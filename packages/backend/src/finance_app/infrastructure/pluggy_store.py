from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from finance_app.infrastructure.db import get_engine


class PluggyBase(DeclarativeBase):
    """Metadata for non-secret Pluggy connection state stored in app.db."""


class PluggyItemRecord(PluggyBase):
    __tablename__ = "pluggy_items"

    item_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    client_user_id: Mapped[str] = mapped_column(String(200), nullable=False)
    connector_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    execution_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    last_synced_at: Mapped[str | None] = mapped_column(String, nullable=True)


class PluggyAccountLinkRecord(PluggyBase):
    """Binds a Pluggy account to the local account, card or card holder.

    The link is the source of truth for where imported entries land. Numbers and
    names are cached only to drive the pairing wizard: a connector that does not
    expose them still works, it just has to be paired by hand.
    """

    __tablename__ = "pluggy_account_links"

    pluggy_account_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    local_account_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    local_card_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    local_holder_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ignored: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    import_since: Mapped[str | None] = mapped_column(String(10), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(80), nullable=True)
    holder_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Two accounts at the same bank can share a name and a number; the subtype
    # and the balance are what tell a current account from a savings one.
    subtype: Mapped[str | None] = mapped_column(String(40), nullable=True)
    balance: Mapped[int | None] = mapped_column(Integer, nullable=True)
    credit_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


@dataclass(frozen=True)
class PluggyAccountLinkState:
    pluggy_account_id: str
    item_id: str
    kind: str
    local_account_id: str | None
    local_card_id: str | None
    local_holder_id: str | None
    ignored: bool
    import_since: str | None
    display_name: str | None
    number: str | None
    brand: str | None
    holder_type: str | None
    subtype: str | None
    balance: int | None
    credit_limit: int | None
    created_at: str
    updated_at: str

    @property
    def is_linked(self) -> bool:
        return any(
            (self.local_account_id, self.local_card_id, self.local_holder_id)
        )


class PluggyStagedEntryRecord(PluggyBase):
    """A proposed entry waiting for review.

    Nothing reaches the event store from here on its own. Keeping the raw
    payload alongside the proposal means the translation can be reworked and
    replayed without asking Pluggy for the data again.
    """

    __tablename__ = "pluggy_staged_entries"

    entry_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    pluggy_account_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    group_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    occurred_at: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    raw_json: Mapped[str] = mapped_column(Text, nullable=False)
    proposal_json: Mapped[str] = mapped_column(Text, nullable=False)
    match_kind: Mapped[str] = mapped_column(String(40), nullable=False, default="new")
    matched_local_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    decision: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    decided_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_local_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    revised: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


@dataclass(frozen=True)
class PluggyStagedEntryState:
    entry_id: str
    item_id: str
    pluggy_account_id: str
    external_id: str
    kind: str
    group_key: str | None
    occurred_at: str
    amount: int
    title: str | None
    raw: dict
    proposal: dict
    match_kind: str
    matched_local_id: str | None
    decision: str
    decided_at: str | None
    created_local_id: str | None
    content_hash: str
    revised: bool

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "item_id": self.item_id,
            "pluggy_account_id": self.pluggy_account_id,
            "external_id": self.external_id,
            "kind": self.kind,
            "group_key": self.group_key,
            "occurred_at": self.occurred_at,
            "amount": self.amount,
            "title": self.title,
            "proposal": self.proposal,
            "match_kind": self.match_kind,
            "matched_local_id": self.matched_local_id,
            "decision": self.decision,
            "decided_at": self.decided_at,
            "created_local_id": self.created_local_id,
            "revised": self.revised,
        }


class PluggyImportRuleRecord(PluggyBase):
    """What a description always means, once the user has said so.

    Only ever used to pre-fill the review. A rule never accepts anything: the
    decision stays a click, by design.
    """

    __tablename__ = "pluggy_import_rules"

    rule_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    match_value: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(300), nullable=True)
    set_category_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    set_person_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    set_card_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    set_holder_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    set_account_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)


