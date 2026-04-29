import { createClientId } from "@/lib/uuid";

export type CategorySpending = {
  category_id: string;
  total: number;
};

export type ReportPeriod = "day" | "week" | "month" | "custom";
export type TransactionTypeFilter =
  | "income"
  | "expense"
  | "transfer"
  | "investment";

export type InvestmentView =
  | "daily"
  | "weekly"
  | "monthly"
  | "bimonthly"
  | "quarterly"
  | "yearly";

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
  amount_received: number;
  status: "pending" | "partial" | "received" | "canceled" | "overdue";
  account_id: string;
  occurred_at: string;
  expected_at: string | null;
  received_at: string | null;
  canceled_at?: string | null;
  receipt_transaction_id: string | null;
  notes: string | null;
  source_transaction_id?: string | null;
  source_title?: string | null;
  source_description?: string | null;
  source_card_id?: string | null;
  source_posted_at?: string | null;
  source_purchase_date?: string | null;
  source_installment_number?: number | null;
  source_installment_total?: number | null;
};

export type RecurringPaymentMethod = "PIX" | "CASH" | "OTHER" | "CARD";

export type DashboardCommitmentSummary = {
  commitment_id: string;
  kind: "recurring" | "invoice";
  title: string;
  category_id: string | null;
  amount: number;
  due_date: string;
  status: string;
  account_id: string | null;
  card_id: string | null;
  payment_method?: string | null;
  source: string;
};

export type DashboardFixedExpenseSummary = {
  pending_id: string;
  rule_id: string;
  title: string;
  category_id: string;
  amount: number;
  due_date: string;
  status: string;
  account_id: string;
  card_id?: string | null;
  payment_method: RecurringPaymentMethod;
  transaction_id: string | null;
};

export type DashboardInstallmentSummary = {
  installment_id: string;
  purchase_id: string;
  title: string | null;
  category_id: string;
  amount: number;
  card_id: string;
  installment_number: number;
  installments_count: number;
  due_date: string;
  reference_month: string;
};

