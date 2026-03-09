import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";

import { 
  AlertCircle, 
  ArrowDown, 
  ArrowUp, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Info, 
  Search, 
  SlidersHorizontal, 
  TriangleAlert 
} from "lucide-react";

import { TransactionDetailDrawer } from "./transaction-detail-drawer";
import { EmptyState } from "../../components/ui/empty-state";
import { MoneyValue } from "../../components/ui/money-value";

import type {
  AccountSummary,
  CardPurchaseUpdatePayload,
  CardSummary,
  TransactionFilters,
  TransactionSummary,
  TransactionTypeFilter,
  TransactionUpdatePayload,
} from "../../lib/api";
import { getCategoryOptions } from "../../lib/categories";
import {
  formatCategoryName,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  formatTransactionStatus,
  formatTransactionType,
  toDateTimeInputValue,
  toIsoDateTime,
} from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";

type TransactionsViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  transactions: TransactionSummary[];
  filters: TransactionFilters;
  isSubmitting: boolean;
  onApplyFilters: (filters: TransactionFilters) => Promise<void>;
  onUpdateCardPurchase: (
    purchaseId: string,
    payload: CardPurchaseUpdatePayload,
  ) => Promise<void>;
  onUpdateTransaction: (
    transactionId: string,
    payload: TransactionUpdatePayload,
  ) => Promise<void>;
  onVoidTransaction: (transactionId: string) => Promise<void>;
  uiDensity: UiDensity;
};

type TransactionEditForm = {
  occurredAt: string;
  type: "income" | "expense";
  amount: string;
  accountId: string;
  paymentMethod: "PIX" | "CASH" | "OTHER";
  categoryId: string;
  description: string;
  personId: string;
};

type CardPurchaseEditForm = {
  purchaseId: string;
  cardId: string;
  description: string;
};

type RequiredTransactionFilters = TransactionFilters & {
  period: "day" | "week" | "month" | "custom";
  reference: string;
};

type LedgerSortColumn =
  | "occurredAt"
  | "description"
  | "category"
  | "account"
  | "source"
  | "destination"
  | "person"
  | "method"
  | "type"
  | "status"
  | "amount";

type LedgerSortDirection = "asc" | "desc";

type TypeFilter = "all" | TransactionTypeFilter;
type TransactionPreset =
  | "month"
  | "fixed"
  | "cards"
  | "installments"
  | "transfers"
  | "investments"
  | "reimbursements"
  | "uncategorized"
  | "review";

type SplitDraftLine = {
  id: string;
  categoryId: string;
  amount: string;
};

type SplitLine = {
  categoryId: string;
  amountInCents: number;
};

