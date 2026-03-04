import type { AccountSummary, DashboardSummary, TransactionSummary } from "../../lib/api";
import type { AppView } from "../../components/sidebar";
import { DashboardBento } from "./dashboard-bento";

type DashboardViewProps = {
  dashboard: DashboardSummary | null;
  accounts: AccountSummary[];
  transactions: TransactionSummary[];
  loading: boolean;
  month: string;
  onMonthChange: (month: string) => void;
  onNavigate: (view: AppView) => void;
  onOpenQuickAdd: () => void;
  onUpdateTransaction: (
    transactionId: string,
    updates: { categoryId?: string; description?: string },
  ) => void;
};

export function DashboardView({
  dashboard,
  accounts,
  loading,
  month,
  onMonthChange,
  onNavigate,
  onOpenQuickAdd,
}: DashboardViewProps) {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <div className="bg-white p-2 rounded-2xl shadow-sm border-none">
          <input
            onChange={(event) => onMonthChange(event.target.value)}
            type="month"
            className="bg-transparent border-none focus:ring-0 font-semibold text-slate-700 cursor-pointer outline-none"
            value={month}
          />
        </div>
      </div>

      {loading && dashboard === null ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-slate-200 animate-pulse rounded-[2rem]" />
          <div className="h-32 bg-slate-200 animate-pulse rounded-[2rem]" />
          <div className="h-32 bg-slate-200 animate-pulse rounded-[2rem]" />
        </div>
      ) : null}

      {!loading && dashboard === null ? (
        <div className="p-12 text-center bg-white rounded-[2rem] border-none shadow-sm">
          <p className="text-slate-500 font-medium">Nao foi possivel carregar o dashboard.</p>
        </div>
      ) : null}

      {dashboard !== null ? (
        <DashboardBento
          dashboard={dashboard}
          accounts={accounts}
          onNavigate={onNavigate}
          onOpenQuickAdd={onOpenQuickAdd}
        />
      ) : null}
    </div>
  );
}
