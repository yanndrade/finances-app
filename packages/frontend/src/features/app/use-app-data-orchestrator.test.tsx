import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardSummary, InvestmentOverview, ReportSummary } from "../../lib/api";
import * as api from "../../lib/api";
import { useAppDataOrchestrator } from "./use-app-data-orchestrator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function buildDashboard(month: string): DashboardSummary {
  return {
    month,
    total_income: month === "2026-01" ? 111_00 : 222_00,
    total_expense: 0,
    net_flow: month === "2026-01" ? 111_00 : 222_00,
    current_balance: month === "2026-01" ? 111_00 : 222_00,
    recent_transactions: [],
    spending_by_category: [],
    previous_month: {
      total_income: 0,
      total_expense: 0,
      net_flow: 0,
    },
    daily_balance_series: [],
    review_queue: [],
  };
}

function buildInvestmentOverview(): InvestmentOverview {
  return {
    view: "monthly",
    from: "2026-01-01T00:00:00Z",
    to: "2026-01-31T23:59:59Z",
    totals: {
      contribution_total: 0,
      dividend_total: 0,
      withdrawal_total: 0,
      invested_balance: 0,
      cash_balance: 0,
      wealth: 0,
      dividends_accumulated: 0,
    },
    goal: {
      target: 0,
      realized: 0,
      remaining: 0,
      progress_percent: 100,
    },
    series: {
      wealth_evolution: [],
      contribution_dividend_trend: [],
    },
  };
}

function buildReportSummary(): ReportSummary {
  return {
    period: {
      type: "month",
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-31T23:59:59Z",
    },
    totals: {
      income_total: 0,
      expense_total: 0,
      net_total: 0,
    },
    category_breakdown: [],
    weekly_trend: [],
    future_commitments: {
      period_installment_impact_total: 0,
      future_installment_total: 0,
      future_installment_months: [],
    },
  };
}

describe("useAppDataOrchestrator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ignores stale month refresh responses when a newer refresh already completed", async () => {
    const firstDashboard = deferred<DashboardSummary>();
    const secondDashboard = deferred<DashboardSummary>();
    let dashboardRequestCount = 0;

    vi.spyOn(api, "fetchCards").mockResolvedValue([]);
    vi.spyOn(api, "fetchInvoices").mockResolvedValue([]);
    vi.spyOn(api, "fetchAccounts").mockResolvedValue([]);
    vi.spyOn(api, "fetchTransactions").mockResolvedValue([]);
    vi.spyOn(api, "fetchInvestmentOverview").mockResolvedValue(buildInvestmentOverview());
    vi.spyOn(api, "fetchInvestmentMovements").mockResolvedValue([]);
    vi.spyOn(api, "fetchReportSummary").mockResolvedValue(buildReportSummary());
    vi.spyOn(api, "fetchDashboardSummary").mockImplementation(async () => {
      dashboardRequestCount += 1;
      if (dashboardRequestCount === 1) {
        return firstDashboard.promise;
      }
      return secondDashboard.promise;
    });

    const onError = vi.fn<(error: unknown) => void>();
    const { result } = renderHook(() =>
      useAppDataOrchestrator({
        activeView: "dashboard",
        selectedMonth: "2026-01",
        initialTransactionFilters: {
          period: "month",
          reference: "2026-01-15",
          from: "",
          to: "",
          category: "",
          account: "",
          card: "",
          method: "",
          person: "",
          text: "",
        },
        initialInvestmentView: "monthly",
        initialInvestmentFromDate: "2026-01-01",
        initialInvestmentToDate: "2026-01-31",
        onError,
      }),
    );

    await act(async () => {
      void result.current.refreshData({ month: "2026-01" });
      void result.current.refreshData({ month: "2026-02" });
    });

    await act(async () => {
      secondDashboard.resolve(buildDashboard("2026-02"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.dashboard?.month).toBe("2026-02");
    });

    await act(async () => {
      firstDashboard.resolve(buildDashboard("2026-01"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.dashboard?.month).toBe("2026-02");
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
