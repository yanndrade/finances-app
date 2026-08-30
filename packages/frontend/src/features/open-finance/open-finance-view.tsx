import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CreditCard,
  Landmark,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type {
  AccountSummary,
  CardHolderSummary,
  CardSummary,
  PluggyCardNumber,
  PluggyDiscoveredAccount,
  PluggyImportRule,
  PluggyItemState,
} from "../../lib/api";
import {
  deletePluggyRule,
  fetchAccounts,
  fetchCardHolders,
  fetchCards,
  fetchPluggyAccounts,
  fetchPluggyCardNumbers,
  fetchPluggyRules,
  fetchPluggyStatus,
  linkPluggyAccount,
  upsertCardHolder,
} from "../../lib/api";
import { formatCurrency } from "../../lib/format";

const IGNORE_VALUE = "__ignore__";
const UNLINKED_VALUE = "__unlinked__";

type Destination =
  | { kind: "account"; id: string }
  | { kind: "card"; id: string }
  | { kind: "holder"; id: string };

type Option = { value: string; label: string };

type Section = {
  key: PluggyDiscoveredAccount["kind"];
  title: string;
  hint: string;
};

const SECTIONS: Section[] = [
  {
    key: "bank",
    title: "Contas",
    hint: "Entradas e saídas viram receitas e despesas na conta escolhida.",
  },
  {
    key: "credit",
    title: "Cartões",
    hint: "Compras entram na fatura do cartão, ou do portador, que você apontar.",
  },
  {
    key: "investment",
    title: "Investimentos",
    hint: "Só compras e vendas são importadas; a posição nunca é sobrescrita.",
  },
];

/**
 * A bank reports the same subtype label in English; these are the ones that
 * actually show up and that tell two look-alike accounts apart.
 */
const SUBTYPE_LABELS: Record<string, string> = {
  CHECKING_ACCOUNT: "Conta corrente",
  SAVINGS_ACCOUNT: "Poupança",
  CREDIT_CARD: "Cartão de crédito",
};

function encode(destination: Destination) {
  return `${destination.kind}:${destination.id}`;
}

function decode(value: string): Destination | null {
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind === "account" || kind === "card" || kind === "holder") {
    return { kind, id };
  }
  return null;
}

function currentValue(account: PluggyDiscoveredAccount) {
  if (account.ignored) return IGNORE_VALUE;
  if (account.local_holder_id) return `holder:${account.local_holder_id}`;
  if (account.local_card_id) return `card:${account.local_card_id}`;
  if (account.local_account_id) return `account:${account.local_account_id}`;
  return UNLINKED_VALUE;
}

function defaultImportSince() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * A row stands for one or more Pluggy accounts that are the same thing to the
 * user. A broker reports every CDB as its own investment, which is two dozen
 * identical lines for one decision, so they are decided together.
 */
type Row = {
  key: string;
  lead: PluggyDiscoveredAccount;
  members: PluggyDiscoveredAccount[];
};

function buildRows(accounts: PluggyDiscoveredAccount[]): Row[] {
  const grouped = new Map<string, PluggyDiscoveredAccount[]>();
  for (const account of accounts) {
    // Only investments collapse: two bank accounts that look alike are two
    // different accounts, and merging them would hide that.
    const key =
      account.kind === "investment" && !account.number
        ? `${account.display_name ?? ""}|${account.brand ?? ""}`
        : account.pluggy_account_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(account);
  }
  return Array.from(grouped.entries()).map(([key, members]) => ({
    key,
    lead: members[0],
    members,
  }));
}

function isPending(account: PluggyDiscoveredAccount) {
  return !account.is_linked && !account.ignored;
}

/**
 * The money that identifies which account this is. Two accounts at one bank
 * often share a name and a number, and the balance is what tells the current
 * account from the savings one.
 *
 * A value only exists after a sync that ran with these fields, so an absent
 * one is skipped rather than rendered as an empty amount.
 */
