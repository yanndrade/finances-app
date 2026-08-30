import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Landmark,
  Link2,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import type { PluggyInboxEntry } from "../../lib/api";
import {
  acceptPluggyEntry,
  fetchPluggyInbox,
  ignorePluggyEntry,
  linkPluggyEntry,
} from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { cn } from "../../lib/utils";

type Filter = "all" | "new" | "duplicates";

const KIND_LABELS: Record<string, string> = {
  bank_transaction: "Conta",
  card_purchase: "Cartão",
  invoice_payment: "Pagamento de fatura",
  transfer: "Transferência",
  investment_movement: "Investimento",
};

const ACCEPTABLE_KINDS = new Set([
  "bank_transaction",
  "card_purchase",
  "invoice_payment",
  "transfer",
  "investment_movement",
]);

/**
 * A bill payment settles an invoice and a transfer only moves money between
 * two accounts the user already picked; neither carries a category.
 */
const CATEGORY_KINDS = new Set(["bank_transaction", "card_purchase"]);

function isAcceptable(entry: PluggyInboxEntry): boolean {
  return ACCEPTABLE_KINDS.has(entry.kind) && !entry.proposal.skip_reason;
}

function needsCategory(entry: PluggyInboxEntry): boolean {
  return CATEGORY_KINDS.has(entry.kind);
}

/**
 * Whether money comes in or goes out. Everything on a card is a charge, and a
 * transfer between own accounts is neither, so it stays neutral.
 */
function direction(entry: PluggyInboxEntry): "in" | "out" | "neutral" {
  if (entry.kind === "transfer") return "neutral";
  if (entry.kind === "bank_transaction") {
    return payloadString(entry, "transaction_type") === "income" ? "in" : "out";
  }
  if (entry.kind === "investment_movement") {
    return payloadString(entry, "movement_type") === "venda" ? "in" : "out";
  }
  return "out";
}

function payloadString(entry: PluggyInboxEntry, key: string): string | null {
  const value = entry.proposal.payload[key];
  return typeof value === "string" && value ? value : null;
}

function payloadNumber(entry: PluggyInboxEntry, key: string): number | null {
  const value = entry.proposal.payload[key];
  return typeof value === "number" ? value : null;
}

/**
 * What the charge was before conversion, on a purchase abroad. The description
 * rarely says a charge came from another country, and the converted value is
 * the only figure that reaches the ledger, so the original and the rate that
 * produced it are worth showing next to it.
 */
