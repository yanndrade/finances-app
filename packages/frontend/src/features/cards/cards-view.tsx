import { useEffect, useState, type FormEvent } from "react";

import { CurrencyInput } from "../../components/currency-input";
import { Modal } from "../../components/modal";
import { StatCard } from "../../components/stat-card";
import { formatCurrency } from "../../lib/format";
import type {
  AccountSummary,
  CardPayload,
  CardPurchasePayload,
  CardSummary,
  CardUpdatePayload,
  InvoiceSummary,
} from "../../lib/api";

type CardsViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  isSubmitting: boolean;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onCreateCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
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

type PurchaseFormState = {
  cardId: string;
  purchaseDate: string;
  amount: string;
  categoryId: string;
  description: string;
};

export function CardsView({
  accounts,
  cards,
  invoices,
  isSubmitting,
  onCreateCard,
  onCreateCardPurchase,
  onUpdateCard,
}: CardsViewProps) {
  const [createForm, setCreateForm] = useState<CardFormState>(() => createEmptyForm(accounts));
  const [editForm, setEditForm] = useState<CardEditState>({
    ...createEmptyForm(accounts),
    isActive: true,
  });
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(() =>
    createEmptyPurchaseForm(cards),
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    setCreateForm((current) =>
      current.paymentAccountId ? current : createEmptyForm(accounts),
    );
  }, [accounts]);

  useEffect(() => {
    setPurchaseForm((current) => {
      if (cards.some((card) => card.card_id === current.cardId && card.is_active)) {
        return current;
      }

      return createEmptyPurchaseForm(cards);
    });
  }, [cards]);

  const activeCards = cards.filter((card) => card.is_active);
  const activeLimitTotal = activeCards.reduce((sum, card) => sum + card.limit, 0);
  const openInvoices = invoices.filter((invoice) => invoice.status === "open");
  const openInvoiceTotal = openInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);

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

  async function handlePurchaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPurchaseError(null);

    const validationError = validatePurchaseForm(purchaseForm);
    if (validationError !== null) {
      setPurchaseError(validationError);
      return;
    }

    try {
      await onCreateCardPurchase({
        cardId: purchaseForm.cardId,
        purchaseDate: purchaseForm.purchaseDate,
        amountInCents: parseInt(purchaseForm.amount, 10),
        categoryId: purchaseForm.categoryId.trim(),
        description: purchaseForm.description.trim() || undefined,
      });
    } catch {
      return;
    }

    setPurchaseForm(createEmptyPurchaseForm(cards));
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
        <StatCard
          label="Faturas abertas"
          tone="default"
          value={String(openInvoices.length)}
        />
        <StatCard
          label="Total em faturas"
          tone="default"
          value={formatCurrency(openInvoiceTotal)}
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

      <section aria-label="Registrar compra no cartao" className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Compras</p>
            <h2 className="section-title">Lancar compra no cartao</h2>
            <p className="section-copy">
              Registre a compra e deixe o app distribuir automaticamente no ciclo correto.
            </p>
          </div>
        </div>

        {activeCards.length === 0 ? (
          <div className="empty-state">
            Cadastre e mantenha ao menos um cartao ativo para registrar compras.
          </div>
        ) : (
          <form className="form-card" onSubmit={handlePurchaseSubmit}>
            <label className="custom-select-wrapper">
              Cartao da compra
              <select
                aria-label="Cartao da compra"
                onChange={(event) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    cardId: event.target.value,
                  }))
                }
                required
                value={purchaseForm.cardId}
              >
                {activeCards.map((card) => (
                  <option key={card.card_id} value={card.card_id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data da compra
              <input
                aria-label="Data da compra"
                onChange={(event) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    purchaseDate: event.target.value,
                  }))
                }
                required
                type="datetime-local"
                value={purchaseForm.purchaseDate}
              />
            </label>
            <CurrencyInput
              aria-label="Valor da compra"
              id="create-card-purchase-amount"
              label="Valor da compra"
              onChange={(value) =>
                setPurchaseForm((current) => ({
                  ...current,
                  amount: value,
                }))
              }
              value={purchaseForm.amount}
            />
            <label>
              Categoria da compra
              <input
                aria-label="Categoria da compra"
                onChange={(event) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                required
                value={purchaseForm.categoryId}
              />
            </label>
            <label>
              Descricao da compra
              <input
                aria-label="Descricao da compra"
                onChange={(event) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Opcional"
                value={purchaseForm.description}
              />
            </label>
            <p className="field-hint">
              Compras no dia do fechamento entram na fatura atual; depois disso, vao para o proximo ciclo.
            </p>
            {purchaseError !== null ? (
              <p className="field-hint text-negative" role="alert">
                {purchaseError}
              </p>
            ) : null}
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Registrando..." : "Registrar compra"}
            </button>
          </form>
        )}
      </section>

      <section aria-label="Faturas abertas" className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Faturas</p>
            <h2 className="section-title">Resumo das faturas abertas</h2>
            <p className="section-copy">
              Confira valor acumulado, vencimento e volume de compras por cartao.
            </p>
          </div>
        </div>

        {openInvoices.length === 0 ? (
          <div className="empty-state">Nenhuma fatura aberta para os cartoes cadastrados.</div>
        ) : (
          <div className="account-grid">
            {openInvoices.map((invoice) => (
              <article key={invoice.invoice_id} className="account-card">
                <div className="account-card__header">
                  <div>
                    <strong>{resolveCardName(cards, invoice.card_id)}</strong>
                    <p className="account-card__meta">Referencia {invoice.reference_month}</p>
                  </div>
                  <span className="status-badge status-badge--active">Aberta</span>
                </div>
                <p className="account-card__balance">{formatCurrency(invoice.total_amount)}</p>
                <p className="account-card__meta">
                  Fecha em {invoice.closing_date} e vence em {invoice.due_date}
                </p>
                <p className="account-card__meta">
                  {invoice.purchase_count} {invoice.purchase_count === 1 ? "compra" : "compras"}
                </p>
              </article>
            ))}
          </div>
        )}
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

function createEmptyPurchaseForm(cards: CardSummary[]): PurchaseFormState {
  return {
    cardId: cards.find((card) => card.is_active)?.card_id ?? "",
    purchaseDate: currentLocalDateTime(),
    amount: "0",
    categoryId: "",
    description: "",
  };
}

function currentLocalDateTime(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localTime.toISOString().slice(0, 16);
}

function resolveAccountName(accounts: AccountSummary[], accountId: string): string {
  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

function resolveCardName(cards: CardSummary[], cardId: string): string {
  return cards.find((card) => card.card_id === cardId)?.name ?? cardId;
}

function validateForm(
  form: Pick<CardFormState, "name" | "limit" | "closingDay" | "dueDay" | "paymentAccountId">,
): string | null {
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

function validatePurchaseForm(form: PurchaseFormState): string | null {
  if (!form.cardId) {
    return "Selecione um cartao ativo.";
  }

  if (!form.purchaseDate.trim()) {
    return "Informe a data da compra.";
  }

  const amount = parseInt(form.amount, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Informe um valor maior que zero.";
  }

  if (!form.categoryId.trim()) {
    return "Informe a categoria da compra.";
  }

  return null;
}
