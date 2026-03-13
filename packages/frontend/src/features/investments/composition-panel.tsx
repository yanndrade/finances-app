import { TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { MoneyValue } from "../../components/ui/money-value";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";
import { prefersReducedMotion } from "../../lib/motion";

const COMPOSITION_COLORS = [
  CHART_THEME.primary,
  CHART_THEME.income,
  CHART_THEME.transfer,
] as const;

type CompositionItem = {
  label: string;
  value: number;
};

type CompositionPanelProps = {
  compositionData: CompositionItem[];
  compositionTotal: number;
  cashBalance: number;
  uiDensity: UiDensity;
  onOpenQuickAdd: () => void;
};

export function CompositionPanel({
  compositionData,
  compositionTotal,
  cashBalance,
  uiDensity,
  onOpenQuickAdd,
}: CompositionPanelProps) {
  const isEmpty = compositionData.length === 0;
  const isSingleClass = compositionData.length === 1;
  const isAllCash =
    isSingleClass && compositionData[0]?.label === "Caixa";

  return (
    <Card
      className={cn(
        "finance-card",
        chartClassNames.surface,
        uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-2xl",
      )}
    >
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-foreground">Composição patrimonial</h3>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-center">
        {/* Left: donut or contextual state */}
        {isEmpty ? (
          /* Zero state */
          <div className="mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-full bg-muted text-center">
            <TrendingUp className="mb-2 h-7 w-7 text-muted-foreground/40" />
            <p className="text-[12px] font-semibold leading-tight text-muted-foreground">
              Nenhum
              <br />
              patrimônio
            </p>
          </div>
        ) : isSingleClass ? (
          /* Single-class contextual state: no donut */
          <div className="mx-auto flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 border-dashed border-border bg-muted text-center">
            <p className="text-[13px] font-black uppercase tracking-wider text-muted-foreground">
              100%
            </p>
            <p className="text-xs font-semibold leading-tight text-foreground">
              {compositionData[0]?.label}
            </p>
            <MoneyValue
              value={compositionData[0]?.value ?? 0}
              neutral
              className="mt-1 text-sm font-bold"
            />
          </div>
        ) : (
          /* Multi-class donut with total in center */
          <div className="relative mx-auto h-40 w-40">
            <PieChart width={160} height={160}>
              <Pie
                data={compositionData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={72}
                paddingAngle={2}
                isAnimationActive={!prefersReducedMotion()}
              >
                {compositionData.map((item, index) => (
                  <Cell
                    key={item.label}
                    fill={COMPOSITION_COLORS[index % COMPOSITION_COLORS.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
            </PieChart>
            {/* Center value */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[12px] font-bold text-muted-foreground">Total</p>
              <p className="font-black tabular-nums text-sm text-foreground">
                {formatCurrency(compositionTotal)}
              </p>
            </div>
          </div>
        )}

        {/* Right: legend or call to action */}
        <div className="space-y-2">
          {isEmpty ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Realize seu primeiro aporte para começar a acompanhar a composição do seu patrimônio.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onOpenQuickAdd}
                className="h-8 rounded-xl text-xs font-bold"
              >
                Registrar primeiro aporte
              </Button>
            </div>
          ) : isSingleClass && isAllCash ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                Patrimônio 100% em caixa. Registre um aporte para iniciar a alocação.
              </p>
              <p className="text-xs text-muted-foreground">
                Caixa disponível: {formatCurrency(cashBalance)}
              </p>
              <Button
                type="button"
                size="sm"
                onClick={onOpenQuickAdd}
                className="h-8 rounded-xl text-xs font-bold"
              >
                Registrar aporte
              </Button>
            </div>
          ) : isSingleClass ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                Todo o capital está alocado em{" "}
                <span className="font-semibold">{compositionData[0]?.label}</span>. Nenhum caixa
                disponível.
              </p>
            </div>
          ) : (
            compositionData.map((item, index) => {
              const share =
                compositionTotal > 0 ? Math.round((item.value / compositionTotal) * 100) : 0;
              return (
                <div
                  key={item.label}
                  className="rounded-xl bg-muted/60 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            COMPOSITION_COLORS[index % COMPOSITION_COLORS.length],
                        }}
                      />
                      <span className="truncate text-xs font-semibold text-foreground">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[13px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                      {share}%
                    </span>
                  </div>
                  <MoneyValue
                    value={item.value}
                    neutral
                    className="mt-1.5 block text-base font-bold text-foreground"
                  />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
