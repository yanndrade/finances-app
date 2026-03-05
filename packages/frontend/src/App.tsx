import "./styles.css";

import { Suspense, lazy, useEffect, useState } from "react";

import { AppShell } from "./components/app-shell";
import type { AppView } from "./components/sidebar";
import { ToastViewport, type AppToast } from "./components/toast-viewport";
import {
  createAccount,
  createCard,
  createCardPurchase,
  createCashTransaction,
  createInvestmentMovement,
  createTransfer,
  fetchAccounts,
  fetchCards,
  fetchDashboardSummary,
  fetchReportSummary,
  fetchInvestmentMovements,
  fetchInvestmentOverview,
  fetchInvoices,
  fetchTransactions,
  markReimbursementReceived,
  payInvoice,
  resetApplicationData,
  upsertCategoryBudget,
  updateAccount,
  updateCard,
  updateTransaction,
  voidTransaction,
  type AccountPayload,
  type AccountSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardSummary,
  type CardUpdatePayload,
  type AccountUpdatePayload,
  type CashTransactionPayload,
  type DashboardSummary,
  type InvoicePaymentPayload,
  type InvestmentMovementPayload,
  type InvestmentMovementSummary,
  type InvestmentOverview,
  type InvestmentView,
  type InvoiceSummary,
  type ReportFilters,
  type ReportSummary,
  type TransactionFilters,
  type TransactionSummary,
  type TransactionUpdatePayload,
  type TransferPayload,
} from "./lib/api";

const QuickAddComposer = lazy(async () => {
  const module = await import("./components/quick-add-composer");
  return { default: module.QuickAddComposer };
});

const AccountsView = lazy(async () => {
  const module = await import("./features/accounts/accounts-view");
  return { default: module.AccountsView };
});

const CardsView = lazy(async () => {
  const module = await import("./features/cards/cards-view");
  return { default: module.CardsView };
});

const DashboardView = lazy(async () => {
  const module = await import("./features/dashboard/dashboard-view");
  return { default: module.DashboardView };
});

const ReportsView = lazy(async () => {
  const module = await import("./features/reports/reports-view");
  return { default: module.ReportsView };
});

const SettingsView = lazy(async () => {
  const module = await import("./features/settings/settings-view");
  return { default: module.SettingsView };
});

const InvestmentsView = lazy(async () => {
  const module = await import("./features/investments/investments-view");
  return { default: module.InvestmentsView };
});

const TransactionsView = lazy(async () => {
  const module = await import("./features/transactions/transactions-view");
  return { default: module.TransactionsView };
});

const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  period: "month",
  reference: currentDate(),
  from: "",
  to: "",
  category: "",
  account: "",
  method: "",
  person: "",
  text: "",
};

const VIEW_META: Record<
  AppView,
  {
    title: string;
    description: string;
  }
> = {
  dashboard: {
    title: "Vis\u00E3o geral",
    description: "Resumo mensal e pontos de atencao.",
  },
  reports: {
    title: "Relat\u00F3rios",
    description: "Filtros globais, categorias e exposicao futura.",
  },
  investments: {
    title: "Investimentos",
    description: "Patrimonio, aportes e dividendos.",
  },
  transactions: {
    title: "Transa\u00E7\u00F5es",
    description: "Filtro, ajuste e hist\u00F3rico.",
  },
  accounts: {
    title: "Contas",
    description: "Saldos e estrutura da carteira.",
  },
  cards: {
    title: "Cart\u00F5es",
    description: "Faturas, ciclos e compras.",
  },
  settings: {
    title: "Configura\u00E7\u00F5es",
    description: "Ferramentas e prefer\u00EAncias.",
  },
};

const TOAST_DURATION_MS = {
  success: 3200,
  error: 5200,
} as const;