export function TransactionsView({
  accounts,
  cards,
  transactions,
  filters,
  isSubmitting,
  onApplyFilters,
  onUpdateCardPurchase,
  onUpdateTransaction,
  onVoidTransaction,
  uiDensity,
}: TransactionsViewProps) {
  const [filterForm, setFilterForm] = useState<RequiredTransactionFilters>(() =>
    normalizeTransactionFilters(filters),
  );
  const [activePreset, setActivePreset] = useState<TransactionPreset>(() =>
    normalizeTransactionPreset(filters.preset),
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => filters.type ?? "all");
  const [sortColumn, setSortColumn] = useState<LedgerSortColumn>("occurredAt");
  const [sortDirection, setSortDirection] = useState<LedgerSortDirection>("desc");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionEditForm | null>(null);
  const [cardPurchaseEditForm, setCardPurchaseEditForm] =
    useState<CardPurchaseEditForm | null>(null);
  const [transactionSplits, setTransactionSplits] = useState<Record<string, SplitLine[]>>({});
  const [splitDraft, setSplitDraft] = useState<SplitDraftLine[] | null>(null);
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => {
    setFilterForm(normalizeTransactionFilters(filters));
    setTypeFilter(filters.type ?? "all");
    setActivePreset(normalizeTransactionPreset(filters.preset));
  }, [filters]);

  const selectedTransaction = useMemo(() => {
    if (selectedTransactionId === null) {
      return null;
    }

    return transactions.find((transaction) => transaction.transaction_id === selectedTransactionId) ?? null;
  }, [selectedTransactionId, transactions]);

  useEffect(() => {
    if (selectedTransaction === null) {
      setSplitDraft(null);
      setSplitError(null);
      return;
    }

    setSplitDraft(null);
    setSplitFeedback(null);
    setSplitError(null);
  }, [selectedTransaction]);

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApplyFilters({
      ...filterForm,
      preset: activePreset,
      type: typeFilter === "all" ? undefined : typeFilter,
    });
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingTransactionId === null || editForm === null) {
      return;
    }

    await onUpdateTransaction(editingTransactionId, {
      occurredAt: toIsoDateTime(editForm.occurredAt),
      type: editForm.type,
      amountInCents: toCents(editForm.amount),
      accountId: editForm.accountId,
      paymentMethod: editForm.paymentMethod,
      categoryId: editForm.categoryId,
      description: editForm.description,
      personId: editForm.personId || undefined,
    });

    setEditingTransactionId(null);
    setEditForm(null);
  }

  async function handleCardPurchaseEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (cardPurchaseEditForm === null) {
      return;
    }

    await onUpdateCardPurchase(cardPurchaseEditForm.purchaseId, {
      cardId: cardPurchaseEditForm.cardId,
    });

    setCardPurchaseEditForm(null);
  }

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = filterForm.text.trim().toLowerCase();
    const normalizedCategoryFilter = filterForm.category.trim().toLowerCase();
    const normalizedPersonFilter = filterForm.person.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (!matchesTransactionPreset(transaction, activePreset)) {
        return false;
      }

      if (typeFilter !== "all" && transaction.type !== typeFilter) {
        return false;
      }

      if (filterForm.account !== "" && transaction.account_id !== filterForm.account) {
        return false;
      }

      if (filterForm.card !== "") {
        const transactionCardId = extractCardId(transaction);
        if (transactionCardId !== filterForm.card) {
          return false;
        }
      }

      if (filterForm.method !== "" && transaction.payment_method !== filterForm.method) {
        return false;
      }

      const categoryPresentation = resolveCategoryPresentation(transaction, transactionSplits);
      if (normalizedCategoryFilter !== "") {
        const rawCategory = formatCategoryName(transaction.category_id).toLowerCase();
        const resolvedCategory = categoryPresentation.label.toLowerCase();
        if (
          !transaction.category_id.toLowerCase().includes(normalizedCategoryFilter) &&
          !rawCategory.includes(normalizedCategoryFilter) &&
          !resolvedCategory.includes(normalizedCategoryFilter)
        ) {
          return false;
        }
      }

      if (normalizedPersonFilter !== "") {
        const personId = (transaction.person_id ?? "").toLowerCase();
        if (!personId.includes(normalizedPersonFilter)) {
          return false;
        }
      }

      if (normalizedSearch === "") {
        return true;
      }

      const searchHaystack = [
        transaction.description ?? "",
        categoryPresentation.label,
        resolveAccountName(transaction.account_id, accounts),
        resolveCardName(transaction, cards),
        resolveLedgerEndpointLabel(transaction, "source", accounts),
        resolveLedgerEndpointLabel(transaction, "destination", accounts),
        formatPaymentMethod(transaction.payment_method),
        formatTransactionType(transaction.type),
        transaction.person_id ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchHaystack.includes(normalizedSearch);
    });
  }, [
    accounts,
    cards,
    filterForm.account,
    filterForm.card,
    filterForm.category,
    filterForm.method,
    filterForm.person,
    filterForm.text,
    transactions,
    transactionSplits,
    typeFilter,
    activePreset,
  ]);

  const visibleTransactions = useMemo(() => {
    return [...filteredTransactions].sort((left, right) =>
      compareTransactions(
        left,
        right,
        sortColumn,
        sortDirection,
        accounts,
        transactionSplits,
      ),
    );
  }, [
    accounts,
    filteredTransactions,
    sortColumn,
    sortDirection,
    transactionSplits,
  ]);

  const sliceKpis = useMemo(() => {
    const effectiveTransactions = visibleTransactions.filter((transaction) => transaction.status !== "voided");
    const incomeTotal = effectiveTransactions.reduce((sum, transaction) => {
      if (transaction.type === "income") {
        return sum + transaction.amount;
      }
      if (transaction.type === "investment" && transaction.ledger_event_type === "investment_withdrawal") {
        return sum + transaction.amount;
      }
      return sum;
    }, 0);
    const expenseTotal = effectiveTransactions.reduce((sum, transaction) => {
      if (
        transaction.type === "expense" &&
        transaction.ledger_event_type !== "invoice_payment" &&
        transaction.ledger_event_type !== "card_purchase"
      ) {
        return sum + transaction.amount;
      }
      if (transaction.type === "investment" && transaction.ledger_event_type === "investment_contribution") {
        return sum + transaction.amount;
      }
      return sum;
    }, 0);

    return {
      incomeTotal,
      expenseTotal,
      resultTotal: incomeTotal - expenseTotal,
    };
  }, [visibleTransactions]);

  const editCategoryOptions = getCategoryOptions(editForm?.categoryId);

  function handleSort(column: LedgerSortColumn) {
    if (column === sortColumn) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection(defaultSortDirection(column));
  }

  function openEditForm(transaction: TransactionSummary) {
    if (isEditableCardPurchaseTransaction(transaction)) {
      const purchaseId = extractPurchaseId(transaction);
      const cardId = extractCardId(transaction);
      if (purchaseId === null || cardId === null) {
        return;
      }

      setEditingTransactionId(null);
      setEditForm(null);
      setCardPurchaseEditForm({
        purchaseId,
        cardId,
        description: transaction.description ?? formatCategoryName(transaction.category_id),
      });
      return;
    }

    if (transaction.type !== "income" && transaction.type !== "expense") {
      return;
    }

    setCardPurchaseEditForm(null);
    setEditingTransactionId(transaction.transaction_id);
    setEditForm({
      occurredAt: toDateTimeInputValue(transaction.occurred_at),
      type: transaction.type as TransactionEditForm["type"],
      amount: String(transaction.amount / 100),
      accountId: transaction.account_id,
      paymentMethod: transaction.payment_method as TransactionEditForm["paymentMethod"],
      categoryId: transaction.category_id,
      description: transaction.description ?? transaction.category_id,
      personId: transaction.person_id ?? "",
    });
  }

  function canEditTransaction(transaction: TransactionSummary): boolean {
    if (isEditableCardPurchaseTransaction(transaction)) {
      return true;
    }

    return (
      transaction.status === "active" &&
      (transaction.type === "income" || transaction.type === "expense")
    );
  }

  function canVoidTransaction(transaction: TransactionSummary): boolean {
    return transaction.status === "active";
  }

  function handleStartSplit() {
    if (selectedTransaction === null) {
      return;
    }

    setSplitDraft([
      {
        id: "1",
        categoryId: selectedTransaction.category_id,
        amount: String(selectedTransaction.amount / 100),
      },
      {
        id: "2",
        categoryId: "other",
        amount: "",
      },
    ]);
    setSplitFeedback(null);
    setSplitError(null);
  }

  function handleSaveSplit() {
    if (selectedTransaction === null || splitDraft === null) {
      return;
    }

    const normalizedSplit = splitDraft.map((line) => ({
      categoryId: line.categoryId,
      amountInCents: toCents(line.amount),
    }));
    const splitTotal = normalizedSplit.reduce((sum, line) => sum + line.amountInCents, 0);

    if (normalizedSplit.some((line) => line.amountInCents <= 0)) {
      setSplitError("Cada divisao precisa ter valor maior que zero.");
      setSplitFeedback(null);
      return;
    }

    if (splitTotal !== selectedTransaction.amount) {
      setSplitError(`O split precisa fechar em ${formatCurrency(selectedTransaction.amount)}.`);
      setSplitFeedback(null);
      return;
    }

    setTransactionSplits((current) => ({
      ...current,
      [selectedTransaction.transaction_id]: normalizedSplit,
    }));
    setSplitDraft(null);
    setSplitError(null);
    setSplitFeedback("Split salvo para esta transação.");
    setSelectedTransactionId(null);
  }

  return (
    <section aria-label="Histórico e filtros" className="panel-card">
      <div className="ledger-header">
        <div>
          <p className="eyebrow">Operacional</p>
          <h2 className="section-title">Histórico de Transações</h2>
          <p className="section-copy">Painel de controle com presets e filtros inteligentes.</p>
        </div>
        <div className="ledger-kpi-grid" role="group" aria-label="Kpis do recorte">
          <LedgerKpi label="Entradas" tone="positive" value={sliceKpis.incomeTotal} />
          <LedgerKpi label="Saídas" tone="negative" value={sliceKpis.expenseTotal} />
          <LedgerKpi label="Resultado" tone="default" value={sliceKpis.resultTotal} />
        </div>
      </div>

      <div className="inline-actions" aria-label="Presets do histórico">
        <button className={activePreset === "month" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("month")} type="button">
          Tudo do mês
        </button>
        <button className={activePreset === "fixed" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("fixed")} type="button">
          Gastos fixos
        </button>
        <button className={activePreset === "cards" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("cards")} type="button">
          Cartão de crédito
        </button>
        <button className={activePreset === "installments" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("installments")} type="button">
          Parcelas do mês
        </button>
        <button className={activePreset === "transfers" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("transfers")} type="button">
          Transferências
        </button>
        <button className={activePreset === "investments" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("investments")} type="button">
          Investimentos
        </button>
        <button className={activePreset === "reimbursements" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("reimbursements")} type="button">
          Reembolsos
        </button>
        <button className={activePreset === "uncategorized" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("uncategorized")} type="button">
          Não categorizados
        </button>
        <button className={activePreset === "review" ? "primary-button" : "ghost-button"} onClick={() => setActivePreset("review")} type="button">
          Pendentes de revisão
        </button>
      </div>

      <form className="filters-grid" onSubmit={handleFilterSubmit}>
        <label>
          Período
          <select
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                period: event.target.value as RequiredTransactionFilters["period"],
              }))
            }
            value={filterForm.period}
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="custom">Customizado</option>
          </select>
        </label>
        <label>
          Buscar
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                text: event.target.value,
              }))
            }
            value={filterForm.text}
          />
        </label>
        {filterForm.period === "custom" ? (
          <>
            <label>
              De
              <input
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                type="date"
                value={filterForm.from}
              />
            </label>
            <label>
              Até
              <input
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                type="date"
                value={filterForm.to}
              />
            </label>
          </>
        ) : (
          <label>
            Referência
            <input
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
              type="date"
              value={filterForm.reference}
            />
          </label>
        )}
        <label>
          Tipo
          <select
            aria-label="Tipo do filtro"
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            value={typeFilter}
          >
            <option value="all">Todos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
            <option value="transfer">Transferências</option>
            <option value="investment">Investimentos</option>
          </select>
        </label>
        <div className="inline-actions">
          <button className="ghost-button" onClick={() => setShowAdvancedFilters((current) => !current)} type="button">
            {showAdvancedFilters ? "Ocultar filtros avançados" : "Mostrar filtros avançados"}
          </button>
        </div>
        <div className="inline-actions">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>

      {showAdvancedFilters ? (
        <div className="filters-grid">
          <label>
            Conta
            <select
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  account: event.target.value,
                }))
              }
              value={filterForm.account}
            >
              <option value="">Todas</option>
              {accounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cartão
            <select
              aria-label="Cartao do filtro"
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  card: event.target.value,
                }))
              }
              value={filterForm.card}
            >
              <option value="">Todos</option>
              {cards.map((card) => (
                <option key={card.card_id} value={card.card_id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Método
            <select
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  method: event.target.value as TransactionFilters["method"],
                }))
              }
              value={filterForm.method}
            >
              <option value="">Todos</option>
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="OTHER">Outro</option>
            </select>
          </label>
          <label>
            Categoria
            <input
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
              value={filterForm.category}
            />
          </label>
          <label>
            Pessoa
            <input
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  person: event.target.value,
                }))
              }
              value={filterForm.person}
            />
          </label>
        </div>
      ) : null}

      {splitFeedback ? <p className="success-banner">{splitFeedback}</p> : null}

      {editingTransactionId !== null && editForm !== null ? (
        <form className="panel-card panel-card--nested" onSubmit={handleEditSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Edição</p>
              <h3 className="section-title">Editar transação</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Data da transação
              <input
                aria-label="Data da transação"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          occurredAt: event.target.value,
                        },
                  )
                }
                required
                type="datetime-local"
                value={editForm.occurredAt}
              />
            </label>
            <label>
              Tipo da transação
              <select
                aria-label="Tipo da transação"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          type: event.target.value as TransactionEditForm["type"],
                        },
                  )
                }
                value={editForm.type}
              >
                <option value="expense">Saída</option>
                <option value="income">Entrada</option>
              </select>
            </label>
            <label>
              Conta da transação
              <select
                aria-label="Conta da transação"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          accountId: event.target.value,
                        },
                  )
                }
                value={editForm.accountId}
              >
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Método da transação
              <select
                aria-label={"M\u00E9todo da transa\u00E7\u00E3o"}
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          paymentMethod: event.target.value as TransactionEditForm["paymentMethod"],
                        },
                  )
                }
                value={editForm.paymentMethod}
              >
                <option value="PIX">PIX</option>
                <option value="CASH">Dinheiro</option>
                <option value="OTHER">Outro</option>
              </select>
            </label>
            <label>
              Descrição da transação
              <input
                aria-label="Descrição da transação"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          description: event.target.value,
                        },
                  )
                }
                required
                value={editForm.description}
              />
            </label>
            <label>
              Valor da transação
              <input
                aria-label="Valor da transação"
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          amount: event.target.value,
                        },
                  )
                }
                required
                step="0.01"
                value={editForm.amount}
              />
            </label>
            <label>
              Categoria da transação
              <select
                aria-label="Categoria da transação"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          categoryId: event.target.value,
                        },
                  )
                }
                required
                value={editForm.categoryId}
              >
                {editCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pessoa da transação
              <input
                aria-label="Pessoa da transação"
                onChange={(event) =>
                  setEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          personId: event.target.value,
                        },
                  )
                }
                value={editForm.personId}
              />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              Salvar alterações
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setEditingTransactionId(null);
                setEditForm(null);
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {cardPurchaseEditForm !== null ? (
        <form className="panel-card panel-card--nested" onSubmit={handleCardPurchaseEditSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">EdiÃ§Ã£o</p>
              <h3 className="section-title">Trocar cartÃ£o da compra</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Compra
              <input disabled value={cardPurchaseEditForm.description} />
            </label>
            <label>
              Novo cartÃ£o
              <select
                aria-label="Cartao da compra"
                onChange={(event) =>
                  setCardPurchaseEditForm((current) =>
                    current === null
                      ? null
                      : {
                          ...current,
                          cardId: event.target.value,
                        },
                  )
                }
                required
                value={cardPurchaseEditForm.cardId}
              >
                {cards.map((card) => (
                  <option key={card.card_id} value={card.card_id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-hint">
            A compra serÃ¡ movida para o novo cartÃ£o sem duplicar parcelas nem alterar o total.
          </p>
          <div className="inline-actions">
            <button className="primary-button" disabled={isSubmitting} type="submit">
              Salvar alteraÃ§Ã£o
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setCardPurchaseEditForm(null);
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {visibleTransactions.length === 0 ? (
        <EmptyState 
          icon={Calendar} 
          title="Nenhuma transação encontrada" 
          description="Ajuste os filtros ou o período para visualizar outros lançamentos."
          className="py-20"
        />
      ) : (
        <div className={`table-shell table-shell--${uiDensity}`}>
          <table className="data-table">
            <thead>
              <tr>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "occurredAt")}>
                  <SortHeaderButton
                    label="Data"
                    column="occurredAt"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "description")}>
                  <SortHeaderButton
                    label="Descrição"
                    column="description"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "category")}>
                  <SortHeaderButton
                    label="Categoria"
                    column="category"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                {uiDensity === "comfort" && (
                  <>
                    <th aria-sort={getAriaSort(sortColumn, sortDirection, "account")}>
                      <SortHeaderButton
                        label="Conta"
                        column="account"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th aria-sort={getAriaSort(sortColumn, sortDirection, "source")}>
                      <SortHeaderButton
                        label="Origem"
                        column="source"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th aria-sort={getAriaSort(sortColumn, sortDirection, "destination")}>
                      <SortHeaderButton
                        label="Destino"
                        column="destination"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  </>
                )}
                {uiDensity !== "dense" && (
                  <th aria-sort={getAriaSort(sortColumn, sortDirection, "method")}>
                    <SortHeaderButton
                      label="Método"
                      column="method"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                )}
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "person")}>
                  <SortHeaderButton
                    label="Pessoa"
                    column="person"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "type")}>
                  <SortHeaderButton
                    label="Tipo"
                    column="type"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "status")}>
                  <SortHeaderButton
                    label="Status"
                    column="status"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "amount")}>
                  <SortHeaderButton
                    label="Valor"
                    column="amount"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => {
                const categoryPresentation = resolveCategoryPresentation(transaction, transactionSplits);
                const sourceLabel = resolveLedgerEndpointLabel(transaction, "source", accounts);
                const destinationLabel = resolveLedgerEndpointLabel(transaction, "destination", accounts);
                const canEdit = canEditTransaction(transaction);
                const canVoid = canVoidTransaction(transaction);
                return (
                  <tr
                    key={transaction.transaction_id}
                    className="data-table__row--interactive"
                    onClick={() => setSelectedTransactionId(transaction.transaction_id)}
                  >
                    <td>{formatDateTime(transaction.occurred_at)}</td>
                    <td>{transaction.description ?? transaction.category_id}</td>
                    <td>{categoryPresentation.label}</td>
                    {uiDensity === "comfort" && (
                      <>
                        <td>{resolveAccountName(transaction.account_id, accounts)}</td>
                        <td>{sourceLabel}</td>
                        <td>{destinationLabel}</td>
                      </>
                    )}
                    {uiDensity !== "dense" && (
                      <td>{formatPaymentMethod(transaction.payment_method)}</td>
                    )}
                    <td>{transaction.person_id?.trim() || "--"}</td>
                    <td>{formatTransactionType(transaction.type)}</td>
                    <td>
                      <span className={`status-badge status-badge--${transaction.status}`}>
                        {formatTransactionStatus(transaction.status)}
                      </span>
                    </td>
                    <td>
                      <MoneyValue 
                        value={transaction.amount} 
                        neutral={transaction.type === "transfer"} 
                      />
                    </td>
                    <td>
                      {canEdit || canVoid ? (
                        <div className="inline-actions">
                          {canEdit ? (
                            <button
                              className="ghost-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditForm(transaction);
                                setSelectedTransactionId(null);
                              }}
                              type="button"
                            >
                              Editar
                            </button>
                          ) : null}
                          {canVoid ? (
                            <button
                              className="ghost-button ghost-button--danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                void onVoidTransaction(transaction.transaction_id);
                              }}
                              type="button"
                            >
                              Estornar
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="field-hint">Sem ações</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TransactionDetailDrawer
        transaction={selectedTransaction}
        accounts={accounts}
        cards={cards} // I need to make sure cards is available or fetched
        isOpen={selectedTransaction !== null}
        onClose={() => setSelectedTransactionId(null)}
        onEdit={(t: TransactionSummary) => {
          openEditForm(t);
          setSelectedTransactionId(null);
        }}
        onVoid={(id: string) => {
          void onVoidTransaction(id);
          setSelectedTransactionId(null);
        }}
        onStartSplit={handleStartSplit}
      />
    </section>
  );
}