function describeOriginalCurrency(entry: PluggyInboxEntry): string | null {
  const currency = payloadString(entry, "original_currency");
  const original = payloadNumber(entry, "original_amount");
  if (!currency || !original) return null;

  // The default symbol, not the narrow one: narrow renders USD as "$", which
  // beside a column of reais reads as the amount that was actually billed.
  // An unrecognised code is a RangeError, and one bad charge must not take the
  // whole queue down with it.
  let value: string;
  try {
    value = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(original / 100);
  } catch {
    value = `${currency} ${(original / 100).toFixed(2)}`;
  }
  const rate = entry.amount / original;
  return `${value} · câmbio ${rate.toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
}

/**
 * What the entry would do, for the kinds where the amount and description do
 * not say it: which invoice a payment settles, and which way money moves.
 */
function describeDestination(
  entry: PluggyInboxEntry,
  names: Record<string, string>,
): string | null {
  const label = (id: string | null) => (id ? (names[id] ?? id) : null);

  if (entry.kind === "transfer") {
    const from = label(payloadString(entry, "from_account_id"));
    const to = label(payloadString(entry, "to_account_id"));
    return from && to ? `${from} → ${to}` : null;
  }

  if (entry.kind === "investment_movement") {
    const account = label(payloadString(entry, "account_id"));
    const ticker = payloadString(entry, "asset_ticker");
    const movement =
      payloadString(entry, "movement_type") === "venda" ? "Venda" : "Compra";
    const what = [movement, ticker].filter(Boolean).join(" · ");
    return account ? `${what} — via ${account}` : what;
  }

  if (entry.kind === "invoice_payment") {
    const card = label(payloadString(entry, "card_id"));
    const account = label(payloadString(entry, "account_id"));
    // invoice_id is "<card>:<YYYY-MM>", and only the month adds anything here.
    const month = payloadString(entry, "invoice_id")?.split(":")[1] ?? null;
    const bill = [card, month].filter(Boolean).join(" · ");
    if (!bill) return null;
    return account ? `Fatura ${bill} — paga por ${account}` : `Fatura ${bill}`;
  }

  return null;
}

function formatDay(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value.slice(0, 10)
    : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Review queue for everything Pluggy proposed. Nothing here has touched the
 * ledger yet: accepting is what writes, through the same path a manual entry
 * takes.
 */
export function ImportView({
  isSyncing,
  onSync,
  onError,
  onChanged,
  refreshToken,
  names = {},
  onReview,
}: {
  isSyncing: boolean;
  onSync: () => Promise<void>;
  onError: (message: string) => void;
  onChanged: () => void;
  refreshToken: number;
  /** Local account and card ids to their display names. */
  names?: Record<string, string>;
  /**
   * Opens the entry in the normal launch composer, pre-filled. Every proposal
   * needs a category and may need a person for a reimbursement, and those are
   * decisions the composer already knows how to ask for.
   */
  onReview?: (entry: PluggyInboxEntry, remember: boolean) => void;
}) {
  const [entries, setEntries] = useState<PluggyInboxEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // Which descriptions the user asked to remember, so the next charge like it
  // opens already filled. It only ever pre-fills; accepting stays a click.
  const [remembered, setRemembered] = useState<Record<string, boolean>>({});
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const reload = useCallback(async () => {
    try {
      const page = await fetchPluggyInbox();
      setEntries(page.entries);
    } catch {
      onError("Não foi possível carregar a fila de importação.");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  const visible = useMemo(
    () =>
      entries.filter((entry) => {
        if (filter === "new") return entry.match_kind === "new";
        if (filter === "duplicates")
          return entry.match_kind === "duplicate_of_local";
        return true;
      }),
    [entries, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, PluggyInboxEntry[]>();
    for (const entry of visible) {
      const key = entry.account_label ?? "Conta sem nome";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries());
  }, [visible]);

  const duplicateCount = entries.filter(
    (entry) => entry.match_kind === "duplicate_of_local",
  ).length;

  async function run(
    entry: PluggyInboxEntry,
    action: () => Promise<unknown>,
  ): Promise<void> {
    setBusyId(entry.entry_id);
    try {
      await action();
      setEntries((current) =>
        current.filter((item) => item.entry_id !== entry.entry_id),
      );
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function handleAccept(entry: PluggyInboxEntry) {
    // Every kind is reviewed in the composer, opened on the entry's own type:
    // an income proposal has an account to confirm just as a card purchase has
    // a category, and reading the proposal back in the form it will be written
    // in is what makes a wrong guess visible before it is written.
    const remember = remembered[entry.entry_id] ?? false;
    if (onReview && isAcceptable(entry)) {
      onReview(entry, remember);
      return;
    }
    void run(entry, () => acceptPluggyEntry(entry.entry_id, {}, remember));
  }

  function handleIgnore(entry: PluggyInboxEntry) {
    void run(entry, () => ignorePluggyEntry(entry.entry_id));
  }

  function handleLink(entry: PluggyInboxEntry) {
    if (!entry.matched_local_id) return;
    void run(entry, () =>
      linkPluggyEntry(entry.entry_id, entry.matched_local_id!),
    );
  }

  function handleAcceptGroup(groupEntries: PluggyInboxEntry[]) {
    // Only what needs no decision: a proposal that already carries a category,
    // or a kind that never has one. Anything else goes through the composer.
    const ready = groupEntries.filter(
      (entry) =>
        entry.match_kind === "new" &&
        isAcceptable(entry) &&
        (!needsCategory(entry) || payloadString(entry, "category_id")),
    );
    if (ready.length === 0) {
      onError(
        "Nenhum lançamento do grupo tem categoria sugerida. Aceite um a um para escolher.",
      );
      return;
    }
    void (async () => {
      for (const entry of ready) {
        await run(entry, () => acceptPluggyEntry(entry.entry_id, {}));
      }
    })();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {entries.length} lançamento(s) para revisar
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Nada entra no histórico sem você aceitar.
              {duplicateCount > 0
                ? ` ${duplicateCount} parece(m) já existir no app.`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {(
              [
                ["all", "Tudo"],
                ["new", "Novos"],
                ["duplicates", "Possíveis duplicatas"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "secondary" : "ghost"}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onSync()}
              disabled={isSyncing}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", isSyncing && "animate-spin")}
                aria-hidden
              />
              {isSyncing ? "Sincronizando…" : "Sincronizar"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando fila…</p>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-semibold text-foreground">
              Nada para revisar.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sincronize para buscar novos lançamentos na Pluggy.
            </p>
          </CardContent>
        </Card>
      ) : (
        groups.map(([label, groupEntries]) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <GroupIcon kind={groupEntries[0].kind} />
                {label}
                <span className="text-xs font-normal text-muted-foreground">
                  {groupEntries.length} item(s)
                </span>
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAcceptGroup(groupEntries)}
                disabled={busyId !== null}
              >
                Aceitar todos
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupEntries.map((entry) => (
                <EntryRow
                  key={entry.entry_id}
                  entry={entry}
                  names={names}
                  isBusy={busyId === entry.entry_id}
                  remember={remembered[entry.entry_id] ?? false}
                  onRememberChange={(value) =>
                    setRemembered((current) => ({
                      ...current,
                      [entry.entry_id]: value,
                    }))
                  }
                  onAccept={() => handleAccept(entry)}
                  onIgnore={() => handleIgnore(entry)}
                  onLink={() => handleLink(entry)}
                  registerRef={(node) => {
                    if (node) rowRefs.current.set(entry.entry_id, node);
                    else rowRefs.current.delete(entry.entry_id);
                  }}
                />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function GroupIcon({ kind }: { kind: PluggyInboxEntry["kind"] }) {
  const className = "size-4 shrink-0";
  if (kind === "investment_movement") {
    return <TrendingUp className={className} aria-hidden />;
  }
  if (kind === "card_purchase" || kind === "invoice_payment") {
    return <CreditCard className={className} aria-hidden />;
  }
  return <Landmark className={className} aria-hidden />;
}

function EntryRow({
  entry,
  names,
  isBusy,
  remember,
  onRememberChange,
  onAccept,
  onIgnore,
  onLink,
  registerRef,
}: {
  entry: PluggyInboxEntry;
  names: Record<string, string>;
  isBusy: boolean;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  onAccept: () => void;
  onIgnore: () => void;
  onLink: () => void;
  registerRef: (node: HTMLDivElement | null) => void;
}) {
  const isDuplicate = entry.match_kind === "duplicate_of_local";
  const acceptable = isAcceptable(entry);
  const flow = direction(entry);
  const holderName = entry.proposal.holder_name;
  const installments = payloadNumber(entry, "installments_count") ?? 1;
  const personId = payloadString(entry, "person_id");
  const destination = describeDestination(entry, names);
  const originalCurrency = describeOriginalCurrency(entry);

  return (
    <div
      ref={registerRef}
      tabIndex={0}
      onKeyDown={(event) => {
        // Reviewing dozens of lines has to be a keyboard job, not a mouse one.
        if (event.target !== event.currentTarget) return;
        const key = event.key.toLowerCase();
        if (key === "a" && acceptable) {
          event.preventDefault();
          onAccept();
        } else if (key === "i") {
          event.preventDefault();
          onIgnore();
        } else if (key === "d" && isDuplicate) {
          event.preventDefault();
          onLink();
        }
      }}
      className={cn(
        "rounded-xl border border-border p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDuplicate && "border-warning/40 bg-warning/5",
        isBusy && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDay(entry.occurred_at)}
            </span>
            <span className="truncate font-semibold text-foreground">
              {entry.title ?? "Sem descrição"}
            </span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              flow === "in" && "text-finance-income",
              flow === "out" && "text-finance-expense",
              flow === "neutral" && "text-muted-foreground",
            )}
          >
            {flow === "in" ? "+" : flow === "out" ? "−" : ""}
            {formatCurrency(entry.amount)}
          </span>
            {installments > 1 ? (
              <Badge variant="secondary">{installments}x</Badge>
            ) : null}
            {entry.revised ? <Badge variant="outline">Revisado</Badge> : null}
            {originalCurrency ? (
              <Badge variant="outline">{originalCurrency}</Badge>
            ) : null}
            {entry.proposal.source_status === "PENDING" ? (
              <Badge variant="outline">Fatura aberta</Badge>
            ) : null}
            {holderName ? <Badge variant="secondary">{holderName}</Badge> : null}
            {personId ? (
              <Badge variant="outline">Reembolso · {personId}</Badge>
            ) : null}
          </div>
          {isDuplicate ? (
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Parece já existir no app.
            </p>
          ) : null}
          {destination ? (
            <p className="text-xs text-muted-foreground">{destination}</p>
          ) : null}
          {entry.proposal.settles_pending ? (
            <p className="text-xs text-muted-foreground">
              Confirma o gasto fixo {entry.proposal.settles_pending} em vez de
              lançar uma segunda cobrança.
            </p>
          ) : null}
          {!acceptable ? (
            <p className="text-xs text-muted-foreground">
              {KIND_LABELS[entry.kind] ?? entry.kind} — ainda não é importado
              automaticamente.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isDuplicate ? (
            <Button size="sm" variant="outline" onClick={onLink} disabled={isBusy}>
              <Link2 className="mr-1.5 size-3.5" aria-hidden />
              É a mesma
            </Button>
          ) : null}
          {acceptable && needsCategory(entry) ? (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 rounded border-input"
                checked={remember}
                onChange={(event) => onRememberChange(event.target.checked)}
                disabled={isBusy}
              />
              Lembrar
            </label>
          ) : null}
          {acceptable ? (
            <Button size="sm" onClick={onAccept} disabled={isBusy}>
              <Check className="mr-1.5 size-3.5" aria-hidden />
              Aceitar
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onIgnore} disabled={isBusy}>
            <X className="mr-1.5 size-3.5" aria-hidden />
            Ignorar
          </Button>
        </div>
      </div>
    </div>
  );
}
