import { ChevronDown, TrendingUp } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { MoneyValue } from "../../components/ui/money-value";
import type { InvestmentOverview, InvestmentView } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";
import { chartClassNames } from "../../lib/chart-theme";

const VIEW_OPTIONS: Array<{ label: string; value: InvestmentView }> = [
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
  { label: "Trimestral", value: "quarterly" },
  { label: "Anual", value: "yearly" },
];

const VIEW_OPTIONS_OVERFLOW: Array<{ label: string; value: InvestmentView }> = [
  { label: "Diário", value: "daily" },
  { label: "Bimestral", value: "bimonthly" },
];

type InvestmentHeroProps = {
  overview: InvestmentOverview | null;
  loading: boolean;
  view: InvestmentView;
  fromDate: string;
  toDate: string;
  capitalAportadoLiquido: number;
  rendimentoAcumulado: number;
  onViewChange: (view: InvestmentView) => void;
  onRangeChange: (fromDate: string, toDate: string) => void;
  uiDensity: UiDensity;
};

export function InvestmentHero({
  overview,
  loading,
  view,
  fromDate,
  toDate,
  capitalAportadoLiquido,
  rendimentoAcumulado,
  onViewChange,
  onRangeChange,
  uiDensity,
}: InvestmentHeroProps) {
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showOverflowPeriods, setShowOverflowPeriods] = useState(false);

  const wealth = overview?.totals.wealth ?? 0;
  const cashBalance = overview?.totals.cash_balance ?? 0;
  const withdrawalTotal = overview?.totals.withdrawal_total ?? 0;

  const isOverflowActive = VIEW_OPTIONS_OVERFLOW.some((o) => o.value === view);

  function handleViewChange(newView: InvestmentView) {
    onViewChange(newView);
    setShowCustomDate(false);
    setShowOverflowPeriods(false);
  }

  function handleFromDateChange(value: string) {
    onRangeChange(value, toDate);
    // deselect quick period when manually editing
    onViewChange("daily");
  }

  function handleToDateChange(value: string) {
    onRangeChange(fromDate, value);
    onViewChange("daily");
  }

  return (
    <Card
      className={cn(
        "finance-card finance-card--strong",
        chartClassNames.surface,
        uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-2xl",
      )}
    >
      <CardContent
        className={cn(
          "p-5 md:p-6",
          uiDensity === "dense" && "p-4",
        )}
      >
        {/* Top row: title + controls */}
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/8 p-2.5">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wide text-slate-900">
                Patrimônio e Investimentos
              </h2>
              <p className="text-[12px] font-medium text-slate-400">
                Evolução, aportes e rendimentos
              </p>
            </div>
          </div>

          {/* Period + date controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick period buttons */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-slate-50/50 p-1">
              {VIEW_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={option.value === view && !isOverflowActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 rounded-lg px-3 text-[12px] font-bold transition-all",
                    option.value === view && !isOverflowActive
                      ? "shadow-sm"
                      : "text-slate-500 hover:text-slate-900",
                  )}
                  type="button"
                  onClick={() => handleViewChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}

              {/* Overflow: Diario / Bimestral */}
              <div className="relative">
                <Button
                  variant={isOverflowActive ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 rounded-lg px-2 text-[12px] font-bold transition-all",
                    isOverflowActive
                      ? "shadow-sm"
                      : "text-slate-400 hover:text-slate-700",
                  )}
                  type="button"
                  onClick={() => setShowOverflowPeriods((v) => !v)}
                >
                  {isOverflowActive
                    ? VIEW_OPTIONS_OVERFLOW.find((o) => o.value === view)?.label
                    : <ChevronDown className="h-3 w-3" />}
                </Button>
                {showOverflowPeriods && (
                  <div className="absolute right-0 top-9 z-10 flex flex-col gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-lg">
                    {VIEW_OPTIONS_OVERFLOW.map((option) => (
                      <Button
                        key={option.value}
                        variant={option.value === view ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-full justify-start rounded-lg px-3 text-[12px] font-bold"
                        type="button"
                        onClick={() => handleViewChange(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom date toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 rounded-xl px-3 text-[12px] font-bold transition-all",
                showCustomDate
                  ? "border border-primary/30 bg-primary/5 text-primary"
                  : "text-slate-400 hover:text-slate-700",
              )}
              type="button"
              onClick={() => setShowCustomDate((v) => !v)}
            >
              Personalizar
            </Button>

            {/* Date inputs — only shown when toggled */}
            {showCustomDate && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">
                    De
                  </span>
                  <input
                    className="h-7 w-28 rounded-lg border-none bg-white px-2 py-0 text-[12px] font-bold shadow-sm ring-1 ring-slate-100 focus:ring-primary"
                    type="date"
                    value={fromDate}
                    onChange={(e) => handleFromDateChange(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">
                    Até
                  </span>
                  <input
                    className="h-7 w-28 rounded-lg border-none bg-white px-2 py-0 text-[12px] font-bold shadow-sm ring-1 ring-slate-100 focus:ring-primary"
                    type="date"
                    value={toDate}
                    onChange={(e) => handleToDateChange(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hero value — dominant */}
        <div
          className={cn(
            "mb-5 flex flex-col gap-1",
            loading && "animate-pulse",
          )}
        >
          <p className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-400">
            Patrimônio total
          </p>
          <p
            className={cn(
              "font-black tabular-nums tracking-tight text-slate-900 truncate",
              uiDensity === "dense" ? "text-3xl" : "text-4xl",
            )}
          >
            {loading ? (
              <span className="inline-block h-10 w-48 rounded-lg bg-slate-100" />
            ) : (
              formatCurrency(wealth)
            )}
          </p>
        </div>

        {/* Secondary metrics */}
        <div
          className={cn(
            "grid grid-cols-2 gap-2 sm:grid-cols-4",
            uiDensity === "dense" && "gap-1.5",
          )}
        >
          <SecondaryMetric
            label="Capital aportado"
            value={capitalAportadoLiquido}
            tone="default"
            loading={loading}
          />
          <SecondaryMetric
            label="Rendimento bruto"
            value={rendimentoAcumulado}
            tone="positive"
            loading={loading}
          />
          <SecondaryMetric
            label="Caixa livre"
            value={cashBalance}
            tone="default"
            loading={loading}
          />
          <SecondaryMetric
            label="Total resgatado"
            value={withdrawalTotal}
            tone="warning"
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SecondaryMetric({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: "default" | "positive" | "warning";
  loading: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : "text-slate-800";

  const bgClass =
    tone === "positive"
      ? "bg-emerald-50/60"
      : tone === "warning"
        ? "bg-amber-50/60"
        : "bg-slate-50/60";

  return (
    <div className={cn("rounded-xl px-3 py-2.5", bgClass)}>
      <p className="text-[13px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-5 w-20 rounded bg-slate-100" />
      ) : (
        <MoneyValue
          value={value}
          neutral={tone === "default"}
          className={cn("mt-1 text-base font-bold", toneClass)}
        />
      )}
    </div>
  );
}
