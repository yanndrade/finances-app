import { useMemo, useState, type FormEvent } from "react";
import {
  Banknote,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { CurrencyInput } from "../../components/currency-input";
import { Modal } from "../../components/modal";
import { Button } from "../../components/ui/button";
import { MoneyValue } from "../../components/ui/money-value";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type {
  AccountPayload,
  AccountSummary,
  AccountUpdatePayload,
} from "../../lib/api";
import { formatAccountType } from "../../lib/format";
import { cn } from "../../lib/utils";

type AccountsViewProps = {
  accounts: AccountSummary[];
  isSubmitting: boolean;
  onCreateAccount: (payload: AccountPayload) => Promise<void>;
  onOpenSettings: () => void;
  onSetAccountActive: (account: AccountSummary, isActive: boolean) => Promise<void>;
  onUpdateAccount: (
    accountId: string,
    payload: AccountUpdatePayload,
  ) => Promise<void>;
};

type AccountFormState = {
  name: string;
  type: AccountPayload["type"];
  initialBalance: string;
};

type AccountEditState = AccountFormState & {
  isActive: boolean;
};

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  name: "",
  type: "checking",
  initialBalance: "0",
};

// Maps account type to a Lucide icon and a background colour token.
const ACCOUNT_TYPE_META: Record<
  string,
  { Icon: React.ElementType; bg: string; fg: string }
> = {
  checking: { Icon: Landmark, bg: "bg-blue-50", fg: "text-blue-600" },
  savings: { Icon: PiggyBank, bg: "bg-emerald-50", fg: "text-emerald-600" },
  wallet: { Icon: Wallet, bg: "bg-amber-50", fg: "text-amber-600" },
  investment: { Icon: TrendingUp, bg: "bg-primary/8", fg: "text-primary" },
  other: { Icon: Banknote, bg: "bg-slate-100", fg: "text-slate-500" },
};

function AccountTypeMonogram({ type }: { type: string }) {
  const meta = ACCOUNT_TYPE_META[type] ?? ACCOUNT_TYPE_META["other"];
  const { Icon, bg, fg } = meta;
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
        bg,
      )}
    >
      <Icon className={cn("h-4 w-4", fg)} />
    </span>
  );
}

