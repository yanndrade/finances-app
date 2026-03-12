import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { MoneyValue } from "../../components/ui/money-value";
import type { DashboardSummary } from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type MonthMapProps = {
  dashboard: DashboardSummary;
  uiDensity: UiDensity;
};

export function MonthMap({ dashboard, uiDensity }: MonthMapProps) {
  const {
    total_income,
    total_expense,
    net_flow,
    fixed_expenses_total,
    installment_total,
  } = dashboard;

  const variable_expenses_total =
    dashboard.variable_expenses_total ??
    total_expense - fixed_expenses_total - installment_total;

  const isPositive = net_flow >= 0;

  // Guard against division by 0
  const safeTotalExpense = total_expense > 0 ? total_expense : 1;

  const fixedPct = (fixed_expenses_total / safeTotalExpense) * 100;
  const installPct = (installment_total / safeTotalExpense) * 100;
  const variablePct = Math.max(0, 100 - fixedPct - installPct);

  return (
    <Card className="finance-card overflow-hidden rounded-xl border border-slate-100/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] bg-surface-elevated">
      <CardContent
        className={cn(
          "flex flex-col",
          uiDensity === "dense"
            ? "p-4 gap-4"
            : uiDensity === "compact"
              ? "p-5 gap-5"
              : "p-6 gap-6",
        )}
      >
        {/* Top: 3 Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              Entradas
            </span>
            <MoneyValue
              value={total_income}
              className="text-2xl font-bold text-emerald-600 tabular-nums"
            />
          </div>

          <div className="flex flex-col gap-1 md:border-l border-slate-100 md:pl-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              Gasto do mês{" "}
              <span className="text-[12px] text-slate-400 normal-case ml-1 font-normal">
                (realizado + previsto)
              </span>
            </span>
            <MoneyValue
              value={total_expense}
              className="text-2xl font-bold text-rose-600 tabular-nums"
            />
          </div>

          <div className="flex flex-col gap-1 md:border-l border-slate-100 md:pl-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              Resultado
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-600 ml-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-rose-600 ml-1" />
              )}
            </span>
            <MoneyValue
              value={net_flow}
              className={cn(
                "text-4xl font-black tabular-nums",
                isPositive ? "text-emerald-600" : "text-rose-600",
              )}
            />
          </div>
        </div>

        {/* Bottom: Expense Breakdown Bar */}
        <div className="pt-2">
          {total_expense > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {fixed_expenses_total > 0 && (
                  <div
                    style={{ width: `${fixedPct}%` }}
                    className="bg-slate-500 hover:opacity-90 transition-opacity"
                    title={`Fixos: ${fixedPct.toFixed(1)}%`}
                  />
                )}
                {installment_total > 0 && (
                  <div
                    style={{ width: `${installPct}%` }}
                    className="bg-indigo-500 hover:opacity-90 transition-opacity"
                    title={`Parceladas: ${installPct.toFixed(1)}%`}
                  />
                )}
                {variable_expenses_total > 0 && (
                  <div
                    style={{ width: `${variablePct}%` }}
                    className="bg-amber-500 hover:opacity-90 transition-opacity"
                    title={`Variáveis: ${variablePct.toFixed(1)}%`}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {fixed_expenses_total > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" />
                    <span className="text-[13px] font-medium text-slate-600 uppercase tracking-wider">
                      Fixos
                    </span>
                    <MoneyValue
                      value={fixed_expenses_total}
                      className="text-[13px] font-bold text-slate-800 tabular-nums"
                    />
                    <span className="text-[12px] text-slate-400 tabular-nums">
                      {fixedPct.toFixed(0)}%
                    </span>
                  </div>
                )}
                {installment_total > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    <span className="text-[13px] font-medium text-slate-600 uppercase tracking-wider">
                      Parceladas
                    </span>
                    <MoneyValue
                      value={installment_total}
                      className="text-[13px] font-bold text-slate-800 tabular-nums"
                    />
                    <span className="text-[12px] text-slate-400 tabular-nums">
                      {installPct.toFixed(0)}%
                    </span>
                  </div>
                )}
                {variable_expenses_total > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-[13px] font-medium text-slate-600 uppercase tracking-wider">
                      Variáveis
                    </span>
                    <MoneyValue
                      value={variable_expenses_total}
                      className="text-[13px] font-bold text-slate-800 tabular-nums"
                    />
                    <span className="text-[12px] text-slate-400 tabular-nums">
                      {variablePct.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">
                Nenhum gasto registrado neste mês.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
