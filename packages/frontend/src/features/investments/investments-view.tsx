import { WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CurrencyInput } from "@/components/ui/currency-input";
import { PercentInput } from "@/components/ui/percent-input";
import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { saveAllocationTarget } from "../../lib/api";
import type {
  AccountSummary,
  InvestmentCurrent,
  InvestmentMovementSummary,
  InvestmentOverview,
  MonthlyIncomeRecord,
  TransactionFilters,
} from "../../lib/api";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency, formatMonthBR, formatPercentBR } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn, getErrorMessage } from "../../lib/utils";

import { ClosingDrawer } from "./closing-drawer";
import { IncomeTab } from "./income-tab";
import {
  buildAllocationRows,
  buildIncomeRecordsFromMovements,
  calculateCapitalGain,
  calculateClosingMetrics,
  calculateKrakenSuggestions,
  calculatePassiveIncome,
  calculateTotalPerformance,
  getInvestmentCashReserve,
  mergeIncomeRecords,
  normalizeSnapshot,
  type AllocationRow,
} from "./investment-calculations";
import { MovementsPanel } from "./movements-panel";
import { TargetsDrawer } from "./targets-drawer";
import { WealthChart } from "./wealth-chart";

const CHART_COLORS = [
  CHART_THEME.primary,
  CHART_THEME.income,
  CHART_THEME.transfer,
  CHART_THEME.expense,
  "#f59e0b",
  "#64748b",
];

type InvestmentsViewProps = {
  accounts: AccountSummary[];
  loading: boolean;
  isSubmitting: boolean;
  current: InvestmentCurrent | null;
  history: InvestmentOverview | null;
  movements: InvestmentMovementSummary[];
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: (preset: QuickAddPreset) => void;
  onRefreshData: () => void;
  onError: (message: string) => void;
  uiDensity: UiDensity;
};

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function ratioToBasisPoints(ratio: number | null): number {
  return ratio === null ? 0 : Math.round(ratio * 10000);
}

function currentValueFromBasisPoints(patrimony: number, basisPoints: number): number {
  return Math.round(patrimony * (basisPoints / 10000));
}

function allocationTargetId(assetClass: string): string {
  return `allocation-target-${assetClass}`;
}

type KrakenDraftCache = {
  contribution?: number;
  currentPercentDrafts?: Record<string, number>;
};

function krakenCacheKey(period: string): string {
  return `finance:investments:kraken:${period}`;
}

function readKrakenCache(period: string): KrakenDraftCache | null {
  try {
    const rawValue = globalThis.localStorage?.getItem(krakenCacheKey(period));
    return rawValue ? JSON.parse(rawValue) as KrakenDraftCache : null;
  } catch {
    return null;
  }
}

function writeKrakenCache(period: string, patch: KrakenDraftCache) {
  try {
    const current = readKrakenCache(period) ?? {};
    globalThis.localStorage?.setItem(
      krakenCacheKey(period),
      JSON.stringify({ ...current, ...patch }),
    );
  } catch {
    // Local cache is only a convenience; ignore unavailable storage.
  }
}

