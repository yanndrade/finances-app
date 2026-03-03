export type DashboardSummary = {
  month: string;
  total_income: number;
  total_expense: number;
  net_flow: number;
  current_balance: number;
  recent_transactions: TransactionSummary[];
};

export type AccountSummary = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  is_active: boolean;
  current_balance: number;
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
};

export type TransferPayload = {
  description: string;
  amountInCents: number;
  fromAccountId: string;
  toAccountId: string;
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

export async function fetchTransactions(): Promise<TransactionSummary[]> {
  return requestJson<TransactionSummary[]>("/api/transactions");
}

export async function createCashTransaction(
  payload: CashTransactionPayload,
): Promise<TransactionSummary> {
  const endpoint = payload.type === "income" ? "/api/incomes" : "/api/expenses";

  return requestJson<TransactionSummary>(endpoint, {
    method: "POST",
    body: JSON.stringify({
      id: `ui-${Date.now()}`,
      occurred_at: new Date().toISOString().replace(".000", ""),
      amount: payload.amountInCents,
      account_id: payload.accountId,
      payment_method: payload.paymentMethod,
      category_id: payload.categoryId,
      description: payload.description,
    }),
  });
}

export async function createTransfer(payload: TransferPayload): Promise<TransactionSummary[]> {
  return requestJson<TransactionSummary[]>("/api/transfers", {
    method: "POST",
    body: JSON.stringify({
      id: `trf-${Date.now()}`,
      occurred_at: new Date().toISOString().replace(".000", ""),
      from_account_id: payload.fromAccountId,
      to_account_id: payload.toAccountId,
      amount: payload.amountInCents,
      description: payload.description,
    }),
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
