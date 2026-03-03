import { useEffect, useState, type FormEvent } from "react";

import { CurrencyInput } from "../../components/currency-input";
import { Modal } from "../../components/modal";
import { StatCard } from "../../components/stat-card";
import { formatCurrency } from "../../lib/format";
import type {
  AccountSummary,
  CardPayload,
  CardSummary,
  CardUpdatePayload,
} from "../../lib/api";

type CardsViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  isSubmitting: boolean;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onUpdateCard: (cardId: string, payload: CardUpdatePayload) => Promise<void>;
};

type CardFormState = {
  name: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  paymentAccountId: string;
};

type CardEditState = CardFormState & {
  isActive: boolean;
};

export function CardsView({
  accounts,
  cards,
  isSubmitting,
  onCreateCard,
  onUpdateCard,
}: CardsViewProps) {
  const [createForm, setCreateForm] = useState<CardFormState>(() => createEmptyForm(accounts));
  const [editForm, setEditForm] = useState<CardEditState>({
    ...createEmptyForm(accounts),
    isActive: true,
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCreateForm((current) =>
      current.paymentAccountId ? current : createEmptyForm(accounts),
    );
  }, [accounts]);

  const activeCards = cards.filter((card) => card.is_active);
  const activeLimitTotal = activeCards.reduce((sum, card) => sum + card.limit, 0);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const validationError = validateForm(createForm);
    if (validationError !== null) {
      setFormError(validationError);
      return;
    }

    try {
      await onCreateCard({
        name: createForm.name.trim(),
        limitInCents: parseInt(createForm.limit, 10),
        closingDay: parseInt(createForm.closingDay, 10),
        dueDay: parseInt(createForm.dueDay, 10),
        paymentAccountId: createForm.paymentAccountId,
      });
    } catch {
      return;
    }

    setCreateForm(createEmptyForm(accounts));
    setIsCreateModalOpen(false);
  }

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (editingCardId === null) {
      return;
    }

    const validationError = validateForm(editForm);
    if (validationError !== null) {
      setFormError(validationError);
      return;
    }

    try {
      await onUpdateCard(editingCardId, {
        name: editForm.name.trim(),
        limitInCents: parseInt(editForm.limit, 10),
        closingDay: parseInt(editForm.closingDay, 10),
        dueDay: parseInt(editForm.dueDay, 10),
        paymentAccountId: editForm.paymentAccountId,
        isActive: editForm.isActive,
      });
    } catch {
      return;
    }

    setEditingCardId(null);
  }

  function openCreateModal() {
    setFormError(null);
    setCreateForm(createEmptyForm(accounts));
    setIsCreateModalOpen(true);
  }

  function openEditModal(card: CardSummary) {
    setFormError(null);
    setEditingCardId(card.card_id);
    setEditForm({
      name: card.name,
      limit: String(card.limit),
      closingDay: String(card.closing_day),
      dueDay: String(card.due_day),
      paymentAccountId: card.payment_account_id,
      isActive: card.is_active,
    });
  }

  return (
    <div className="screen-stack">
      <div className="stats-grid">
        <StatCard
          label="Cartoes cadastrados"
          tone="default"
          value={String(cards.length)}
        />
        <StatCard
          label="Limite total ativo"
          tone="default"
          value={formatCurrency(activeLimitTotal)}
        />
      </div>

      <section aria-label="Gerenciar cartoes" className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Cartoes</p>
            <h2 className="section-title">Cadastro de cartoes</h2>
            <p className="section-copy">
              Configure limite, fechamento, vencimento e a conta padrao de pagamento.
            </p>
          </div>
          <button
            className="primary-button"
            disabled={accounts.length === 0}
            onClick={openCreateModal}
            type="button"
          >
            + Adicionar cartao
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="empty-state">
            Voce ainda nao tem cartoes cadastrados. Clique em Adicionar cartao.
          </div>
        ) : (
          <div className="account-grid">
            {cards.map((card) => (
              <article key={card.card_id} className="account-card">
                <div className="account-card__header">
                  <div>
                    <strong>{card.name}</strong>
                    <p className="account-card__meta">
                      Conta padrao: {resolveAccountName(accounts, card.payment_account_id)}
                    </p>
                  </div>
                  <span
                    className={`status-badge status-badge--${
                      card.is_active ? "active" : "voided"
                    }`}
                  >
                    {card.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="account-card__balance">{formatCurrency(card.limit)}</p>
                <p className="account-card__meta">
                  Fecha dia {card.closing_day} e vence dia {card.due_day}
                </p>
                <button
                  aria-label={`Editar ${card.name}`}
                  className="ghost-button"
                  onClick={() => openEditModal(card)}
                  type="button"
                >
                  Editar
                </button>
              </article>
            ))}
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="field-hint text-negative">
            Cadastre ao menos uma conta antes de criar um cartao.
          </p>
        ) : null}
      </section>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setFormError(null);
          setIsCreateModalOpen(false);
        }}
        title="Novo cartao"
      >
        <form className="form-card" onSubmit={handleCreateSubmit}>
          <label>
            Nome do cartao
            <input
              aria-label="Nome do cartao"
              autoFocus
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
          <CurrencyInput
            aria-label="Limite do cartao"
            id="create-card-limit"
            label="Limite do cartao"
            onChange={(value) =>
              setCreateForm((current) => ({
                ...current,
                limit: value,
              }))
            }
            value={createForm.limit}
          />
          <label>
            Dia de fechamento
            <input
              aria-label="Dia de fechamento"
              max="28"
              min="1"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  closingDay: event.target.value,
                }))
              }
              required
              type="number"
              value={createForm.closingDay}
            />
          </label>
          <label>
            Dia de vencimento
            <input
              aria-label="Dia de vencimento"
              max="28"
              min="1"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  dueDay: event.target.value,
                }))
              }
              required
              type="number"
              value={createForm.dueDay}
            />
          </label>
          <label className="custom-select-wrapper">
            Conta padrao para pagamento
            <select
              aria-label="Conta padrao para pagamento"
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  paymentAccountId: event.target.value,
                }))
              }
              required
              value={createForm.paymentAccountId}
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <p className="field-hint">Fechamento e vencimento aceitam apenas valores de 1 a 28.</p>
          {formError !== null ? (
            <p className="field-hint text-negative" role="alert">
              {formError}
            </p>
          ) : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Criando..." : "Criar cartao"}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={editingCardId !== null}
        onClose={() => {
          setFormError(null);
          setEditingCardId(null);
        }}
        title="Editar cartao"
      >
        <form className="form-card" onSubmit={handleUpdateSubmit}>
          <label>
            Nome do cartao
            <input
              aria-label="Nome do cartao"
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
          <CurrencyInput
            aria-label="Limite do cartao"
            id="edit-card-limit"
            label="Limite do cartao"
            onChange={(value) =>
              setEditForm((current) => ({
                ...current,
                limit: value,
              }))
            }
            value={editForm.limit}
          />
          <label>
            Dia de fechamento
            <input
              aria-label="Dia de fechamento"
              max="28"
              min="1"
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  closingDay: event.target.value,
                }))
              }
              required
              type="number"
              value={editForm.closingDay}
            />
          </label>
          <label>
            Dia de vencimento
            <input
              aria-label="Dia de vencimento"
              max="28"
              min="1"
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  dueDay: event.target.value,
                }))
              }
              required
              type="number"
              value={editForm.dueDay}
            />
          </label>
          <label className="custom-select-wrapper">
            Conta padrao para pagamento
            <select
              aria-label="Conta padrao para pagamento"
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  paymentAccountId: event.target.value,
                }))
              }
              required
              value={editForm.paymentAccountId}
            >
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
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
            Cartao ativo
          </label>
          <p className="field-hint">Fechamento e vencimento aceitam apenas valores de 1 a 28.</p>
          {formError !== null ? (
            <p className="field-hint text-negative" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="inline-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : "Salvar cartao"}
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setFormError(null);
                setEditingCardId(null);
              }}
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

function createEmptyForm(accounts: AccountSummary[]): CardFormState {
  return {
    name: "",
    limit: "0",
    closingDay: "1",
    dueDay: "1",
    paymentAccountId: accounts[0]?.account_id ?? "",
  };
}

function resolveAccountName(accounts: AccountSummary[], accountId: string): string {
  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

function validateForm(form: Pick<CardFormState, "name" | "limit" | "closingDay" | "dueDay" | "paymentAccountId">): string | null {
  if (!form.name.trim()) {
    return "Informe o nome do cartao.";
  }

  const limit = parseInt(form.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) {
    return "Informe um limite maior que zero.";
  }

  const closingDay = parseInt(form.closingDay, 10);
  if (!Number.isFinite(closingDay) || closingDay < 1 || closingDay > 28) {
    return "Dia de fechamento deve ficar entre 1 e 28.";
  }

  const dueDay = parseInt(form.dueDay, 10);
  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28) {
    return "Dia de vencimento deve ficar entre 1 e 28.";
  }

  if (!form.paymentAccountId) {
    return "Selecione a conta padrao para pagamento.";
  }

  return null;
}
