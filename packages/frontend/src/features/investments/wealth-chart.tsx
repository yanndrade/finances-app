import { TrendingUp } from "lucide-react";
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
import { formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type WealthPoint = {
  bucket: string;
  patrimonio: number;
};

type WealthChartProps = {
  data: WealthPoint[];
  loading: boolean;
  uiDensity: UiDensity;
};

const GRADIENT_ID = "wealthGradient";

function getChartHeight(pointCount: number): number {
  if (pointCount <= 1) return 0; // show text state instead
  if (pointCount <= 3) return 160;
  return 224;
}

export function WealthChart({ data, loading, uiDensity }: WealthChartProps) {
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
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-slate-800">Evolução do patrimônio</h3>
      </CardHeader>
      <CardContent className="min-w-0">
        {loading ? (
          <div className="flex h-36 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !hasEnoughData ? (
          <div className="flex h-36 flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-slate-50 p-3">
              <TrendingUp className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {data.length === 0
                ? "Nenhum dado no período."
                : "Dados insuficientes para o gráfico."}
            </p>
            <p className="text-xs text-slate-400">
              Com mais períodos, a evolução aparecerá aqui.
            </p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_THEME.primary} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_THEME.primary} stopOpacity={0} />
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
                  tickFormatter={(val) => formatCurrency(val * 100).replace("R$\u00a0", "R$ ")}
                  width={72}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [
                    value !== undefined ? formatCurrency(value * 100) : "—",
                    "Patrimônio",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="patrimonio"
                  stroke={CHART_THEME.primary}
                  strokeWidth={2.5}
                  fill={`url(#${GRADIENT_ID})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
