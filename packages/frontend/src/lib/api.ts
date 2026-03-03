export type CategorySpending = {
  category_id: string;
  total: number;
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

export type DashboardSummary = {
  month: string;
  total_income: number;
  total_expense: number;
  net_flow: number;
  current_balance: number;
  recent_transactions: TransactionSummary[];
  spending_by_category: CategorySpending[];
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
};

export type InvoicePaymentPayload = {
  invoiceId: string;
  amountInCents: number;
  accountId: string;
  paidAt: string;
};

export type TransactionFilters = {
  from: string;
  to: string;
  category: string;
  account: string;
  method: "" | "PIX" | "CASH" | "OTHER";
  person: string;
  text: string;
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

export const API_BASE_URL =
  (globalThis as { __FINANCES_API_BASE_URL__?: string }).__FINANCES_API_BASE_URL__ ??
  "http://127.0.0.1:8000";

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
  payload: TransactionUpdatePayload,
): Promise<TransactionSummary> {
  return requestJson<TransactionSummary>(`/api/transactions/${transactionId}`, {
    method: "PATCH",
    body: JSON.stringify({
      occurred_at: payload.occurredAt,
      type: payload.type,
      amount: payload.amountInCents,
      account_id: payload.accountId,
      payment_method: payload.paymentMethod,
      category_id: payload.categoryId,
      description: payload.description,
      person_id: payload.personId || undefined,
    }),
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

export async function resetApplicationData(): Promise<{ status: string; message: string }> {
  return requestJson<{ status: string; message: string }>("/api/dev/reset", {
    method: "POST",
  });
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Request failed.");
  }

  return (await response.json()) as T;
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