function describeMoney(
  account: PluggyDiscoveredAccount,
  members: PluggyDiscoveredAccount[],
): { label: string; value: number }[] {
  if (account.kind === "investment") {
    const total = members.reduce(
      (sum, item) => sum + (Number.isFinite(item.balance) ? item.balance! : 0),
      0,
    );
    return members.some((item) => Number.isFinite(item.balance))
      ? [{ label: "Posição", value: total }]
      : [];
  }

  const entries: { label: string; value: number }[] = [];
  if (Number.isFinite(account.balance)) {
    entries.push({
      label: account.kind === "credit" ? "Fatura" : "Saldo",
      value: account.balance!,
    });
  }
  if (account.kind === "credit" && Number.isFinite(account.credit_limit)) {
    entries.push({ label: "Limite", value: account.credit_limit! });
  }
  return entries;
}

/**
 * Everything Open Finance brings in, and where each piece lands. Nothing is
 * imported from an account until it has a destination here, which is what lets
 * a first sync run against a database full of manual history without doing
 * anything at all.
 */
export function OpenFinanceView({
  onError,
  onChanged,
  onSync,
  isSyncing,
  refreshToken,
}: {
  onError: (message: string) => void;
  onChanged: () => void;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  refreshToken: number;
}) {
  const [accounts, setAccounts] = useState<PluggyDiscoveredAccount[]>([]);
  const [items, setItems] = useState<PluggyItemState[]>([]);
  const [localAccounts, setLocalAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [holders, setHolders] = useState<CardHolderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [discovered, status, loadedAccounts, loadedCards] =
        await Promise.all([
          fetchPluggyAccounts(),
          fetchPluggyStatus(),
          fetchAccounts(),
          fetchCards(),
        ]);
      const loadedHolders = (
        await Promise.all(
          loadedCards.map((card) => fetchCardHolders(card.card_id)),
        )
      ).flat();
      setAccounts(discovered);
      setItems(status.items);
      setLocalAccounts(loadedAccounts);
      setCards(loadedCards);
      setHolders(loadedHolders);
    } catch {
      onError("Não foi possível carregar as contas conectadas.");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  const bankOptions = useMemo<Option[]>(
    () =>
      localAccounts
        .filter((account) => account.is_active)
        .map((account) => ({
          value: `account:${account.account_id}`,
          label: account.name,
        })),
    [localAccounts],
  );

  const creditOptions = useMemo<Option[]>(() => {
    const cardsById = new Map(cards.map((card) => [card.card_id, card]));
    return [
      ...cards
        .filter((card) => card.is_active)
        .map<Option>((card) => ({
          value: `card:${card.card_id}`,
          label: card.name,
        })),
      ...holders.map<Option>((holder) => ({
        value: `holder:${holder.holder_id}`,
        label: `${cardsById.get(holder.card_id)?.name ?? "Cartão"} · ${holder.name}${
          holder.last_four ? ` (····${holder.last_four})` : ""
        }`,
      })),
    ];
  }, [cards, holders]);

  /**
   * Two Pluggy accounts with the same number under one connection are the
   * trap this screen exists to make visible: linking both would import every
   * transaction twice, and the backend refuses it.
   */
  const lookAlikes = useMemo(() => {
    const byNumber = new Map<string, number>();
    for (const account of accounts) {
      if (!account.number || account.kind === "investment") continue;
      const key = `${account.kind}:${account.number}`;
      byNumber.set(key, (byNumber.get(key) ?? 0) + 1);
    }
    return byNumber;
  }, [accounts]);

  async function save(
    row: Row,
    apply: (account: PluggyDiscoveredAccount) => Promise<unknown>,
  ) {
    setSavingKey(row.key);
    try {
      for (const account of row.members) {
        await apply(account);
      }
      await reload();
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o vínculo.",
      );
    } finally {
      setSavingKey(null);
    }
  }

  async function applyValue(row: Row, value: string) {
    await save(row, (account) => {
      if (value === IGNORE_VALUE) {
        return linkPluggyAccount(account.pluggy_account_id, { ignored: true });
      }
      if (value === UNLINKED_VALUE) {
        return linkPluggyAccount(account.pluggy_account_id, {});
      }
      const destination = decode(value);
      if (!destination) return Promise.resolve();
      return linkPluggyAccount(account.pluggy_account_id, {
        localAccountId:
          destination.kind === "account" ? destination.id : undefined,
        localCardId: destination.kind === "card" ? destination.id : undefined,
        localHolderId: destination.kind === "holder" ? destination.id : undefined,
        // Everything before the cut-off stays out, which keeps a first sync
        // from proposing months that were already entered by hand.
        importSince: account.import_since ?? defaultImportSince(),
      });
    });
  }

  function handleChange(row: Row, value: string) {
    void applyValue(row, value);
  }

  function handleImportSince(row: Row, importSince: string) {
    if (importSince.length !== 10) return;
    void save(row, (account) =>
      linkPluggyAccount(account.pluggy_account_id, {
        localAccountId: account.local_account_id,
        localCardId: account.local_holder_id ? null : account.local_card_id,
        localHolderId: account.local_holder_id,
        importSince,
      }),
    );
  }

  function handleAcceptSuggestions(rows: Row[]) {
    const ready = rows.filter((row) => row.lead.suggestion && isPending(row.lead));
    if (ready.length === 0) {
      onError("Nenhuma sugestão pendente nesta seção.");
      return;
    }
    void (async () => {
      // Sequential on purpose: the backend refuses a second account on a
      // destination another one just took, and that refusal has to surface
      // rather than race.
      for (const row of ready) {
        const suggestion = row.lead.suggestion!;
        await applyValue(
          row,
          encode({ kind: suggestion.kind, id: suggestion.id }),
        );
      }
    })();
  }

  function handleIgnoreRest(rows: Row[]) {
    const ready = rows.filter((row) => isPending(row.lead));
    if (ready.length === 0) {
      onError("Nenhuma conta sem vínculo nesta seção.");
      return;
    }
    void (async () => {
      for (const row of ready) {
        await save(row, (account) =>
          linkPluggyAccount(account.pluggy_account_id, { ignored: true }),
        );
      }
    })();
  }

  const pendingTotal = accounts.filter(isPending).length;

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Carregando conexões…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-sm">
            Conexões
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {items.length} conectada(s)
            </span>
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onSync()}
            disabled={isSyncing}
          >
            <RefreshCw
              className={`mr-1.5 size-3.5 ${isSyncing ? "animate-spin" : ""}`}
              aria-hidden
            />
            {isSyncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma conexão ainda. Conecte pelo Open Finance em Configurações.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.item_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm font-medium">
                  {item.connector_name ?? "Conexão"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.last_synced_at
                    ? `Sincronizada em ${new Date(item.last_synced_at).toLocaleString("pt-BR")}`
                    : "Nunca sincronizada"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nada descoberto ainda.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sincronize para listar o que as conexões expõem.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">
          {pendingTotal > 0
            ? `${pendingTotal} sem destino. Nada é importado de uma conta antes de você dizer onde ela entra.`
            : "Tudo com destino definido."}
        </p>
      )}

      {SECTIONS.map((section) => {
        const rows = buildRows(
          accounts.filter((account) => account.kind === section.key),
        );
        if (rows.length === 0) return null;
        const pending = rows.filter((row) => isPending(row.lead)).length;
        const options = section.key === "credit" ? creditOptions : bankOptions;

        return (
          <Card key={section.key}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <SectionIcon kind={section.key} />
                {section.title}
                <span className="text-xs font-normal text-muted-foreground">
                  {rows.length}
                </span>
                {pending > 0 ? (
                  <Badge variant="outline">{pending} sem destino</Badge>
                ) : null}
              </CardTitle>
              {pending > 0 ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingKey !== null}
                    onClick={() => handleAcceptSuggestions(rows)}
                  >
                    Aceitar sugestões
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={savingKey !== null}
                    onClick={() => handleIgnoreRest(rows)}
                  >
                    Não importar o resto
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{section.hint}</p>
              <ul className="grid gap-1.5" aria-label={section.title}>
                {rows.map((row) => (
                  <AccountRow
                    key={row.key}
                    row={row}
                    options={options}
                    isSaving={savingKey === row.key}
                    isDuplicated={
                      (lookAlikes.get(
                        `${row.lead.kind}:${row.lead.number}`,
                      ) ?? 0) > 1
                    }
                    holders={holders}
                    onError={onError}
                    onChanged={onChanged}
                    refreshToken={refreshToken}
                    onChange={(value) => handleChange(row, value)}
                    onImportSince={(value) => handleImportSince(row, value)}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <ImportRules onError={onError} refreshToken={refreshToken} />
    </div>
  );
}

/**
 * The plastics that actually spent on a credit account.
 *
 * An issuer bills one account for a card and every additional on it, so
 * without this the whole family lands on the titular. The numbers only exist
 * once transactions have been staged, which is why this appears after the
 * account is linked and synced.
 */
function PhysicalCards({
  account,
  holders,
  onError,
  onChanged,
  refreshToken,
}: {
  account: PluggyDiscoveredAccount;
  holders: CardHolderSummary[];
  onError: (message: string) => void;
  onChanged: () => void;
  refreshToken: number;
}) {
  const [numbers, setNumbers] = useState<PluggyCardNumber[]>([]);
  const [localCardId, setLocalCardId] = useState<string | null>(null);
  const [savingLastFour, setSavingLastFour] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchPluggyCardNumbers(account.pluggy_account_id);
        if (cancelled) return;
        setNumbers(result.card_numbers);
        setLocalCardId(result.local_card_id);
      } catch {
        // A card with nothing staged yet simply has nothing to show.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.pluggy_account_id, refreshToken]);

  if (numbers.length === 0) return null;

  const cardHolders = holders.filter((holder) => holder.card_id === localCardId);

  async function assign(lastFour: string, holderId: string) {
    const holder = cardHolders.find((item) => item.holder_id === holderId);
    if (!holder || !localCardId) return;
    setSavingLastFour(lastFour);
    try {
      await upsertCardHolder(localCardId, {
        holderId: holder.holder_id,
        name: holder.name,
        lastFour,
        isPrimary: holder.is_primary,
        subLimitInCents: holder.sub_limit,
        reimbursablePersonId: holder.reimbursable_person_id,
        isActive: holder.is_active,
      });
      const result = await fetchPluggyCardNumbers(account.pluggy_account_id);
      setNumbers(result.card_numbers);
      onChanged();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível atribuir o cartão ao portador.",
      );
    } finally {
      setSavingLastFour(null);
    }
  }

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
      <p className="text-xs font-medium">Cartões que gastaram nesta conta</p>
      <p className="text-xs text-muted-foreground">
        O banco cobra titular e adicionais na mesma fatura. Atribua cada
        adicional ao seu portador; o seu próprio cartão fica sem portador e é
        isso que o marca como titular.
      </p>
      {cardHolders.length === 0 ? (
        <p className="text-xs text-warning">
          Este cartão ainda não tem portadores. Cadastre em Cartões → Detalhes,
          ou converta o cartão do adicional em portador por lá.
        </p>
      ) : null}
      <ul className="grid gap-1.5" aria-label="Cartões que gastaram">
        {numbers.map((number) => (
          <li
            key={number.last_four}
            className="flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-2">
              <span className="tabular-nums font-medium">
                ····{number.last_four}
              </span>
              <span className="text-muted-foreground">
                {number.purchase_count} compra(s) ·{" "}
                {formatCurrency(number.total_amount)}
              </span>
              {number.holder_name ? (
                <Badge variant="secondary">{number.holder_name}</Badge>
              ) : (
                // No holder is the titular's own plastic, not a gap to fill.
                <Badge variant="outline">Titular</Badge>
              )}
            </span>
            {cardHolders.length > 0 ? (
              <Select
                value={number.holder_id ?? ""}
                onValueChange={(value) => void assign(number.last_four, value)}
                disabled={savingLastFour === number.last_four}
              >
                <SelectTrigger
                  className="h-8 w-52"
                  aria-label={`Portador de ····${number.last_four}`}
                >
                  <SelectValue placeholder="Atribuir a" />
                </SelectTrigger>
                <SelectContent>
                  {cardHolders.map((holder) => (
                    <SelectItem key={holder.holder_id} value={holder.holder_id}>
                      {holder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the user has taught the queue. A rule only pre-fills the review of the
 * next charge with the same description — it never accepts anything.
 */
function ImportRules({
  onError,
  refreshToken,
}: {
  onError: (message: string) => void;
  refreshToken: number;
}) {
  const [rules, setRules] = useState<PluggyImportRule[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRules(await fetchPluggyRules());
    } catch {
      onError("Não foi possível carregar as regras de preenchimento.");
    }
  }, [onError]);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  async function remove(rule: PluggyImportRule) {
    setBusyId(rule.rule_id);
    try {
      await deletePluggyRule(rule.rule_id);
      await reload();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível apagar a regra.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          Preenchimento automático
          <span className="text-xs font-normal text-muted-foreground">
            {rules.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Marque "Lembrar" ao aceitar um lançamento e a próxima cobrança com a
          mesma descrição já abre preenchida. Isso nunca aceita nada sozinho.
        </p>
        {rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma regra ainda.
          </p>
        ) : (
          <ul className="grid gap-1.5" aria-label="Regras de preenchimento">
            {rules.map((rule) => (
              <li
                key={rule.rule_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate text-sm font-medium">
                    {rule.label ?? rule.match_value}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[
                      rule.set_category_id ? `categoria ${rule.set_category_id}` : null,
                      rule.set_person_id ? `reembolso ${rule.set_person_id}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "sem preenchimento"}
                    {rule.hit_count > 0 ? ` · usada ${rule.hit_count}x` : ""}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === rule.rule_id}
                  onClick={() => void remove(rule)}
                >
                  Apagar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SectionIcon({ kind }: { kind: PluggyDiscoveredAccount["kind"] }) {
  const className = "size-4 shrink-0";
  if (kind === "credit") return <CreditCard className={className} aria-hidden />;
  if (kind === "investment")
    return <TrendingUp className={className} aria-hidden />;
  return <Landmark className={className} aria-hidden />;
}

function AccountRow({
  row,
  options,
  isSaving,
  isDuplicated,
  holders,
  onError,
  onChanged,
  refreshToken,
  onChange,
  onImportSince,
}: {
  row: Row;
  options: Option[];
  isSaving: boolean;
  isDuplicated: boolean;
  holders: CardHolderSummary[];
  onError: (message: string) => void;
  onChanged: () => void;
  refreshToken: number;
  onChange: (value: string) => void;
  onImportSince: (value: string) => void;
}) {
  const account = row.lead;
  const label = account.display_name ?? "Sem nome";
  const subtype = account.subtype ? SUBTYPE_LABELS[account.subtype] : null;
  const money = describeMoney(account, row.members);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          {account.number ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {account.kind === "credit" ? `····${account.number}` : account.number}
            </span>
          ) : null}
          {row.members.length > 1 ? (
            <Badge variant="secondary">{row.members.length} posições</Badge>
          ) : null}
          {subtype ? <Badge variant="outline">{subtype}</Badge> : null}
          {account.holder_type === "ADDITIONAL" ? (
            <Badge variant="secondary">Adicional</Badge>
          ) : null}
          {money.map((entry) => (
            <span
              key={entry.label}
              className="text-xs tabular-nums text-muted-foreground"
            >
              {entry.label} {formatCurrency(entry.value)}
            </span>
          ))}
        </div>
        {money.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sincronize para ver saldo e limite desta conta.
          </p>
        ) : null}
        {isDuplicated ? (
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            O banco expõe mais de uma conta com este número. Aponte só uma para
            cada conta do app, senão cada lançamento entra duas vezes.
          </p>
        ) : null}
        {account.suggestion && isPending(account) ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Sugestão: {account.suggestion.label}
            {account.suggestion.reason === "last_four"
              ? " (pelos 4 dígitos)"
              : " (pelo nome)"}
          </p>
        ) : null}
        {account.is_linked ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Importar a partir de
            <input
              type="date"
              className="h-8 rounded-lg border border-input bg-background px-2 tabular-nums"
              value={account.import_since ?? ""}
              onChange={(event) => onImportSince(event.target.value)}
              disabled={isSaving}
            />
          </label>
        ) : null}
        {account.kind === "credit" && account.is_linked ? (
          <PhysicalCards
            account={account}
            holders={holders}
            onError={onError}
            onChanged={onChanged}
            refreshToken={refreshToken}
          />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={currentValue(account)}
          onValueChange={onChange}
          disabled={isSaving}
        >
          <SelectTrigger className="w-64" aria-label={`Destino de ${label}`}>
            <SelectValue placeholder="Selecione o destino" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNLINKED_VALUE}>Sem destino</SelectItem>
            <SelectItem value={IGNORE_VALUE}>Não importar</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {account.suggestion && isPending(account) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() =>
              onChange(
                encode({
                  kind: account.suggestion!.kind,
                  id: account.suggestion!.id,
                }),
              )
            }
          >
            Aceitar
          </Button>
        ) : null}
      </div>
    </li>
  );
}
