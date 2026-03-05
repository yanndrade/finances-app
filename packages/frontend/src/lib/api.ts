export type CategorySpending = {
  category_id: string;
  total: number;
};

export type ReportPeriod = "day" | "week" | "month" | "custom";

export type InvestmentView = "daily" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "yearly";

export type InvestmentMovementSummary = {
  movement_id: string;
  occurred_at: string;
  type: "contribution" | "withdrawal";
  account_id: string;
  description: string | null;
  contribution_amount: number;
  dividend_amount: number;
  cash_amount: number;
  invested_amount: number;
  cash_delta: number;
  invested_delta: number;
};

export type InvestmentWealthPoint = {
  bucket: string;
  cash_balance: number;
  invested_balance: number;
  wealth: number;
};

export type InvestmentTrendPoint = {
  bucket: string;
  contribution_total: number;
  dividend_total: number;
  withdrawal_total: number;
};

export type InvestmentOverview = {
  view: InvestmentView;
  from: string;
  to: string;
  totals: {
    contribution_total: number;
    dividend_total: number;
    withdrawal_total: number;
    invested_balance: number;
    cash_balance: number;
    wealth: number;
    dividends_accumulated: number;
  };
  goal: {
    target: number;
    realized: number;
    remaining: number;
    progress_percent: number;
  };
  series: {
    wealth_evolution: InvestmentWealthPoint[];
    contribution_dividend_trend: InvestmentTrendPoint[];
  };
};

export type CategoryBudgetSummary = {
  category_id: string;
  month: string;
  limit: number;
  spent: number;
  usage_percent: number;
  status: "ok" | "warning" | "exceeded" | string;
};

export type PreviousMonthSummary = {
  total_income: number;
  total_expense: number;
  net_flow: number;
};

export type DailyBalancePoint = {
  date: string;
  balance: number;
};

export type PendingReimbursementSummary = {
  transaction_id: string;
  person_id: string;
  amount: number;
  status: "pending" | "received";
  account_id: string;
  occurred_at: string;
  received_at: string | null;
  receipt_transaction_id: string | null;
};

export type DashboardSummary = {
  month: string;
  total_income: number;
  total_expense: number;
  net_flow: number;
  current_balance: number;
  pending_reimbursements_total?: number;
  pending_reimbursements?: PendingReimbursementSummary[];
  recent_transactions: TransactionSummary[];
  spending_by_category: CategorySpending[];
  category_budgets?: CategoryBudgetSummary[];
  budget_alerts?: CategoryBudgetSummary[];
  previous_month: PreviousMonthSummary;
  daily_balance_series: DailyBalancePoint[];
  review_queue: TransactionSummary[];
};

export type AccountSummary = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  is_active: boolean;
  current_balance: number;
};

export type CardSummary = {
  card_id: string;
  name: string;
  limit: number;
  closing_day: number;
  due_day: number;
  payment_account_id: string;
  is_active: boolean;
};

export type CardPurchaseSummary = {
  purchase_id: string;
  purchase_date: string;
  amount: number;
  category_id: string;
  card_id: string;
  description: string | null;
  installments_count: number;
  invoice_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
};

export type InvoiceSummary = {
  invoice_id: string;
  card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  purchase_count: number;
  status: string;
};

export type InvoiceItemSummary = {
  invoice_item_id: string;
  invoice_id: string;
  purchase_id: string;
  card_id: string;
  purchase_date: string;
  category_id: string;
  description: string | null;
  installment_number: number;
  installments_count: number;
  amount: number;
};

export type TransactionSummary = {
  transaction_id: string;
  occurred_at: string;
  type: string;
  amount: number;
  account_id: string;
  payment_method: string;
  category_id: string;
  description: string | null;
  person_id: string | null;
  status: string;
  transfer_id?: string;
  direction?: string;
};

export type CashTransactionPayload = {
  type: "income" | "expense";
  description: string;
  amountInCents: number;
  accountId: string;
  paymentMethod: "PIX" | "CASH" | "OTHER";
  categoryId: string;
  occurredAt?: string;
  personId?: string;
};

export type TransferPayload = {
  description: string;
  amountInCents: number;
  fromAccountId: string;
  toAccountId: string;
  occurredAt?: string;
};

export type AccountPayload = {
  name: string;
  type: "checking" | "savings" | "wallet" | "investment" | "other";
  initialBalanceInCents: number;
};

export type AccountUpdatePayload = {
  name: string;
  type: "checking" | "savings" | "wallet" | "investment" | "other";
  initialBalanceInCents: number;
  isActive: boolean;
};

export type CardPayload = {
  name: string;
  limitInCents: number;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string;
};

export type CardUpdatePayload = CardPayload & {
  isActive: boolean;
};

