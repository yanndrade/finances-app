import { BarChart2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
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

export type TrendPoint = {
  bucket: string;
  aporte: number;
  resgate: number;
  provento: number;
  reinvestido: number;
  ganhoCapital: number;
};

type TrendChartProps = {
  data: TrendPoint[];
  loading: boolean;
  uiDensity: UiDensity;
};

type ToggleKey = Exclude<keyof TrendPoint, "bucket">;

const SERIES: Array<{ key: ToggleKey; label: string; color: string; kind: "bar" | "line" }> = [
  { key: "aporte", label: "Aporte", color: CHART_THEME.primary, kind: "bar" },
  { key: "resgate", label: "Resgate", color: CHART_THEME.expense, kind: "bar" },
  { key: "provento", label: "Provento", color: CHART_THEME.income, kind: "bar" },
  { key: "reinvestido", label: "Reinvestido", color: CHART_THEME.transfer, kind: "bar" },
  { key: "ganhoCapital", label: "Ganho de capital", color: "#64748b", kind: "line" },
];

function getChartHeight(pointCount: number): number {
  if (pointCount <= 3) return 180;
  return 260;
}

export function TrendChart({ data, loading, uiDensity }: TrendChartProps) {
  const [visible, setVisible] = useState<Record<ToggleKey, boolean>>({
    aporte: true,
    resgate: true,
    provento: true,
    reinvestido: true,
    ganhoCapital: true,
  });
  const chartHeight = getChartHeight(data.length);
  const hasEnoughData = data.length > 0;

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
          <h3 className="text-sm font-semibold text-foreground">Aportes versus proventos</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERIES.map((series) => (
            <ToggleLegend
              key={series.key}
              color={series.color}
              label={series.label}
              active={visible[series.key]}
              onToggle={() => setVisible((current) => ({ ...current, [series.key]: !current[series.key] }))}
            />
          ))}
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
            <p className="text-sm font-semibold text-foreground">Nenhum dado no período.</p>
            <p className="text-xs text-muted-foreground">
              Salve um fechamento ou movimento para visualizar aqui.
            </p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} opacity={0.4} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
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
                    labelForSeries(name),
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                />
                {SERIES.map((series) => {
                  if (!visible[series.key]) return null;
                  if (series.kind === "line") {
                    return (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        stroke={series.color}
                        strokeWidth={2.4}
                        dot={{ r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                        isAnimationActive={!prefersReducedMotion()}
                      />
                    );
                  }
                  return (
                    <Bar
                      key={series.key}
                      dataKey={series.key}
                      fill={series.color}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={34}
                      isAnimationActive={!prefersReducedMotion()}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function labelForSeries(name: string | undefined): string {
  return SERIES.find((series) => series.key === name)?.label ?? name ?? "Valor";
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
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
        active ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground",
      )}
      onClick={onToggle}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }} />
      {label}
    </button>
  );
}
