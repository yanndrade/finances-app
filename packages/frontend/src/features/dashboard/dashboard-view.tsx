import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  InvestmentOverview,
  InvoiceSummary,
  TransactionFilters,
  TransactionSummary,
} from "../../lib/api";
import type { AppView } from "../../components/sidebar";
import { cn } from "../../lib/utils";
import type { UiDensity } from "../../lib/ui-density";
import { DashboardBento } from "./dashboard-bento";

type DashboardViewProps = {
  dashboard: DashboardSummary | null;
  investmentOverview: InvestmentOverview | null;
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  transactions: TransactionSummary[];
  loading: boolean;
  isSubmitting: boolean;
  month: string;
  onMarkReimbursementReceived: (transactionId: string) => Promise<void>;
  onMonthChange: (month: string) => void;
  onNavigate: (view: AppView) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: () => void;
  uiDensity: UiDensity;
};

export function DashboardView({
  dashboard,
  investmentOverview,
  accounts,
  cards,
  invoices,
  loading,
  isSubmitting,
  month,
  onMarkReimbursementReceived,
  onMonthChange,
  onNavigate,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  uiDensity,
}: DashboardViewProps) {
  return (
    <div
      className={cn(
        "space-y-6",
        uiDensity === "compact" && "space-y-4",
        uiDensity === "dense" && "space-y-3",
      )}
    >
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
          investmentOverview={investmentOverview}
          accounts={accounts}
          cards={cards}
          invoices={invoices}
          isSubmitting={isSubmitting}
          onMarkReimbursementReceived={onMarkReimbursementReceived}
          onNavigate={onNavigate}
          onOpenLedgerFiltered={onOpenLedgerFiltered}
          onOpenQuickAdd={onOpenQuickAdd}
          uiDensity={uiDensity}
        />
      ) : null}
    </div>
  );
}