export type CardPurchasePayload = {
  cardId: string;
  purchaseDate: string;
  amountInCents: number;
  installmentsCount: number;
  categoryId: string;
  description?: string;
  personId?: string;
};

export type InvoicePaymentPayload = {
  invoiceId: string;
  amountInCents: number;
  accountId: string;
  paidAt: string;
};

export type MarkReimbursementReceivedPayload = {
  receivedAt: string;
  accountId?: string;
};

export type InvestmentMovementPayload = {
  type: "contribution" | "withdrawal";
  accountId: string;
  occurredAt: string;
  description?: string;
  contributionAmountInCents?: number;
  dividendAmountInCents?: number;
  cashAmountInCents?: number;
  investedAmountInCents?: number;
};

export type CategoryBudgetPayload = {
  categoryId: string;
  month: string;
  limitInCents: number;
};

export type InvestmentOverviewParams = {
  view: InvestmentView;
  from: string;
  to: string;
};

export type TransactionFilters = {
  period?: ReportPeriod;
  reference?: string;
  from: string;
  to: string;
  category: string;
  account: string;
  method: "" | "PIX" | "CASH" | "OTHER";
  person: string;
  text: string;
};

export type ReportFilters = {
  period: ReportPeriod;
  reference: string;
  from: string;
  to: string;
  category: string;
  account: string;
  method: "" | "PIX" | "CASH" | "OTHER";
  person: string;
  text: string;
};

export type WeeklyTrendPoint = {
  week: string;
  income_total: number;
  expense_total: number;
  net_total: number;
};

export type FutureInstallmentMonth = {
  month: string;
  total: number;
};

export type ReportSummary = {
  period: {
    type: ReportPeriod;
    from: string;
    to: string;
  };
  totals: {
    income_total: number;
    expense_total: number;
    net_total: number;
  };
  category_breakdown: CategorySpending[];
  weekly_trend: WeeklyTrendPoint[];
  future_commitments: {
    period_installment_impact_total: number;
    future_installment_total: number;
    future_installment_months: FutureInstallmentMonth[];
  };
};

export type TransactionUpdatePayload = {
  occurredAt: string;
  type: "income" | "expense";
  amountInCents: number;
  accountId: string;
  paymentMethod: "PIX" | "CASH" | "OTHER";
  categoryId: string;
  description: string;
  personId?: string;
};

export type TransactionPatchPayload = Partial<TransactionUpdatePayload>;

export const API_BASE_URL =
  (globalThis as { __FINANCES_API_BASE_URL__?: string }).__FINANCES_API_BASE_URL__ ??
  "http://127.0.0.1:8000";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail || "Request failed.");
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function fetchDashboardSummary(month: string): Promise<DashboardSummary> {
  return requestJson<DashboardSummary>(`/api/dashboard?month=${month}`);
}

export async function fetchAccounts(): Promise<AccountSummary[]> {
  return requestJson<AccountSummary[]>("/api/accounts");
}

export async function fetchCards(): Promise<CardSummary[]> {
  return requestJson<CardSummary[]>("/api/cards");
}

export async function fetchInvoices(cardId?: string): Promise<InvoiceSummary[]> {
  const query = cardId ? `?card=${encodeURIComponent(cardId)}` : "";

  return requestJson<InvoiceSummary[]>(`/api/invoices${query}`);
}

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItemSummary[]> {
  return requestJson<InvoiceItemSummary[]>(
    `/api/invoices/${encodeURIComponent(invoiceId)}/items`,
  );
}

export async function fetchTransactions(
  filters?: Partial<TransactionFilters>,
): Promise<TransactionSummary[]> {
  const searchParams = new URLSearchParams();

  if (filters?.from) {
    searchParams.set("from", filters.from);
  }
  if (filters?.to) {
    searchParams.set("to", filters.to);
  }
  if (filters?.category) {
    searchParams.set("category", filters.category);
  }
  if (filters?.account) {
    searchParams.set("account", filters.account);
  }
  if (filters?.method) {
    searchParams.set("method", filters.method);
  }
  if (filters?.person) {
    searchParams.set("person", filters.person);
  }
  if (filters?.text) {
    searchParams.set("text", filters.text);
  }

  const query = searchParams.toString();

  return requestJson<TransactionSummary[]>(
    query.length > 0 ? `/api/transactions?${query}` : "/api/transactions",
  );
}

