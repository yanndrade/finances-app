import { useCallback, useRef, useState } from "react";

import type { AppView } from "../../components/sidebar";
import {
  fetchAccounts,
  fetchCards,
  fetchDashboardSummary,
  fetchInvestmentMovements,
  fetchInvestmentCurrent,
  fetchInvestmentHistory,
  fetchInvestmentSnapshots,
  fetchInvestmentOverview,
  fetchInvoices,
  fetchPendings,
  fetchRecurringRules,
  syncRecurringCardCharges,
  fetchTransactions,
  type AccountSummary,
  type CardSummary,
  type DashboardSummary,
  type InvestmentMovementSummary,
  type InvestmentCurrent,
  type InvestmentOverview,
  type InvestmentSnapshot,
  type InvestmentView,
  type InvoiceSummary,
  type PendingExpenseSummary,
  type RecurringRuleSummary,
  type TransactionFilters,
  type TransactionSummary,
} from "../../lib/api";
import {
  monthFirstDay,
  monthLastDay,
  toIsoFromDate,
  toTransactionApiFilters,
} from "../../lib/date-filters";

type RefreshOptions = {
  month?: string;
  filters?: TransactionFilters;
  investmentView?: InvestmentView;
  investmentFromDate?: string;
  investmentToDate?: string;
  investmentGoalPercent?: number;
};

type UseAppDataOrchestratorParams = {
  activeView: AppView;
  selectedMonth: string;
  initialTransactionFilters: TransactionFilters;
  initialInvestmentView: InvestmentView;
  initialInvestmentFromDate: string;
  initialInvestmentToDate: string;
  investmentGoalPercent: number;
  onError: (error: unknown) => void;
  onRefreshSuccess?: () => void;
};

export function useAppDataOrchestrator({
  activeView,
  selectedMonth,
  initialTransactionFilters,
  initialInvestmentView,
  initialInvestmentFromDate,
  initialInvestmentToDate,
  investmentGoalPercent,
  onError,
  onRefreshSuccess,
}: UseAppDataOrchestratorParams) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardInvestmentOverview, setDashboardInvestmentOverview] =
    useState<InvestmentOverview | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleSummary[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpenseSummary[]>([]);
  const [investmentHistory, setInvestmentHistory] = useState<InvestmentOverview | null>(null);
  const [investmentCurrent, setInvestmentCurrent] = useState<InvestmentCurrent | null>(null);
  const [investmentSnapshots, setInvestmentSnapshots] = useState<InvestmentSnapshot[]>([]);
  const [investmentMovements, setInvestmentMovements] = useState<InvestmentMovementSummary[]>([]);
  const [investmentView, setInvestmentView] = useState<InvestmentView>(initialInvestmentView);
  const [investmentFromDate, setInvestmentFromDate] = useState(initialInvestmentFromDate);
  const [investmentToDate, setInvestmentToDate] = useState(initialInvestmentToDate);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    initialTransactionFilters,
  );
  const [loading, setLoading] = useState(true);
  const latestRefreshIdRef = useRef(0);
  const refreshDataRef = useRef<(options?: RefreshOptions) => Promise<void>>(
    async () => undefined,
  );

  const refreshData = useCallback(
    async (options?: RefreshOptions) => {
      const refreshId = ++latestRefreshIdRef.current;
      const month = options?.month ?? selectedMonth;
      const filters = options?.filters ?? transactionFilters;
      const activeInvestmentView = options?.investmentView ?? investmentView;
      const activeFromDate = options?.investmentFromDate ?? investmentFromDate;
      const activeToDate = options?.investmentToDate ?? investmentToDate;
      const activeGoalPercent =
        options?.investmentGoalPercent ?? investmentGoalPercent;
      const transactionApiFilters = toTransactionApiFilters(filters);
      const dashboardInvestmentFrom = toIsoFromDate(monthFirstDay(month), false);
      const dashboardInvestmentTo = toIsoFromDate(monthLastDay(month), true);

      setLoading(true);

      void syncRecurringCardCharges()
        .then((result) => {
          if (result.posted_count > 0) {
            void refreshDataRef.current({ month });
          }
        })
        .catch(() => {
          // Data refresh remains usable when an older/local backend does not expose the sync endpoint yet.
        });

      try {
        const [
          nextCards,
          nextInvoices,
          nextDashboard,
          nextAccounts,
          nextTransactions,
          nextRecurringRules,
          nextPendingExpenses,
          nextDashboardInvestmentOverview,
          nextInvestmentCurrent,
          nextInvestmentSnapshots,
          nextInvestmentHistory,
          nextInvestmentMovements,
        ] = await Promise.all([
          fetchCards(),
          fetchInvoices(undefined, month),
          fetchDashboardSummary(month),
          fetchAccounts(),
          fetchTransactions(transactionApiFilters),
          fetchRecurringRules(),
          fetchPendings(month),
          fetchInvestmentOverview({
            view: "monthly",
            from: dashboardInvestmentFrom,
            to: dashboardInvestmentTo,
            goalPercent: activeGoalPercent,
          }),
          fetchInvestmentCurrent(),
          fetchInvestmentSnapshots().catch(() => []),
          fetchInvestmentHistory({
            view: activeInvestmentView,
            from: toIsoFromDate(activeFromDate, false),
            to: toIsoFromDate(activeToDate, true),
            goalPercent: activeGoalPercent,
          }),
          fetchInvestmentMovements({
            from: toIsoFromDate(activeFromDate, false),
            to: toIsoFromDate(activeToDate, true),
          }),
        ]);

        if (refreshId !== latestRefreshIdRef.current) {
          return;
        }

        setCards(nextCards);
        setInvoices(nextInvoices);
        setDashboard(nextDashboard);
        setAccounts(nextAccounts);
        setTransactions(nextTransactions);
        setRecurringRules(nextRecurringRules);
        setPendingExpenses(nextPendingExpenses);
        setDashboardInvestmentOverview(nextDashboardInvestmentOverview);
        setInvestmentCurrent(nextInvestmentCurrent);
        setInvestmentSnapshots(nextInvestmentSnapshots);
        setInvestmentHistory(nextInvestmentHistory);
        setInvestmentMovements(nextInvestmentMovements);
        setTransactionFilters(filters);
        setInvestmentView(activeInvestmentView);
        setInvestmentFromDate(activeFromDate);
        setInvestmentToDate(activeToDate);
        onRefreshSuccess?.();
      } catch (error) {
        if (refreshId === latestRefreshIdRef.current) {
          onError(error);
        }
      } finally {
        if (refreshId === latestRefreshIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      activeView,
      investmentFromDate,
      investmentGoalPercent,
      investmentToDate,
      investmentView,
      onError,
      onRefreshSuccess,
      selectedMonth,
      transactionFilters,
    ],
  );

  refreshDataRef.current = refreshData;

  return {
    dashboard,
    dashboardInvestmentOverview,
    accounts,
    cards,
    invoices,
    transactions,
    recurringRules,
    pendingExpenses,
    investmentHistory,
    investmentCurrent,
    investmentSnapshots,
    investmentMovements,
    investmentView,
    investmentFromDate,
    investmentToDate,
    transactionFilters,
    loading,
    refreshData,
  };
}
