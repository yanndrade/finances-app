import type { AccountSummary, DashboardSummary, TransactionSummary } from "../../lib/api";
import type { AppView } from "../../components/sidebar";

import { DashboardHealth } from "./dashboard-health";
import { DashboardControl } from "./dashboard-control";
import { DashboardAction } from "./dashboard-action";

type DashboardViewProps = {
  dashboard: DashboardSummary | null;
  accounts: AccountSummary[];
  transactions: TransactionSummary[];
  loading: boolean;
  month: string;
  onMonthChange: (month: string) => void;
  onNavigate: (view: AppView) => void;
  onUpdateTransaction: (
    transactionId: string,
    updates: { categoryId?: string; description?: string },
  ) => void;
};

export function DashboardView({
  dashboard,
  accounts,
  transactions,
  loading,
  month,
  onMonthChange,
  onNavigate,
  onUpdateTransaction,
}: DashboardViewProps) {
  const recentTransactions =
    dashboard?.recent_transactions.length
      ? dashboard.recent_transactions
      : transactions.slice(0, 8);

  return (
    <div className="screen-stack">
      <div className="dashboard-topbar">
        <label className="inline-field" aria-label="Mes do dashboard">
          Mes
          <input
            onChange={(event) => onMonthChange(event.target.value)}
            type="month"
            value={month}
          />
        </label>
      </div>

      {loading && dashboard === null ? (
        <div className="loading-panel">
          <div className="skeleton-grid">
            <div className="skeleton skeleton--lg" />
            <div className="skeleton skeleton--lg" />
            <div className="skeleton skeleton--md" />
            <div className="skeleton skeleton--md" />
            <div className="skeleton skeleton--md" />
          </div>
        </div>
      ) : null}

      {!loading && dashboard === null ? (
        <div className="empty-state empty-state--guided">
          <p>Nao foi possivel carregar o dashboard.</p>
          <p className="empty-state__hint">
            Verifique a conexao com o servidor e tente novamente.
          </p>
        </div>
      ) : null}

      {dashboard !== null ? (
        <>
          <DashboardHealth
            dashboard={dashboard}
            onNavigateToTransactions={() => onNavigate("transactions")}
          />

          <DashboardControl
            accounts={accounts}
            spendingByCategory={dashboard.spending_by_category}
          />

          <DashboardAction
            accounts={accounts}
            onNavigate={onNavigate}
            onUpdateTransaction={(id, updates) => {
              onUpdateTransaction(id, updates);
            }}
            recentTransactions={recentTransactions}
            reviewQueue={dashboard.review_queue}
          />
        </>
      ) : null}
    </div>
  );
}