export function App() {
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [investmentOverview, setInvestmentOverview] = useState<InvestmentOverview | null>(null);
  const [investmentMovements, setInvestmentMovements] = useState<InvestmentMovementSummary[]>([]);
  const [investmentView, setInvestmentView] = useState<InvestmentView>("monthly");
  const [investmentFromDate, setInvestmentFromDate] = useState(() =>
    monthFirstDay(currentMonth()),
  );
  const [investmentToDate, setInvestmentToDate] = useState(() =>
    monthLastDay(currentMonth()),
  );
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    EMPTY_TRANSACTION_FILTERS,
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [toast, setToast] = useState<AppToast>(null);

  useEffect(() => {
    void refreshData({ month: selectedMonth });
  }, [selectedMonth]);

  useEffect(() => {
    if (activeView !== "reports") {
      return;
    }

    void refreshData({ includeReport: true });
  }, [activeView]);

  useEffect(() => {
    if (toast === null) {
      return;
    }

    const timeout = globalThis.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, TOAST_DURATION_MS[toast.tone]);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [toast]);

  function showToast(tone: "success" | "error", message: string) {
    setToast({
      id: Date.now(),
      tone,
      message,
    });
  }

  async function refreshData(options?: {
    month?: string;
    filters?: TransactionFilters;
    investmentView?: InvestmentView;
    investmentFromDate?: string;
    investmentToDate?: string;
    includeReport?: boolean;
  }) {
    const month = options?.month ?? selectedMonth;
    const filters = options?.filters ?? transactionFilters;
    const activeInvestmentView = options?.investmentView ?? investmentView;
    const activeFromDate = options?.investmentFromDate ?? investmentFromDate;
    const activeToDate = options?.investmentToDate ?? investmentToDate;
    const shouldFetchReport = options?.includeReport ?? activeView === "reports";
    const transactionApiFilters = toTransactionApiFilters(filters);
    const reportApiFilters = toReportApiFilters(filters);

    setLoading(true);

    try {
      const [
        nextCards,
        nextInvoices,
        nextDashboard,
        nextAccounts,
        nextTransactions,
        nextInvestmentOverview,
        nextInvestmentMovements,
      ] = await Promise.all([
        fetchCards(),
        fetchInvoices(),
        fetchDashboardSummary(month),
        fetchAccounts(),
        fetchTransactions(transactionApiFilters),
        fetchInvestmentOverview({
          view: activeInvestmentView,
          from: toIsoFromDate(activeFromDate, false),
          to: toIsoFromDate(activeToDate, true),
        }),
        fetchInvestmentMovements({
          from: toIsoFromDate(activeFromDate, false),
          to: toIsoFromDate(activeToDate, true),
        }),
      ]);
      let nextReportSummary: ReportSummary | undefined;
      if (shouldFetchReport) {
        nextReportSummary = await fetchReportSummary(reportApiFilters);
      }

      setCards(nextCards);
      setInvoices(nextInvoices);
      setDashboard(nextDashboard);
      setAccounts(nextAccounts);
      setTransactions(nextTransactions);
      setInvestmentOverview(nextInvestmentOverview);
      setInvestmentMovements(nextInvestmentMovements);
      if (nextReportSummary !== undefined) {
        setReportSummary(nextReportSummary);
      }
      setTransactionFilters(filters);
      setInvestmentView(activeInvestmentView);
      setInvestmentFromDate(activeFromDate);
      setInvestmentToDate(activeToDate);
    } catch (error) {
      showToast("error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function runMutation(
    action: () => Promise<unknown>,
    successMessage: string,
    options?: {
      filters?: TransactionFilters;
      includeReport?: boolean;
    },
  ): Promise<boolean> {
    setIsSubmitting(true);
    setToast(null);

    try {
      await action();
      await refreshData({
        filters: options?.filters,
        includeReport: options?.includeReport,
      });
      showToast("success", successMessage);
      return true;
    } catch (error) {
      showToast("error", getErrorMessage(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransactionSubmit(payload: CashTransactionPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCashTransaction(payload),
      "Transa\u00e7\u00e3o registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a transacao.");
    }
  }

  async function handleTransferSubmit(payload: TransferPayload): Promise<void> {
    if (payload.fromAccountId === payload.toAccountId) {
      showToast("error", "Selecione contas diferentes para a transfer\u00eancia.");
      throw new Error("Selecione contas diferentes para a transferencia.");
    }

    const wasSuccessful = await runMutation(
      () => createTransfer(payload),
      "Transfer\u00eancia registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a transferencia.");
    }
  }

  async function handleCreateAccount(payload: AccountPayload): Promise<void> {
    await runMutation(() => createAccount(payload), "Conta criada com sucesso.");
  }

  async function handleCreateCard(payload: CardPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCard(payload),
      "Cartao criado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel criar o cartao.");
    }
  }

  async function handleUpdateAccount(
    accountId: string,
    payload: AccountUpdatePayload,
  ): Promise<void> {
    await runMutation(
      () => updateAccount(accountId, payload),
      "Conta atualizada com sucesso.",
    );
  }

  async function handleUpdateCard(cardId: string, payload: CardUpdatePayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => updateCard(cardId, payload),
      "Cartao atualizado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel atualizar o cartao.");
    }
  }

  async function handleCreateCardPurchase(payload: CardPurchasePayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createCardPurchase(payload),
      "Compra no cartao registrada com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar a compra no cartao.");
    }
  }

  async function handlePayInvoice(payload: InvoicePaymentPayload): Promise<void> {
    const wasSuccessful = await runMutation(
      () => payInvoice(payload),
      "Pagamento de fatura registrado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar o pagamento da fatura.");
    }
  }

  async function handleApplyTransactionFilters(filters: TransactionFilters): Promise<void> {
    await refreshData({ filters, includeReport: false });
  }

  async function handleApplyReportFilters(filters: TransactionFilters): Promise<void> {
    await refreshData({ filters, includeReport: true });
  }

  async function handleUpdateTransaction(
    transactionId: string,
    payload: TransactionUpdatePayload,
  ): Promise<void> {
    await runMutation(
      () => updateTransaction(transactionId, payload),
      "Transacao atualizada com sucesso.",
    );
  }

  async function handleVoidTransaction(transactionId: string): Promise<void> {
    await runMutation(
      () => voidTransaction(transactionId),
      "Transacao estornada com sucesso.",
    );
  }

  async function handleMarkReimbursementReceived(
    transactionId: string,
  ): Promise<void> {
    await runMutation(
      () =>
        markReimbursementReceived(transactionId, {
          receivedAt: new Date().toISOString(),
        }),
      "Reembolso confirmado com sucesso.",
    );
  }

  async function handleUpsertCategoryBudget(
    month: string,
    categoryId: string,
    limitInCents: number,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () =>
        upsertCategoryBudget({
          categoryId,
          month,
          limitInCents,
        }),
      "Orcamento mensal salvo com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel salvar o orcamento.");
    }
  }

  async function handleCreateInvestmentMovement(
    payload: InvestmentMovementPayload,
  ): Promise<void> {
    const wasSuccessful = await runMutation(
      () => createInvestmentMovement(payload),
      "Movimento de investimento registrado com sucesso.",
    );

    if (!wasSuccessful) {
      throw new Error("Nao foi possivel registrar movimento de investimento.");
    }
  }

  async function handleInvestmentViewChange(nextView: InvestmentView): Promise<void> {
    await refreshData({
      investmentView: nextView,
    });
  }

  async function handleInvestmentRangeChange(
    nextFromDate: string,
    nextToDate: string,
  ): Promise<void> {
    await refreshData({
      investmentFromDate: nextFromDate,
      investmentToDate: nextToDate,
    });
  }

  async function handleResetAllData(): Promise<void> {
    if (!globalThis.confirm("Isso vai apagar todos os dados da aplicacao. Deseja continuar?")) {
      return;
    }

    const wasSuccessful = await runMutation(
      () => resetApplicationData(),
      "Aplicacao zerada com sucesso.",
    );

    if (wasSuccessful) {
      setActiveView("dashboard");
    }
  }

  const activeMeta = VIEW_META[activeView];

  return (
    <AppShell
      activeView={activeView}
      description={activeMeta.description}
      onNavigate={setActiveView}
      onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      title={activeMeta.title}
    >
      <Suspense fallback={<ViewFallback activeView={activeView} />}>
        {activeView === "dashboard" ? (
          <DashboardView
            accounts={accounts}
            dashboard={dashboard}
            investmentOverview={investmentOverview}
            isSubmitting={isSubmitting}
            loading={loading}
            month={selectedMonth}
            onMarkReimbursementReceived={handleMarkReimbursementReceived}
            onMonthChange={setSelectedMonth}
            onNavigate={setActiveView}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onUpsertBudget={handleUpsertCategoryBudget}
            onUpdateTransaction={(transactionId, updates) => {
              if (updates.description !== undefined) {
                void runMutation(
                  () =>
                    updateTransaction(transactionId, {
                      description: updates.description ?? "",
                    } as TransactionUpdatePayload),
                  "Descricao atualizada com sucesso.",
                );
              }
            }}
            transactions={transactions}
          />
        ) : null}

        {activeView === "reports" ? (
          <ReportsView
            accounts={accounts}
            filters={transactionFilters}
            isSubmitting={isSubmitting}
            loading={loading}
            onApplyFilters={handleApplyReportFilters}
            summary={reportSummary}
          />
        ) : null}

        {activeView === "investments" ? (
          <InvestmentsView
            accounts={accounts}
            loading={loading}
            isSubmitting={isSubmitting}
            overview={investmentOverview}
            movements={investmentMovements}
            view={investmentView}
            fromDate={investmentFromDate}
            toDate={investmentToDate}
            onViewChange={(nextView) => {
              void handleInvestmentViewChange(nextView);
            }}
            onRangeChange={(nextFromDate, nextToDate) => {
              void handleInvestmentRangeChange(nextFromDate, nextToDate);
            }}
            onCreateMovement={async (payload) => {
              await handleCreateInvestmentMovement(payload);
            }}
          />
        ) : null}

        {activeView === "transactions" ? (
          <TransactionsView
            accounts={accounts}
            filters={transactionFilters}
            isSubmitting={isSubmitting}
            onApplyFilters={handleApplyTransactionFilters}
            onUpdateTransaction={handleUpdateTransaction}
            onVoidTransaction={handleVoidTransaction}
            transactions={transactions}
          />
        ) : null}

        {activeView === "accounts" ? (
          <AccountsView
            accounts={accounts}
            isSubmitting={isSubmitting}
            onCreateAccount={handleCreateAccount}
            onUpdateAccount={handleUpdateAccount}
          />
        ) : null}

        {activeView === "cards" ? (
          <CardsView
            accounts={accounts}
            cards={cards}
            invoices={invoices}
            isSubmitting={isSubmitting}
            onCreateCard={handleCreateCard}
            onCreateCardPurchase={handleCreateCardPurchase}
            onPayInvoice={handlePayInvoice}
            onUpdateCard={handleUpdateCard}
          />
        ) : null}

        {activeView === "settings" ? (
          <SettingsView
            isSubmitting={isSubmitting}
            onResetApplicationData={handleResetAllData}
          />
        ) : null}
      </Suspense>

      <ToastViewport
        onDismiss={() => setToast(null)}
        toast={toast}
      />

      {isQuickAddOpen ? (
        <Suspense fallback={null}>
          <QuickAddComposer
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
            accounts={accounts}
            cards={cards}
            invoices={invoices}
            onSubmitTransaction={async (payload) => {
              await handleTransactionSubmit(payload);
            }}
            onSubmitTransfer={async (payload) => {
              await handleTransferSubmit(payload);
            }}
            onSubmitCardPurchase={async (payload) => {
              await handleCreateCardPurchase(payload);
            }}
            onSubmitInvoicePayment={async (payload) => {
              await handlePayInvoice(payload);
            }}
            onSubmitInvestmentMovement={async (payload) => {
              await handleCreateInvestmentMovement(payload);
            }}
            isSubmitting={isSubmitting}
          />
        </Suspense>
      ) : null}
    </AppShell>
  );
}

