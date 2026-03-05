import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";

import type {
  AccountSummary,
  CardSummary,
  TransactionFilters,
  TransactionSummary,
  TransactionTypeFilter,
  TransactionUpdatePayload,
} from "../../lib/api";
import type { CategoryRule } from "../../lib/category-rules";
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
  categoryRules: CategoryRule[];
  cards: CardSummary[];
  transactions: TransactionSummary[];
  filters: TransactionFilters;
  isSubmitting: boolean;
  onApplyFilters: (filters: TransactionFilters) => Promise<void>;
  onDensityChange: (density: UiDensity) => void;
  onUpsertCategoryRule: (pattern: string, categoryId: string) => boolean;
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
  categoryRules,
  cards,
  transactions,
  filters,
  isSubmitting,
  onApplyFilters,
  onDensityChange,
  onUpsertCategoryRule,
  onUpdateTransaction,
  onVoidTransaction,
  uiDensity,
}: TransactionsViewProps) {
  const [filterForm, setFilterForm] = useState<RequiredTransactionFilters>(() =>
    normalizeTransactionFilters(filters),
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => filters.type ?? "all");
  const [sortColumn, setSortColumn] = useState<LedgerSortColumn>("occurredAt");
  const [sortDirection, setSortDirection] = useState<LedgerSortDirection>("desc");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TransactionEditForm | null>(null);
  const [transactionSplits, setTransactionSplits] = useState<Record<string, SplitLine[]>>({});
  const [splitDraft, setSplitDraft] = useState<SplitDraftLine[] | null>(null);
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [rulePattern, setRulePattern] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [ruleFeedback, setRuleFeedback] = useState<string | null>(null);

  useEffect(() => {
    setFilterForm(normalizeTransactionFilters(filters));
    setTypeFilter(filters.type ?? "all");
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
      setRuleFeedback(null);
      setRulePattern("");
      setRuleCategoryId("");
      return;
    }

    const firstWord = (selectedTransaction.description ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const existingRule = findMatchingRule(selectedTransaction, categoryRules);
    setSplitDraft(null);
    setSplitFeedback(null);
    setSplitError(null);
    setRuleFeedback(null);
    setRulePattern(existingRule?.pattern ?? firstWord);
    setRuleCategoryId(existingRule?.categoryId ?? selectedTransaction.category_id);
  }, [categoryRules, selectedTransaction]);

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApplyFilters({
      ...filterForm,
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

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = filterForm.text.trim().toLowerCase();
    const normalizedCategoryFilter = filterForm.category.trim().toLowerCase();
    const normalizedPersonFilter = filterForm.person.trim().toLowerCase();

    return transactions.filter((transaction) => {
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

      const categoryPresentation = resolveCategoryPresentation(transaction, transactionSplits, categoryRules);
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
    categoryRules,
    filterForm.account,
    filterForm.card,
    filterForm.category,
    filterForm.method,
    filterForm.person,
    filterForm.text,
    transactions,
    transactionSplits,
    typeFilter,
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
        categoryRules,
      ),
    );
  }, [
    accounts,
    categoryRules,
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
      if (transaction.type === "expense") {
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
    if (transaction.type !== "income" && transaction.type !== "expense") {
      return;
    }

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
    setSplitFeedback("Split salvo para esta transacao.");
    setSelectedTransactionId(null);
  }

  function handleSaveRule() {
    if (selectedTransaction === null) {
      return;
    }

    const normalizedPattern = rulePattern.trim().toLowerCase();
    if (normalizedPattern === "" || ruleCategoryId === "") {
      return;
    }

    const wasSaved = onUpsertCategoryRule(normalizedPattern, ruleCategoryId);
    if (!wasSaved) {
      return;
    }

    setRuleFeedback("Regra salva e aplicada no historico.");
    setSelectedTransactionId(null);
  }

  const selectedTransactionSplit = selectedTransaction
    ? transactionSplits[selectedTransaction.transaction_id] ?? null
    : null;

  return (
    <section aria-label="Historico e filtros" className="panel-card">
      <div className="ledger-header">
        <div>
          <p className="eyebrow">Ledger</p>
          <h2 className="section-title">Historico unificado</h2>
          <p className="section-copy">Linha do tempo do dinheiro com filtros e acoes rapidas.</p>
        </div>
        <div className="ledger-kpi-grid" role="group" aria-label="Kpis do recorte">
          <LedgerKpi label="Entradas" tone="positive" value={sliceKpis.incomeTotal} />
          <LedgerKpi label="Saidas" tone="negative" value={sliceKpis.expenseTotal} />
          <LedgerKpi label="Resultado" tone="default" value={sliceKpis.resultTotal} />
        </div>
      </div>

      <form className="filters-grid" onSubmit={handleFilterSubmit}>
        <label>
          Periodo
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
              Ate
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
          Conta do filtro
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
          Cartao do filtro
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
          Tipo do filtro
          <select
            aria-label="Tipo do filtro"
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            value={typeFilter}
          >
            <option value="all">Todos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saidas</option>
            <option value="transfer">Transferencias</option>
            <option value="investment">Investimentos</option>
          </select>
        </label>
        <label>
          Densidade da tabela
          <select
            aria-label="Densidade da tabela"
            onChange={(event) => onDensityChange(event.target.value as UiDensity)}
            value={uiDensity}
          >
            <option value="comfort">Conforto</option>
            <option value="compact">Compacto</option>
            <option value="dense">Denso</option>
          </select>
        </label>
        <label>
          Metodo do filtro
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
          Categoria do filtro
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
          Pessoa do filtro
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
        <div className="inline-actions">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>

      {splitFeedback ? <p className="success-banner">{splitFeedback}</p> : null}

      {editingTransactionId !== null && editForm !== null ? (
        <form className="panel-card panel-card--nested" onSubmit={handleEditSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Edicao</p>
              <h3 className="section-title">Editar transacao</h3>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Data da transacao
              <input
                aria-label="Data da transacao"
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
              Tipo da transacao
              <select
                aria-label="Tipo da transacao"
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
                <option value="expense">Saida</option>
                <option value="income">Entrada</option>
              </select>
            </label>
            <label>
              Conta da transacao
              <select
                aria-label="Conta da transacao"
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
              Metodo da transacao
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
              Descricao da transacao
              <input
                aria-label="Descricao da transacao"
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
              Valor da transacao
              <input
                aria-label="Valor da transacao"
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
              Categoria da transacao
              <select
                aria-label="Categoria da transacao"
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
              Pessoa da transacao
              <input
                aria-label="Pessoa da transacao"
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
              Salvar alteracoes
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

      {visibleTransactions.length === 0 ? (
        <div className="empty-state">Nenhuma transacao registrada.</div>
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
                    label="Descricao"
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
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "method")}>
                  <SortHeaderButton
                    label="Metodo"
                    column="method"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                  />
                </th>
                <th aria-sort={getAriaSort(sortColumn, sortDirection, "person")}>
                  <SortHeaderButton
                    label="Pessoa/Reembolso"
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
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((transaction) => {
                const categoryPresentation = resolveCategoryPresentation(transaction, transactionSplits, categoryRules);
                const sourceLabel = resolveLedgerEndpointLabel(transaction, "source", accounts);
                const destinationLabel = resolveLedgerEndpointLabel(transaction, "destination", accounts);
                return (
                  <tr
                    key={transaction.transaction_id}
                    className="data-table__row--interactive"
                    onClick={() => setSelectedTransactionId(transaction.transaction_id)}
                  >
                    <td>{formatDateTime(transaction.occurred_at)}</td>
                    <td>{transaction.description ?? transaction.category_id}</td>
                    <td>{categoryPresentation.label}</td>
                    <td>{resolveAccountName(transaction.account_id, accounts)}</td>
                    <td>{sourceLabel}</td>
                    <td>{destinationLabel}</td>
                    <td>{formatPaymentMethod(transaction.payment_method)}</td>
                    <td>{transaction.person_id?.trim() || "--"}</td>
                    <td>{formatTransactionType(transaction.type)}</td>
                    <td>
                      <span className={`status-badge status-badge--${transaction.status}`}>
                        {formatTransactionStatus(transaction.status)}
                      </span>
                    </td>
                    <td>{formatCurrency(transaction.amount)}</td>
                    <td>
                      <div className="inline-actions">
                        <button
                          className="ghost-button"
                          disabled={transaction.status !== "active"}
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditForm(transaction);
                            setSelectedTransactionId(null);
                          }}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="ghost-button ghost-button--danger"
                          disabled={transaction.status !== "active"}
                          onClick={(event) => {
                            event.stopPropagation();
                            void onVoidTransaction(transaction.transaction_id);
                          }}
                          type="button"
                        >
                          Estornar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={selectedTransaction !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedTransactionId(null);
          }
        }}
      >
        {selectedTransaction !== null ? (
          <SheetContent side="right" className="ledger-detail-drawer w-full sm:max-w-[620px]">
            <SheetHeader>
              <SheetTitle>Detalhes da transacao</SheetTitle>
              <SheetDescription>
                Visualize e ajuste rapidamente sem sair do Historico.
              </SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <DetailItem label="Descricao" value={selectedTransaction.description ?? selectedTransaction.category_id} />
              <DetailItem
                label="Categoria"
                value={resolveCategoryPresentation(selectedTransaction, transactionSplits, categoryRules).label}
              />
              <DetailItem label="Conta" value={resolveAccountName(selectedTransaction.account_id, accounts)} />
              <DetailItem
                label="Origem"
                value={resolveLedgerEndpointLabel(selectedTransaction, "source", accounts)}
              />
              <DetailItem
                label="Destino"
                value={resolveLedgerEndpointLabel(selectedTransaction, "destination", accounts)}
              />
              <DetailItem label="Forma de pagamento" value={formatPaymentMethod(selectedTransaction.payment_method)} />
              <DetailItem label="Pessoa/Reembolso" value={selectedTransaction.person_id?.trim() || "--"} />
              <DetailItem label="Tipo" value={formatTransactionType(selectedTransaction.type)} />
              <DetailItem label="Status" value={formatTransactionStatus(selectedTransaction.status)} />
              <DetailItem label="Data" value={formatDateTime(selectedTransaction.occurred_at)} />
              <DetailItem label="Valor" value={formatCurrency(selectedTransaction.amount)} />
            </div>

            <div className="panel-card panel-card--nested">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Split</p>
                  <h3 className="section-title">Divisao de categorias</h3>
                </div>
                <button className="secondary-button" onClick={handleStartSplit} type="button">
                  Iniciar split
                </button>
              </div>
              {selectedTransactionSplit !== null ? (
                <p className="field-hint">Split atual com {selectedTransactionSplit.length} divisao(oes).</p>
              ) : null}
              {splitFeedback ? <p className="success-banner">{splitFeedback}</p> : null}
              {splitError ? <p className="error-banner">{splitError}</p> : null}
              {splitDraft !== null ? (
                <>
                  <div className="form-grid">
                    {splitDraft.map((line, index) => (
                      <Fragment key={line.id}>
                        <label>
                          Categoria da divisao {index + 1}
                          <select
                            aria-label={`Categoria da divisao ${index + 1}`}
                            onChange={(event) =>
                              setSplitDraft((current) =>
                                current === null
                                  ? null
                                  : current.map((currentLine) =>
                                      currentLine.id === line.id
                                        ? {
                                            ...currentLine,
                                            categoryId: event.target.value,
                                          }
                                        : currentLine,
                                    ),
                              )
                            }
                            value={line.categoryId}
                          >
                            {getCategoryOptions(line.categoryId).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Valor da divisao {index + 1}
                          <input
                            aria-label={`Valor da divisao ${index + 1}`}
                            inputMode="decimal"
                            onChange={(event) =>
                              setSplitDraft((current) =>
                                current === null
                                  ? null
                                  : current.map((currentLine) =>
                                      currentLine.id === line.id
                                        ? {
                                            ...currentLine,
                                            amount: event.target.value,
                                          }
                                        : currentLine,
                                    ),
                              )
                            }
                            value={line.amount}
                          />
                        </label>
                      </Fragment>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <button
                      className="ghost-button"
                      onClick={() =>
                        setSplitDraft((current) =>
                          current === null
                            ? null
                            : [
                                ...current,
                                {
                                  id: String(current.length + 1),
                                  categoryId: selectedTransaction.category_id,
                                  amount: "",
                                },
                              ],
                        )
                      }
                      type="button"
                    >
                      Adicionar divisao
                    </button>
                    <button className="primary-button" onClick={handleSaveSplit} type="button">
                      Salvar split
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            <div className="panel-card panel-card--nested">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Regras</p>
                  <h3 className="section-title">Auto-categorizacao</h3>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  Padrao da regra
                  <input
                    aria-label="Padrao da regra"
                    onChange={(event) => setRulePattern(event.target.value)}
                    value={rulePattern}
                  />
                </label>
                <label>
                  Categoria da regra
                  <select
                    aria-label="Categoria da regra"
                    onChange={(event) => setRuleCategoryId(event.target.value)}
                    value={ruleCategoryId}
                  >
                    {getCategoryOptions(ruleCategoryId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="inline-actions">
                <button className="primary-button" onClick={handleSaveRule} type="button">
                  Salvar regra
                </button>
              </div>
              {ruleFeedback ? <p className="success-banner">{ruleFeedback}</p> : null}
            </div>

            <div className="inline-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  openEditForm(selectedTransaction);
                  setSelectedTransactionId(null);
                }}
                disabled={selectedTransaction.status !== "active"}
              >
                Editar transacao
              </button>
              <button
                className="ghost-button ghost-button--danger"
                type="button"
                onClick={() => {
                  void onVoidTransaction(selectedTransaction.transaction_id);
                  setSelectedTransactionId(null);
                }}
                disabled={selectedTransaction.status !== "active"}
              >
                Estornar transacao
              </button>
            </div>
          </SheetContent>
        ) : null}
      </Sheet>
    </section>
  );
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
  categoryRules: CategoryRule[],
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
        resolveCategoryPresentation(left, transactionSplits, categoryRules).label,
        resolveCategoryPresentation(right, transactionSplits, categoryRules).label,
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

function findMatchingRule(
  transaction: TransactionSummary,
  categoryRules: CategoryRule[],
): CategoryRule | null {
  const description = (transaction.description ?? "").toLowerCase();
  if (description === "") {
    return null;
  }

  return (
    categoryRules.find((rule) => description.includes(rule.pattern.toLowerCase())) ?? null
  );
}

function resolveCategoryPresentation(
  transaction: TransactionSummary,
  transactionSplits: Record<string, SplitLine[]>,
  categoryRules: CategoryRule[],
): {
  label: string;
  source: "transaction" | "rule" | "split";
} {
  const split = transactionSplits[transaction.transaction_id];
  if (split && split.length > 0) {
    return {
      label: `Dividida (${split.length})`,
      source: "split",
    };
  }

  const matchingRule = findMatchingRule(transaction, categoryRules);
  if (matchingRule !== null) {
    return {
      label: `${formatCategoryName(matchingRule.categoryId)} (regra)`,
      source: "rule",
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




