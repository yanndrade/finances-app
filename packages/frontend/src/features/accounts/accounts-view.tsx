import { useMemo, useState, type FormEvent } from "react";

import { CurrencyInput } from "../../components/currency-input";
import { Modal } from "../../components/modal";
import { StatCard } from "../../components/stat-card";
import type {
  AccountPayload,
  AccountSummary,
  AccountUpdatePayload,
} from "../../lib/api";
import { formatAccountType, formatCurrency } from "../../lib/format";

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
        "Excluir esta conta da operacao ativa? O historico sera preservado.",
      )
    ) {
      return;
    }

    await onSetAccountActive(account, nextIsActive);
  }

  return (
    <div className="screen-stack">
      <div className="stats-grid">
        <StatCard
          label="Total consolidado (ativas)"
          tone="default"
          value={formatCurrency(consolidatedTotal)}
        />
        <StatCard label="Contas ativas" tone="default" value={String(activeCount)} />
        <StatCard label="Contas inativas" tone="default" value={String(inactiveCount)} />
      </div>

      <section aria-label="Gerenciar contas" className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Gestao</p>
            <h3 className="section-title">Contas e saldos</h3>
            <p className="section-copy">
              Cadastre, edite, remova da operacao ativa ou reative contas sem sair desta tela.
            </p>
          </div>
          <div className="inline-actions">
            <button className="ghost-button" onClick={onOpenSettings} type="button">
              Abrir configuracoes
            </button>
            <button
              className="primary-button"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              + Adicionar conta
            </button>
          </div>
        </div>

        <div className="accounts-filters">
          <div className="search-field">
            <input
              placeholder="Buscar conta..."
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <div className="sort-field custom-select-wrapper">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "name" | "balance" | "type")}
            >
              <option value="name">Ordenar por Nome</option>
              <option value="balance">Ordenar por Saldo</option>
              <option value="type">Ordenar por Tipo</option>
            </select>
          </div>
        </div>

        {filteredAndSortedAccounts.length === 0 ? (
          <div className="empty-state">
            {searchQuery
              ? "Nenhuma conta encontrada para essa busca."
              : "Voce ainda nao tem contas cadastradas. Clique em Adicionar conta."}
          </div>
        ) : (
          <div className="account-grid">
            {filteredAndSortedAccounts.map((account) => (
              <article key={account.account_id} className="account-card">
                <div className="account-card__header">
                  <div>
                    <strong>{account.name}</strong>
                    <p className="account-card__meta">{formatAccountType(account.type)}</p>
                  </div>
                  <span
                    className={`status-badge status-badge--${account.is_active ? "active" : "voided"}`}
                  >
                    {account.is_active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="account-card__balance">{formatCurrency(account.current_balance)}</p>
                <p className="account-card__meta">
                  Saldo inicial {formatCurrency(account.initial_balance)}
                </p>
                {!account.is_active ? (
                  <p className="account-card__meta">
                    Fora da operacao ativa. O historico continua preservado.
                  </p>
                ) : null}
                <div className="inline-actions">
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setEditingAccountId(account.account_id);
                      setEditForm({
                        name: account.name,
                        type: account.type as AccountPayload["type"],
                        initialBalance: String(account.initial_balance),
                        isActive: account.is_active,
                      });
                    }}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className={account.is_active ? "ghost-button ghost-button--danger" : "ghost-button"}
                    disabled={isSubmitting}
                    onClick={() => {
                      void handleToggleAccountActive(account);
                    }}
                    type="button"
                  >
                    {account.is_active ? "Excluir conta" : "Reativar conta"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
              <option value="savings">Poupanca</option>
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
            Saldo inicial opcional. Se voce ja tem dinheiro nessa conta hoje, informe aqui.
          </p>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>
      </Modal>

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
              <option value="savings">Poupanca</option>
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