function ViewFallback({ activeView }: { activeView: AppView }) {
  if (activeView === "dashboard") {
    return (
      <div className="space-y-8" aria-hidden="true">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
          <div className="h-32 rounded-[2rem] bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] bg-white p-8 shadow-sm" aria-hidden="true">
      <div className="h-5 w-40 rounded-full bg-slate-200 animate-pulse" />
    </div>
  );
}

function currentMonth(): string {
  return currentDate().slice(0, 7);
}

function currentDate(): string {
  return formatLocalDate(new Date());
}

function monthFirstDay(month: string): string {
  return `${month}-01`;
}

function monthLastDay(month: string): string {
  const [yearText, monthText] = month.split("-");
  const year = parseInt(yearText ?? "1970", 10);
  const monthValue = parseInt(monthText ?? "1", 10);
  const lastDay = new Date(year, monthValue, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function toTransactionApiFilters(filters: TransactionFilters): Partial<TransactionFilters> {
  const normalized = normalizeReportFilters(filters);
  const range = resolveFilterRange(normalized);

  return {
    from: range.from,
    to: range.to,
    category: normalized.category,
    account: normalized.account,
    method: normalized.method,
    person: normalized.person,
    text: normalized.text,
  };
}

function toReportApiFilters(filters: TransactionFilters): ReportFilters {
  const normalized = normalizeReportFilters(filters);
  const range = resolveFilterRange(normalized);

  return {
    period: normalized.period,
    reference: normalized.reference,
    from: range.from,
    to: range.to,
    category: normalized.category,
    account: normalized.account,
    method: normalized.method,
    person: normalized.person,
    text: normalized.text,
  };
}

function normalizeReportFilters(filters: TransactionFilters): ReportFilters {
  return {
    period: filters.period ?? "month",
    reference: filters.reference ?? currentDate(),
    from: filters.from,
    to: filters.to,
    category: filters.category,
    account: filters.account,
    method: filters.method,
    person: filters.person,
    text: filters.text,
  };
}

function resolveFilterRange(filters: ReportFilters): { from: string; to: string } {
  if (filters.period === "custom") {
    if (!filters.from || !filters.to) {
      return { from: "", to: "" };
    }
    return {
      from: toIsoFromDate(filters.from, false),
      to: toIsoFromDate(filters.to, true),
    };
  }

  const safeReference = normalizeReferenceDate(filters.reference);
  const [yearText, monthText, dayText] = safeReference.split("-");
  const year = parseInt(yearText ?? "1970", 10);
  const month = parseInt(monthText ?? "1", 10);
  const day = parseInt(dayText ?? "1", 10);
  const referenceDate = new Date(Date.UTC(year, month - 1, day));
  let start = new Date(referenceDate);
  let end = new Date(referenceDate);

  if (filters.period === "week") {
    const weekDay = referenceDate.getUTCDay();
    const mondayOffset = (weekDay + 6) % 7;
    start = new Date(referenceDate);
    start.setUTCDate(referenceDate.getUTCDate() - mondayOffset);
    end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (filters.period === "month") {
    start = new Date(Date.UTC(year, month - 1, 1));
    end = new Date(Date.UTC(year, month, 0));
  }

  return {
    from: `${start.toISOString().slice(0, 10)}T00:00:00Z`,
    to: `${end.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}

function toIsoFromDate(value: string, endOfDay: boolean): string {
  const suffix = endOfDay ? "T23:59:59Z" : "T00:00:00Z";
  return `${value}${suffix}`;
}

function normalizeReferenceDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return currentDate();
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel concluir a operacao.";
}