function matchesTransactionPreset(
  transaction: TransactionSummary,
  preset: TransactionPreset,
): boolean {
  if (preset === "month") {
    return true;
  }

  if (preset === "fixed") {
    return (
      transaction.ledger_event_type === "recurring_expense" ||
      transaction.ledger_event_type === "recurring_card_purchase" ||
      transaction.ledger_event_type === "recurring_card_installment"
    );
  }

  if (preset === "cards") {
    return extractCardId(transaction) !== null;
  }

  if (preset === "installments") {
    return transaction.ledger_event_type === "card_installment";
  }

  if (preset === "transfers") {
    return transaction.type === "transfer";
  }

  if (preset === "investments") {
    return transaction.type === "investment";
  }

  if (preset === "reimbursements") {
    return (transaction.person_id?.trim().length ?? 0) > 0;
  }

  if (preset === "uncategorized") {
    return transaction.category_id === "other";
  }

  return requiresLedgerReview(transaction);
}

function requiresLedgerReview(transaction: TransactionSummary): boolean {
  const description = transaction.description?.trim() ?? "";
  return description === "" || transaction.category_id === "other";
}

function normalizeTransactionPreset(value: string | undefined): TransactionPreset {
  switch (value) {
    case "fixed":
    case "cards":
    case "installments":
    case "transfers":
    case "investments":
    case "reimbursements":
    case "uncategorized":
    case "review":
      return value;
    default:
      return "month";
  }
}