export type DashboardSummary = {
  month: string;
  total_income: number;
  total_expense: number;
  net_flow: number;
  current_balance: number;
  fixed_expenses_total: number;
  installment_total: number;
  variable_expenses_total: number;
  invoices_due_total: number;
  free_to_spend: number;
  pending_reimbursements_total?: number;
  pending_reimbursements?: PendingReimbursementSummary[];
  monthly_commitments?: DashboardCommitmentSummary[];
  monthly_fixed_expenses?: DashboardFixedExpenseSummary[];
  monthly_installments?: DashboardInstallmentSummary[];
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
  future_installment_total: number;
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

export type CardInstallmentSummary = {
  installment_id: string;
  purchase_id: string;
  card_id: string;
  purchase_date: string;
  due_date: string;
  reference_month: string;
  category_id: string;
  description: string | null;
  installment_number: number;
  installments_count: number;
  amount: number;
  invoice_id: string;
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

export type InvoicePaymentSummary = {
  payment_id: string;
  invoice_id: string;
  card_id: string;
  account_id: string;
  amount: number;
  paid_at: string;
};

export type InvoiceItemSummary = {
  invoice_item_id: string;
  invoice_id: string;
  purchase_id: string;
  card_id: string;
  purchase_date: string;
  category_id: string;
  title?: string | null;
  description: string | null;
  origin_type?: string | null;
  group_id?: string | null;
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
  ledger_event_type?: string;
  ledger_source?: string;
  ledger_destination?: string;
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
  paymentAccountId?: string;
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

export type CardPurchaseUpdatePayload = {
  purchaseDate?: string;
  amountInCents?: number;
  installmentsCount?: number;
  categoryId?: string;
  cardId?: string;
  description?: string | null;
  personId?: string | null;
};

export type InvoicePaymentPayload = {
  invoiceId: string;
  amountInCents: number;
  accountId: string;
  paidAt: string;
};

export type InvoicePaymentUpdatePayload = {
  accountId: string;
};

export type MarkReimbursementReceivedPayload = {
  receivedAt: string;
  accountId?: string;
  amount?: number;
};

export type UpdateReimbursementPayload = {
  expectedAt?: string | null;
  notes?: string | null;
};

export type ReimbursementSummary = {
  total_outstanding: number;
  received_in_month: number;
  expiring_soon_count: number;
  expiring_soon_total: number;
  overdue_count: number;
  overdue_total: number;
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

export type RecurringRuleSummary = {
  rule_id: string;
  name: string;
  amount: number;
  due_day: number;
  account_id: string | null;
  card_id: string | null;
  payment_method: RecurringPaymentMethod;
  category_id: string;
  description: string | null;
  is_active: boolean;
};

export type PendingExpenseSummary = {
  pending_id: string;
  rule_id: string;
  month: string;
  name: string;
  amount: number;
  due_date: string;
  account_id: string | null;
  card_id: string | null;
  payment_method: RecurringPaymentMethod;
  category_id: string;
  description: string | null;
  status: string;
  transaction_id: string | null;
};

export type SecurityState = {
  password_configured: boolean;
  is_locked: boolean;
  requires_lock_on_startup: boolean;
  inactivity_lock_seconds: number | null;
};

export type LanSecurityState = {
  enabled: boolean;
  pair_token_ttl_seconds: number;
  local_ip: string | null;
  subnet_cidr: string | null;
  public_url: string | null;
  public_scheme: "http" | "https" | string;
};

export type LanPairTokenSession = {
  pair_token: string;
  expires_at: string;
  pairing_url: string;
};

export type AuthorizedLanDevice = {
  device_id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
  last_seen_ip: string | null;
  revoked_at: string | null;
};

export type LanPairingResult = {
  device_id: string;
  device_token: string;
  paired_at: string;
};

export type RecurringRulePayload = {
  name: string;
  amountInCents: number;
  dueDay: number;
  paymentMethod: RecurringPaymentMethod;
  accountId?: string;
  cardId?: string;
  categoryId: string;
  description?: string;
};

export type RecurringRuleUpdatePayload = Partial<RecurringRulePayload> & {
  isActive?: boolean;
};

export type InvestmentOverviewParams = {
  view: InvestmentView;
  from: string;
  to: string;
  goalPercent?: number;
};

export type TransactionFilters = {
  period?: ReportPeriod;
  reference?: string;
  preset?: string;
  from: string;
  to: string;
  type?: TransactionTypeFilter;
  category: string;
  account: string;
  card: string;
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
  card: string;
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

export type ExpenseMixSummary = {
  fixed_total: number;
  variable_total: number;
  installment_total: number;
};

export type CardSpendingSummary = {
  card_id: string;
  total: number;
};

export type MonthlyExpenseEvolutionPoint = {
  month: string;
  expense_total: number;
};

export type MonthProjectionSummary = {
  current_balance: number;
  projected_end_balance: number;
  pending_fixed_total: number;
  invoice_due_total: number;
  planned_income_total: number;
  installment_impact_total: number;
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
  expense_mix: ExpenseMixSummary;
  card_breakdown: CardSpendingSummary[];
  expense_evolution: MonthlyExpenseEvolutionPoint[];
  month_projection: MonthProjectionSummary;
  category_breakdown: CategorySpending[];
  weekly_trend: WeeklyTrendPoint[];
  future_commitments: {
    period_installment_impact_total: number;
    future_installment_total: number;
    future_installment_months: FutureInstallmentMonth[];
  };
};

export type BackupSnapshot = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  transactions: TransactionSummary[];
  investment_movements: InvestmentMovementSummary[];
  report_summary: ReportSummary | null;
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

// ─────────────────────────────────────────────────────────────────────────────
// Unified Movement Ledger — types
// ─────────────────────────────────────────────────────────────────────────────

export type MovementKind =
  | "income"
  | "expense"
  | "transfer"
  | "investment"
  | "reimbursement"
  | "adjustment";

export type MovementOriginType =
  | "manual"
  | "recurring"
  | "installment"
  | "card_purchase"
  | "transfer"
  | "investment"
  | "reimbursement"
  | "imported";

export type MovementLifecycleStatus =
  | "forecast"
  | "pending"
  | "cleared"
  | "cancelled"
  | "voided";

export type MovementScope =
  | "all"
  | "fixed"
  | "installments"
  | "variable"
  | "transfers"
  | "investments"
  | "reimbursements";

export type MovementPaymentMethod =
  | "PIX"
  | "CASH"
  | "DEBIT"
  | "CREDIT_CASH"
  | "CREDIT_INSTALLMENT"
  | "BOLETO"
  | "AUTO_DEBIT"
  | "TRANSFER"
  | "BALANCE"
  | "OTHER";

export type UnifiedMovement = {
  movement_id: string;
  kind: MovementKind;
  origin_type: MovementOriginType;
  title: string;
  description: string | null;
  amount: number;
  posted_at: string;
  competence_month: string;
  account_id: string;
  card_id: string | null;
  payment_method: string;
  category_id: string;
  counterparty: string | null;
  lifecycle_status: MovementLifecycleStatus;
  edit_policy: "editable" | "inherited" | "locked";
  parent_id: string | null;
  group_id: string | null;
  transfer_direction: string | null;
  installment_number: number | null;
  installment_total: number | null;
  source_event_type: string;
};

export type MovementFilters = {
  competence_month?: string;
  kind?: MovementKind;
  origin_type?: MovementOriginType;
  lifecycle_status?: MovementLifecycleStatus;
  account_id?: string;
  card_id?: string;
  category_id?: string;
  payment_method?: string;
  counterparty?: string;
  has_counterparty?: boolean;
  text?: string;
  scope?: MovementScope;
  sort_by?:
    | "posted_at"
    | "competence_month"
    | "amount"
    | "title"
    | "category_id";
  sort_dir?: "asc" | "desc";
  page?: number;
  page_size?: number;
};

export type ScopeCount = {
  all: number;
  fixed: number;
  installments: number;
  variable: number;
  transfers: number;
  investments: number;
  reimbursements: number;
};

export type MovementSummary = {
  total_income: number;
  total_fixed: number;
  total_installments: number;
  total_variable: number;
  total_investments: number;
  total_reimbursements: number;
  total_expenses: number;
  total_result: number;
  counts: ScopeCount;
};

export type MovementPage = {
  items: UnifiedMovement[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

function resolveApiBaseUrl(): string {
  const injected = (globalThis as { __FINANCES_API_BASE_URL__?: string })
    .__FINANCES_API_BASE_URL__;
  if (injected && injected.trim().length > 0) {
    return injected.trim();
  }

  const location = globalThis.location;
  if (!location) {
    return "http://127.0.0.1:8000";
  }

  const isHttpOrigin =
    location.protocol === "http:" || location.protocol === "https:";
  const isLocalDevFrontend =
    (location.hostname === "127.0.0.1" || location.hostname === "localhost") &&
    location.port === "5173";
  const isTauriOrigin = location.hostname === "tauri.localhost";

  if (isHttpOrigin && !isLocalDevFrontend && !isTauriOrigin) {
    return location.origin;
  }

  return "http://127.0.0.1:8000";
}

export const API_BASE_URL = resolveApiBaseUrl();
const DEVICE_TOKEN_STORAGE_KEY = "finance.device_token";
let runtimeDeviceToken = readPersistedDeviceToken();

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly diagnostic: string | null;

  constructor(status: number, detail: string, diagnostic?: string | null) {
    super(detail || "Request failed.");
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.diagnostic = diagnostic ?? null;
  }
}

export function readLanDeviceToken(): string | null {
  return runtimeDeviceToken;
}

export function setLanDeviceToken(token: string | null): void {
  runtimeDeviceToken = token && token.trim().length > 0 ? token.trim() : null;
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  if (runtimeDeviceToken === null) {
    globalThis.localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
    return;
  }
  globalThis.localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, runtimeDeviceToken);
}

export async function fetchDashboardSummary(
  month: string,
): Promise<DashboardSummary> {
  return requestJson<DashboardSummary>(`/api/dashboard?month=${month}`);
}

export async function fetchBackupSnapshot(): Promise<BackupSnapshot> {
  return requestJson<BackupSnapshot>("/api/backups/export");
}

export async function fetchAccounts(): Promise<AccountSummary[]> {
  return requestJson<AccountSummary[]>("/api/accounts");
}

export async function fetchCards(): Promise<CardSummary[]> {
  return requestJson<CardSummary[]>("/api/cards");
}

export async function fetchRecurringRules(
  active?: boolean,
): Promise<RecurringRuleSummary[]> {
  const query =
    typeof active === "boolean"
      ? `?active=${encodeURIComponent(String(active))}`
      : "";
  return requestJson<RecurringRuleSummary[]>(
    query.length > 0 ? `/api/recurring-rules${query}` : "/api/recurring-rules",
  );
}

export async function fetchPendings(
  month: string,
): Promise<PendingExpenseSummary[]> {
  return requestJson<PendingExpenseSummary[]>(
    `/api/pendings?month=${encodeURIComponent(month)}`,
  );
}

export async function fetchInvoices(
  cardId?: string,
): Promise<InvoiceSummary[]> {
  const query = cardId ? `?card=${encodeURIComponent(cardId)}` : "";

  return requestJson<InvoiceSummary[]>(`/api/invoices${query}`);
}

export async function fetchCardPurchases(
  cardId?: string,
): Promise<CardPurchaseSummary[]> {
  const query = cardId ? `?card=${encodeURIComponent(cardId)}` : "";

  return requestJson<CardPurchaseSummary[]>(
    query.length > 0 ? `/api/card-purchases${query}` : "/api/card-purchases",
  );
}

export async function fetchCardInstallments(params?: {
  cardId?: string;
  fromMonth?: string;
}): Promise<CardInstallmentSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.cardId) {
    searchParams.set("card", params.cardId);
  }
  if (params?.fromMonth) {
    searchParams.set("from_month", params.fromMonth);
  }

  const query = searchParams.toString();
  return requestJson<CardInstallmentSummary[]>(
    query.length > 0
      ? `/api/card-installments?${query}`
      : "/api/card-installments",
  );
}

export async function fetchInvoiceItems(
  invoiceId: string,
): Promise<InvoiceItemSummary[]> {
  return requestJson<InvoiceItemSummary[]>(
    `/api/invoices/${encodeURIComponent(invoiceId)}/items`,
  );
}

export async function fetchInvoicePayments(
  invoiceId: string,
): Promise<InvoicePaymentSummary[]> {
  return requestJson<InvoicePaymentSummary[]>(
    `/api/invoices/${encodeURIComponent(invoiceId)}/payments`,
  );
}

export async function fetchTransactions(
  filters?: Partial<TransactionFilters>,
): Promise<TransactionSummary[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("ledger", "true");

  if (filters?.from) {
    searchParams.set("from", filters.from);
  }
  if (filters?.to) {
    searchParams.set("to", filters.to);
  }
  if (filters?.type) {
    searchParams.set("type", filters.type);
  }
  if (filters?.category) {
    searchParams.set("category", filters.category);
  }
  if (filters?.account) {
    searchParams.set("account", filters.account);
  }
  if (filters?.card) {
    searchParams.set("card", filters.card);
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
  if (filters.card) {
    searchParams.set("card", filters.card);
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

  return requestJson<ReportSummary>(
    `/api/reports/summary?${searchParams.toString()}`,
  );
}

export async function createAccount(
  payload: AccountPayload,
): Promise<AccountSummary> {
  return requestJson<AccountSummary>("/api/accounts", {
    method: "POST",
    body: JSON.stringify({
      id: createClientId(),
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
      id: createClientId(),
      name: payload.name,
      limit: payload.limitInCents,
      closing_day: payload.closingDay,
      due_day: payload.dueDay,
      payment_account_id: payload.paymentAccountId || undefined,
    }),
  });
}

export async function createRecurringRule(
  payload: RecurringRulePayload,
): Promise<RecurringRuleSummary> {
  return requestJson<RecurringRuleSummary>("/api/recurring-rules", {
    method: "POST",
    body: JSON.stringify({
      id: createClientId(),
      name: payload.name,
      amount: payload.amountInCents,
      due_day: payload.dueDay,
      payment_method: payload.paymentMethod,
      account_id:
        payload.paymentMethod === "CARD"
          ? undefined
          : payload.accountId || undefined,
      card_id:
        payload.paymentMethod === "CARD"
          ? payload.cardId || undefined
          : undefined,
      category_id: payload.categoryId,
      description: payload.description || undefined,
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

export async function updateRecurringRule(
  ruleId: string,
  payload: RecurringRuleUpdatePayload,
): Promise<RecurringRuleSummary> {
  const body = {
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.amountInCents !== undefined
      ? { amount: payload.amountInCents }
      : {}),
    ...(payload.dueDay !== undefined ? { due_day: payload.dueDay } : {}),
    ...(payload.paymentMethod !== undefined
      ? { payment_method: payload.paymentMethod }
      : {}),
    ...(payload.categoryId !== undefined
      ? { category_id: payload.categoryId }
      : {}),
    ...(payload.description !== undefined
      ? { description: payload.description || null }
      : {}),
    ...(payload.isActive !== undefined ? { is_active: payload.isActive } : {}),
    ...(payload.accountId !== undefined
      ? { account_id: payload.accountId || null }
      : {}),
    ...(payload.cardId !== undefined
      ? { card_id: payload.cardId || null }
      : {}),
  };

  return requestJson<RecurringRuleSummary>(`/api/recurring-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function createCardPurchase(
  payload: CardPurchasePayload,
): Promise<CardPurchaseSummary> {
  return requestJson<CardPurchaseSummary>("/api/card-purchases", {
    method: "POST",
    body: JSON.stringify({
      id: createClientId(),
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

export async function updateCardPurchase(
  purchaseId: string,
  payload: CardPurchaseUpdatePayload,
): Promise<CardPurchaseSummary> {
  const body = {
    ...(payload.purchaseDate !== undefined
      ? { purchase_date: normalizeTimestampForApi(payload.purchaseDate) }
      : {}),
    ...(payload.amountInCents !== undefined
      ? { amount: payload.amountInCents }
      : {}),
    ...(payload.installmentsCount !== undefined
      ? { installments_count: payload.installmentsCount }
      : {}),
    ...(payload.categoryId !== undefined
      ? { category_id: payload.categoryId }
      : {}),
    ...(payload.cardId !== undefined ? { card_id: payload.cardId } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description || null }
      : {}),
    ...(payload.personId !== undefined
      ? { person_id: payload.personId || null }
      : {}),
  };

  return requestJson<CardPurchaseSummary>(
    `/api/card-purchases/${encodeURIComponent(purchaseId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function voidCardPurchase(purchaseId: string): Promise<void> {
  await requestJson<void>(
    `/api/card-purchases/${encodeURIComponent(purchaseId)}/void`,
    {
      method: "POST",
    },
  );
}

export async function payInvoice(
  payload: InvoicePaymentPayload,
): Promise<InvoiceSummary> {
  return requestJson<InvoiceSummary>(
    `/api/invoices/${encodeURIComponent(payload.invoiceId)}/payments`,
    {
      method: "POST",
      body: JSON.stringify({
        id: createClientId(),
        amount: payload.amountInCents,
        account_id: payload.accountId,
        paid_at: normalizeTimestampForApi(payload.paidAt),
      }),
    },
  );
}

export async function updateInvoicePayment(
  paymentId: string,
  payload: InvoicePaymentUpdatePayload,
): Promise<InvoicePaymentSummary> {
  return requestJson<InvoicePaymentSummary>(
    `/api/invoice-payments/${encodeURIComponent(paymentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        account_id: payload.accountId,
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
      id: createClientId(),
      occurred_at:
        payload.occurredAt ?? new Date().toISOString().replace(".000", ""),
      amount: payload.amountInCents,
      account_id: payload.accountId,
      payment_method: payload.paymentMethod,
      category_id: payload.categoryId,
      description: payload.description,
      person_id: payload.personId || undefined,
    }),
  });
}

export async function createTransfer(
  payload: TransferPayload,
): Promise<TransactionSummary[]> {
  return requestJson<TransactionSummary[]>("/api/transfers", {
    method: "POST",
    body: JSON.stringify({
      id: createClientId(),
      occurred_at:
        payload.occurredAt ?? new Date().toISOString().replace(".000", ""),
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
    ...(payload.occurredAt !== undefined
      ? { occurred_at: payload.occurredAt }
      : {}),
    ...(payload.type !== undefined ? { type: payload.type } : {}),
    ...(payload.amountInCents !== undefined
      ? { amount: payload.amountInCents }
      : {}),
    ...(payload.accountId !== undefined
      ? { account_id: payload.accountId }
      : {}),
    ...(payload.paymentMethod !== undefined
      ? { payment_method: payload.paymentMethod }
      : {}),
    ...(payload.categoryId !== undefined
      ? { category_id: payload.categoryId }
      : {}),
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    ...(payload.personId !== undefined
      ? { person_id: payload.personId || undefined }
      : {}),
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
  return requestJson<TransactionSummary>(
    `/api/transactions/${transactionId}/void`,
    {
      method: "POST",
      body: JSON.stringify({
        reason: reason || undefined,
      }),
    },
  );
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
        amount: payload.amount ?? undefined,
      }),
    },
  );
}

export async function listReimbursements(params?: {
  status?: string;
  person?: string;
  month?: string;
  includeSourceDetails?: boolean;
}): Promise<PendingReimbursementSummary[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.person) query.set("person", params.person);
  if (params?.month) query.set("month", params.month);
  if (params?.includeSourceDetails) query.set("include_source_details", "true");
  const qs = query.toString();
  return requestJson<PendingReimbursementSummary[]>(
    `/api/reimbursements${qs ? `?${qs}` : ""}`,
  );
}

export async function getReimbursementsSummary(params?: {
  month?: string;
}): Promise<ReimbursementSummary> {
  const query = new URLSearchParams();
  if (params?.month) query.set("month", params.month);
  const qs = query.toString();
  return requestJson<ReimbursementSummary>(
    `/api/reimbursements/summary${qs ? `?${qs}` : ""}`,
  );
}

export async function updateReimbursement(
  transactionId: string,
  payload: UpdateReimbursementPayload,
): Promise<PendingReimbursementSummary> {
  const body: Record<string, string | null> = {};
  if ("expectedAt" in payload) body["expected_at"] = payload.expectedAt ?? null;
  if ("notes" in payload) body["notes"] = payload.notes ?? null;
  return requestJson<PendingReimbursementSummary>(
    `/api/reimbursements/${encodeURIComponent(transactionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function cancelReimbursement(
  transactionId: string,
): Promise<PendingReimbursementSummary> {
  return requestJson<PendingReimbursementSummary>(
    `/api/reimbursements/${encodeURIComponent(transactionId)}/cancel`,
    { method: "POST" },
  );
}

export async function confirmPendingExpense(
  pendingId: string,
): Promise<PendingExpenseSummary> {
  return requestJson<PendingExpenseSummary>(
    `/api/pendings/${encodeURIComponent(pendingId)}/confirm`,
    {
      method: "POST",
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
      id: createClientId(),
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
  const searchParams = new URLSearchParams({
    view: params.view,
    from: params.from,
    to: params.to,
  });
  if (typeof params.goalPercent === "number") {
    searchParams.set("goal_percent", String(params.goalPercent));
  }
  const query = searchParams.toString();

  return requestJson<InvestmentOverview>(`/api/investments/overview?${query}`);
}

export async function fetchMovements(
  filters?: MovementFilters,
): Promise<MovementPage> {
  const params = new URLSearchParams();
  if (filters?.competence_month)
    params.set("competence_month", filters.competence_month);
  if (filters?.kind) params.set("kind", filters.kind);
  if (filters?.origin_type) params.set("origin_type", filters.origin_type);
  if (filters?.lifecycle_status)
    params.set("lifecycle_status", filters.lifecycle_status);
  if (filters?.account_id) params.set("account_id", filters.account_id);
  if (filters?.card_id) params.set("card_id", filters.card_id);
  if (filters?.category_id) params.set("category_id", filters.category_id);
  if (filters?.payment_method)
    params.set("payment_method", filters.payment_method);
  if (filters?.counterparty) params.set("counterparty", filters.counterparty);
  if (typeof filters?.has_counterparty === "boolean") {
    params.set("has_counterparty", String(filters.has_counterparty));
  }
  if (filters?.text) params.set("text", filters.text);
  if (filters?.scope && filters.scope !== "all")
    params.set("scope", filters.scope);
  if (filters?.sort_by) params.set("sort_by", filters.sort_by);
  if (filters?.sort_dir) params.set("sort_dir", filters.sort_dir);
  if (filters?.page != null) params.set("page", String(filters.page));
  if (filters?.page_size != null)
    params.set("page_size", String(filters.page_size));
  const qs = params.toString();
  return requestJson<MovementPage>(
    qs ? `/api/movements?${qs}` : "/api/movements",
  );
}

export async function fetchMovementsSummary(
  competenceMonth: string,
): Promise<MovementSummary> {
  return requestJson<MovementSummary>(
    `/api/movements/summary?competence_month=${encodeURIComponent(competenceMonth)}`,
  );
}

export async function resetApplicationData(): Promise<{
  status: string;
  message: string;
}> {
  return requestJson<{ status: string; message: string }>("/api/dev/reset", {
    method: "POST",
  });
}

export async function fetchSecurityState(): Promise<SecurityState> {
  return requestJson<SecurityState>("/api/security/state");
}

export async function fetchLanSecurityState(): Promise<LanSecurityState> {
  return requestJson<LanSecurityState>("/api/security/lan");
}

export async function setLanSecurityEnabled(enabled: boolean): Promise<LanSecurityState> {
  return requestJson<LanSecurityState>("/api/security/lan", {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export async function issueLanPairToken(): Promise<LanPairTokenSession> {
  return requestJson<LanPairTokenSession>("/api/security/lan/pair-token", {
    method: "POST",
  });
}

export async function pairLanDevice(payload: {
  pairToken: string;
  deviceName?: string;
}): Promise<LanPairingResult> {
  const result = await requestJson<LanPairingResult>("/api/security/pair", {
    method: "POST",
    body: JSON.stringify({
      pair_token: payload.pairToken,
      device_name: payload.deviceName || undefined,
    }),
  });
  setLanDeviceToken(result.device_token);
  return result;
}

export async function fetchAuthorizedLanDevices(): Promise<AuthorizedLanDevice[]> {
  return requestJson<AuthorizedLanDevice[]>("/api/security/devices");
}

export async function revokeAuthorizedLanDevice(deviceId: string): Promise<void> {
  await requestJson<void>(`/api/security/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE",
  });
}

export async function setSecurityPassword(payload: {
  password: string;
  inactivityLockSeconds?: number;
}): Promise<void> {
  await requestJson<void>("/api/security/password", {
    method: "POST",
    body: JSON.stringify({
      password: payload.password,
      inactivity_lock_seconds: payload.inactivityLockSeconds,
    }),
  });
}

export async function lockApplication(): Promise<void> {
  await requestJson<void>("/api/security/lock", {
    method: "POST",
  });
}

export async function unlockApplication(password: string): Promise<void> {
  await requestJson<void>("/api/security/unlock", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const requestMethod = (init?.method || "GET").toUpperCase();
  const requestUrl = `${API_BASE_URL}${path}`;
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (runtimeDeviceToken && !headers.has("X-Finance-Token")) {
    headers.set("X-Finance-Token", runtimeDeviceToken);
  }
  const requestOrigin = resolveRequestOriginHeaderValue();
  if (requestOrigin && !headers.has("X-Finance-Origin")) {
    headers.set("X-Finance-Origin", requestOrigin);
  }

  const response = await fetch(requestUrl, {
    ...init,
    headers,
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
    const diagnostic = buildApiErrorDiagnostic({
      path,
      requestUrl,
      requestMethod,
      headers,
      responseStatus: response.status,
      responseStatusText: response.statusText,
      responseDetail: detail || "Request failed.",
      responseBody: detailText,
    });
    throw new ApiError(response.status, detail || "Request failed.", diagnostic);
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

function readPersistedDeviceToken(): string | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }
  const stored = globalThis.localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  if (!stored) {
    return null;
  }
  const trimmed = stored.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildApiErrorDiagnostic(params: {
  path: string;
  requestUrl: string;
  requestMethod: string;
  headers: Headers;
  responseStatus: number;
  responseStatusText: string;
  responseDetail: string;
  responseBody: string;
}): string {
  const location = globalThis.location;
  const navigator = globalThis.navigator;
  const payload = {
    diagnostic_type: "api_error",
    captured_at: new Date().toISOString(),
    request: {
      method: params.requestMethod,
      path: params.path,
      url: params.requestUrl,
      api_base_url: API_BASE_URL,
      has_device_token: params.headers.has("X-Finance-Token"),
      x_finance_origin: params.headers.get("X-Finance-Origin"),
      content_type: params.headers.get("Content-Type"),
    },
    response: {
      status: params.responseStatus,
      status_text: params.responseStatusText || null,
      detail: truncateDiagnosticText(params.responseDetail, 1500),
      raw_body: truncateDiagnosticText(params.responseBody, 3000),
    },
    runtime: {
      page_href: location?.href ?? null,
      page_origin: location?.origin ?? null,
      page_protocol: location?.protocol ?? null,
      user_agent: navigator?.userAgent ?? null,
      language: navigator?.language ?? null,
    },
  };
  return JSON.stringify(payload, null, 2);
}

function resolveRequestOriginHeaderValue(): string | null {
  const location = globalThis.location;
  if (
    !location ||
    (location.protocol !== "http:" && location.protocol !== "https:")
  ) {
    return null;
  }

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;
    if (location.origin !== apiOrigin) {
      return null;
    }
    return location.origin;
  } catch {
    return null;
  }
}

function truncateDiagnosticText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  const hiddenCount = value.length - maxLength;
  return `${value.slice(0, maxLength)}...[truncated:${hiddenCount}]`;
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
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
      match;
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
