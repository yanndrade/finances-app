import { useCallback, useRef, useState } from "react";

import type { AppView } from "../../components/sidebar";
import {
  fetchAccounts,
  fetchCards,
  fetchDashboardSummary,
  fetchInvestmentMovements,
  fetchInvestmentOverview,
  fetchInvoices,
  fetchReportSummary,
  fetchTransactions,
  type AccountSummary,
  type CardSummary,
  type DashboardSummary,
  type InvestmentMovementSummary,
  type InvestmentOverview,
  type InvestmentView,
  type InvoiceSummary,
  type ReportSummary,
  type TransactionFilters,
  type TransactionSummary,
} from "../../lib/api";
import { toIsoFromDate, toReportApiFilters, toTransactionApiFilters } from "../../lib/date-filters";

type RefreshOptions = {
  month?: string;
  filters?: TransactionFilters;
  investmentView?: InvestmentView;
  investmentFromDate?: string;
  investmentToDate?: string;
  includeReport?: boolean;
};

type UseAppDataOrchestratorParams = {
  activeView: AppView;
  selectedMonth: string;
  initialTransactionFilters: TransactionFilters;
  initialInvestmentView: InvestmentView;
  initialInvestmentFromDate: string;
  initialInvestmentToDate: string;
  onError: (error: unknown) => void;
};

export function useAppDataOrchestrator({
  activeView,
  selectedMonth,
  initialTransactionFilters,
  initialInvestmentView,
  initialInvestmentFromDate,
  initialInvestmentToDate,
  onError,
}: UseAppDataOrchestratorParams) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
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

        if (refreshId !== latestRefreshIdRef.current) {
          return;
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
    reportSummary,
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