function normalizeTransactionFilters(filters: TransactionFilters): RequiredTransactionFilters {
  return {
    ...filters,
    period: filters.period ?? "month",
    reference: filters.reference ?? localDateToday(),
  };
}

function localDateToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveAccountName(accountId: string, accounts: AccountSummary[]): string {
  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

function resolveCardName(transaction: TransactionSummary, cards: CardSummary[]): string {
  const cardId = extractCardId(transaction);
  if (cardId === null) {
    return "";
  }

  return cards.find((card) => card.card_id === cardId)?.name ?? cardId;
}

function extractCardId(transaction: TransactionSummary): string | null {
  const ledgerSource = transaction.ledger_source ?? "";
  if (ledgerSource.startsWith("card_liability:")) {
    return ledgerSource.slice("card_liability:".length);
  }

  if (transaction.category_id === "invoice_payment") {
    const description = transaction.description ?? "";
    const marker = "Pagamento de fatura ";
    const start = description.indexOf(marker);
    if (start >= 0) {
      const invoiceIdentifier = description.slice(start + marker.length).trim();
      const separator = invoiceIdentifier.indexOf(":");
      return separator >= 0 ? invoiceIdentifier.slice(0, separator) : invoiceIdentifier || null;
    }
  }

  return null;
}

function extractPurchaseId(transaction: TransactionSummary): string | null {
  if (!isEditableCardPurchaseTransaction(transaction)) {
    return null;
  }

  if (transaction.transaction_id.endsWith(":card-purchase")) {
    return transaction.transaction_id.slice(0, -":card-purchase".length);
  }

  if (transaction.transaction_id.endsWith(":card-installment")) {
    const installmentId = transaction.transaction_id.slice(0, -":card-installment".length);
    const lastSeparator = installmentId.lastIndexOf(":");
    return lastSeparator >= 0 ? installmentId.slice(0, lastSeparator) : installmentId;
  }

  return null;
}

function isEditableCardPurchaseTransaction(transaction: TransactionSummary): boolean {
  return (
    transaction.ledger_event_type === "card_purchase" ||
    transaction.ledger_event_type === "card_installment" ||
    transaction.ledger_event_type === "recurring_card_purchase" ||
    transaction.ledger_event_type === "recurring_card_installment"
  );
}

function resolveLedgerEndpointLabel(
  transaction: TransactionSummary,
  endpoint: "source" | "destination",
  accounts: AccountSummary[],
): string {
  const encodedEndpoint =
    endpoint === "source" ? transaction.ledger_source : transaction.ledger_destination;

  if (encodedEndpoint) {
    return formatLedgerEntity(encodedEndpoint, accounts);
  }

  return resolveLedgerFallback(transaction, endpoint, accounts);
}

function resolveLedgerFallback(
  transaction: TransactionSummary,
  endpoint: "source" | "destination",
  accounts: AccountSummary[],
): string {
  if (transaction.type === "transfer") {
    if (endpoint === "source") {
      if (transaction.direction === "credit") {
        return "Transferencia interna";
      }
      return resolveAccountName(transaction.account_id, accounts);
    }

    if (transaction.direction === "debit") {
      return "Transferencia interna";
    }
    return resolveAccountName(transaction.account_id, accounts);
  }

  if (transaction.type === "income") {
    return endpoint === "source"
      ? formatCategoryName(transaction.category_id)
      : resolveAccountName(transaction.account_id, accounts);
  }

  if (transaction.type === "expense" && transaction.category_id === "invoice_payment") {
    return endpoint === "source"
      ? resolveAccountName(transaction.account_id, accounts)
      : "Passivo de cartao";
  }

  if (transaction.type === "expense") {
    return endpoint === "source"
      ? resolveAccountName(transaction.account_id, accounts)
      : formatCategoryName(transaction.category_id);
  }

  if (transaction.type === "investment") {
    if (transaction.category_id === "investment_withdrawal") {
      return endpoint === "source"
        ? "Patrimonio investido"
        : resolveAccountName(transaction.account_id, accounts);
    }

    return endpoint === "source"
      ? resolveAccountName(transaction.account_id, accounts)
      : "Patrimonio investido";
  }

  return "--";
}

function formatLedgerEntity(value: string, accounts: AccountSummary[]): string {
  const separatorIndex = value.indexOf(":");
  const kind = separatorIndex >= 0 ? value.slice(0, separatorIndex) : value;
  const id = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : "";

  if (kind === "account") {
    return resolveAccountName(id, accounts);
  }
  if (kind === "category") {
    return formatCategoryName(id);
  }
  if (kind === "transfer") {
    return "Transferencia interna";
  }
  if (kind === "card_liability") {
    return `Passivo ${id || "cartao"}`;
  }
  if (kind === "person") {
    return id || "Pessoa";
  }
  if (kind === "investment_asset") {
    return "Patrimonio investido";
  }

  return "--";
}

function toCents(rawValue: string): number {
  return Math.round(Number(rawValue.replace(",", ".")) * 100);
}

function defaultSortDirection(column: LedgerSortColumn): LedgerSortDirection {
  if (column === "amount" || column === "occurredAt") {
    return "desc";
  }

  return "asc";
}

function getAriaSort(
  activeColumn: LedgerSortColumn,
  direction: LedgerSortDirection,
  column: LedgerSortColumn,
): "none" | "ascending" | "descending" {
  if (activeColumn !== column) {
    return "none";
  }

  return direction === "asc" ? "ascending" : "descending";
}

function compareTransactions(
  left: TransactionSummary,
  right: TransactionSummary,
  column: LedgerSortColumn,
  direction: LedgerSortDirection,
  accounts: AccountSummary[],
  transactionSplits: Record<string, SplitLine[]>,
): number {
  let comparison = 0;

  switch (column) {
    case "occurredAt":
      comparison =
        new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime();
      break;
    case "amount":
      comparison = left.amount - right.amount;
      break;
    case "description":
      comparison = compareText(
        left.description ?? left.category_id,
        right.description ?? right.category_id,
      );
      break;
    case "category":
      comparison = compareText(
        resolveCategoryPresentation(left, transactionSplits).label,
        resolveCategoryPresentation(right, transactionSplits).label,
      );
      break;
    case "account":
      comparison = compareText(
        resolveAccountName(left.account_id, accounts),
        resolveAccountName(right.account_id, accounts),
      );
      break;
    case "source":
      comparison = compareText(
        resolveLedgerEndpointLabel(left, "source", accounts),
        resolveLedgerEndpointLabel(right, "source", accounts),
      );
      break;
    case "destination":
      comparison = compareText(
        resolveLedgerEndpointLabel(left, "destination", accounts),
        resolveLedgerEndpointLabel(right, "destination", accounts),
      );
      break;
    case "method":
      comparison = compareText(
        formatPaymentMethod(left.payment_method),
        formatPaymentMethod(right.payment_method),
      );
      break;
    case "person":
      comparison = compareText(left.person_id ?? "", right.person_id ?? "");
      break;
    case "type":
      comparison = compareText(
        formatTransactionType(left.type),
        formatTransactionType(right.type),
      );
      break;
    case "status":
      comparison = compareText(
        formatTransactionStatus(left.status),
        formatTransactionStatus(right.status),
      );
      break;
    default:
      comparison = 0;
      break;
  }

  if (comparison === 0) {
    comparison = compareText(left.transaction_id, right.transaction_id);
  }

  return direction === "asc" ? comparison : comparison * -1;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "pt-BR", { sensitivity: "base" });
}

