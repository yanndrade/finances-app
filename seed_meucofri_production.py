from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_SRC = REPO_ROOT / "packages" / "backend" / "src"
DEFAULT_APP_DATA_DIR = Path(r"C:\Users\yannb\AppData\Local\com.yannb.meucofri")
DEFAULT_SNAPSHOT_PATH = REPO_ROOT / "meucofri-production-seed-2026-03.json"
SEED_MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")

if str(BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(BACKEND_SRC))

from finance_app.application.accounts import ACCOUNT_TYPES  # noqa: E402
from finance_app.application.recurring import PAYMENT_METHODS as RECURRING_PAYMENT_METHODS  # noqa: E402
from finance_app.application.transactions import PAYMENT_METHODS as TRANSACTION_PAYMENT_METHODS  # noqa: E402
from finance_app.domain.cards import allocate_purchase_installments, parse_utc_timestamp  # noqa: E402
from finance_app.interfaces.http.bootstrap import AppServices, build_services  # noqa: E402


class SeedError(Exception):
    pass


@dataclass(frozen=True)
class SeedAccount:
    id: str
    name: str
    type: str
    initial_balance: int


@dataclass(frozen=True)
class SeedIncome:
    id: str
    occurred_at: str
    amount: int
    account_id: str
    payment_method: str
    category_id: str
    description: str | None
    person_id: str | None = None


@dataclass(frozen=True)
class SeedCard:
    id: str
    name: str
    limit: int
    closing_day: int
    due_day: int
    payment_account_id: str | None


@dataclass(frozen=True)
class SeedCardPurchase:
    id: str
    purchase_date: str
    amount: int
    installments_count: int
    category_id: str
    card_id: str
    description: str | None
    person_id: str | None = None


@dataclass(frozen=True)
class SeedRecurringRule:
    id: str
    name: str
    amount: int
    due_day: int
    account_id: str | None
    card_id: str | None
    payment_method: str
    category_id: str
    description: str | None
    confirm_month: str | None = None


@dataclass(frozen=True)
class SeedSnapshot:
    seed_name: str
    seed_month: str
    accounts: tuple[SeedAccount, ...]
    incomes: tuple[SeedIncome, ...]
    cards: tuple[SeedCard, ...]
    card_purchases: tuple[SeedCardPurchase, ...]
    recurring_rules: tuple[SeedRecurringRule, ...]


