import { useMemo } from "react";

import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import type {
  AccountSummary,
  InvestmentMovementSummary,
  InvestmentOverview,
  InvestmentView,
  TransactionFilters,
} from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

import { CompositionPanel } from "./composition-panel";
import { InsightGrid } from "./insight-grid";
import { InvestmentHero } from "./investment-hero";
import { MovementsPanel } from "./movements-panel";
import { TrendChart } from "./trend-chart";
import { WealthChart } from "./wealth-chart";

type InvestmentsViewProps = {
  accounts: AccountSummary[];
  loading: boolean;
  isSubmitting: boolean;
  overview: InvestmentOverview | null;
  movements: InvestmentMovementSummary[];
  view: InvestmentView;
  fromDate: string;
  toDate: string;
  onViewChange: (view: InvestmentView) => void;
  onRangeChange: (fromDate: string, toDate: string) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: (preset: QuickAddPreset) => void;
  uiDensity: UiDensity;
};

export function InvestmentsView({
  accounts,
  loading,
  isSubmitting,
  overview,
  movements,
  view,
  fromDate,
  toDate,
  onViewChange,
  onRangeChange,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  uiDensity,
}: InvestmentsViewProps) {
  const movementAccounts = useMemo(
    () => accounts.filter((account) => account.type !== "investment"),
    [accounts],
  );
  const hasMovementAccounts = movementAccounts.length > 0;

  const capitalAportadoLiquido = useMemo(
    () =>
      Math.max(
        (overview?.totals.contribution_total ?? 0) -
          (overview?.totals.withdrawal_total ?? 0),
        0,
      ),
    [overview],
  );
  const rendimentoAcumulado = Math.max(
    overview?.totals.dividends_accumulated ?? 0,
    0,
  );
  const caixaAtual = Math.max(overview?.totals.cash_balance ?? 0, 0);

  const compositionData = useMemo(
    () =>
      [
        { label: "Capital aportado", value: capitalAportadoLiquido },
        { label: "Rendimento", value: rendimentoAcumulado },
        { label: "Caixa", value: caixaAtual },
      ].filter((item) => item.value > 0),
    [capitalAportadoLiquido, rendimentoAcumulado, caixaAtual],
  );

  const compositionTotal = useMemo(
    () => compositionData.reduce((sum, item) => sum + item.value, 0),
    [compositionData],
  );

  const wealthData = useMemo(
    () =>
      (overview?.series.wealth_evolution ?? []).map((item) => ({
        bucket: item.bucket,
        patrimonio: item.wealth / 100,
      })),
    [overview],
  );

  const trendData = useMemo(
    () =>
      (overview?.series.contribution_dividend_trend ?? []).map((item) => ({
        bucket: item.bucket,
        aporte: item.contribution_total / 100,
        dividendos: item.dividend_total / 100,
      })),
    [overview],
  );

  return (
    <div
      className={cn(
        "investments-workbench space-y-5",
        uiDensity === "compact" && "space-y-4",
        uiDensity === "dense" && "space-y-3",
      )}
    >
      {/* Hero — dominant patrimonial summary + period controls */}
      <InvestmentHero
        overview={overview}
        loading={loading}
        view={view}
        fromDate={fromDate}
        toDate={toDate}
        capitalAportadoLiquido={capitalAportadoLiquido}
        rendimentoAcumulado={rendimentoAcumulado}
        onViewChange={onViewChange}
        onRangeChange={onRangeChange}
        uiDensity={uiDensity}
      />

        {/* Tabs: Painel / Evolução / Movimentos */}
      <Tabs defaultValue="panel" className="w-full">
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            uiDensity === "dense" ? "mb-3" : "mb-4",
          )}
        >
          <div className="space-y-0.5">
            <p className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-300">
              Navegação interna
            </p>
            <h3 className="text-base font-semibold text-slate-800">
              Resumo, evolução e movimentos
            </h3>
          </div>
          <TabsList className="h-12 rounded-[1.5rem] bg-slate-100/70 p-1">
            <TabsTrigger
              value="panel"
              className="rounded-2xl px-6 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)]"
            >
              Painel
            </TabsTrigger>
            <TabsTrigger
              value="evolution"
              className="rounded-2xl px-6 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)]"
            >
              Evolução
            </TabsTrigger>
            <TabsTrigger
              value="movements"
              className="rounded-2xl px-6 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.2)]"
            >
              Movimentos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Painel */}
        <TabsContent value="panel" className="space-y-5 outline-none focus:ring-0">
          <div
            className={cn(
              "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]",
              uiDensity === "dense" && "gap-3",
            )}
          >
            <CompositionPanel
              compositionData={compositionData}
              compositionTotal={compositionTotal}
              cashBalance={caixaAtual}
              uiDensity={uiDensity}
              onOpenQuickAdd={() => onOpenQuickAdd("investment_contribution")}
            />
            <InsightGrid
              goalTarget={overview?.goal.target ?? 0}
              goalProgress={overview?.goal.progress_percent ?? 0}
              goalRemaining={overview?.goal.remaining ?? 0}
              goalRealized={overview?.goal.realized ?? 0}
              investedBalance={overview?.totals.invested_balance ?? 0}
              rendimentoAcumulado={rendimentoAcumulado}
              contributionTotal={overview?.totals.contribution_total ?? 0}
              withdrawalTotal={overview?.totals.withdrawal_total ?? 0}
              uiDensity={uiDensity}
            />
          </div>
        </TabsContent>

        {/* Evolução */}
        <TabsContent value="evolution" className="space-y-5 outline-none focus:ring-0">
          <div
            className={cn(
              "grid gap-5 xl:grid-cols-2",
              uiDensity === "dense" && "gap-3",
            )}
          >
            <WealthChart data={wealthData} loading={loading} uiDensity={uiDensity} />
            <TrendChart data={trendData} loading={loading} uiDensity={uiDensity} />
          </div>
        </TabsContent>

        {/* Movimentos */}
        <TabsContent value="movements" className="outline-none focus:ring-0">
          <MovementsPanel
            movements={movements}
            isSubmitting={isSubmitting}
            hasMovementAccounts={hasMovementAccounts}
            fromDate={fromDate}
            toDate={toDate}
            uiDensity={uiDensity}
            onOpenQuickAdd={onOpenQuickAdd}
            onOpenLedgerFiltered={onOpenLedgerFiltered}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
