import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
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
    <div
      className={cn(
        "flex flex-col",
        uiDensity === "dense"
          ? "gap-4 pb-4 border-b border-border/40"
          : uiDensity === "compact"
            ? "gap-4 pb-5 border-b border-border/40"
            : "gap-5 pb-6 border-b border-border/40",
      )}
    >
      {/* Primary row: Resultado leads, Entradas/Saídas support */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
        {/* Resultado — dominant number */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            Resultado
            {isPositive ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
            )}
          </span>
          <MoneyValue
            value={net_flow}
            className={cn(
              "tabular-nums leading-none font-black",
              uiDensity === "dense" ? "text-4xl" : "text-5xl",
              isPositive ? "text-emerald-600" : "text-rose-600",
            )}
          />
        </div>

        {/* Supporting: Entradas + Saídas */}
        <div className="flex gap-6 sm:gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Entradas
            </span>
            <MoneyValue
              value={total_income}
              className="text-xl font-bold text-emerald-600 tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1 pl-6 sm:pl-8 border-l border-border/40">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Gastos
            </span>
            <MoneyValue
              value={total_expense}
              className="text-xl font-bold text-rose-600 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Expense Breakdown Bar */}
      <div>
        {total_expense > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/40">
              {fixed_expenses_total > 0 && (
                <div
                  style={{ width: `${fixedPct}%` }}
                  className="bg-slate-400 hover:opacity-90 transition-opacity"
                  title={`Fixos: ${fixedPct.toFixed(1)}%`}
                />
              )}
              {installment_total > 0 && (
                <div
                  style={{ width: `${installPct}%` }}
                  className="bg-indigo-400 hover:opacity-90 transition-opacity"
                  title={`Parceladas: ${installPct.toFixed(1)}%`}
                />
              )}
              {variable_expenses_total > 0 && (
                <div
                  style={{ width: `${variablePct}%` }}
                  className="bg-amber-400 hover:opacity-90 transition-opacity"
                  title={`Variáveis: ${variablePct.toFixed(1)}%`}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {fixed_expenses_total > 0 && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                    Fixos
                  </span>
                  <MoneyValue
                    value={fixed_expenses_total}
                    className="text-[12px] font-semibold text-foreground tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                    {fixedPct.toFixed(0)}%
                  </span>
                </div>
              )}
              {installment_total > 0 && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                    Parceladas
                  </span>
                  <MoneyValue
                    value={installment_total}
                    className="text-[12px] font-semibold text-foreground tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                    {installPct.toFixed(0)}%
                  </span>
                </div>
              )}
              {variable_expenses_total > 0 && (
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
                    Variáveis
                  </span>
                  <MoneyValue
                    value={variable_expenses_total}
                    className="text-[12px] font-semibold text-foreground tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                    {variablePct.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum gasto registrado neste mês.
          </p>
        )}
      </div>
    </div>
  );
}
