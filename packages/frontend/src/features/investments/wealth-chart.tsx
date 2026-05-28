import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

type WealthPoint = {
  bucket: string;
  date: string;
  patrimonio: number;
  valorAplicado: number;
  saldoBruto: number;
  caixaLivre: number;
  proventosAcumulados: number;
};

type WealthChartProps = {
  data: WealthPoint[];
  loading: boolean;
  uiDensity: UiDensity;
  compact?: boolean;
};

type WealthGrouping = "weekly" | "monthly" | "quarterly" | "annual" | "custom";
type OptionalSeries = "valorAplicado" | "saldoBruto" | "caixaLivre" | "proventosAcumulados";

const OPTIONAL_SERIES: Array<{ key: OptionalSeries; label: string; color: string }> = [
  { key: "valorAplicado", label: "Valor aplicado", color: CHART_THEME.income },
  { key: "saldoBruto", label: "Saldo bruto", color: CHART_THEME.transfer },
  { key: "caixaLivre", label: "Caixa livre", color: "#f59e0b" },
  { key: "proventosAcumulados", label: "Proventos acumulados", color: CHART_THEME.expense },
];

function getChartHeight(pointCount: number, compact: boolean): number {
  if (pointCount <= 1) return compact ? 120 : 180;
  if (compact) return pointCount <= 3 ? 140 : 200;
  if (pointCount <= 3) return 180;
  return 260;
}

function monthToQuarter(period: string): string {
  const year = period.slice(0, 4);
  const month = Number(period.slice(5, 7));
  const quarter = Math.ceil(month / 3);
  return `${year}-T${quarter}`;
}

function weekKey(dateValue: string): string {
  const date = new Date(dateValue.includes("T") ? dateValue : `${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateValue.slice(0, 7);
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86_400_000) + 1;
  const week = Math.ceil((dayOfYear + firstDay.getUTCDay()) / 7);
  return `${date.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

function groupKey(point: WealthPoint, grouping: WealthGrouping): string {
  if (grouping === "weekly") return weekKey(point.date || `${point.bucket}-01`);
  if (grouping === "quarterly") return monthToQuarter(point.bucket);
  if (grouping === "annual") return point.bucket.slice(0, 4);
  return point.bucket;
}

function groupPoints(points: WealthPoint[], grouping: WealthGrouping): WealthPoint[] {
  if (grouping === "custom") return points;

  const byGroup = new Map<string, WealthPoint>();
  for (const point of points) {
    const key = groupKey(point, grouping);
    const current = byGroup.get(key);
    if (!current || point.bucket >= current.bucket) {
      byGroup.set(key, { ...point, bucket: key });
    }
  }

  return [...byGroup.values()].sort((left, right) => left.bucket.localeCompare(right.bucket));
}

export function WealthChart({ data, loading, uiDensity, compact = false }: WealthChartProps) {
  const [grouping, setGrouping] = useState<WealthGrouping>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [visibleSeries, setVisibleSeries] = useState<Record<OptionalSeries, boolean>>({
    valorAplicado: true,
    saldoBruto: false,
    caixaLivre: false,
    proventosAcumulados: true,
  });

  const chartData = useMemo(() => {
    const filtered = data.filter((point) => {
      if (grouping !== "custom") return true;
      if (customFrom && point.bucket < customFrom) return false;
      if (customTo && point.bucket > customTo) return false;
      return true;
    });
    return groupPoints(filtered, grouping);
  }, [customFrom, customTo, data, grouping]);

  const chartHeight = getChartHeight(chartData.length, compact);
  const hasEnoughData = chartData.length > 0;

  return (
    <Card
      className={cn(
        "finance-card",
        chartClassNames.surface,
        uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-2xl",
      )}
    >
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-sm font-semibold text-foreground">Evolução do patrimônio</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Agrupar evolução do patrimônio"
              className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
              value={grouping}
              onChange={(event) => setGrouping(event.target.value as WealthGrouping)}
            >
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="annual">Anual</option>
              <option value="custom">Personalizado</option>
            </select>
            {grouping === "custom" && (
              <>
                <input
                  aria-label="Início do período"
                  className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
                  type="month"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                />
                <input
                  aria-label="Fim do período"
                  className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"
                  type="month"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleLegend color={CHART_THEME.primary} label="Patrimônio total" active onToggle={undefined} />
          {OPTIONAL_SERIES.map((series) => (
            <ToggleLegend
              key={series.key}
              color={series.color}
              label={series.label}
              active={visibleSeries[series.key]}
              onToggle={() =>
                setVisibleSeries((current) => ({ ...current, [series.key]: !current[series.key] }))
              }
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
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhum fechamento no período.</p>
            <p className="text-xs text-muted-foreground">
              Salve um fechamento mensal para visualizar a evolução.
            </p>
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} opacity={0.4} vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: number) => formatCurrencyCompact(val)}
                  width={72}
                />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value !== undefined ? formatCurrency(value) : "—",
                    labelForSeries(name),
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="patrimonio"
                  stroke={CHART_THEME.primary}
                  strokeWidth={2.8}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={!prefersReducedMotion()}
                />
                {OPTIONAL_SERIES.map((series) =>
                  visibleSeries[series.key] ? (
                    <Line
                      key={series.key}
                      type="monotone"
                      dataKey={series.key}
                      stroke={series.color}
                      strokeWidth={2}
                      dot={{ r: 2.5, strokeWidth: 0 }}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      isAnimationActive={!prefersReducedMotion()}
                    />
                  ) : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function labelForSeries(name: string | undefined): string {
  const labels: Record<string, string> = {
    patrimonio: "Patrimônio total",
    valorAplicado: "Valor aplicado",
    saldoBruto: "Saldo bruto",
    caixaLivre: "Caixa livre",
    proventosAcumulados: "Proventos acumulados",
  };
  return name ? labels[name] ?? name : "Valor";
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
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
        active ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground",
        onToggle ? "cursor-pointer" : "cursor-default",
      )}
      onClick={onToggle}
      disabled={!onToggle}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 1 : 0.3 }} />
      {label}
    </button>
  );
}
