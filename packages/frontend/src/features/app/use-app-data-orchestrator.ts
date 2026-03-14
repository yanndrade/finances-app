import { useCallback, useRef, useState } from "react";

import type { AppView } from "../../components/sidebar";
import {
  fetchAccounts,
  fetchCards,
  fetchDashboardSummary,
  fetchInvestmentMovements,
  fetchInvestmentOverview,
  fetchInvoices,
  fetchPendings,
  fetchRecurringRules,
  fetchTransactions,
  type AccountSummary,
  type CardSummary,
  type DashboardSummary,
  type InvestmentMovementSummary,
  type InvestmentOverview,
  type InvestmentView,
  type InvoiceSummary,
  type PendingExpenseSummary,
  type RecurringRuleSummary,
  type TransactionFilters,
  type TransactionSummary,
} from "../../lib/api";
import { toIsoFromDate, toTransactionApiFilters } from "../../lib/date-filters";

type RefreshOptions = {
  month?: string;
  filters?: TransactionFilters;
  investmentView?: InvestmentView;
  investmentFromDate?: string;
  investmentToDate?: string;
};

type UseAppDataOrchestratorParams = {
  activeView: AppView;
  selectedMonth: string;
  initialTransactionFilters: TransactionFilters;
  initialInvestmentView: InvestmentView;
  initialInvestmentFromDate: string;
  initialInvestmentToDate: string;
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
  onError,
  onRefreshSuccess,
}: UseAppDataOrchestratorParams) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleSummary[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpenseSummary[]>([]);
  const [investmentOverview, setInvestmentOverview] = useState<InvestmentOverview | null>(null);
  const [investmentMovements, setInvestmentMovements] = useState<InvestmentMovementSummary[]>([]);
  const [investmentView, setInvestmentView] = useState<InvestmentView>(initialInvestmentView);
  const [investmentFromDate, setInvestmentFromDate] = useState(initialInvestmentFromDate);
  const [investmentToDate, setInvestmentToDate] = useState(initialInvestmentToDate);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(
    initialTransactionFilters,
  );
  const [loading, setLoading] = useState(true);
  const latestRefreshIdRef = useRef(0);

  const refreshData = useCallback(
    async (options?: RefreshOptions) => {
      const refreshId = ++latestRefreshIdRef.current;
      const month = options?.month ?? selectedMonth;
      const filters = options?.filters ?? transactionFilters;
      const activeInvestmentView = options?.investmentView ?? investmentView;
      const activeFromDate = options?.investmentFromDate ?? investmentFromDate;
      const activeToDate = options?.investmentToDate ?? investmentToDate;
      const transactionApiFilters = toTransactionApiFilters(filters);

      setLoading(true);

      try {
        const [
          nextCards,
          nextInvoices,
          nextDashboard,
          nextAccounts,
          nextTransactions,
          nextRecurringRules,
          nextPendingExpenses,
          nextInvestmentOverview,
          nextInvestmentMovements,
        ] = await Promise.all([
          fetchCards(),
          fetchInvoices(),
          fetchDashboardSummary(month),
          fetchAccounts(),
          fetchTransactions(transactionApiFilters),
          fetchRecurringRules(),
          fetchPendings(month),
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
        setInvestmentOverview(nextInvestmentOverview);
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
      investmentToDate,
      investmentView,
      onError,
      onRefreshSuccess,
      selectedMonth,
      transactionFilters,
    ],
  );

  return {
    dashboard,
    accounts,
    cards,
    invoices,
    transactions,
    recurringRules,
    pendingExpenses,
    investmentOverview,
    investmentMovements,
    investmentView,
    investmentFromDate,
    investmentToDate,
    transactionFilters,
    loading,
    refreshData,
  };
}
