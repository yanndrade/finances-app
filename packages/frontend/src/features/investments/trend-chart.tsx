import { BarChart2 } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency, formatCurrencyCompact } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";
import { prefersReducedMotion } from "../../lib/motion";

type TrendPoint = {
  bucket: string;
  aporte: number;
  dividendos: number;
};

type TrendChartProps = {
  data: TrendPoint[];
  loading: boolean;
  uiDensity: UiDensity;
};

function getChartHeight(pointCount: number): number {
  if (pointCount <= 1) return 0;
  if (pointCount <= 3) return 160;
  return 224;
}

const GRADIENT_APORTE = "trendAporteGradient";
const GRADIENT_DIVIDENDOS = "trendDividendosGradient";

export function TrendChart({ data, loading, uiDensity }: TrendChartProps) {
  const [showContribution, setShowContribution] = useState(true);
  const [showDividend, setShowDividend] = useState(true);
  const chartHeight = getChartHeight(data.length);
  const hasEnoughData = data.length > 1;

  return (
    <Card
      className={cn(
        "finance-card",
        chartClassNames.surface,
        uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-2xl",
      )}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Aportes e dividendos</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <ToggleLegend
            color={CHART_THEME.primary}
            label="Aporte"
            active={showContribution}
            onToggle={() => setShowContribution((v) => !v)}
          />
          <ToggleLegend
            color={CHART_THEME.income}
            label="Dividendos"
            active={showDividend}
            onToggle={() => setShowDividend((v) => !v)}
          />
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {loading ? (
          <div className="flex h-36 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !hasEnoughData ? (
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-muted p-3">
              <BarChart2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {data.length === 0 ? "Nenhum dado no período." : "Dados insuficientes para o gráfico."}
            </p>
            <p className="text-xs text-muted-foreground">
              Com mais períodos, a tendência aparecerá aqui.
            </p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={GRADIENT_APORTE} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_THEME.primary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_THEME.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={GRADIENT_DIVIDENDOS} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_THEME.income} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART_THEME.income} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={CHART_THEME.grid}
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: number) => formatCurrencyCompact(val * 100)}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value !== undefined ? formatCurrency(value * 100) : "—",
                    name === "aporte" ? "Aporte" : "Dividendos",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                />
                {showContribution && (
                  <Area
                    type="monotone"
                    dataKey="aporte"
                    stroke={CHART_THEME.primary}
                    strokeWidth={2.5}
                    fill={`url(#${GRADIENT_APORTE})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={!prefersReducedMotion()}
                  />
                )}
                {showDividend && (
                  <Area
                    type="monotone"
                    dataKey="dividendos"
                    stroke={CHART_THEME.income}
                    strokeWidth={2.5}
                    fill={`url(#${GRADIENT_DIVIDENDOS})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={!prefersReducedMotion()}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ToggleLegend({
  color,
  label,
  active,
  onToggle,
}: {
  color: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all select-none",
        active ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground",
      )}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={active}
        onChange={onToggle}
        className="sr-only"
      />
      <span
        className="h-2 w-2 rounded-full transition-opacity"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }}
      />
      {label}
    </label>
  );
}
