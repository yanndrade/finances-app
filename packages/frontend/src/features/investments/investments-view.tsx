import { useMemo, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { MeasuredChartFrame } from "../../components/ui/measured-chart-frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import type {
  AccountSummary,
  InvestmentMovementSummary,
  InvestmentOverview,
  InvestmentView,
  TransactionFilters,
} from "../../lib/api";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

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

const VIEW_OPTIONS: Array<{ label: string; value: InvestmentView }> = [
  { label: "Diario", value: "daily" },
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
  { label: "Bimestral", value: "bimonthly" },
  { label: "Trimestral", value: "quarterly" },
  { label: "Anual", value: "yearly" },
];

const COMPOSITION_COLORS = [
  CHART_THEME.primary,
  CHART_THEME.income,
  CHART_THEME.transfer,
] as const;

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
  const [showContribution, setShowContribution] = useState(true);
  const [showDividend, setShowDividend] = useState(true);
  const hasMovementAccounts = movementAccounts.length > 0;

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

  const capitalAportadoLiquido = Math.max(
    (overview?.totals.contribution_total ?? 0) - (overview?.totals.withdrawal_total ?? 0),
    0,
  );
  const rendimentoAcumulado = Math.max(overview?.totals.dividends_accumulated ?? 0, 0);
  const caixaAtual = Math.max(overview?.totals.cash_balance ?? 0, 0);
  const compositionData = [
    { label: "Capital aportado", value: capitalAportadoLiquido },
    { label: "Rendimento", value: rendimentoAcumulado },
    { label: "Caixa", value: caixaAtual },
  ].filter((item) => item.value > 0);
  const compositionTotal = compositionData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={cn("space-y-6", uiDensity === "compact" && "space-y-5", uiDensity === "dense" && "space-y-4")}>
      <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
        <CardHeader className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <p className="eyebrow">Patrimonio</p>
              <h2 className="text-2xl font-black text-slate-900">
                Investimentos e patrimonio
              </h2>
              <p className="section-copy max-w-2xl">
                Acompanhe patrimonio total, capital aportado, rendimento acumulado e movimentos
                sem sair do fluxo principal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIEW_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={option.value === view ? "default" : "outline"}
                  size="sm"
                  type="button"
                  onClick={() => onViewChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              De
              <input
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3"
                type="date"
                value={fromDate}
                onChange={(event) => onRangeChange(event.target.value, toDate)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Ate
              <input
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3"
                type="date"
                value={toDate}
                onChange={(event) => onRangeChange(fromDate, event.target.value)}
              />
            </label>
          </div>
        </CardHeader>

        <CardContent className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-5", uiDensity === "dense" && "gap-3")}>
          <MetricCard label="Patrimonio total" value={overview?.totals.wealth ?? 0} tone="default" />
          <MetricCard label="Capital aportado" value={capitalAportadoLiquido} tone="default" />
          <MetricCard label="Rendimento acumulado" value={rendimentoAcumulado} tone="positive" />
          <MetricCard label="Caixa livre" value={overview?.totals.cash_balance ?? 0} tone="default" />
          <MetricCard label="Resgates" value={overview?.totals.withdrawal_total ?? 0} tone="warning" />
        </CardContent>
      </Card>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]", uiDensity === "dense" && "gap-4")}>
        <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
          <CardHeader>
            <h3 className="text-lg font-semibold">Composicao patrimonial</h3>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto h-48 w-48">
              {compositionData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-full bg-slate-50 text-center text-sm text-slate-400">
                  Sem composicao no periodo.
                </div>
              ) : (
                <PieChart width={192} height={192}>
                  <Pie
                    data={compositionData}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {compositionData.map((item, index) => (
                      <Cell
                        key={item.label}
                        fill={COMPOSITION_COLORS[index % COMPOSITION_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                </PieChart>
              )}
            </div>

            <div className="space-y-3">
              {compositionData.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Assim que houver aportes ou dividendos, esta area passa a separar capital,
                  rendimento e caixa.
                </p>
              ) : (
                compositionData.map((item, index) => {
                  const share = compositionTotal > 0
                    ? Math.round((item.value / compositionTotal) * 100)
                    : 0;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COMPOSITION_COLORS[index % COMPOSITION_COLORS.length] }}
                          />
                          <span className="truncate text-sm font-semibold text-slate-700">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                          {share}%
                        </span>
                      </div>
                      <p className="money-value mt-2 text-lg font-black text-slate-900">
                        {formatCurrency(item.value)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
          <CardHeader className="space-y-4">
            <h3 className="text-lg font-semibold">Capital x rendimento</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <InsightMetric
                label="Meta patrimonial"
                value={formatCurrency(overview?.goal.target ?? 0)}
                supporting={`${overview?.goal.progress_percent ?? 0}% concluido`}
              />
              <InsightMetric
                label="Falta para a meta"
                value={formatCurrency(overview?.goal.remaining ?? 0)}
                supporting={`${formatCurrency(overview?.goal.realized ?? 0)} ja realizado`}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <InsightPanel
              label="Capital investido"
              value={formatCurrency(overview?.totals.invested_balance ?? 0)}
              supporting="Base patrimonial sem misturar rendimento."
            />
            <InsightPanel
              label="Rendimento acumulado"
              value={formatCurrency(rendimentoAcumulado)}
              supporting="Dividendos e retorno separados do principal."
            />
            <InsightPanel
              label="Aportes do periodo"
              value={formatCurrency(overview?.totals.contribution_total ?? 0)}
              supporting="Total que saiu do caixa para compor patrimonio."
            />
            <InsightPanel
              label="Resgates do periodo"
              value={formatCurrency(overview?.totals.withdrawal_total ?? 0)}
              supporting="Liquidez trazida de volta para o caixa."
            />
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-2", uiDensity === "dense" && "gap-4")}>
        <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
          <CardHeader>
            <h2 className="text-lg font-semibold">Evolucao do patrimonio</h2>
          </CardHeader>
          <CardContent className="min-w-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando visao de patrimonio...</p>
            ) : (
              <MeasuredChartFrame className="h-72" minHeight={288}>
                {({ width, height }) => (
                  <LineChart data={wealthData} width={width} height={height}>
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="patrimonio" stroke={CHART_THEME.primary} strokeWidth={2} />
                  </LineChart>
                )}
              </MeasuredChartFrame>
            )}
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
          <CardHeader className="space-y-4">
            <h3 className="text-lg font-semibold">Aportes e dividendos</h3>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  aria-label="Aporte"
                  checked={showContribution}
                  type="checkbox"
                  onChange={(event) => setShowContribution(event.target.checked)}
                />
                Aporte
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  aria-label="Dividendos"
                  checked={showDividend}
                  type="checkbox"
                  onChange={(event) => setShowDividend(event.target.checked)}
                />
                Dividendos
              </label>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <MeasuredChartFrame className="h-72" minHeight={288}>
              {({ width, height }) => (
                <LineChart data={trendData} width={width} height={height}>
                  <XAxis dataKey="bucket" />
                  <YAxis />
                  <Tooltip />
                  {showContribution ? (
                    <Line type="monotone" dataKey="aporte" stroke={CHART_THEME.primary} strokeWidth={2} />
                  ) : null}
                  {showDividend ? (
                    <Line type="monotone" dataKey="dividendos" stroke={CHART_THEME.income} strokeWidth={2} />
                  ) : null}
                </LineChart>
              )}
            </MeasuredChartFrame>
          </CardContent>
        </Card>
      </div>

      <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
        <CardHeader>
          <h3 className="text-lg font-semibold">Acoes rapidas</h3>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => onOpenQuickAdd("investment_contribution")}
            disabled={isSubmitting || !hasMovementAccounts}
          >
            Novo aporte
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenQuickAdd("investment_withdrawal")}
            disabled={isSubmitting || !hasMovementAccounts}
          >
            Novo resgate
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onOpenLedgerFiltered(
                {
                  period: "custom",
                  from: fromDate,
                  to: toDate,
                  type: "investment",
                },
                fromDate.slice(0, 7),
              )
            }
          >
            Ver movimentos no historico
          </Button>
          {!hasMovementAccounts ? (
            <p className="w-full text-sm text-muted-foreground">
              Cadastre uma conta de caixa para registrar aportes e resgates.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">Movimentos de investimento</h3>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onOpenLedgerFiltered(
                {
                  period: "custom",
                  from: fromDate,
                  to: toDate,
                  type: "investment",
                },
                fromDate.slice(0, 7),
              )
            }
          >
            Abrir ledger filtrado
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="px-6 pb-6">
              <p className="rounded-2xl bg-slate-50 px-4 py-6 text-sm italic text-muted-foreground">
                Nenhum movimento no periodo.
              </p>
            </div>
          ) : (
            <div className={`table-shell table-shell--${uiDensity}`}>
              <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="px-6">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descricao</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Rendimento</TableHead>
                  <TableHead className="text-right">Caixa</TableHead>
                  <TableHead className="text-right pr-6">Investido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.movement_id} className="border-slate-50">
                    <TableCell className="px-6 font-medium text-slate-600">
                      {movement.occurred_at.split("T")[0]}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      {movement.type === "contribution" ? "Aporte" : "Resgate"}
                    </TableCell>
                    <TableCell className="font-medium text-slate-700">
                      {movement.description ?? "Sem descricao"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-900">
                      {formatCurrency(movement.contribution_amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-700">
                      {formatCurrency(movement.dividend_amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-900">
                      {formatCurrency(movement.cash_delta)}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-semibold text-slate-900">
                      {formatCurrency(movement.invested_delta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800"
        : "bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-2xl px-4 py-4 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="money-value mt-2 text-2xl font-black">{formatCurrency(value)}</p>
    </div>
  );
}

function InsightMetric({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="money-value mt-2 text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{supporting}</p>
    </div>
  );
}

function InsightPanel({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
        {label}
      </p>
      <p className="money-value mt-2 text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{supporting}</p>
    </div>
  );
}


