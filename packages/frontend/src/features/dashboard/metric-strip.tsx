import React from "react";
import { Clock, CreditCard, Receipt, RotateCcw, Target, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
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
        "grid grid-cols-2 lg:grid-cols-4 gap-3",
        uiDensity === "dense" ? "gap-3" : "gap-4",
        hasPendingReimbursements && "lg:grid-cols-5",
      )}
    >
      <MetricCard
        title="Gastos Fixos"
        value={fixed_expenses_total}
        icon={<Receipt className="h-4 w-4 text-slate-500" />}
        onClick={() => onNavigate("fixedExpenses")}
        density={uiDensity}
      />
      <MetricCard
        title="Parceladas"
        value={installment_total}
        icon={<CreditCard className="h-4 w-4 text-indigo-500" />}
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
        icon={<Clock className="h-4 w-4 text-amber-500" />}
        onClick={() =>
          onOpenLedgerFiltered({ period: "month", type: "expense" }, month)
        }
        density={uiDensity}
      />

      <Card className="finance-card rounded-xl border border-slate-100/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-slate-50/50 transition-colors bg-white">
        <button
          onClick={() => onNavigate("investments")}
          type="button"
          className="w-full text-left h-full"
        >
          <CardContent
            className={cn(
              "flex flex-col justify-center h-full",
              uiDensity === "dense" ? "p-3" : "p-4",
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Meta Invest.
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <MoneyValue
                value={investmentMeta}
                className="text-lg font-bold text-slate-800 tabular-nums"
              />
              <span className="text-sm font-semibold text-primary tabular-nums">
                {progressPct.toFixed(0)}%
              </span>
            </div>
          </CardContent>
        </button>
      </Card>

      {hasPendingReimbursements && (
        <MetricCard
          title="A Receber"
          value={pendingReimbursementsTotal}
          icon={<RotateCcw className="h-4 w-4 text-emerald-500" />}
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
    <Card className="finance-card rounded-xl border border-slate-100/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-slate-50/50 transition-colors bg-white">
      <button
        onClick={onClick}
        type="button"
        className="w-full text-left h-full cursor-pointer group"
      >
        <CardContent
          className={cn(
            "flex flex-col justify-center",
            density === "dense" ? "p-3" : "p-4",
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {icon}
              <span className="text-[12px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {title}
              </span>
            </div>
            <ArrowRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <MoneyValue
            value={value}
            className="text-lg font-bold text-slate-800 tabular-nums"
          />
        </CardContent>
      </button>
    </Card>
  );
}
