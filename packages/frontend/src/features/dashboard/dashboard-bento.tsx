import React from "react";
import type {
  CardSummary,
  DashboardSummary,
  InvestmentOverview,
  TransactionFilters,
} from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import type { QuickAddPreset } from "../../components/quick-add-composer";
import { cn } from "../../lib/utils";

import { MonthMap } from "./month-map";
import { MetricStrip } from "./metric-strip";
import { InvestmentGoal } from "./investment-goal";
import { ExpenseXray } from "./expense-xray";
import { MonthCommitments } from "./month-commitments";

type DashboardBentoProps = {
  dashboard: DashboardSummary;
  investmentOverview: InvestmentOverview | null;
  cards: CardSummary[];
  onNavigate: (
    view:
      | "transactions"
      | "fixedExpenses"
      | "investments"
      | "cards"
      | "settings"
      | "reimbursements",
  ) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: (preset?: QuickAddPreset) => void;
  uiDensity: UiDensity;
};

export function DashboardBento({
  dashboard,
  investmentOverview,
  cards,
  onNavigate,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  uiDensity,
}: DashboardBentoProps) {
  return (
    <div
      className={cn(
        "dashboard-workbench flex flex-col h-full overflow-y-auto w-full",
        uiDensity === "dense" ? "gap-4 p-2" : "gap-6 p-4",
      )}
    >
      {/* 1. Hero: Mapa do Mês */}
      <section className="w-full">
        <MonthMap dashboard={dashboard} uiDensity={uiDensity} />
      </section>

      {/* 2. Faixa secundária de métricas */}
      <section className="w-full">
        <MetricStrip
          dashboard={dashboard}
          investmentOverview={investmentOverview}
          uiDensity={uiDensity}
          onNavigate={onNavigate}
          onOpenLedgerFiltered={onOpenLedgerFiltered}
        />
      </section>

      {/* 3. Grid principal: Investimento + Raio-X */}
      <section
        className={cn(
          "grid grid-cols-1 lg:grid-cols-12 w-full",
          uiDensity === "dense" ? "gap-4" : "gap-6",
        )}
      >
        <div className="lg:col-span-5 xl:col-span-4 h-full">
          <InvestmentGoal
            dashboard={dashboard}
            investmentOverview={investmentOverview}
            uiDensity={uiDensity}
            onOpenQuickAdd={onOpenQuickAdd}
          />
        </div>
        <div className="lg:col-span-7 xl:col-span-8 h-full">
          <ExpenseXray
            dashboard={dashboard}
            uiDensity={uiDensity}
            onOpenLedgerFiltered={onOpenLedgerFiltered}
          />
        </div>
      </section>

      {/* 4. Bloco inferior: Compromissos */}
      <section className="w-full">
        <MonthCommitments
          dashboard={dashboard}
          cards={cards}
          uiDensity={uiDensity}
          onOpenLedgerFiltered={onOpenLedgerFiltered}
        />
      </section>

      {/* Spacer final para garantir margem no final do scroll */}
      <div className="h-4 w-full flex-shrink-0" />
    </div>
  );
}
