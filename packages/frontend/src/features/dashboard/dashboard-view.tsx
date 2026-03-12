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
import { formatCurrency, formatDateTime } from "../../lib/format";
import { Button } from "../../components/ui/button";

type DashboardViewProps = {
  surface: "desktop" | "mobile";
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
  surface,
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
  if (surface === "mobile") {
    return (
      <MobileDashboardHome
        dashboard={dashboard}
        loading={loading}
        onNavigate={onNavigate}
        onOpenLedgerFiltered={onOpenLedgerFiltered}
        onOpenQuickAdd={onOpenQuickAdd}
      />
    );
  }

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
          cards={cards}
          onNavigate={onNavigate}
          onOpenLedgerFiltered={onOpenLedgerFiltered}
          onOpenQuickAdd={onOpenQuickAdd}
          uiDensity={uiDensity}
        />
      ) : null}
    </div>
  );
}

function MobileDashboardHome({
  dashboard,
  loading,
  onNavigate,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
}: {
  dashboard: DashboardSummary | null;
  loading: boolean;
  onNavigate: (view: AppView) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: () => void;
}) {
  if (loading && dashboard === null) {
    return (
      <div className="grid grid-cols-1 gap-3" aria-hidden="true">
        <div className="h-28 rounded-3xl bg-slate-200 animate-pulse" />
        <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" />
      </div>
    );
  }

  if (dashboard === null) {
    return (
      <div className="p-6 text-center bg-white rounded-3xl shadow-sm">
        <p className="text-slate-500 font-medium">Nao foi possivel carregar o dashboard.</p>
      </div>
    );
  }

  const recentTransactions = dashboard.recent_transactions.slice(0, 5);
  const hasPendingReimbursements =
    (dashboard.pending_reimbursements_total ?? 0) > 0;

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          Competencia {dashboard.month}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 font-black">
              Saldo atual
            </p>
            <p className="text-lg font-black text-slate-900">
              {formatCurrency(dashboard.current_balance)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 font-black">
              Fluxo liquido
            </p>
            <p className="text-lg font-black text-slate-900">
              {formatCurrency(dashboard.net_flow)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" className="h-9 rounded-xl" onClick={onOpenQuickAdd}>
            Lancar rapido
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl"
            onClick={() => onNavigate("transactions")}
          >
            Ver historico
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <MiniMetric title="Entradas" value={dashboard.total_income} />
        <MiniMetric title="Saidas" value={dashboard.total_expense} />
        <MiniMetric title="Livre mes" value={dashboard.free_to_spend} />
        <MiniMetric title="Faturas" value={dashboard.invoices_due_total} />
      </section>

      {hasPendingReimbursements ? (
        <button
          type="button"
          className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left"
          onClick={() => onNavigate("reimbursements")}
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
            Reembolsos pendentes
          </p>
          <p className="text-lg font-black text-emerald-900">
            {formatCurrency(dashboard.pending_reimbursements_total ?? 0)}
          </p>
        </button>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
            Ultimas transacoes
          </h3>
          <button
            type="button"
            className="text-xs font-black uppercase tracking-[0.14em] text-slate-600"
            onClick={() =>
              onOpenLedgerFiltered(
                { period: "month", type: undefined },
                dashboard.month,
              )
            }
          >
            Abrir lista
          </button>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma movimentacao no periodo.
          </p>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.transaction_id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {transaction.description ?? transaction.category_id}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(transaction.occurred_at)}
                  </p>
                </div>
                <p className="text-sm font-black text-slate-800">
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniMetric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-base font-black text-slate-900">
        {formatCurrency(value)}
      </p>
    </div>
  );
}