@dataclass(frozen=True)
class PluggyImportRuleState:
    rule_id: str
    match_value: str
    label: str | None
    set_category_id: str | None
    set_person_id: str | None
    set_card_id: str | None
    set_holder_id: str | None
    set_account_id: str | None
    hit_count: int
    created_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "match_value": self.match_value,
            "label": self.label,
            "set_category_id": self.set_category_id,
            "set_person_id": self.set_person_id,
            "set_card_id": self.set_card_id,
            "set_holder_id": self.set_holder_id,
            "set_account_id": self.set_account_id,
            "hit_count": self.hit_count,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass(frozen=True)
class PluggyItemState:
    item_id: str
    client_user_id: str
    connector_name: str | None
    status: str | None
    execution_status: str | None
    error_code: str | None
    error_message: str | None
    provider_message: str | None
    created_at: str
    updated_at: str
    last_synced_at: str | None


class PluggyStore:
    def __init__(self, database_url: str | None = None) -> None:
        self._engine = get_engine(database_url)
        self._session_factory = sessionmaker(
            bind=self._engine,
            autoflush=False,
            autocommit=False,
        )

    def upsert_item(
        self,
        *,
        item_id: str,
        client_user_id: str,
        connector_name: str | None = None,
        status: str | None = None,
        execution_status: str | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
        provider_message: str | None = None,
    ) -> PluggyItemState:
        self._bootstrap()
        now = self._utc_now()
        with self._session_factory.begin() as session:
            record = session.get(PluggyItemRecord, item_id)
            if record is None:
                record = PluggyItemRecord(
                    item_id=item_id,
                    client_user_id=client_user_id,
                    created_at=now,
                    updated_at=now,
                )
                session.add(record)
            record.client_user_id = client_user_id
            record.connector_name = connector_name or record.connector_name
            record.status = status
            record.execution_status = execution_status
            record.error_code = error_code
            record.error_message = error_message
            record.provider_message = provider_message
            record.updated_at = now
        state = self.get_item(item_id)
        assert state is not None
        return state

    def mark_synced(self, item_id: str) -> PluggyItemState:
        self._bootstrap()
        now = self._utc_now()
        with self._session_factory.begin() as session:
            record = session.get(PluggyItemRecord, item_id)
            if record is None:
                raise KeyError(item_id)
            record.last_synced_at = now
            record.updated_at = now
        state = self.get_item(item_id)
        assert state is not None
        return state

    def get_item(self, item_id: str) -> PluggyItemState | None:
        self._bootstrap()
        with self._session_factory() as session:
            record = session.get(PluggyItemRecord, item_id)
            return self._to_state(record) if record is not None else None

    def list_items(self) -> list[PluggyItemState]:
        self._bootstrap()
        with self._session_factory() as session:
            records = session.query(PluggyItemRecord).order_by(
                PluggyItemRecord.created_at
            )
            return [self._to_state(record) for record in records]

    def upsert_discovered_account(
        self,
        *,
        pluggy_account_id: str,
        item_id: str,
        kind: str,
        display_name: str | None = None,
        number: str | None = None,
        brand: str | None = None,
        holder_type: str | None = None,
        subtype: str | None = None,
        balance: int | None = None,
        credit_limit: int | None = None,
    ) -> PluggyAccountLinkState:
        """Record an account seen at Pluggy without touching its link decision.

        Re-running a sync must never undo a pairing the user already made, so
        only the descriptive cache is refreshed here.
        """
        self._bootstrap()
        now = self._utc_now()
        with self._session_factory.begin() as session:
            record = session.get(PluggyAccountLinkRecord, pluggy_account_id)
            if record is None:
                record = PluggyAccountLinkRecord(
                    pluggy_account_id=pluggy_account_id,
                    item_id=item_id,
                    kind=kind,
                    created_at=now,
                    updated_at=now,
                )
                session.add(record)
            record.item_id = item_id
            record.kind = kind
            record.display_name = display_name or record.display_name
            record.number = number or record.number
            record.brand = brand or record.brand
            record.holder_type = holder_type or record.holder_type
            record.subtype = subtype or record.subtype
            record.balance = balance if balance is not None else record.balance
            record.credit_limit = (
                credit_limit if credit_limit is not None else record.credit_limit
            )
            record.updated_at = now
        state = self.get_account_link(pluggy_account_id)
        assert state is not None
        return state

    def set_account_link(
        self,
        *,
        pluggy_account_id: str,
        local_account_id: str | None = None,
        local_card_id: str | None = None,
        local_holder_id: str | None = None,
        ignored: bool = False,
        import_since: str | None = None,
    ) -> PluggyAccountLinkState:
        self._bootstrap()
        now = self._utc_now()
        with self._session_factory.begin() as session:
            record = session.get(PluggyAccountLinkRecord, pluggy_account_id)
            if record is None:
                raise KeyError(pluggy_account_id)
            record.local_account_id = local_account_id
            record.local_card_id = local_card_id
            record.local_holder_id = local_holder_id
            record.ignored = ignored
            record.import_since = import_since
            record.updated_at = now
        state = self.get_account_link(pluggy_account_id)
        assert state is not None
        return state

    def get_account_link(
        self,
        pluggy_account_id: str,
    ) -> PluggyAccountLinkState | None:
        self._bootstrap()
        with self._session_factory() as session:
            record = session.get(PluggyAccountLinkRecord, pluggy_account_id)
            return self._to_link_state(record) if record is not None else None

    def list_account_links(
        self,
        *,
        item_id: str | None = None,
    ) -> list[PluggyAccountLinkState]:
        self._bootstrap()
        with self._session_factory() as session:
            query = session.query(PluggyAccountLinkRecord)
            if item_id is not None:
                query = query.filter(PluggyAccountLinkRecord.item_id == item_id)
            records = query.order_by(
                PluggyAccountLinkRecord.kind,
                PluggyAccountLinkRecord.display_name,
            )
            return [self._to_link_state(record) for record in records]

    def _to_link_state(
        self,
        record: PluggyAccountLinkRecord,
    ) -> PluggyAccountLinkState:
        return PluggyAccountLinkState(
            pluggy_account_id=record.pluggy_account_id,
            item_id=record.item_id,
            kind=record.kind,
            local_account_id=record.local_account_id,
            local_card_id=record.local_card_id,
            local_holder_id=record.local_holder_id,
            ignored=record.ignored,
            import_since=record.import_since,
            display_name=record.display_name,
            number=record.number,
            brand=record.brand,
            holder_type=record.holder_type,
            subtype=record.subtype,
            balance=record.balance,
            credit_limit=record.credit_limit,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    def stage_entry(
        self,
        *,
        entry_id: str,
        item_id: str,
        pluggy_account_id: str,
        external_id: str,
        kind: str,
        group_key: str | None,
        occurred_at: str,
        amount: int,
        title: str | None,
        raw: dict,
        proposal: dict,
        content_hash: str,
        match_kind: str = "new",
        matched_local_id: str | None = None,
    ) -> PluggyStagedEntryState:
        """Record a proposal, or refresh one that is still pending.

        An entry the user already decided on is left alone, so re-syncing never
        resurrects something that was accepted or ignored. The exception is a
        revision at Pluggy: a different content hash reopens it for review
        instead of letting the stale decision stand — unless the revision still
        resolves to the very transaction this entry already created (a Pix
        merely settling from PENDING to POSTED, say), in which case reopening
        would only ask the user to reconfirm something already recorded.
        """
        self._bootstrap()
        now = self._utc_now()
        with self._session_factory.begin() as session:
            record = session.get(PluggyStagedEntryRecord, entry_id)
            if record is None:
                record = PluggyStagedEntryRecord(
                    entry_id=entry_id,
                    item_id=item_id,
                    pluggy_account_id=pluggy_account_id,
                    external_id=external_id,
                    created_at=now,
                )
                session.add(record)
            elif record.decision != "pending":
                if record.content_hash == content_hash:
                    return self._require_entry(entry_id)
                if (
                    record.created_local_id is None
                    or record.created_local_id != matched_local_id
                ):
                    record.revised = True
                    record.decision = "pending"
                    record.decided_at = None

            record.kind = kind
            record.group_key = group_key
            record.occurred_at = occurred_at
            record.amount = amount
            record.title = title
            record.raw_json = json.dumps(raw, ensure_ascii=False)
            record.proposal_json = json.dumps(proposal, ensure_ascii=False)
            record.content_hash = content_hash
            record.match_kind = match_kind
            record.matched_local_id = matched_local_id
            record.updated_at = now
        return self._require_entry(entry_id)

    def decide_entry(
        self,
        *,
        entry_id: str,
        decision: str,
        created_local_id: str | None = None,
        proposal: dict | None = None,
    ) -> PluggyStagedEntryState:
        self._bootstrap()
        now = self._utc_now()
        with self._session_factory.begin() as session:
            record = session.get(PluggyStagedEntryRecord, entry_id)
            if record is None:
                raise KeyError(entry_id)
            record.decision = decision
            record.decided_at = now
            record.created_local_id = created_local_id
            record.revised = False
            if proposal is not None:
                record.proposal_json = json.dumps(proposal, ensure_ascii=False)
            record.updated_at = now
        return self._require_entry(entry_id)

    def get_entry(self, entry_id: str) -> PluggyStagedEntryState | None:
        self._bootstrap()
        with self._session_factory() as session:
            record = session.get(PluggyStagedEntryRecord, entry_id)
            return self._to_entry_state(record) if record is not None else None

    def list_entries(
        self,
        *,
        decision: str | None = None,
        kind: str | None = None,
        pluggy_account_id: str | None = None,
        include_covered: bool = False,
    ) -> list[PluggyStagedEntryState]:
        self._bootstrap()
        with self._session_factory() as session:
            query = session.query(PluggyStagedEntryRecord)
            if decision is not None:
                query = query.filter(PluggyStagedEntryRecord.decision == decision)
            if kind is not None:
                query = query.filter(PluggyStagedEntryRecord.kind == kind)
            if pluggy_account_id is not None:
                query = query.filter(
                    PluggyStagedEntryRecord.pluggy_account_id == pluggy_account_id
                )
            if not include_covered:
                query = query.filter(
                    PluggyStagedEntryRecord.match_kind != "covered_by_group"
                )
            records = query.order_by(
                PluggyStagedEntryRecord.occurred_at.desc(),
                PluggyStagedEntryRecord.entry_id.asc(),
            )
            return [self._to_entry_state(record) for record in records]

    def upsert_import_rule(
        self,
        *,
        match_value: str,
        label: str | None = None,
        set_category_id: str | None = None,
        set_person_id: str | None = None,
        set_card_id: str | None = None,
        set_holder_id: str | None = None,
        set_account_id: str | None = None,
    ) -> PluggyImportRuleState:
        """One rule per description; teaching it again replaces it."""
        self._bootstrap()
        now = self._utc_now()
        rule_id = hashlib.sha1(match_value.encode("utf-8")).hexdigest()[:32]
        with self._session_factory.begin() as session:
            record = session.get(PluggyImportRuleRecord, rule_id)
            if record is None:
                record = PluggyImportRuleRecord(
                    rule_id=rule_id,
                    match_value=match_value,
                    hit_count=0,
                    created_at=now,
                    updated_at=now,
                )
                session.add(record)
            record.label = label or record.label
            record.set_category_id = set_category_id
            record.set_person_id = set_person_id
            record.set_card_id = set_card_id
            record.set_holder_id = set_holder_id
            record.set_account_id = set_account_id
            record.updated_at = now
        state = self.get_import_rule(match_value)
        assert state is not None
        return state

    def get_import_rule(self, match_value: str) -> PluggyImportRuleState | None:
        self._bootstrap()
        rule_id = hashlib.sha1(match_value.encode("utf-8")).hexdigest()[:32]
        with self._session_factory() as session:
            record = session.get(PluggyImportRuleRecord, rule_id)
            return self._to_rule_state(record) if record is not None else None

    def list_import_rules(self) -> list[PluggyImportRuleState]:
        self._bootstrap()
        with self._session_factory() as session:
            records = session.query(PluggyImportRuleRecord).order_by(
                PluggyImportRuleRecord.hit_count.desc(),
                PluggyImportRuleRecord.match_value.asc(),
            )
            return [self._to_rule_state(record) for record in records]

    def delete_import_rule(self, rule_id: str) -> bool:
        self._bootstrap()
        with self._session_factory.begin() as session:
            record = session.get(PluggyImportRuleRecord, rule_id)
            if record is None:
                return False
            session.delete(record)
            return True

    def count_import_rule_hit(self, rule_id: str) -> None:
        self._bootstrap()
        with self._session_factory.begin() as session:
            record = session.get(PluggyImportRuleRecord, rule_id)
            if record is not None:
                record.hit_count += 1

    def _to_rule_state(self, record: PluggyImportRuleRecord) -> PluggyImportRuleState:
        return PluggyImportRuleState(
            rule_id=record.rule_id,
            match_value=record.match_value,
            label=record.label,
            set_category_id=record.set_category_id,
            set_person_id=record.set_person_id,
            set_card_id=record.set_card_id,
            set_holder_id=record.set_holder_id,
            set_account_id=record.set_account_id,
            hit_count=record.hit_count,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    def count_pending_entries(self) -> int:
        self._bootstrap()
        with self._session_factory() as session:
            return (
                session.query(PluggyStagedEntryRecord)
                .filter(PluggyStagedEntryRecord.decision == "pending")
                .filter(PluggyStagedEntryRecord.match_kind != "covered_by_group")
                .count()
            )

    def _require_entry(self, entry_id: str) -> PluggyStagedEntryState:
        state = self.get_entry(entry_id)
        assert state is not None
        return state

    def _to_entry_state(
        self,
        record: PluggyStagedEntryRecord,
    ) -> PluggyStagedEntryState:
        return PluggyStagedEntryState(
            entry_id=record.entry_id,
            item_id=record.item_id,
            pluggy_account_id=record.pluggy_account_id,
            external_id=record.external_id,
            kind=record.kind,
            group_key=record.group_key,
            occurred_at=record.occurred_at,
            amount=record.amount,
            title=record.title,
            raw=json.loads(record.raw_json),
            proposal=json.loads(record.proposal_json),
            match_kind=record.match_kind,
            matched_local_id=record.matched_local_id,
            decision=record.decision,
            decided_at=record.decided_at,
            created_local_id=record.created_local_id,
            content_hash=record.content_hash,
            revised=record.revised,
        )

    def _bootstrap(self) -> None:
        PluggyBase.metadata.create_all(self._engine)
        self._add_missing_columns()

    def _add_missing_columns(self) -> None:
        """Add columns introduced after a table already existed.

        ``create_all`` only creates missing tables, so a column added later
        would never reach an install that connected before it existed. These
        tables cache what Pluggy exposes, so a new column starts empty and
        fills on the next sync — there is nothing to backfill.

        Only nullable columns can be added this way, which is the only shape
        SQLite accepts without a default anyway.
        """
        with self._engine.begin() as connection:
            for table in PluggyBase.metadata.sorted_tables:
                present = {
                    row[1]
                    for row in connection.exec_driver_sql(
                        f'PRAGMA table_info("{table.name}")'
                    )
                }
                if not present:
                    continue
                for column in table.columns:
                    if column.name in present or not column.nullable:
                        continue
                    column_type = column.type.compile(self._engine.dialect)
                    connection.exec_driver_sql(
                        f'ALTER TABLE "{table.name}" '
                        f'ADD COLUMN "{column.name}" {column_type}'
                    )

    def _to_state(self, record: PluggyItemRecord) -> PluggyItemState:
        return PluggyItemState(
            item_id=record.item_id,
            client_user_id=record.client_user_id,
            connector_name=record.connector_name,
            status=record.status,
            execution_status=record.execution_status,
            error_code=record.error_code,
            error_message=record.error_message,
            provider_message=record.provider_message,
            created_at=record.created_at,
            updated_at=record.updated_at,
            last_synced_at=record.last_synced_at,
        )

    def _utc_now(self) -> str:
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
