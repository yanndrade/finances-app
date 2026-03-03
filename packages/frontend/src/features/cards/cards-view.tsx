import { useEffect, useState, type FormEvent } from "react";

import { CurrencyInput } from "../../components/currency-input";
import { Modal } from "../../components/modal";
import { StatCard } from "../../components/stat-card";
import { formatCurrency } from "../../lib/format";
import {
  fetchInvoiceItems,
  type InvoiceItemSummary,
  type AccountSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardSummary,
  type InvoicePaymentPayload,
  type CardUpdatePayload,
  type InvoiceSummary,
} from "../../lib/api";

type CardsViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  isSubmitting: boolean;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onCreateCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
  onPayInvoice: (payload: InvoicePaymentPayload) => Promise<void>;
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
  installmentsCount: string;
  categoryId: string;
  description: string;
};

type PaymentFormState = {
  accountId: string;
  amount: string;
  paidAt: string;
};

export function CardsView({
  accounts,
  cards,
  invoices,
  isSubmitting,
  onCreateCard,
  onCreateCardPurchase,
  onPayInvoice,
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
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(() =>
    createEmptyPaymentForm(accounts),
  );
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [invoiceItemsByInvoiceId, setInvoiceItemsByInvoiceId] = useState<
    Record<string, InvoiceItemSummary[]>
  >({});
  const [invoiceItemsErrorByInvoiceId, setInvoiceItemsErrorByInvoiceId] = useState<
    Record<string, string>
  >({});
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
  const activeAccounts = accounts.filter((account) => account.is_active);
  const activeLimitTotal = activeCards.reduce((sum, card) => sum + card.limit, 0);
  const payableInvoices = invoices.filter(
    (invoice) => invoice.status === "open" || invoice.status === "partial",
  );
  const openInvoiceTotal = payableInvoices.reduce(
    (sum, invoice) => sum + invoice.remaining_amount,
    0,
  );

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
        installmentsCount: parseInt(purchaseForm.installmentsCount, 10),
        categoryId: purchaseForm.categoryId.trim(),
        description: purchaseForm.description.trim() || undefined,
      });
    } catch {
      return;
    }

    setPurchaseForm(createEmptyPurchaseForm(cards));
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentError(null);

    if (payingInvoiceId === null) {
      return;
    }

    const validationError = validatePaymentForm(paymentForm);
    if (validationError !== null) {
      setPaymentError(validationError);
      return;
    }

    try {
      await onPayInvoice({
        invoiceId: payingInvoiceId,
        amountInCents: parseInt(paymentForm.amount, 10),
        accountId: paymentForm.accountId,
        paidAt: paymentForm.paidAt,
      });
    } catch {
      return;
    }

    setPayingInvoiceId(null);
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

  function openPaymentModal(invoice: InvoiceSummary) {
    const preferredAccountId = cards.find((card) => card.card_id === invoice.card_id)?.payment_account_id;
    const selectedAccountId =
      activeAccounts.find((account) => account.account_id === preferredAccountId)?.account_id ??
      activeAccounts[0]?.account_id ??
      "";

    setPaymentError(null);
    setPayingInvoiceId(invoice.invoice_id);
    setPaymentForm({
      accountId: selectedAccountId,
      amount: String(invoice.remaining_amount),
      paidAt: currentLocalDateTime(),
    });
  }

  async function toggleInvoiceItems(invoiceId: string) {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null);
      return;
    }

    setExpandedInvoiceId(invoiceId);
    if (invoiceItemsByInvoiceId[invoiceId] !== undefined) {
      return;
    }

    setLoadingInvoiceId(invoiceId);
    setInvoiceItemsErrorByInvoiceId((current) => {
      if (current[invoiceId] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[invoiceId];
      return next;
    });

    try {
      const items = await fetchInvoiceItems(invoiceId);
      setInvoiceItemsByInvoiceId((current) => ({
        ...current,
        [invoiceId]: items,
      }));
    } catch (error) {
      setInvoiceItemsErrorByInvoiceId((current) => ({
        ...current,
        [invoiceId]: resolveInlineErrorMessage(error),
      }));
    } finally {
      setLoadingInvoiceId((current) => (current === invoiceId ? null : current));
    }
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
          label="Faturas pendentes"
          tone="default"
          value={String(payableInvoices.length)}
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
              Parcelas
              <input
                aria-label="Parcelas"
                min="1"
                onChange={(event) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    installmentsCount: event.target.value,
                  }))
                }
                required
                type="number"
                value={purchaseForm.installmentsCount}
              />
            </label>
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
              Compras parceladas dividem igualmente, com centavos residuais na ultima parcela.
            </p>
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

      <section aria-label="Faturas pendentes" className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Faturas</p>
            <h2 className="section-title">Resumo das faturas pendentes</h2>
            <p className="section-copy">
              Acompanhe saldo restante e registre pagamentos parciais ou totais sem sair daqui.
            </p>
          </div>
        </div>

        {payableInvoices.length === 0 ? (
          <div className="empty-state">Nenhuma fatura pendente para os cartoes cadastrados.</div>
        ) : (
          <div className="account-grid">
            {payableInvoices.map((invoice) => (
              <div key={invoice.invoice_id} className="invoice-card-shell">
                <article className="account-card">
                  <div className="account-card__header">
                    <div>
                      <strong>{resolveCardName(cards, invoice.card_id)}</strong>
                      <p className="account-card__meta">Referencia {invoice.reference_month}</p>
                    </div>
                    <span
                      className={`status-badge status-badge--${
                        invoice.status === "partial" ? "pending" : "active"
                      }`}
                    >
                      {invoice.status === "partial" ? "Parcial" : "Aberta"}
                    </span>
                  </div>
                  <p className="account-card__balance">{formatCurrency(invoice.remaining_amount)}</p>
                  <p className="account-card__meta">
                    Fecha em {invoice.closing_date} e vence em {invoice.due_date}
                  </p>
                  <p className="account-card__meta">
                    Total {formatCurrency(invoice.total_amount)} • Pago{" "}
                    {formatCurrency(invoice.paid_amount)}
                  </p>
                  <p className="account-card__meta">
                    {invoice.purchase_count}{" "}
                    {invoice.purchase_count === 1 ? "parcela" : "parcelas"}
                  </p>
                  <div className="inline-actions">
                    <button
                      className="ghost-button"
                      onClick={() => {
                        void toggleInvoiceItems(invoice.invoice_id);
                      }}
                      type="button"
                    >
                      {expandedInvoiceId === invoice.invoice_id ? "Ocultar itens" : "Ver itens"}
                    </button>
                    <button
                      className="ghost-button"
                      disabled={activeAccounts.length === 0}
                      onClick={() => openPaymentModal(invoice)}
                      type="button"
                    >
                      Registrar pagamento
                    </button>
                  </div>
                </article>

                {expandedInvoiceId === invoice.invoice_id ? (
                  <div className="invoice-detail-panel">
                    <div className="invoice-detail-panel__header">
                      <strong>Itens da fatura</strong>
                      <span>{invoice.reference_month}</span>
                    </div>

                    {loadingInvoiceId === invoice.invoice_id ? (
                      <p className="field-hint">Carregando itens...</p>
                    ) : null}

                    {invoiceItemsErrorByInvoiceId[invoice.invoice_id] !== undefined ? (
                      <p className="field-hint text-negative" role="alert">
                        {invoiceItemsErrorByInvoiceId[invoice.invoice_id]}
                      </p>
                    ) : null}

                    {loadingInvoiceId !== invoice.invoice_id &&
                    invoiceItemsErrorByInvoiceId[invoice.invoice_id] === undefined ? (
                      invoiceItemsByInvoiceId[invoice.invoice_id]?.length ? (
                        <div className="invoice-item-list">
                          {invoiceItemsByInvoiceId[invoice.invoice_id].map((item) => (
                            <div key={item.invoice_item_id} className="invoice-item-row">
                              <div className="invoice-item-row__main">
                                <strong>{item.description ?? "Compra sem descricao"}</strong>
                                <p>
                                  {item.category_id} • {formatPurchaseDate(item.purchase_date)}
                                </p>
                              </div>
                              <div className="invoice-item-row__meta">
                                <span>
                                  {item.installment_number}/{item.installments_count}
                                </span>
                                <strong>{formatCurrency(item.amount)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="field-hint">Nenhum item encontrado para esta fatura.</p>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={payingInvoiceId !== null}
        onClose={() => {
          setPaymentError(null);
          setPayingInvoiceId(null);
        }}
        title="Pagar fatura"
      >
        <form className="form-card" onSubmit={handlePaymentSubmit}>
          <label className="custom-select-wrapper">
            Conta de pagamento
            <select
              aria-label="Conta de pagamento"
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  accountId: event.target.value,
                }))
              }
              required
              value={paymentForm.accountId}
            >
              {activeAccounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <CurrencyInput
            aria-label="Valor do pagamento"
            id="invoice-payment-amount"
            label="Valor do pagamento"
            onChange={(value) =>
              setPaymentForm((current) => ({
                ...current,
                amount: value,
              }))
            }
            value={paymentForm.amount}
          />
          <label>
            Data do pagamento
            <input
              aria-label="Data do pagamento"
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  paidAt: event.target.value,
                }))
              }
              required
              type="datetime-local"
              value={paymentForm.paidAt}
            />
          </label>
          <p className="field-hint">
            Escolha qualquer conta ativa. O app sugere a conta padrao do cartao, mas voce pode trocar.
          </p>
          {paymentError !== null ? (
            <p className="field-hint text-negative" role="alert">
              {paymentError}
            </p>
          ) : null}
          <div className="inline-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Registrando..." : "Confirmar pagamento"}
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setPaymentError(null);
                setPayingInvoiceId(null);
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

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
    installmentsCount: "1",
    categoryId: "",
    description: "",
  };
}

function createEmptyPaymentForm(accounts: AccountSummary[]): PaymentFormState {
  return {
    accountId: accounts.find((account) => account.is_active)?.account_id ?? "",
    amount: "0",
    paidAt: currentLocalDateTime(),
  };
}

function currentLocalDateTime(): string {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);

  return localTime.toISOString().slice(0, 16);
}

function formatPurchaseDate(value: string): string {
  return value.slice(0, 10);
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

  const installmentsCount = parseInt(form.installmentsCount, 10);
  if (!Number.isFinite(installmentsCount) || installmentsCount <= 0) {
    return "Informe pelo menos uma parcela.";
  }

  if (!form.categoryId.trim()) {
    return "Informe a categoria da compra.";
  }

  return null;
}

function validatePaymentForm(form: PaymentFormState): string | null {
  if (!form.accountId) {
    return "Selecione uma conta ativa para pagar a fatura.";
  }

  const amount = parseInt(form.amount, 10);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Informe um valor maior que zero.";
  }

  if (!form.paidAt.trim()) {
    return "Informe a data do pagamento.";
  }

  return null;
}

function resolveInlineErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Nao foi possivel carregar os itens da fatura.";
}
