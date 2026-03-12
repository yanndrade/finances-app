import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { MoneyValue } from "../../components/ui/money-value";
import { Progress } from "../../components/ui/progress";
import { chartClassNames } from "../../lib/chart-theme";
import { formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type InsightGridProps = {
  goalTarget: number;
  goalProgress: number;
  goalRemaining: number;
  goalRealized: number;
  investedBalance: number;
  rendimentoAcumulado: number;
  contributionTotal: number;
  withdrawalTotal: number;
  uiDensity: UiDensity;
};

export function InsightGrid({
  goalTarget,
  goalProgress,
  goalRemaining,
  goalRealized,
  investedBalance,
  rendimentoAcumulado,
  contributionTotal,
  withdrawalTotal,
  uiDensity,
}: InsightGridProps) {
  const hasGoal = goalTarget > 0;

  return (
    <Card
      className={cn(
        "finance-card",
        chartClassNames.surface,
        uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-2xl",
      )}
    >
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-slate-800">Capital x rendimento</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meta patrimonial */}
        {hasGoal && (
          <div className="rounded-xl bg-primary/5 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-black uppercase tracking-[0.15em] text-primary/60">
                  Meta patrimonial
                </p>
                <MoneyValue
                  value={goalTarget}
                  neutral
                  className="mt-0.5 text-base font-bold text-slate-900"
                />
              </div>
              <div className="text-right">
                <p className="text-[13px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Progresso
                </p>
                <p className="mt-0.5 text-base font-black tabular-nums text-slate-900">
                  {goalProgress.toFixed(0)}%
                </p>
              </div>
            </div>
            <Progress
              value={Math.min(goalProgress, 100)}
              className="h-1.5 w-full rounded-full bg-primary/10"
            />
            <p className="mt-1.5 text-[12px] text-slate-400">
              {formatCurrency(goalRealized)} realizado &middot; {formatCurrency(goalRemaining)}{" "}
              restante
            </p>
          </div>
        )}

        {/* 4 insight panels */}
        <div className="grid grid-cols-2 gap-2">
          <InsightPanel
            label="Capital investido"
            value={investedBalance}
            supporting="Base patrimonial sem rendimento."
          />
          <InsightPanel
            label="Rendimento acumulado"
            value={rendimentoAcumulado}
            supporting="Dividendos separados do principal."
            tone="positive"
          />
          <InsightPanel
            label="Aportes do período"
            value={contributionTotal}
            supporting="Total saído do caixa para o patrimônio."
          />
          <InsightPanel
            label="Resgates do período"
            value={withdrawalTotal}
            supporting="Liquidez trazida de volta para o caixa."
            tone="warning"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function InsightPanel({
  label,
  value,
  supporting,
  tone = "default",
}: {
  label: string;
  value: number;
  supporting: string;
  tone?: "default" | "positive" | "warning";
}) {
  const bgClass =
    tone === "positive"
      ? "bg-emerald-50/60"
      : tone === "warning"
        ? "bg-amber-50/60"
        : "bg-slate-50/60";

  return (
    <div className={cn("rounded-xl px-3 py-2.5", bgClass)}>
      <p className="text-[13px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <MoneyValue
        value={value}
        neutral={tone === "default"}
        className="mt-1 text-base font-bold"
      />
      <p className="mt-0.5 text-[12px] leading-snug text-slate-400">{supporting}</p>
    </div>
  );
}
