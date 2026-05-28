import { Fragment, useMemo } from "react";
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

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MonthlyIncomeRecord } from "@/lib/api";
import { CHART_THEME, chartClassNames } from "@/lib/chart-theme";
import { formatCurrency, formatCurrencyCompact, formatPercentBR } from "@/lib/format";
import { cn } from "@/lib/utils";

import { buildAnnualIncomeMatrix } from "./investment-calculations";
import { TrendChart } from "./trend-chart";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type IncomeTabProps = {
  incomeRecords: MonthlyIncomeRecord[];
  period: string;
  trendData: Array<{
    bucket: string;
    aporte: number;
    resgate: number;
    provento: number;
    reinvestido: number;
    ganhoCapital: number;
  }>;
  loading: boolean;
  uiDensity: import("../../lib/ui-density").UiDensity;
};

function isFutureMonth(year: string, month: string, referencePeriod: string): boolean {
  return `${year}-${month}` > referencePeriod;
}

type IncomeEvolutionRow = {
  month: string;
  proventos: number;
  media3: number | null;
  media12: number | null;
  acumuladoAno: number;
  yoy: number | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildIncomeEvolutionRows(matrix: ReturnType<typeof buildAnnualIncomeMatrix>): IncomeEvolutionRow[] {
  const rows = matrix
    .flatMap((yearRow) =>
      yearRow.months.map((monthRow) => ({
        month: `${yearRow.year}-${monthRow.month}`,
        proventos: monthRow.amount,
      })),
    )
    .sort((left, right) => left.month.localeCompare(right.month));
  const amountByMonth = new Map(rows.map((row) => [row.month, row.proventos]));
  const ytdByYear = new Map<string, number>();

  return rows.map((row, index) => {
    const year = row.month.slice(0, 4);
    const month = row.month.slice(5, 7);
    const previousYearAmount = amountByMonth.get(`${Number(year) - 1}-${month}`) ?? 0;
    const ytd = (ytdByYear.get(year) ?? 0) + row.proventos;
    ytdByYear.set(year, ytd);

    return {
      month: row.month,
      proventos: row.proventos,
      media3: average(rows.slice(Math.max(0, index - 2), index + 1).map((item) => item.proventos)),
      media12: average(rows.slice(Math.max(0, index - 11), index + 1).map((item) => item.proventos)),
      acumuladoAno: ytd,
      yoy: previousYearAmount > 0 ? (row.proventos - previousYearAmount) / previousYearAmount : null,
    };
  });
}

export function IncomeTab({
  incomeRecords,
  period,
  trendData,
  loading,
  uiDensity,
}: IncomeTabProps) {
  const matrix = useMemo(
    () => buildAnnualIncomeMatrix(incomeRecords, period.slice(0, 4)),
    [incomeRecords, period],
  );
  const incomeEvolution = useMemo(() => buildIncomeEvolutionRows(matrix), [matrix]);
  const chartData = useMemo(() => trendData.map((item) => ({ ...item })), [trendData]);

  return (
    <div className="space-y-5">
      <AnnualIncomeMatrix matrix={matrix} period={period} />
      <IncomeEvolutionChart rows={incomeEvolution} loading={loading} uiDensity={uiDensity} />
      <IncomeGrowthTable matrix={matrix} period={period} />
      <Card className={cn("finance-card", chartClassNames.surface)}>
        <CardHeader>
          <h3 className="text-sm font-semibold text-foreground">Proventos por período</h3>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={chartData.map((item) => ({
              bucket: item.bucket,
              aporte: item.aporte,
              resgate: item.resgate,
              provento: item.provento,
              reinvestido: item.reinvestido,
              ganhoCapital: item.ganhoCapital,
            }))}
            loading={loading}
            uiDensity={uiDensity}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function IncomeEvolutionChart({
  rows,
  loading,
  uiDensity,
}: {
  rows: IncomeEvolutionRow[];
  loading: boolean;
  uiDensity: import("../../lib/ui-density").UiDensity;
}) {
  return (
    <Card className={cn("finance-card", chartClassNames.surface)}>
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Evolução dos proventos</h3>
        <p className="text-xs text-slate-400">
          Proventos mensais, médias móveis, acumulado no ano e comparação ano contra ano.
        </p>
      </CardHeader>
      <CardContent className="min-w-0">
        {loading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-44 items-center justify-center text-sm text-slate-400">
            Sem proventos registrados.
          </div>
        ) : (
          <div className={uiDensity === "dense" ? "h-52" : "h-64"}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} opacity={0.4} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="money"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: number) => formatCurrencyCompact(val)}
                  width={64}
                />
                <YAxis
                  yAxisId="percent"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: number) => formatPercentBR(val, 0)}
                  width={48}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const numericValue = typeof value === "number" ? value : null;
                    if (numericValue === null) return ["Sem base", labelForIncomeEvolution(String(name))];
                    if (name === "yoy") return [formatPercentBR(numericValue), labelForIncomeEvolution(String(name))];
                    return [formatCurrency(numericValue), labelForIncomeEvolution(String(name))];
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                />
                <Bar yAxisId="money" dataKey="proventos" fill={CHART_THEME.income} radius={[5, 5, 0, 0]} maxBarSize={34} />
                <Line yAxisId="money" type="monotone" dataKey="media3" stroke={CHART_THEME.primary} strokeWidth={2.4} dot={false} />
                <Line yAxisId="money" type="monotone" dataKey="media12" stroke={CHART_THEME.transfer} strokeWidth={2.4} dot={false} />
                <Line yAxisId="money" type="monotone" dataKey="acumuladoAno" stroke="#64748b" strokeWidth={2} dot={false} />
                <Line yAxisId="percent" type="monotone" dataKey="yoy" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function labelForIncomeEvolution(name: string | undefined): string {
  const labels: Record<string, string> = {
    proventos: "Proventos mensais",
    media3: "Média móvel 3 meses",
    media12: "Média móvel 12 meses",
    acumuladoAno: "Acumulado no ano",
    yoy: "Ano contra ano",
  };
  return name ? labels[name] ?? name : "Valor";
}

function AnnualIncomeMatrix({
  matrix,
  period,
}: {
  matrix: ReturnType<typeof buildAnnualIncomeMatrix>;
  period: string;
}) {
  return (
    <Card className="finance-card">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Proventos pagos por mês</h3>
        <p className="text-xs text-slate-400">
          Esta tabela é preenchida automaticamente pelo fechamento mensal e pelos lançamentos, quando existirem.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-slate-400">
              <th className="px-2 py-2">Ano</th>
              {MONTH_LABELS.map((label) => (
                <th key={label} className="px-2 py-2 text-right">
                  {label}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {matrix.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-8 text-center text-slate-400">
                  Sem proventos cadastrados.
                </td>
              </tr>
            ) : (
              matrix.map((yearRow) => (
                <tr key={yearRow.year} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-bold text-slate-800">{yearRow.year}</td>
                  {yearRow.months.map((monthRow) => (
                    <td key={`${yearRow.year}-${monthRow.month}`} className="px-2 py-2 text-right tabular-nums">
                      {isFutureMonth(yearRow.year, monthRow.month, period)
                        ? "-"
                        : formatCurrency(monthRow.amount)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-bold tabular-nums">
                    {formatCurrency(yearRow.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function IncomeGrowthTable({
  matrix,
  period,
}: {
  matrix: ReturnType<typeof buildAnnualIncomeMatrix>;
  period: string;
}) {
  const amountByMonth = new Map<string, number>();
  for (const yearRow of matrix) {
    for (const monthRow of yearRow.months) {
      amountByMonth.set(`${yearRow.year}-${monthRow.month}`, monthRow.amount);
    }
  }

  function previousMonthKey(year: string, month: string): string {
    const monthNumber = Number(month);
    if (monthNumber === 1) return `${Number(year) - 1}-12`;
    return `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
  }

  function monthlyDelta(year: string, month: string, amount: number): number {
    return amount - (amountByMonth.get(previousMonthKey(year, month)) ?? 0);
  }

  function monthlyDeltaPercent(year: string, month: string, amount: number): number | null {
    const previousAmount = amountByMonth.get(previousMonthKey(year, month)) ?? 0;
    if (previousAmount <= 0 && amount === 0) return 0;
    if (previousAmount <= 0) return null;
    return (amount - previousAmount) / previousAmount;
  }

  function averageMonthlyIncome(yearRow: ReturnType<typeof buildAnnualIncomeMatrix>[number]): number {
    return Math.round(yearRow.total / 12);
  }

  const growthChartRows = matrix
    .flatMap((yearRow) =>
      yearRow.months
        .filter((monthRow) => !isFutureMonth(yearRow.year, monthRow.month, period))
        .map((monthRow) => ({
          month: `${yearRow.year}-${monthRow.month}`,
          proventos: monthRow.amount,
          delta: monthlyDelta(yearRow.year, monthRow.month, monthRow.amount),
        })),
    )
    .sort((left, right) => left.month.localeCompare(right.month));

  return (
    <Card className="finance-card">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Crescimento dos proventos</h3>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {growthChartRows.length > 0 && (
          <div className="mb-5 h-44 min-w-[680px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={growthChartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} opacity={0.4} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: number) => formatCurrencyCompact(val)}
                  width={64}
                />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value !== undefined ? formatCurrency(value) : "-",
                    name === "delta" ? "Δ em R$" : "Proventos",
                  ]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="proventos" fill={CHART_THEME.income} radius={[5, 5, 0, 0]} maxBarSize={34} />
                <Line type="monotone" dataKey="delta" stroke={CHART_THEME.primary} strokeWidth={2.2} dot={{ r: 3, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <tbody>
            {matrix.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-8 text-center text-slate-400">
                  Sem histórico de proventos.
                </td>
              </tr>
            ) : (
              matrix.map((yearRow) => {
                const average = averageMonthlyIncome(yearRow);

                return (
                  <Fragment key={yearRow.year}>
                    <tr className="border-t border-slate-100 text-xs uppercase tracking-widest text-slate-400">
                      <th className="px-2 py-2 text-left">Mês</th>
                      {yearRow.months.map((monthRow) => (
                        <th key={monthRow.month} className="px-2 py-2 text-right">
                          {MONTH_LABELS[Number(monthRow.month) - 1]}/{yearRow.year.slice(2)}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right">Média</th>
                    </tr>
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold text-slate-700">Proventos</th>
                      {yearRow.months.map((monthRow) => (
                        <td key={monthRow.month} className="px-2 py-2 text-right tabular-nums">
                          {isFutureMonth(yearRow.year, monthRow.month, period)
                            ? "-"
                            : formatCurrency(monthRow.amount)}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-bold tabular-nums">
                        {formatCurrency(average)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <th className="px-2 py-2 text-left font-semibold text-slate-700">Δ em R$</th>
                      {yearRow.months.map((monthRow) => (
                        <td key={monthRow.month} className="px-2 py-2 text-right tabular-nums">
                          {isFutureMonth(yearRow.year, monthRow.month, period)
                            ? "-"
                            : formatCurrency(monthlyDelta(yearRow.year, monthRow.month, monthRow.amount))}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right tabular-nums">-</td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <th className="px-2 py-2 text-left font-semibold text-slate-700">Δ em %</th>
                      {yearRow.months.map((monthRow) => (
                        <td key={monthRow.month} className="px-2 py-2 text-right tabular-nums">
                          {isFutureMonth(yearRow.year, monthRow.month, period)
                            ? "-"
                            : formatPercentBR(monthlyDeltaPercent(yearRow.year, monthRow.month, monthRow.amount))}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right tabular-nums">-</td>
                    </tr>
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