@dataclass(frozen=True)
class DatabaseState:
    app_db_path: str
    events_db_path: str
    events_count: int
    projection_counts: dict[str, int]

    @property
    def is_empty(self) -> bool:
        return self.events_count == 0 and all(
            count == 0 for count in self.projection_counts.values()
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "app_db_path": self.app_db_path,
            "events_db_path": self.events_db_path,
            "events_count": self.events_count,
            "projection_counts": dict(self.projection_counts),
            "is_empty": self.is_empty,
        }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Standalone production seed for MeuCofri."
    )
    parser.add_argument(
        "--snapshot",
        default=str(DEFAULT_SNAPSHOT_PATH),
        help="Path to the normalized snapshot JSON.",
    )
    parser.add_argument(
        "--app-data-dir",
        default=str(DEFAULT_APP_DATA_DIR),
        help="Path to the MeuCofri app data directory.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate snapshot and target DBs without writing events.",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="Skip DB backup before apply mode.",
    )
    args = parser.parse_args(argv)

    try:
        snapshot = load_snapshot(args.snapshot)
        app_data_dir = Path(args.app_data_dir).resolve()
        app_db_path = app_data_dir / "app.db"
        events_db_path = app_data_dir / "events.db"

        if args.dry_run:
            result = build_seed_plan(
                snapshot,
                app_db_path=app_db_path,
                events_db_path=events_db_path,
            )
            if not bool(result["database_state"]["is_empty"]):  # type: ignore[index]
                raise SeedError(
                    "Target databases are not empty. Dry run validated the snapshot, but apply mode would refuse to continue."
                )
        else:
            running_processes = find_running_meucofri_processes()
            if running_processes:
                details = ", ".join(
                    f"{process['name']} (PID {process['pid']})"
                    for process in running_processes
                )
                raise SeedError(
                    f"Close MeuCofri before seeding. Running processes: {details}."
                )
            backup = None
            if not args.skip_backup:
                backup = create_backup(app_data_dir)
            result = seed_snapshot(
                snapshot,
                app_db_path=app_db_path,
                events_db_path=events_db_path,
            )
            if backup is not None:
                result["backup"] = backup
    except SeedError as exc:
        print(f"SeedError: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def load_snapshot(snapshot_path: str | Path) -> SeedSnapshot:
    path = Path(snapshot_path).resolve()
    try:
        raw_payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SeedError(f"Snapshot file was not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SeedError(f"Snapshot file is not valid JSON: {path}") from exc

    try:
        snapshot = SeedSnapshot(
            seed_name=_read_required_text(raw_payload, "seed_name"),
            seed_month=_read_required_text(raw_payload, "seed_month"),
            accounts=tuple(
                SeedAccount(
                    id=_read_required_text(item, "id"),
                    name=_read_required_text(item, "name"),
                    type=_read_required_text(item, "type"),
                    initial_balance=_read_required_int(item, "initial_balance"),
                )
                for item in _read_required_list(raw_payload, "accounts")
            ),
            incomes=tuple(
                SeedIncome(
                    id=_read_required_text(item, "id"),
                    occurred_at=_read_required_text(item, "occurred_at"),
                    amount=_read_required_int(item, "amount"),
                    account_id=_read_required_text(item, "account_id"),
                    payment_method=_read_required_text(item, "payment_method"),
                    category_id=_read_required_text(item, "category_id"),
                    description=_read_optional_text(item, "description"),
                    person_id=_read_optional_text(item, "person_id"),
                )
                for item in _read_required_list(raw_payload, "incomes")
            ),
            cards=tuple(
                SeedCard(
                    id=_read_required_text(item, "id"),
                    name=_read_required_text(item, "name"),
                    limit=_read_required_int(item, "limit"),
                    closing_day=_read_required_int(item, "closing_day"),
                    due_day=_read_required_int(item, "due_day"),
                    payment_account_id=_read_optional_text(item, "payment_account_id"),
                )
                for item in _read_required_list(raw_payload, "cards")
            ),
            card_purchases=tuple(
                SeedCardPurchase(
                    id=_read_required_text(item, "id"),
                    purchase_date=_read_required_text(item, "purchase_date"),
                    amount=_read_required_int(item, "amount"),
                    installments_count=_read_required_int(item, "installments_count"),
                    category_id=_read_required_text(item, "category_id"),
                    card_id=_read_required_text(item, "card_id"),
                    description=_read_optional_text(item, "description"),
                    person_id=_read_optional_text(item, "person_id"),
                )
                for item in _read_required_list(raw_payload, "card_purchases")
            ),
            recurring_rules=tuple(
                SeedRecurringRule(
                    id=_read_required_text(item, "id"),
                    name=_read_required_text(item, "name"),
                    amount=_read_required_int(item, "amount"),
                    due_day=_read_required_int(item, "due_day"),
                    account_id=_read_optional_text(item, "account_id"),
                    card_id=_read_optional_text(item, "card_id"),
                    payment_method=_read_required_text(item, "payment_method"),
                    category_id=_read_required_text(item, "category_id"),
                    description=_read_optional_text(item, "description"),
                    confirm_month=_read_optional_text(item, "confirm_month"),
                )
                for item in _read_required_list(raw_payload, "recurring_rules")
            ),
        )
    except (TypeError, ValueError) as exc:
        raise SeedError(f"Snapshot payload is malformed: {path}") from exc

    validate_snapshot(snapshot)
    return snapshot


def build_seed_plan(
    snapshot: SeedSnapshot,
    *,
    app_db_path: str | Path,
    events_db_path: str | Path,
) -> dict[str, object]:
    database_state = inspect_database_state(app_db_path, events_db_path)
    reimbursement_total, reimbursement_seed_month = planned_reimbursement_counts(
        snapshot
    )

    return {
        "mode": "dry-run",
        "seed_name": snapshot.seed_name,
        "seed_month": snapshot.seed_month,
        "database_state": database_state.to_dict(),
        "plan": {
            "accounts": len(snapshot.accounts),
            "income_entries": len(snapshot.incomes),
            "cards": len(snapshot.cards),
            "manual_card_purchases": len(snapshot.card_purchases),
            "recurring_rules": len(snapshot.recurring_rules),
            "pending_confirmations": sum(
                1 for rule in snapshot.recurring_rules if rule.confirm_month is not None
            ),
            "projected_card_purchases_after_seed": len(snapshot.card_purchases)
            + sum(
                1
                for rule in snapshot.recurring_rules
                if rule.confirm_month is not None and rule.payment_method == "CARD"
            ),
            "projected_reimbursements_after_seed": reimbursement_total,
            "projected_reimbursements_in_seed_month": reimbursement_seed_month,
        },
    }


def seed_snapshot(
    snapshot: SeedSnapshot,
    *,
    app_db_path: str | Path,
    events_db_path: str | Path,
) -> dict[str, object]:
    database_state = inspect_database_state(app_db_path, events_db_path)
    if not database_state.is_empty:
        raise SeedError(
            "Target databases are not empty. Restore a backup or reset the app before seeding."
        )

    app_path = Path(app_db_path).resolve()
    events_path = Path(events_db_path).resolve()
    app_path.parent.mkdir(parents=True, exist_ok=True)
    events_path.parent.mkdir(parents=True, exist_ok=True)

    services = build_services(
        database_url=build_sqlite_url(app_path),
        event_database_url=build_sqlite_url(events_path),
    )

    for account in snapshot.accounts:
        services.account_service.create_account(
            account_id=account.id,
            name=account.name,
            account_type=account.type,
            initial_balance=account.initial_balance,
        )

    for income in snapshot.incomes:
        services.transaction_service.create_income(
            transaction_id=income.id,
            occurred_at=income.occurred_at,
            amount=income.amount,
            account_id=income.account_id,
            payment_method=income.payment_method,
            category_id=income.category_id,
            description=income.description,
            person_id=income.person_id,
        )

    for card in snapshot.cards:
        services.card_service.create_card(
            card_id=card.id,
            name=card.name,
            limit_amount=card.limit,
            closing_day=card.closing_day,
            due_day=card.due_day,
            payment_account_id=card.payment_account_id,
        )

    for purchase in snapshot.card_purchases:
        services.card_purchase_service.create_card_purchase(
            purchase_id=purchase.id,
            purchase_date=purchase.purchase_date,
            amount=purchase.amount,
            installments_count=purchase.installments_count,
            category_id=purchase.category_id,
            card_id=purchase.card_id,
            description=purchase.description,
            person_id=purchase.person_id,
        )

    for rule in snapshot.recurring_rules:
        services.recurring_service.create_rule(
            rule_id=rule.id,
            name=rule.name,
            amount=rule.amount,
            due_day=rule.due_day,
            account_id=rule.account_id,
            card_id=rule.card_id,
            payment_method=rule.payment_method,
            category_id=rule.category_id,
            description=rule.description,
        )
        if rule.confirm_month is not None:
            services.recurring_service.confirm_pending(f"{rule.id}:{rule.confirm_month}")

    services.projector.run()
    return build_seed_result(
        snapshot=snapshot,
        services=services,
        database_state=database_state,
    )


def build_seed_result(
    *,
    snapshot: SeedSnapshot,
    services: AppServices,
    database_state: DatabaseState,
) -> dict[str, object]:
    accounts = services.account_service.list_accounts()
    cards = services.card_service.list_cards()
    card_purchases = services.card_purchase_service.list_card_purchases()
    recurring_rules = services.recurring_service.list_rules()
    seed_month_pendings = services.recurring_service.list_pendings(month=snapshot.seed_month)
    reimbursements = services.reimbursement_service.list_reimbursements()
    seed_month_reimbursements = services.reimbursement_service.list_reimbursements(
        month=snapshot.seed_month
    )
    transactions = services.transaction_service.list_transactions()

    expected_balances = expected_account_balances(snapshot)
    actual_balances = {
        str(account["account_id"]): int(account["current_balance"])
        for account in accounts
    }
    if actual_balances != expected_balances:
        raise SeedError(
            f"Projected balances do not match the snapshot. Expected {expected_balances}, got {actual_balances}."
        )

    if len(accounts) != len(snapshot.accounts):
        raise SeedError("Projected account count does not match the snapshot.")
    if len(cards) != len(snapshot.cards):
        raise SeedError("Projected card count does not match the snapshot.")

    expected_purchase_total = len(snapshot.card_purchases) + sum(
        1
        for rule in snapshot.recurring_rules
        if rule.confirm_month is not None and rule.payment_method == "CARD"
    )
    if len(card_purchases) != expected_purchase_total:
        raise SeedError(
            f"Projected card purchase count does not match the seed plan. Expected {expected_purchase_total}, got {len(card_purchases)}."
        )

    if len(recurring_rules) != len(snapshot.recurring_rules):
        raise SeedError("Projected recurring rule count does not match the snapshot.")

    validate_confirmed_pendings(snapshot, seed_month_pendings)

    expected_reimbursement_total, expected_seed_month_reimbursements = (
        planned_reimbursement_counts(snapshot)
    )
    if len(reimbursements) != expected_reimbursement_total:
        raise SeedError(
            f"Projected reimbursement count does not match the seed plan. Expected {expected_reimbursement_total}, got {len(reimbursements)}."
        )
    if len(seed_month_reimbursements) != expected_seed_month_reimbursements:
        raise SeedError(
            "Projected reimbursement count for the seed month does not match the seed plan."
        )

    invoice_payment_transactions = [
        transaction
        for transaction in transactions
        if str(transaction["category_id"]) == "invoice_payment"
    ]
    if invoice_payment_transactions:
        raise SeedError("Invoice payment transactions were created, but the seed should omit them.")

    return {
        "mode": "apply",
        "seed_name": snapshot.seed_name,
        "seed_month": snapshot.seed_month,
        "database_state_before": database_state.to_dict(),
        "created": {
            "accounts": len(snapshot.accounts),
            "income_entries": len(snapshot.incomes),
            "cards": len(snapshot.cards),
            "manual_card_purchases": len(snapshot.card_purchases),
            "recurring_rules": len(snapshot.recurring_rules),
            "pending_confirmations": sum(
                1 for rule in snapshot.recurring_rules if rule.confirm_month is not None
            ),
        },
        "totals_after_seed": {
            "accounts": len(accounts),
            "cards": len(cards),
            "income_entries": len(
                [transaction for transaction in transactions if transaction["type"] == "income"]
            ),
            "card_purchases": len(card_purchases),
            "recurring_rules": len(recurring_rules),
            "pendings_in_seed_month": len(seed_month_pendings),
            "confirmed_pendings_in_seed_month": len(
                [pending for pending in seed_month_pendings if pending["status"] == "confirmed"]
            ),
            "reimbursements": len(reimbursements),
            "reimbursements_in_seed_month": len(seed_month_reimbursements),
        },
        "balances": actual_balances,
        "reimbursements_by_person": summarize_reimbursements_by_person(reimbursements),
    }


def validate_snapshot(snapshot: SeedSnapshot) -> None:
    if not SEED_MONTH_PATTERN.fullmatch(snapshot.seed_month):
        raise SeedError("seed_month must use YYYY-MM format.")

    validate_unique_ids(snapshot.accounts, "account")
    validate_unique_ids(snapshot.incomes, "income")
    validate_unique_ids(snapshot.cards, "card")
    validate_unique_ids(snapshot.card_purchases, "card purchase")
    validate_unique_ids(snapshot.recurring_rules, "recurring rule")

    account_ids = {account.id for account in snapshot.accounts}
    card_ids = {card.id for card in snapshot.cards}

    for account in snapshot.accounts:
        if account.type not in ACCOUNT_TYPES:
            raise SeedError(f"Unsupported account type '{account.type}' in account '{account.id}'.")
        if account.initial_balance < 0:
            raise SeedError(f"initial_balance must be at least zero in account '{account.id}'.")

    for income in snapshot.incomes:
        validate_utc_timestamp(income.occurred_at, f"income '{income.id}'")
        if income.amount <= 0:
            raise SeedError(f"amount must be greater than zero in income '{income.id}'.")
        if income.account_id not in account_ids:
            raise SeedError(f"income '{income.id}' references unknown account '{income.account_id}'.")
        if income.payment_method not in TRANSACTION_PAYMENT_METHODS:
            raise SeedError(
                f"Unsupported payment_method '{income.payment_method}' in income '{income.id}'."
            )
        if not income.category_id:
            raise SeedError(f"category_id is required in income '{income.id}'.")

    for card in snapshot.cards:
        if card.limit <= 0:
            raise SeedError(f"limit must be greater than zero in card '{card.id}'.")
        if not 1 <= card.closing_day <= 28:
            raise SeedError(f"closing_day must be between 1 and 28 in card '{card.id}'.")
        if not 1 <= card.due_day <= 28:
            raise SeedError(f"due_day must be between 1 and 28 in card '{card.id}'.")
        if card.payment_account_id is not None and card.payment_account_id not in account_ids:
            raise SeedError(
                f"card '{card.id}' references unknown payment account '{card.payment_account_id}'."
            )

    for purchase in snapshot.card_purchases:
        validate_utc_timestamp(purchase.purchase_date, f"card purchase '{purchase.id}'")
        if purchase.amount <= 0:
            raise SeedError(f"amount must be greater than zero in card purchase '{purchase.id}'.")
        if purchase.installments_count <= 0:
            raise SeedError(
                f"installments_count must be at least 1 in card purchase '{purchase.id}'."
            )
        if purchase.card_id not in card_ids:
            raise SeedError(
                f"card purchase '{purchase.id}' references unknown card '{purchase.card_id}'."
            )
        if not purchase.category_id:
            raise SeedError(f"category_id is required in card purchase '{purchase.id}'.")

    for rule in snapshot.recurring_rules:
        if rule.amount <= 0:
            raise SeedError(f"amount must be greater than zero in recurring rule '{rule.id}'.")
        if not 1 <= rule.due_day <= 28:
            raise SeedError(f"due_day must be between 1 and 28 in recurring rule '{rule.id}'.")
        if rule.payment_method not in RECURRING_PAYMENT_METHODS:
            raise SeedError(
                f"Unsupported payment_method '{rule.payment_method}' in recurring rule '{rule.id}'."
            )
        if not rule.category_id:
            raise SeedError(f"category_id is required in recurring rule '{rule.id}'.")
        if rule.confirm_month is not None and not SEED_MONTH_PATTERN.fullmatch(rule.confirm_month):
            raise SeedError(f"confirm_month must use YYYY-MM format in recurring rule '{rule.id}'.")
        if rule.payment_method == "CARD":
            if rule.card_id is None:
                raise SeedError(f"card_id is required in recurring rule '{rule.id}'.")
            if rule.account_id is not None:
                raise SeedError(
                    f"account_id must be empty when payment_method is CARD in recurring rule '{rule.id}'."
                )
            if rule.card_id not in card_ids:
                raise SeedError(
                    f"recurring rule '{rule.id}' references unknown card '{rule.card_id}'."
                )
        else:
            if rule.account_id is None:
                raise SeedError(
                    f"account_id is required for non-card recurring rule '{rule.id}'."
                )
            if rule.account_id not in account_ids:
                raise SeedError(
                    f"recurring rule '{rule.id}' references unknown account '{rule.account_id}'."
                )
            if rule.card_id is not None:
                raise SeedError(
                    f"card_id must be empty for non-card recurring rule '{rule.id}'."
                )


def inspect_database_state(
    app_db_path: str | Path,
    events_db_path: str | Path,
) -> DatabaseState:
    app_path = Path(app_db_path).resolve()
    events_path = Path(events_db_path).resolve()
    projection_tables = (
        "accounts",
        "cards",
        "transactions",
        "card_purchases",
        "recurring_rules",
        "pendings",
        "reimbursements",
    )

    projection_counts = {
        table_name: read_table_count(app_path, table_name)
        for table_name in projection_tables
    }
    events_count = read_table_count(events_path, "events")

    return DatabaseState(
        app_db_path=str(app_path),
        events_db_path=str(events_path),
        events_count=events_count,
        projection_counts=projection_counts,
    )


def planned_reimbursement_counts(snapshot: SeedSnapshot) -> tuple[int, int]:
    card_by_id = {card.id: card for card in snapshot.cards}
    reimbursement_total = 0
    reimbursement_seed_month = 0

    for purchase in snapshot.card_purchases:
        if purchase.person_id is None:
            continue

        card = card_by_id[purchase.card_id]
        allocations = allocate_purchase_installments(
            purchase_date=purchase.purchase_date,
            total_amount=purchase.amount,
            installments_count=purchase.installments_count,
            closing_day=card.closing_day,
            due_day=card.due_day,
        )
        visible_allocations = [allocation for allocation in allocations if allocation.amount > 0]
        reimbursement_total += len(visible_allocations)
        reimbursement_seed_month += sum(
            1
            for allocation in visible_allocations
            if allocation.closing_date.startswith(snapshot.seed_month)
        )

    return reimbursement_total, reimbursement_seed_month


def expected_account_balances(snapshot: SeedSnapshot) -> dict[str, int]:
    balances = {account.id: account.initial_balance for account in snapshot.accounts}
    for income in snapshot.incomes:
        balances[income.account_id] = balances.get(income.account_id, 0) + income.amount
    return balances


def validate_confirmed_pendings(
    snapshot: SeedSnapshot,
    pendings: list[dict[str, str | int | None]],
) -> None:
    pending_by_id = {str(pending["pending_id"]): pending for pending in pendings}
    for rule in snapshot.recurring_rules:
        if rule.confirm_month is None:
            continue
        pending_id = f"{rule.id}:{rule.confirm_month}"
        pending = pending_by_id.get(pending_id)
        if pending is None:
            raise SeedError(f"Expected pending '{pending_id}' was not materialized.")
        if str(pending["status"]) != "confirmed":
            raise SeedError(f"Expected pending '{pending_id}' to be confirmed.")
        if pending["transaction_id"] is None:
            raise SeedError(f"Expected pending '{pending_id}' to reference a created transaction.")


def summarize_reimbursements_by_person(
    reimbursements: list[dict[str, str | int | None]],
) -> dict[str, dict[str, int]]:
    summary: dict[str, dict[str, int]] = {}
    for reimbursement in reimbursements:
        person_id = str(reimbursement["person_id"])
        bucket = summary.setdefault(person_id, {"count": 0, "amount": 0})
        bucket["count"] += 1
        bucket["amount"] += int(reimbursement["amount"])
    return summary


def create_backup(app_data_dir: Path) -> dict[str, object]:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = app_data_dir / "seed-backups" / timestamp
    backup_dir.mkdir(parents=True, exist_ok=True)

    copied_files: list[str] = []
    for file_name in ("app.db", "events.db", "events.db-wal", "events.db-shm"):
        source = app_data_dir / file_name
        if not source.exists():
            continue
        shutil.copy2(source, backup_dir / file_name)
        copied_files.append(file_name)

    return {
        "directory": str(backup_dir),
        "files": copied_files,
    }


def find_running_meucofri_processes() -> list[dict[str, object]]:
    powershell_script = """
$matches = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -in @('meucofri-desktop.exe', 'meucofri_desktop.exe') -or
    ($_.Name -eq 'backend.exe' -and $_.ExecutablePath -like '*\\MeuCofri\\*')
} | Select-Object ProcessId, Name, ExecutablePath
if ($matches) {
    $matches | ConvertTo-Json -Compress
}
"""
    completed = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-Command",
            powershell_script,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise SeedError("Failed to inspect running MeuCofri processes.")

    raw_output = completed.stdout.strip()
    if not raw_output:
        return []

    try:
        payload = json.loads(raw_output)
    except json.JSONDecodeError as exc:
        raise SeedError("Failed to parse running-process inspection output.") from exc

    if isinstance(payload, dict):
        payload = [payload]
    if not isinstance(payload, list):
        raise SeedError("Unexpected running-process inspection payload.")

    results: list[dict[str, object]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        results.append(
            {
                "pid": int(item.get("ProcessId", 0)),
                "name": str(item.get("Name", "")),
                "path": str(item.get("ExecutablePath", "")),
            }
        )
    return results


def validate_unique_ids(items: tuple[object, ...], item_label: str) -> None:
    seen: set[str] = set()
    for item in items:
        item_id = str(getattr(item, "id"))
        if item_id in seen:
            raise SeedError(f"Duplicate {item_label} id '{item_id}' in snapshot.")
        seen.add(item_id)


def validate_utc_timestamp(value: str, label: str) -> None:
    try:
        parse_utc_timestamp(value)
    except ValueError as exc:
        raise SeedError(f"{label} must use a UTC ISO 8601 timestamp.") from exc


def read_table_count(database_path: Path, table_name: str) -> int:
    if not database_path.exists():
        return 0

    try:
        with sqlite3.connect(database_path) as connection:
            exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
                (table_name,),
            ).fetchone()
            if exists is None:
                return 0
            row = connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()
    except sqlite3.DatabaseError as exc:
        raise SeedError(f"Failed to inspect SQLite database '{database_path}'.") from exc

    if row is None:
        return 0
    return int(row[0])


def build_sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def read_required_list(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise TypeError(f"'{key}' must be a list.")
    return value


def _read_required_list(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    return read_required_list(payload, key)


def read_required_text(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"'{key}' must be a non-empty string.")
    return value.strip()


def _read_required_text(payload: dict[str, Any], key: str) -> str:
    return read_required_text(payload, key)


def read_optional_text(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"'{key}' must be a string or null.")
    trimmed = value.strip()
    return trimmed or None


def _read_optional_text(payload: dict[str, Any], key: str) -> str | None:
    return read_optional_text(payload, key)


def read_required_int(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int):
        raise ValueError(f"'{key}' must be an integer.")
    return value


def _read_required_int(payload: dict[str, Any], key: str) -> int:
    return read_required_int(payload, key)


if __name__ == "__main__":
    raise SystemExit(main())