export async function fetchReportSummary(
  filters: ReportFilters,
): Promise<ReportSummary> {
  const searchParams = new URLSearchParams();
  searchParams.set("period", filters.period);

  if (filters.reference) {
    searchParams.set("reference", filters.reference);
  }
  if (filters.from) {
    searchParams.set("from", filters.from);
  }
  if (filters.to) {
    searchParams.set("to", filters.to);
  }
  if (filters.category) {
    searchParams.set("category", filters.category);
  }
  if (filters.account) {
    searchParams.set("account", filters.account);
  }
  if (filters.method) {
    searchParams.set("method", filters.method);
  }
  if (filters.person) {
    searchParams.set("person", filters.person);
  }
  if (filters.text) {
    searchParams.set("text", filters.text);
  }

  return requestJson<ReportSummary>(`/api/reports/summary?${searchParams.toString()}`);
}

export async function createAccount(payload: AccountPayload): Promise<AccountSummary> {
  return requestJson<AccountSummary>("/api/accounts", {
    method: "POST",
    body: JSON.stringify({
      id: `acc-${Date.now()}`,
      name: payload.name,
      type: payload.type,
      initial_balance: payload.initialBalanceInCents,
    }),
  });
}

export async function updateAccount(
  accountId: string,
  payload: AccountUpdatePayload,
): Promise<AccountSummary> {
  return requestJson<AccountSummary>(`/api/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: payload.name,
      type: payload.type,
      initial_balance: payload.initialBalanceInCents,
      is_active: payload.isActive,
    }),
  });
}

export async function createCard(payload: CardPayload): Promise<CardSummary> {
  return requestJson<CardSummary>("/api/cards", {
    method: "POST",
    body: JSON.stringify({
      id: `card-${Date.now()}`,
      name: payload.name,
      limit: payload.limitInCents,
      closing_day: payload.closingDay,
      due_day: payload.dueDay,
      payment_account_id: payload.paymentAccountId,
    }),
  });
}

export async function updateCard(
  cardId: string,
  payload: CardUpdatePayload,
): Promise<CardSummary> {
  return requestJson<CardSummary>(`/api/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: payload.name,
      limit: payload.limitInCents,
      closing_day: payload.closingDay,
      due_day: payload.dueDay,
      payment_account_id: payload.paymentAccountId,
      is_active: payload.isActive,
    }),
  });
}

export async function createCardPurchase(
  payload: CardPurchasePayload,
): Promise<CardPurchaseSummary> {
  return requestJson<CardPurchaseSummary>("/api/card-purchases", {
    method: "POST",
    body: JSON.stringify({
      id: `purchase-${Date.now()}`,
      purchase_date: normalizeTimestampForApi(payload.purchaseDate),
      amount: payload.amountInCents,
      installments_count: payload.installmentsCount,
      category_id: payload.categoryId,
      card_id: payload.cardId,
      description: payload.description || undefined,
      person_id: payload.personId || undefined,
    }),
  });
}

export async function payInvoice(payload: InvoicePaymentPayload): Promise<InvoiceSummary> {
  return requestJson<InvoiceSummary>(
    `/api/invoices/${encodeURIComponent(payload.invoiceId)}/payments`,
    {
      method: "POST",
      body: JSON.stringify({
        id: `payment-${Date.now()}`,
        amount: payload.amountInCents,
        account_id: payload.accountId,
        paid_at: normalizeTimestampForApi(payload.paidAt),
      }),
    },
  );
}

export async function createCashTransaction(
  payload: CashTransactionPayload,
): Promise<TransactionSummary> {
  const endpoint = payload.type === "income" ? "/api/incomes" : "/api/expenses";

  return requestJson<TransactionSummary>(endpoint, {
    method: "POST",
    body: JSON.stringify({
      id: `ui-${Date.now()}`,
      occurred_at: payload.occurredAt ?? new Date().toISOString().replace(".000", ""),
      amount: payload.amountInCents,
      account_id: payload.accountId,
      payment_method: payload.paymentMethod,
      category_id: payload.categoryId,
      description: payload.description,
      person_id: payload.personId || undefined,
    }),
  });
}

export async function createTransfer(payload: TransferPayload): Promise<TransactionSummary[]> {
  return requestJson<TransactionSummary[]>("/api/transfers", {
    method: "POST",
    body: JSON.stringify({
      id: `trf-${Date.now()}`,
      occurred_at: payload.occurredAt ?? new Date().toISOString().replace(".000", ""),
      from_account_id: payload.fromAccountId,
      to_account_id: payload.toAccountId,
      amount: payload.amountInCents,
      description: payload.description,
    }),
  });
}