function resolveCategoryPresentation(
  transaction: TransactionSummary,
  transactionSplits: Record<string, SplitLine[]>,
): {
  label: string;
  source: "transaction" | "split";
} {
  const split = transactionSplits[transaction.transaction_id];
  if (split && split.length > 0) {
    return {
      label: `Dividida (${split.length})`,
      source: "split",
    };
  }

  return {
    label: formatCategoryName(transaction.category_id),
    source: "transaction",
  };
}

function LedgerKpi({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "default" | "positive" | "negative";
  value: number;
}) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <p className="stat-card__label">{label}</p>
      <strong className="stat-card__value">{formatCurrency(value)}</strong>
    </div>
  );
}

function SortHeaderButton({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string;
  column: LedgerSortColumn;
  activeColumn: LedgerSortColumn;
  direction: LedgerSortDirection;
  onSort: (column: LedgerSortColumn) => void;
}) {
  const isActive = activeColumn === column;
  const indicator = isActive ? (direction === "asc" ? "^" : "v") : "<>";

  return (
    <button
      type="button"
      className={`table-sort-button${isActive ? " is-active" : ""}`}
      aria-label={`Ordenar por ${label}`}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      <span className="table-sort-button__indicator" aria-hidden="true">
        {indicator}
      </span>
    </button>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
