import { useState, useMemo, type FormEvent } from "react";

import type {
  AccountPayload,
  AccountSummary,
  AccountUpdatePayload,
} from "../../lib/api";
import { formatAccountType, formatCurrency } from "../../lib/format";
import { CurrencyInput } from "../../components/currency-input";
import { Modal } from "../../components/modal";
import { StatCard } from "../../components/stat-card";

type AccountsViewProps = {
  accounts: AccountSummary[];
  isSubmitting: boolean;
  onCreateAccount: (payload: AccountPayload) => Promise<void>;
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
      .filter((a) => a.is_active)
      .reduce((sum, a) => sum + a.current_balance, 0);
  }, [accounts]);

  const filteredAndSortedAccounts = useMemo(() => {
    return accounts
      .filter((account) =>
        account.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "balance") return b.current_balance - a.current_balance;
        if (sortBy === "type") return a.type.localeCompare(b.type);
        return 0;
      });
  }, [accounts, searchQuery, sortBy]);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onCreateAccount({
      name: createForm.name,
      type: createForm.type,
      initialBalanceInCents: parseInt(createForm.initialBalance, 10),
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
      name: editForm.name,
      type: editForm.type,
      initialBalanceInCents: parseInt(editForm.initialBalance, 10),
      isActive: editForm.isActive,
    });

    setEditingAccountId(null);
  }

  return (
    <div className="screen-stack">
      <div className="stats-grid">
        <StatCard
          label="Total consolidado (ativas)"
          tone="default"
          value={formatCurrency(consolidatedTotal)}
        />
        <StatCard
          label="Quantidade de contas"
          tone="default"
          value={String(accounts.length)}
        />
      </div>

      <section aria-label="Gerenciar contas" className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Carteira</p>
            <h2 className="section-title">Mapa de contas</h2>
            <p className="section-copy">
              Gerencie seus saldos e a visibilidade das suas contas ativas.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Adicionar conta
          </button>
        </div>

        <div className="accounts-filters">
          <div className="search-field">
            <input
              placeholder="Buscar conta..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="sort-field custom-select-wrapper">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
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
              : "Você ainda não tem contas cadastradas. Clique em Adicionar conta."}
          </div>
        ) : (
          <div className="account-grid">
            {filteredAndSortedAccounts.map((account) => (
              <article key={account.account_id} className="account-card">
                <div className="account-card__header">
                  <div>
                    <strong>{account.name}</strong>
                    <p className="account-card__meta">
                      {formatAccountType(account.type)}
                    </p>
                  </div>
                  <span
                    className={`status-badge status-badge--${
                      account.is_active ? "active" : "voided"
                    }`}
                  >
                    {account.is_active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="account-card__balance">
                  {formatCurrency(account.current_balance)}
                </p>
                <p className="account-card__meta">
                  Saldo inicial {formatCurrency(account.initial_balance)}
                </p>
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
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Modal Nova Conta */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Nova conta"
      >
        <form className="form-card" onSubmit={handleCreateSubmit}>
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
            onChange={(val) =>
              setCreateForm((current) => ({ ...current, initialBalance: val }))
            }
          />
          <p className="field-hint">
            Saldo inicial (opcional). Se você já tem dinheiro nessa conta hoje, informe aqui.
          </p>
          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>
      </Modal>

      {/* Modal Editar Conta */}
      <Modal
        isOpen={editingAccountId !== null}
        onClose={() => setEditingAccountId(null)}
        title="Editar conta"
      >
        <form className="form-card" onSubmit={handleUpdateSubmit}>
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
            onChange={(val) =>
              setEditForm((current) => ({ ...current, initialBalance: val }))
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
            <button
              className="primary-button"
              disabled={isSubmitting}
              type="submit"
            >
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