export function AccountsView({
  accounts,
  isSubmitting,
  onCreateAccount,
  onOpenSettings,
  onSetAccountActive,
  onUpdateAccount,
}: AccountsViewProps) {
  const [createForm, setCreateForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<AccountEditState>({
    ...EMPTY_ACCOUNT_FORM,
    isActive: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "balance" | "type">("name");

  const consolidatedTotal = useMemo(() => {
    return accounts
      .filter((account) => account.is_active)
      .reduce((sum, account) => sum + account.current_balance, 0);
  }, [accounts]);

  const activeCount = useMemo(
    () => accounts.filter((account) => account.is_active).length,
    [accounts],
  );
  const inactiveCount = accounts.length - activeCount;

  const filteredAndSortedAccounts = useMemo(() => {
    return accounts
      .filter((account) =>
        account.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      .sort((left, right) => {
        if (sortBy === "name") {
          return left.name.localeCompare(right.name);
        }
        if (sortBy === "balance") {
          return right.current_balance - left.current_balance;
        }
        return left.type.localeCompare(right.type);
      });
  }, [accounts, searchQuery, sortBy]);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onCreateAccount({
      name: createForm.name.trim(),
      type: createForm.type,
      initialBalanceInCents: parseInt(createForm.initialBalance || "0", 10),
    });

    setCreateForm(EMPTY_ACCOUNT_FORM);
    setIsCreateModalOpen(false);
  }

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingAccountId === null) {
      return;
    }

    await onUpdateAccount(editingAccountId, {
      name: editForm.name.trim(),
      type: editForm.type,
      initialBalanceInCents: parseInt(editForm.initialBalance || "0", 10),
      isActive: editForm.isActive,
    });

    setEditingAccountId(null);
  }

  async function handleToggleAccountActive(account: AccountSummary) {
    const nextIsActive = !account.is_active;

    if (
      !nextIsActive &&
      !globalThis.confirm(
        "Excluir esta conta da operação ativa? O histórico será preservado.",
      )
    ) {
      return;
    }

    await onSetAccountActive(account, nextIsActive);
  }

  return (
    <div className="screen-stack">
      <section aria-label="Gerenciar contas" className="panel-card p-6 md:p-8">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Gestão</p>
            <h3 className="section-title">Contas e saldos</h3>
            {/* Compact stats inline — one line, no hero weight */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Patrimônio consolidado:{" "}
                <MoneyValue
                  value={consolidatedTotal}
                  neutral
                  className="text-xs"
                />
              </span>
              <span className="hidden sm:inline text-slate-200">|</span>
              <span>
                {activeCount}{" "}
                {activeCount === 1 ? "conta ativa" : "contas ativas"}
                {inactiveCount > 0 && (
                  <span className="ml-1 text-slate-400">
                    · {inactiveCount} inativa{inactiveCount > 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={onOpenSettings}
            >
              Configurações
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => setIsCreateModalOpen(true)}
            >
              + Adicionar conta
            </Button>
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div className="accounts-filters mb-4 flex flex-wrap gap-2">
          <div className="search-field flex-1 min-w-[160px]">
            <input
              placeholder="Buscar conta..."
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(value) =>
              setSortBy(value as "name" | "balance" | "type")
            }
          >
            <SelectTrigger className="h-9 w-auto min-w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Ordenar por Nome</SelectItem>
              <SelectItem value="balance">Ordenar por Saldo</SelectItem>
              <SelectItem value="type">Ordenar por Tipo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Table / empty state ─────────────────────────────────────────── */}
        {filteredAndSortedAccounts.length === 0 ? (
          <div className="empty-state">
            {searchQuery
              ? "Nenhuma conta encontrada para essa busca."
              : "Você ainda não tem contas cadastradas. Clique em Adicionar conta."}
          </div>
        ) : (
          <div className="table-shell table-shell--compact">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-[12px] uppercase tracking-widest px-4 py-3">
                    Conta
                  </th>
                  <th className="text-[12px] uppercase tracking-widest px-4 py-3 text-right">
                    Saldo atual
                  </th>
                  <th className="text-[12px] uppercase tracking-widest px-4 py-3 text-right">
                    Saldo inicial
                  </th>
                  <th className="text-[12px] uppercase tracking-widest px-4 py-3 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedAccounts.map((account) => (
                  <tr
                    key={account.account_id}
                    className={cn(
                      "text-sm transition-colors hover:bg-slate-50/70",
                      !account.is_active && "opacity-60",
                    )}
                  >
                    {/* ── Conta cell: monogram + name + type + inactive badge ── */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AccountTypeMonogram type={account.type} />
                        <div className="space-y-0.5">
                          <strong className="block text-slate-900 leading-tight">
                            {account.name}
                          </strong>
                          <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
                            {formatAccountType(account.type)}
                            {!account.is_active && (
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-px text-[13px] font-semibold uppercase tracking-wider text-slate-500">
                                Inativa
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* ── Current balance ─────────────────────────────────── */}
                    <td className="px-4 py-3 text-right">
                      <MoneyValue
                        value={account.current_balance}
                        neutral
                        className="text-sm"
                      />
                    </td>

                    {/* ── Initial balance ─────────────────────────────────── */}
                    <td className="px-4 py-3 text-right">
                      <MoneyValue
                        value={account.initial_balance}
                        neutral
                        className="text-sm text-slate-400"
                      />
                    </td>

                    {/* ── Actions ─────────────────────────────────────────── */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-3 text-[12px]"
                          onClick={() => {
                            setEditingAccountId(account.account_id);
                            setEditForm({
                              name: account.name,
                              type: account.type as AccountPayload["type"],
                              initialBalance: String(account.initial_balance),
                              isActive: account.is_active,
                            });
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant={account.is_active ? "destructive" : "outline"}
                          size="sm"
                          className="h-7 px-3 text-[12px]"
                          disabled={isSubmitting}
                          onClick={() => {
                            void handleToggleAccountActive(account);
                          }}
                        >
                          {account.is_active ? "Excluir" : "Entrar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Create modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Nova conta"
      >
        <form className="form-card" onSubmit={(event) => void handleCreateSubmit(event)}>
          <label>
            Nome da conta
            <input
              aria-label="Nome da conta"
              placeholder="Ex: Nubank, Carteira..."
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
              value={createForm.name}
            />
          </label>
          <label className="custom-select-wrapper">
            Tipo da conta
            <select
              aria-label="Tipo da conta"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  type: event.target.value as AccountPayload["type"],
                }))
              }
              value={createForm.type}
            >
              <option value="checking">Conta corrente</option>
              <option value="savings">Poupança</option>
              <option value="wallet">Carteira</option>
              <option value="investment">Investimento</option>
              <option value="other">Outra</option>
            </select>
          </label>
          <CurrencyInput
            label="Saldo inicial"
            value={createForm.initialBalance}
            onChange={(value) =>
              setCreateForm((current) => ({ ...current, initialBalance: value }))
            }
          />
          <p className="field-hint">
            Saldo inicial opcional. Se você já tem dinheiro nessa conta hoje, informe aqui.
          </p>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>
      </Modal>

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      <Modal
        isOpen={editingAccountId !== null}
        onClose={() => setEditingAccountId(null)}
        title="Editar conta"
      >
        <form className="form-card" onSubmit={(event) => void handleUpdateSubmit(event)}>
          <label>
            Nome da conta
            <input
              aria-label="Nome da conta"
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
              value={editForm.name}
            />
          </label>
          <label className="custom-select-wrapper">
            Tipo da conta
            <select
              aria-label="Tipo da conta"
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  type: event.target.value as AccountPayload["type"],
                }))
              }
              value={editForm.type}
            >
              <option value="checking">Conta corrente</option>
              <option value="savings">Poupança</option>
              <option value="wallet">Carteira</option>
              <option value="investment">Investimento</option>
              <option value="other">Outra</option>
            </select>
          </label>
          <CurrencyInput
            label="Saldo inicial"
            value={editForm.initialBalance}
            onChange={(value) =>
              setEditForm((current) => ({ ...current, initialBalance: value }))
            }
          />
          <label className="checkbox-field">
            <input
              checked={editForm.isActive}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              type="checkbox"
            />
            Conta ativa
          </label>
          <div className="inline-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : "Salvar conta"}
            </button>
            <button
              className="ghost-button"
              onClick={() => setEditingAccountId(null)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
