import React from "react";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { MoneyValue } from "../../components/ui/money-value";
import { formatCategoryName, formatCurrency } from "../../lib/format";
import { CHART_THEME } from "../../lib/chart-theme";
import type { DashboardSummary, TransactionFilters } from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type ExpenseXrayProps = {
  dashboard: DashboardSummary;
  className?: string;
  uiDensity: UiDensity;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
};

export function ExpenseXray({
  dashboard,
  className,
  uiDensity,
  onOpenLedgerFiltered,
}: ExpenseXrayProps) {
  const categoryComposition = dashboard.spending_by_category.slice(0, 5);
  const compositionTotal =
    categoryComposition.reduce((sum, category) => sum + category.total, 0) || 1;

  const categoryColors = [
    CHART_THEME.primary,
    CHART_THEME.income,
    CHART_THEME.transfer,
    "hsl(var(--warning))",
    CHART_THEME.expense,
  ];

  const highestCategory = categoryComposition[0];

  return (
    <Card
      className={cn(
        "finance-card overflow-hidden flex flex-col h-full rounded-xl border-slate-100/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] bg-white",
        className,
      )}
    >
      <CardHeader className="pb-4 shrink-0 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-slate-100 p-2">
            <PieChartIcon className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Raio-X de Despesas
            </CardTitle>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium mt-0.5">
              Top categorias do mês
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "flex-1 overflow-y-auto min-h-0",
          uiDensity === "dense" ? "p-4" : "p-6",
        )}
      >
        {categoryComposition.length > 0 ? (
          <div className="flex flex-col md:flex-row h-full items-center md:items-stretch gap-6 md:gap-8">
            {/* Chart Side */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center w-full md:w-auto">
              <div className="relative flex items-center justify-center">
                <PieChart width={160} height={160}>
                  <Pie
                    data={categoryComposition}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={2}
                    dataKey="total"
                  >
                    {categoryComposition.map((category, index) => (
                      <Cell
                        key={category.category_id}
                        fill={categoryColors[index % categoryColors.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                </PieChart>
                {highestCategory && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Maior gasto
                    </span>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1 break-all px-2">
                      {formatCategoryName(highestCategory.category_id)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Legend Side */}
            <div className="flex-1 w-full flex flex-col justify-center gap-2.5">
              {categoryComposition.map((category, index) => {
                const share = Math.round(
                  (category.total / compositionTotal) * 100,
                );
                return (
                  <button
                    key={category.category_id}
                    className="flex w-full items-center justify-between gap-3 rounded-lg hover:bg-slate-50 p-2 -mx-2 transition-colors cursor-pointer"
                    onClick={() =>
                      onOpenLedgerFiltered(
                        {
                          period: "month",
                          category: category.category_id,
                          type: "expense",
                        },
                        dashboard.month,
                      )
                    }
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            categoryColors[index % categoryColors.length],
                        }}
                      />
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {formatCategoryName(category.category_id)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <MoneyValue
                        value={category.total}
                        className="text-xs font-bold text-slate-900 tabular-nums"
                      />
                      <span className="text-[10px] font-semibold text-slate-400 tabular-nums w-8 text-right bg-slate-50 px-1 py-0.5 rounded">
                        {share}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center py-10">
            <p className="text-sm italic text-slate-400">
              Sem dados suficientes este mês.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