export function InvestmentsView({
  accounts,
  loading,
  isSubmitting,
  current,
  history,
  movements,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  onRefreshData,
  onError,
  uiDensity,
}: InvestmentsViewProps) {
  const [closingOpen, setClosingOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const [simulateCents, setSimulateCents] = useState<number>(0);
  const [currentPercentDrafts, setCurrentPercentDrafts] = useState<Record<string, number>>({});
  const [savingCurrentPercents, setSavingCurrentPercents] = useState(false);

  const movementAccounts = useMemo(
    () => accounts.filter((account) => account.type !== "investment"),
    [accounts],
  );
  const period = currentPeriod();
  const snapshot = useMemo(() => normalizeSnapshot(current?.snapshot ?? null), [current?.snapshot]);
  const assets = current?.assets ?? [];
  const targets = current?.allocation_targets ?? [];
  const incomeRecords = current?.income_records ?? [];
  const closingIncomeRecords = useMemo<MonthlyIncomeRecord[]>(() => {
    if (!snapshot || snapshot.total_monthly_income <= 0) return [];

    const records: MonthlyIncomeRecord[] = [];
    if (snapshot.fii_monthly_income > 0) {
      records.push({
        id: `closing-income-fii-${snapshot.period}`,
        month: snapshot.period,
        asset_class: "fii",
        asset_ticker: null,
        amount: snapshot.fii_monthly_income,
      });
    }
    if (snapshot.stock_monthly_income > 0) {
      records.push({
        id: `closing-income-stock-${snapshot.period}`,
        month: snapshot.period,
        asset_class: "acao",
        asset_ticker: null,
        amount: snapshot.stock_monthly_income,
      });
    }
    if (records.length === 0) {
      records.push({
        id: `closing-income-${snapshot.period}`,
        month: snapshot.period,
        asset_class: "consolidado",
        asset_ticker: null,
        amount: snapshot.total_monthly_income,
      });
    }
    return records;
  }, [snapshot]);
  const movementIncomeRecords = useMemo(
    () => buildIncomeRecordsFromMovements(movements),
    [movements],
  );
  const historyIncomeRecords = useMemo<MonthlyIncomeRecord[]>(() => {
    const amount = history?.totals.dividend_total ?? history?.totals.dividend_received_total ?? 0;
    if (amount <= 0) return [];

    return [{
      id: `history-income-${period}`,
      month: period,
      asset_class: "consolidado",
      asset_ticker: null,
      amount,
    }];
  }, [history?.totals.dividend_total, history?.totals.dividend_received_total, period]);
  const inferredIncomeRecords = useMemo(
    () => mergeIncomeRecords(movementIncomeRecords, historyIncomeRecords),
    [movementIncomeRecords, historyIncomeRecords],
  );
  const fallbackIncomeRecords = useMemo(
    () => mergeIncomeRecords(incomeRecords, inferredIncomeRecords),
    [incomeRecords, inferredIncomeRecords],
  );
  const effectiveIncomeRecords = useMemo(
    () => mergeIncomeRecords(closingIncomeRecords, fallbackIncomeRecords),
    [closingIncomeRecords, fallbackIncomeRecords],
  );
  const movementReinvestedIncome = useMemo(() => {
    return movements
      .filter((movement) => movement.occurred_at.slice(0, 7) === period)
      .reduce((sum, movement) => sum + (movement.reinvested_dividend_amount ?? 0), 0);
  }, [movements, period]);
  const reinvestedIncome = Math.max(snapshot?.reinvested_income ?? 0, movementReinvestedIncome);

  useEffect(() => {
    const cached = readKrakenCache(period);
    setSimulateCents(cached?.contribution ?? snapshot?.monthly_contribution_target ?? 0);
  }, [period, snapshot?.monthly_contribution_target]);

  const baseAllocationRows = useMemo(
    () => buildAllocationRows(assets, targets, snapshot),
    [assets, targets, snapshot],
  );

  useEffect(() => {
    const cachedDrafts = readKrakenCache(period)?.currentPercentDrafts ?? {};
    setCurrentPercentDrafts(
      Object.fromEntries(
        baseAllocationRows.map((row) => [
          row.assetClass,
          cachedDrafts[row.assetClass] ?? ratioToBasisPoints(row.currentPercent),
        ]),
      ),
    );
  }, [baseAllocationRows, period]);

  const allocationRows = useMemo(() => {
    const patrimony = snapshot?.gross_balance ?? 0;
    return baseAllocationRows.map((row) => {
      const basisPoints = currentPercentDrafts[row.assetClass] ?? ratioToBasisPoints(row.currentPercent);
      const currentPercent = basisPoints / 10000;
      const currentValue = currentValueFromBasisPoints(patrimony, basisPoints);
      const targetValue = Math.round(patrimony * row.idealPercent);
      const difference = currentValue - targetValue;
      const tolerance = Math.max(Math.round(patrimony * 0.01), 1);
      const status: AllocationRow["status"] =
        difference < -tolerance ? "below" : difference > tolerance ? "above" : "inside";

      return {
        ...row,
        currentValue,
        currentPercent,
        targetValue,
        difference,
        status,
      };
    });
  }, [baseAllocationRows, currentPercentDrafts, snapshot?.gross_balance]);
  const passiveIncome = useMemo(
    () => calculatePassiveIncome(snapshot, assets, effectiveIncomeRecords, reinvestedIncome),
    [snapshot, assets, effectiveIncomeRecords, reinvestedIncome],
  );
  const closingMetrics = useMemo(() => calculateClosingMetrics(snapshot), [snapshot]);
  const accumulatedIncome = Math.max(
    history?.totals.dividends_accumulated ?? 0,
    snapshot?.accumulated_dividends ?? 0,
    effectiveIncomeRecords.reduce((sum, record) => sum + record.amount, 0),
  );
  const performance = calculateTotalPerformance(snapshot, accumulatedIncome);
  const contributionAutonomy = simulateCents > 0
    ? passiveIncome.monthlyIncome / simulateCents
    : passiveIncome.contributionAutonomy;
  const cashReserve = getInvestmentCashReserve(snapshot);

  const krakenInputRows = useMemo(
    () => allocationRows.filter((row) => row.idealPercent > 0),
    [allocationRows],
  );
  const currentPercentTotalInBasisPoints = krakenInputRows.reduce(
    (sum, row) => sum + ratioToBasisPoints(row.currentPercent),
    0,
  );

  const krakenRows = useMemo(
    () =>
      calculateKrakenSuggestions(
        krakenInputRows,
        snapshot?.gross_balance ?? 0,
        simulateCents,
      ),
    [krakenInputRows, snapshot?.gross_balance, simulateCents],
  );

  function updateCurrentPercent(assetClass: string, basisPoints: number) {
    setCurrentPercentDrafts((current) => {
      const next = { ...current, [assetClass]: basisPoints };
      writeKrakenCache(period, { currentPercentDrafts: next });
      return next;
    });
  }

  function updateContribution(value: number) {
    setSimulateCents(value);
    writeKrakenCache(period, { contribution: value });
  }

  async function saveCurrentPercents() {
    if (currentPercentTotalInBasisPoints !== 10000) {
      onError("A soma do Atual % precisa fechar 100% antes de salvar.");
      return;
    }

    setSavingCurrentPercents(true);
    try {
      for (const row of krakenInputRows) {
        const existingTarget = targets.find((target) => target.asset_class === row.assetClass);
        const basisPoints = currentPercentDrafts[row.assetClass] ?? ratioToBasisPoints(row.currentPercent);
        writeKrakenCache(period, {
          currentPercentDrafts: {
            ...currentPercentDrafts,
            [row.assetClass]: basisPoints,
          },
        });
        await saveAllocationTarget({
          id: existingTarget?.id ?? allocationTargetId(row.assetClass),
          asset_class: row.assetClass,
          label: existingTarget?.label ?? row.label,
          ideal_percentage: existingTarget?.ideal_percentage ?? Math.round(row.idealPercent * 10000),
          current_value: currentValueFromBasisPoints(snapshot?.gross_balance ?? 0, basisPoints),
        });
      }
      onRefreshData();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSavingCurrentPercents(false);
    }
  }

  const wealthData = useMemo(
    () =>
      (history?.series.wealth_evolution ?? []).map((item) => ({
        bucket: item.bucket,
        patrimonio: item.wealth / 100,
      })),
    [history],
  );

  const trendData = useMemo(() => {
    const byBucket = new Map<string, { bucket: string; aporte: number; dividendos: number; reinvestido: number }>();
    for (const item of history?.series.contribution_dividend_trend ?? []) {
      byBucket.set(item.bucket, {
        bucket: item.bucket,
        aporte: item.contribution_total / 100,
        dividendos: item.dividend_total / 100,
        reinvestido: (item.reinvested_dividend_total ?? 0) / 100,
      });
    }

    const movementContributionByMonth = new Map<string, number>();
    const movementReinvestedByMonth = new Map<string, number>();
    for (const movement of movements) {
      const month = movement.occurred_at.slice(0, 7);
      movementContributionByMonth.set(
        month,
        (movementContributionByMonth.get(month) ?? 0) + movement.contribution_amount,
      );
      movementReinvestedByMonth.set(
        month,
        (movementReinvestedByMonth.get(month) ?? 0) + (movement.reinvested_dividend_amount ?? 0),
      );
    }
    for (const [month, amount] of movementContributionByMonth) {
      const current = byBucket.get(month) ?? { bucket: month, aporte: 0, dividendos: 0, reinvestido: 0 };
      current.aporte = Math.max(current.aporte, amount / 100);
      byBucket.set(month, current);
    }
    for (const [month, amount] of movementReinvestedByMonth) {
      const current = byBucket.get(month) ?? { bucket: month, aporte: 0, dividendos: 0, reinvestido: 0 };
      current.reinvestido = Math.max(current.reinvestido, amount / 100);
      byBucket.set(month, current);
    }

    const incomeByMonth = new Map<string, number>();
    for (const record of effectiveIncomeRecords) {
      incomeByMonth.set(record.month, (incomeByMonth.get(record.month) ?? 0) + record.amount);
    }
    for (const [month, amount] of incomeByMonth) {
      const current = byBucket.get(month) ?? { bucket: month, aporte: 0, dividendos: 0, reinvestido: 0 };
      current.dividendos = Math.max(current.dividendos, amount / 100);
      byBucket.set(month, current);
    }
    if (reinvestedIncome > 0) {
      const current = byBucket.get(period) ?? { bucket: period, aporte: 0, dividendos: 0, reinvestido: 0 };
      current.reinvestido = Math.max(current.reinvestido, reinvestedIncome / 100);
      byBucket.set(period, current);
    }

    return [...byBucket.values()].sort((left, right) => left.bucket.localeCompare(right.bucket));
  }, [effectiveIncomeRecords, history, movements, period, reinvestedIncome]);

  const classChartData = allocationRows
    .filter((row) => row.currentValue > 0)
    .map((row) => ({ name: row.label, value: row.currentValue }));

  return (
    <div
      className={cn(
        "investments-workbench space-y-5",
        uiDensity === "dense" && "space-y-3",
      )}
    >
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <WalletCards className="h-4 w-4 text-primary" />
            Patrimônio & Investimentos
          </div>
          <p className="mt-1 text-xs text-slate-400">{formatMonthBR(new Date())}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setClosingOpen(true)}>
            Editar fechamento
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setTargetsOpen(true)}>
            Editar metas
          </Button>
        </div>
      </header>

      <Tabs defaultValue="panel" className="w-full">
        <TabsList className="grid h-auto grid-cols-2 rounded-2xl bg-slate-100/70 p-1 sm:grid-cols-4">
          {[
            { label: "Painel", value: "panel" },
            { label: "Carteira", value: "wallet" },
            { label: "Proventos", value: "income" },
            { label: "Movimentos", value: "movements" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="panel" className="space-y-5 outline-none">
          <MetricSection title="Resumo da carteira">
            <SummaryCard label="Patrimônio atual" value={formatCurrency(snapshot?.gross_balance ?? 0)} />
            <SummaryCard label="Valor aplicado" value={formatCurrency(snapshot?.applied_value ?? 0)} />
            <SummaryCard label="Ganho de capital" value={formatCurrency(calculateCapitalGain(snapshot))} />
            <SummaryCard
              label="Ganho de capital %"
              value={formatPercentBR(closingMetrics.capitalGainPercent)}
            />
            <SummaryCard
              label="Performance"
              value={formatPercentBR(performance)}
            />
            <SummaryCard
              label="Proventos acumulados"
              value={formatCurrency(accumulatedIncome)}
            />
          </MetricSection>

          <MetricSection title="Renda passiva">
            <SummaryCard label="Proventos do mês" value={formatCurrency(passiveIncome.monthlyIncome)} />
            <SummaryCard
              label="YoC mensal consolidado"
              value={formatPercentBR(passiveIncome.consolidatedYoc)}
            />
            <SummaryCard label="Yield FIIs mensal" value={formatPercentBR(passiveIncome.fiiYoc)} />
            <SummaryCard
              label="Yield ações mensal"
              value={formatPercentBR(passiveIncome.stockYoc)}
            />
            <SummaryCard
              label="Autonomia do aporte"
              value={formatPercentBR(contributionAutonomy)}
            />
            <SummaryCard
              label="Taxa de reinvestimento"
              value={formatPercentBR(passiveIncome.reinvestmentRate)}
            />
          </MetricSection>

          <KrakenTable
            rows={krakenRows}
            patrimony={snapshot?.gross_balance ?? 0}
            contribution={simulateCents}
            currentPercentTotalInBasisPoints={currentPercentTotalInBasisPoints}
            savingCurrentPercents={savingCurrentPercents}
            onContributionChange={updateContribution}
            onCurrentPercentChange={updateCurrentPercent}
            onSaveCurrentPercents={() => void saveCurrentPercents()}
          />

          {cashReserve > 0 ? (
            <p className="text-xs text-slate-500">
              Caixa de investimentos: {formatCurrency(cashReserve)}
            </p>
          ) : null}

          <WealthChart data={wealthData} loading={loading} uiDensity={uiDensity} compact />
        </TabsContent>

        <TabsContent value="wallet" className="space-y-5 outline-none">
          <AllocationSection rows={allocationRows} chartData={classChartData} cashReserve={cashReserve} />
        </TabsContent>

        <TabsContent value="income" className="space-y-5 outline-none">
          <MetricSection title="Resumo de proventos">
            <SummaryCard label="Proventos do mês" value={formatCurrency(passiveIncome.monthlyIncome)} />
            <SummaryCard label="Proventos no ano" value={formatCurrency(passiveIncome.yearTotal)} />
            <SummaryCard
              label="Proventos acumulados"
              value={formatCurrency(accumulatedIncome)}
            />
            <SummaryCard label="Média mensal no ano" value={formatCurrency(passiveIncome.last12Average)} />
            <SummaryCard
              label="Taxa de reinvestimento"
              value={formatPercentBR(passiveIncome.reinvestmentRate)}
            />
            <SummaryCard
              label="Autonomia do aporte"
              value={formatPercentBR(contributionAutonomy)}
            />
          </MetricSection>
          <IncomeTab
            incomeRecords={effectiveIncomeRecords}
            period={period}
            trendData={trendData}
            loading={loading}
            uiDensity={uiDensity}
          />
        </TabsContent>

        <TabsContent value="movements" className="outline-none">
          <MovementsPanel
            movements={movements}
            accounts={movementAccounts}
            isSubmitting={isSubmitting}
            hasMovementAccounts={movementAccounts.length > 0}
            uiDensity={uiDensity}
            onOpenQuickAdd={onOpenQuickAdd}
            onOpenLedgerFiltered={onOpenLedgerFiltered}
          />
        </TabsContent>
      </Tabs>

      <ClosingDrawer
        open={closingOpen}
        period={period}
        fallbackSnapshot={snapshot}
        onClose={() => setClosingOpen(false)}
        onSaved={onRefreshData}
        onError={onError}
      />
      <TargetsDrawer
        open={targetsOpen}
        targets={targets}
        onClose={() => setTargetsOpen(false)}
        onSaved={onRefreshData}
        onError={onError}
      />

    </div>
  );
}

function MetricSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="finance-card">
      <CardContent className="p-4">
        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-2 text-xl font-black tabular-nums text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function KrakenTable({
  rows,
  patrimony,
  contribution,
  currentPercentTotalInBasisPoints,
  savingCurrentPercents,
  onContributionChange,
  onCurrentPercentChange,
  onSaveCurrentPercents,
}: {
  rows: ReturnType<typeof calculateKrakenSuggestions>;
  patrimony: number;
  contribution: number;
  currentPercentTotalInBasisPoints: number;
  savingCurrentPercents: boolean;
  onContributionChange: (value: number) => void;
  onCurrentPercentChange: (assetClass: string, value: number) => void;
  onSaveCurrentPercents: () => void;
}) {
  const isCurrentPercentBalanced = currentPercentTotalInBasisPoints === 10000;

  return (
    <Card className={cn("finance-card", chartClassNames.surface)}>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Próximo aporte sugerido</h3>
          <p className="mt-1 text-xs text-slate-400">
            Patrimônio atual: <span className="font-bold text-slate-600">{formatCurrency(patrimony)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isCurrentPercentBalanced || savingCurrentPercents}
            onClick={onSaveCurrentPercents}
          >
            {savingCurrentPercents ? "Salvando..." : "Salvar Atual %"}
          </Button>
          <span className="text-xs font-semibold text-slate-500">Aporte disponível:</span>
          <div className="w-40">
            <CurrencyInput
              aria-label="Aporte disponível"
              valueInCents={contribution}
              onValueChange={onContributionChange}
              className="h-9 font-bold"
            />
          </div>
        </div>
      </CardHeader>
      {!isCurrentPercentBalanced && (
        <div className="mx-6 -mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          A soma do Atual % está em {formatPercentBR(currentPercentTotalInBasisPoints / 10000)}.
          Ajuste para 100,00% para salvar os percentuais. A simulação continua livre.
        </div>
      )}
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
            <tr>
              <th className="py-2">Classe</th>
              <th className="py-2 text-right">Atual %</th>
              <th className="py-2 text-right">Ideal %</th>
              <th className="py-2 text-right">Valor atual</th>
              <th className="py-2 text-right">Quanto aportar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assetClass} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-800">{row.label}</td>
                <td className="py-2 text-right tabular-nums">
                  <div className="ml-auto w-28">
                    <PercentInput
                      aria-label={`Atual ${row.label}`}
                      valueInBasisPoints={ratioToBasisPoints(row.currentPercent)}
                      onValueChange={(value) => onCurrentPercentChange(row.assetClass, value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </td>
                <td className="py-2 text-right tabular-nums">{formatPercentBR(row.idealPercent)}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(row.currentValue)}</td>
                <td className="py-2 text-right font-bold tabular-nums text-primary">
                  {formatCurrency(row.suggestedContribution)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AllocationSection({
  rows,
  chartData,
  cashReserve,
}: {
  rows: AllocationRow[];
  chartData: Array<{ name: string; value: number }>;
  cashReserve: number;
}) {
  return (
    <Card className={cn("finance-card", chartClassNames.surface)}>
      <CardHeader>
        <h3 className="text-sm font-semibold text-foreground">Distribuição da carteira</h3>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="h-52">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
              Sem alocação
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86}>
                  {chartData.map((item, index) => (
                    <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs uppercase tracking-widest text-slate-400">
              <tr>
                <th className="py-2">Classe</th>
                <th className="py-2 text-right">Valor estimado</th>
                <th className="py-2 text-right">% carteira</th>
                <th className="py-2 text-right">Meta</th>
                <th className="py-2 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.assetClass} className="border-t border-slate-100">
                  <td className="py-2 font-semibold">{row.label}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(row.currentValue)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercentBR(row.currentPercent)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercentBR(row.idealPercent)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(row.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cashReserve > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Caixa de investimentos (fora da composição): {formatCurrency(cashReserve)}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