export async function updateTransaction(
  transactionId: string,
  payload: TransactionPatchPayload,
): Promise<TransactionSummary> {
  const body = {
    ...(payload.occurredAt !== undefined ? { occurred_at: payload.occurredAt } : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.amountInCents !== undefined ? { amount: payload.amountInCents } : {}),
    ...(payload.accountId !== undefined ? { account_id: payload.accountId } : {}),
    ...(payload.paymentMethod !== undefined ? { payment_method: payload.paymentMethod } : {}),
    ...(payload.categoryId !== undefined ? { category_id: payload.categoryId } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.personId !== undefined ? { person_id: payload.personId || undefined } : {}),
  };

  return requestJson<TransactionSummary>(`/api/transactions/${transactionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function voidTransaction(
  transactionId: string,
  reason?: string,
): Promise<TransactionSummary> {
  return requestJson<TransactionSummary>(`/api/transactions/${transactionId}/void`, {
    method: "POST",
    body: JSON.stringify({
      reason: reason || undefined,
    }),
  });
}

export async function markReimbursementReceived(
  transactionId: string,
  payload: MarkReimbursementReceivedPayload,
): Promise<PendingReimbursementSummary> {
  return requestJson<PendingReimbursementSummary>(
    `/api/reimbursements/${encodeURIComponent(transactionId)}/mark-received`,
    {
      method: "POST",
      body: JSON.stringify({
        received_at: normalizeTimestampForApi(payload.receivedAt),
        account_id: payload.accountId || undefined,
      }),
    },
  );
}

export async function upsertCategoryBudget(
  payload: CategoryBudgetPayload,
): Promise<CategoryBudgetSummary> {
  return requestJson<CategoryBudgetSummary>("/api/budgets", {
    method: "POST",
    body: JSON.stringify({
      category_id: payload.categoryId,
      month: payload.month,
      limit: payload.limitInCents,
    }),
  });
}

export async function createInvestmentMovement(
  payload: InvestmentMovementPayload,
): Promise<InvestmentMovementSummary> {
  return requestJson<InvestmentMovementSummary>("/api/investments/movements", {
    method: "POST",
    body: JSON.stringify({
      id: `inv-${Date.now()}`,
      occurred_at: normalizeTimestampForApi(payload.occurredAt),
      type: payload.type,
      account_id: payload.accountId,
      description: payload.description || undefined,
      contribution_amount: payload.contributionAmountInCents,
      dividend_amount: payload.dividendAmountInCents ?? 0,
      cash_amount: payload.cashAmountInCents,
      invested_amount: payload.investedAmountInCents,
    }),
  });
}

export async function fetchInvestmentMovements(filters?: {
  from?: string;
  to?: string;
}): Promise<InvestmentMovementSummary[]> {
  const searchParams = new URLSearchParams();
  if (filters?.from) {
    searchParams.set("from", filters.from);
  }
  if (filters?.to) {
    searchParams.set("to", filters.to);
  }
  const query = searchParams.toString();

  return requestJson<InvestmentMovementSummary[]>(
    query.length > 0
      ? `/api/investments/movements?${query}`
      : "/api/investments/movements",
  );
}

export async function fetchInvestmentOverview(
  params: InvestmentOverviewParams,
): Promise<InvestmentOverview> {
  const query = new URLSearchParams({
    view: params.view,
    from: params.from,
    to: params.to,
  }).toString();

  return requestJson<InvestmentOverview>(`/api/investments/overview?${query}`);
}

export async function resetApplicationData(): Promise<{ status: string; message: string }> {
  return requestJson<{ status: string; message: string }>("/api/dev/reset", {
    method: "POST",
  });
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detailText = await response.text();
    let detail = detailText;
    if (detailText) {
      try {
        const parsed = JSON.parse(detailText) as { detail?: string };
        if (typeof parsed.detail === "string") {
          detail = parsed.detail;
        }
      } catch {
        detail = detailText;
      }
    }
    throw new ApiError(response.status, detail || "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const bodyText = await response.text();
  if (!bodyText.trim()) {
    return undefined as T;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return undefined as T;
  }
}

export function normalizeTimestampForApi(
  value: string,
  options?: {
    localOffsetMinutes?: number;
  },
): string {
  const trimmed = value.trim();

  if (trimmed.endsWith("Z")) {
    return trimmed;
  }

  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match !== null) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
    const year = parseInt(yearText, 10);
    const month = parseInt(monthText, 10);
    const day = parseInt(dayText, 10);
    const hour = parseInt(hourText, 10);
    const minute = parseInt(minuteText, 10);
    const second = parseInt(secondText ?? "0", 10);
    const localOffsetMinutes =
      options?.localOffsetMinutes ??
      new Date(year, month - 1, day, hour, minute, second).getTimezoneOffset();
    const utcMillis =
      Date.UTC(year, month - 1, day, hour, minute, second) +
      localOffsetMinutes * 60_000;

    return new Date(utcMillis).toISOString().replace(".000", "");
  }

  throw new Error("Data da compra invalida.");
}
