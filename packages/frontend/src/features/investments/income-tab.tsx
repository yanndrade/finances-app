import { Fragment, useMemo } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MonthlyIncomeRecord } from "@/lib/api";
import { chartClassNames } from "@/lib/chart-theme";
import { formatCurrency, formatPercentBR } from "@/lib/format";
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
    dividendos: number;
    reinvestido: number;
  }>;
  loading: boolean;
  uiDensity: import("../../lib/ui-density").UiDensity;
};

function isFutureMonth(year: string, month: string, referencePeriod: string): boolean {
  return `${year}-${month}` > referencePeriod;
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
  const chartData = useMemo(() => {
    return trendData.map((item) => ({ ...item }));
  }, [trendData]);

  return (
    <div className="space-y-5">
      <AnnualIncomeMatrix matrix={matrix} period={period} />
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
              dividendos: item.dividendos,
              reinvestido: item.reinvestido,
            }))}
            loading={loading}
            uiDensity={uiDensity}
          />
        </CardContent>
      </Card>
    </div>
  );
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

  return (
    <Card className="finance-card">
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Crescimento dos proventos</h3>
      </CardHeader>
      <CardContent className="overflow-x-auto">
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
