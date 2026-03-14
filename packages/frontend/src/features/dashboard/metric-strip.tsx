import React from "react";
import { Clock, CreditCard, Receipt, RotateCcw, Target, ArrowRight } from "lucide-react";
import { MoneyValue } from "../../components/ui/money-value";
import type {
  DashboardSummary,
  InvestmentOverview,
  TransactionFilters,
} from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type MetricStripProps = {
  dashboard: DashboardSummary;
  investmentOverview: InvestmentOverview | null;
  uiDensity: UiDensity;
  onNavigate: (view: "fixedExpenses" | "investments" | "reimbursements") => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
};

export function MetricStrip({
  dashboard,
  investmentOverview,
  uiDensity,
  onNavigate,
  onOpenLedgerFiltered,
}: MetricStripProps) {
  const { fixed_expenses_total, installment_total, month, total_expense } =
    dashboard;
  const variable_expenses_total =
    dashboard.variable_expenses_total ??
    total_expense - fixed_expenses_total - installment_total;

  const investmentMeta =
    investmentOverview?.goal.target ?? dashboard.total_income * 0.1;
  const realizedInvestment =
    investmentOverview?.goal.realized ??
    dashboard.spending_by_category.find(
      (c) =>
        c.category_id === "investment" || c.category_id === "investimentos",
    )?.total ??
    0;

  const progressPct =
    investmentMeta > 0
      ? Math.min((realizedInvestment / investmentMeta) * 100, 100)
      : 0;

  const pendingReimbursementsTotal = dashboard.pending_reimbursements_total ?? 0;
  const hasPendingReimbursements = pendingReimbursementsTotal > 0;

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4",
        uiDensity === "dense" ? "gap-3" : "gap-4",
        hasPendingReimbursements && "lg:grid-cols-5",
      )}
    >
      <MetricCard
        title="Gastos Fixos"
        value={fixed_expenses_total}
        icon={<Receipt className="h-4 w-4 text-slate-400" />}
        onClick={() => onNavigate("fixedExpenses")}
        density={uiDensity}
      />
      <MetricCard
        title="Parceladas"
        value={installment_total}
        icon={<CreditCard className="h-4 w-4 text-indigo-400" />}
        onClick={() =>
          onOpenLedgerFiltered(
            { period: "month", type: "expense", preset: "installments" },
            month,
          )
        }
        density={uiDensity}
      />
      <MetricCard
        title="Variáveis"
        value={variable_expenses_total}
        icon={<Clock className="h-4 w-4 text-amber-400" />}
        onClick={() =>
          onOpenLedgerFiltered({ period: "month", type: "expense" }, month)
        }
        density={uiDensity}
      />

      <button
        onClick={() => onNavigate("investments")}
        type="button"
        className={cn(
          "w-full text-left hover:bg-muted/40 transition-colors cursor-pointer group rounded-lg",
          uiDensity === "dense" ? "py-2 px-2" : "py-2.5 px-2",
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Target className="h-4 w-4 text-primary/70" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Meta Invest.
          </span>
          <span className="text-xs font-semibold text-primary tabular-nums ml-auto">
            {progressPct.toFixed(0)}%
          </span>
        </div>
        <MoneyValue
          value={investmentMeta}
          className="text-sm font-bold text-foreground tabular-nums"
        />
      </button>

      {hasPendingReimbursements && (
        <MetricCard
          title="A Receber"
          value={pendingReimbursementsTotal}
          icon={<RotateCcw className="h-4 w-4 text-emerald-400" />}
          onClick={() => onNavigate("reimbursements")}
          density={uiDensity}
        />
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  onClick,
  density,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  onClick: () => void;
  density: UiDensity;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "w-full text-left hover:bg-muted/40 transition-colors cursor-pointer group rounded-lg",
        density === "dense" ? "py-2 px-2" : "py-2.5 px-2",
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {title}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
      </div>
      <MoneyValue
        value={value}
        className="text-sm font-bold text-foreground tabular-nums"
      />
    </button>
  );
}
