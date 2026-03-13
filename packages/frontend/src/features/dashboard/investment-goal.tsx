import React from "react";
import { Target } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { MoneyValue } from "../../components/ui/money-value";
import { formatCurrency } from "../../lib/format";
import type { DashboardSummary, InvestmentOverview } from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import type { QuickAddPreset } from "../../components/quick-add-composer";
import { cn } from "../../lib/utils";
import { prefersReducedMotion } from "../../lib/motion";

type InvestmentGoalProps = {
  dashboard: DashboardSummary;
  investmentOverview: InvestmentOverview | null;
  className?: string;
  uiDensity: UiDensity;
  onOpenQuickAdd: (preset?: QuickAddPreset) => void;
};

export function InvestmentGoal({
  dashboard,
  investmentOverview,
  className,
  uiDensity,
  onOpenQuickAdd,
}: InvestmentGoalProps) {
  const investmentMeta =
    investmentOverview?.goal.target ?? dashboard.total_income * 0.1;
  const realizedInvestment =
    investmentOverview?.goal.realized ??
    dashboard.spending_by_category.find(
      (category) =>
        category.category_id === "investment" ||
        category.category_id === "investimentos",
    )?.total ??
    0;

  const metaProgress =
    investmentMeta > 0
      ? Math.min((realizedInvestment / investmentMeta) * 100, 100)
      : 0;
  const remaining = Math.max(investmentMeta - realizedInvestment, 0);

  const netFlow = dashboard.net_flow;

  // Contextual status
  let statusCard = "healthy"; // green
  if (netFlow <= 0 && remaining > 0) {
    statusCard = "danger"; // red (threatened)
  } else if (netFlow > 0 && netFlow < remaining) {
    statusCard = "warning"; // amber (tight)
  }

  const getThemeVars = () => {
    if (statusCard === "healthy") {
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-900",
        iconBg: "bg-emerald-100",
        icon: "text-emerald-600",
        ring: "hsl(var(--success))",
        btnColor: "bg-emerald-600 hover:bg-emerald-700 text-white",
        statusMsg: "Meta de investimento no caminho certo.",
      };
    } else if (statusCard === "warning") {
      return {
        bg: "bg-amber-50",
        text: "text-amber-900",
        iconBg: "bg-amber-100",
        icon: "text-amber-600",
        ring: "hsl(var(--warning))",
        btnColor: "bg-amber-600 hover:bg-amber-700 text-white",
        statusMsg: "Atenção: caixa livre está menor que a meta restante.",
      };
    } else {
      return {
        bg: "bg-rose-50",
        text: "text-rose-900",
        iconBg: "bg-rose-100",
        icon: "text-rose-600",
        ring: "hsl(var(--danger))",
        btnColor: "bg-rose-600 hover:bg-rose-700 text-white",
        statusMsg: "Alerta: resultado negativo ameaça a meta do mês.",
      };
    }
  };

  const theme = getThemeVars();

  return (
    <Card
      className={cn(
        "finance-card overflow-hidden flex flex-col h-full rounded-xl border border-border/50 shadow-none bg-surface",
        className,
      )}
    >
      <CardHeader className={cn("shrink-0 pb-3 border-b border-border/40")}>
        <div className="flex items-center gap-2">
          <Target className={cn("h-4 w-4", theme.icon)} />
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Compromisso com o Futuro
            </CardTitle>
            <p className="text-[12px] text-muted-foreground">
              {theme.statusMsg}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "flex-1 flex flex-col items-center justify-center py-6",
          uiDensity === "dense" && "py-4",
        )}
      >
        <div
          className={cn(
            "relative",
            uiDensity === "dense" ? "mb-4 h-32 w-32" : "mb-6 h-40 w-40",
          )}
        >
          <PieChart
            width={uiDensity === "dense" ? 128 : 160}
            height={uiDensity === "dense" ? 128 : 160}
          >
            <Pie
              data={[{ value: realizedInvestment }, { value: remaining }]}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={66}
              paddingAngle={0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={!prefersReducedMotion()}
            >
              <Cell fill={theme.ring} stroke="none" />
              <Cell fill="hsl(var(--slate-100) / 0.8)" stroke="none" />
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={cn(
                "text-3xl font-black tabular-nums tracking-tight",
                statusCard === "healthy" ? "text-emerald-600" : statusCard === "warning" ? "text-amber-600" : "text-rose-600",
              )}
            >
              {metaProgress.toFixed(0)}%
            </span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Aportado
            </span>
          </div>
        </div>

        <div className="w-full flex justify-between items-center px-4 mb-6 text-sm">
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-muted-foreground font-medium">
              Meta do mês
            </span>
            <MoneyValue
              value={investmentMeta}
              className="font-bold text-foreground"
            />
          </div>
          <div className="flex flex-col text-right min-w-0">
            <span className="text-xs text-muted-foreground font-medium">Falta</span>
            <MoneyValue
              value={remaining}
              className="font-bold text-foreground"
            />
          </div>
        </div>

        <Button
          onClick={() => onOpenQuickAdd("investment_contribution")}
          className="h-auto w-full rounded-xl py-3 font-semibold transition-colors"
        >
          Registrar aporte
        </Button>
      </CardContent>
    </Card>
  );
}
