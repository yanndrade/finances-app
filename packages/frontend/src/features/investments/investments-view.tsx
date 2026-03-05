import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import type {
  AccountSummary,
  InvestmentMovementPayload,
  InvestmentMovementSummary,
  InvestmentOverview,
  InvestmentView,
} from "../../lib/api";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency } from "../../lib/format";

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
  onCreateMovement: (payload: InvestmentMovementPayload) => Promise<void>;
};

const VIEW_OPTIONS: Array<{ label: string; value: InvestmentView }> = [
  { label: "Diário", value: "daily" },
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
  { label: "Bimestral", value: "bimonthly" },
  { label: "Trimestral", value: "quarterly" },
  { label: "Anual", value: "yearly" },
];

function movementAccountIdOrEmpty(accounts: AccountSummary[]): string {
  return accounts.find((account) => account.type !== "investment")?.account_id ?? "";
}

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
  onCreateMovement,
}: InvestmentsViewProps) {
  const movementAccounts = useMemo(
    () => accounts.filter((account) => account.type !== "investment"),
    [accounts],
  );
  const [showContribution, setShowContribution] = useState(true);
  const [showDividend, setShowDividend] = useState(true);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionDividendAmount, setContributionDividendAmount] = useState("");
  const [contributionAccountId, setContributionAccountId] = useState(() =>
    movementAccountIdOrEmpty(accounts),
  );
  const [contributionDate, setContributionDate] = useState(fromDate);
  const [contributionDescription, setContributionDescription] = useState("");
  const [withdrawalCashAmount, setWithdrawalCashAmount] = useState("");
  const [withdrawalInvestedAmount, setWithdrawalInvestedAmount] = useState("");
  const [withdrawalAccountId, setWithdrawalAccountId] = useState(() =>
    movementAccountIdOrEmpty(accounts),
  );
  const [withdrawalDate, setWithdrawalDate] = useState(toDate);
  const [withdrawalDescription, setWithdrawalDescription] = useState("");

  useEffect(() => {
    const firstAccountId = movementAccounts[0]?.account_id ?? "";
    if (movementAccounts.some((account) => account.account_id === contributionAccountId)) {
      return;
    }
    setContributionAccountId(firstAccountId);
  }, [movementAccounts, contributionAccountId]);

  useEffect(() => {
    const firstAccountId = movementAccounts[0]?.account_id ?? "";
    if (movementAccounts.some((account) => account.account_id === withdrawalAccountId)) {
      return;
    }
    setWithdrawalAccountId(firstAccountId);
  }, [movementAccounts, withdrawalAccountId]);

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

  async function submitContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedContribution = parseAmountInCents(contributionAmount);
    const parsedDividend = parseAmountInCents(contributionDividendAmount);
    if (parsedContribution <= 0 || !contributionAccountId) {
      return;
    }
    await onCreateMovement({
      type: "contribution",
      accountId: contributionAccountId,
      occurredAt: toIsoAtMidday(contributionDate),
      contributionAmountInCents: parsedContribution,
      dividendAmountInCents: Math.max(parsedDividend, 0),
      description: contributionDescription.trim() || undefined,
    });
    setContributionAmount("");
    setContributionDividendAmount("");
    setContributionDescription("");
  }

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedCash = parseAmountInCents(withdrawalCashAmount);
    const parsedInvested = parseAmountInCents(withdrawalInvestedAmount);
    if (parsedCash <= 0 || parsedInvested <= 0 || !withdrawalAccountId) {
      return;
    }
    await onCreateMovement({
      type: "withdrawal",
      accountId: withdrawalAccountId,
      occurredAt: toIsoAtMidday(withdrawalDate),
      cashAmountInCents: parsedCash,
      investedAmountInCents: parsedInvested,
      description: withdrawalDescription.trim() || undefined,
    });
    setWithdrawalCashAmount("");
    setWithdrawalInvestedAmount("");
    setWithdrawalDescription("");
  }

  return (
    <div className="space-y-6">
      <Card className={`rounded-[2rem] border-none bg-white shadow-sm ${chartClassNames.surface}`}>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Investimentos</h2>
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
              Até
              <input
                className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3"
                type="date"
                value={toDate}
                onChange={(event) => onRangeChange(fromDate, event.target.value)}
              />
            </label>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Metric label="Patrimônio" value={overview?.totals.wealth ?? 0} />
          <Metric label="Investido" value={overview?.totals.invested_balance ?? 0} />
          <Metric label="Dividendos acumulados" value={overview?.totals.dividends_accumulated ?? 0} />
          <Metric label="Meta 10%" value={overview?.goal.target ?? 0} />
        </CardContent>
      </Card>

      <Card className={`rounded-[2rem] border-none bg-white shadow-sm ${chartClassNames.surface}`}>
        <CardHeader>
          <h2 className="text-lg font-semibold">Evolução do patrimônio</h2>
        </CardHeader>
        <CardContent className="h-72">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando visão de patrimônio...</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wealthData}>
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="patrimonio" stroke={CHART_THEME.primary} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className={`rounded-[2rem] border-none bg-white shadow-sm ${chartClassNames.surface}`}>
        <CardHeader className="space-y-4">
          <h2 className="text-lg font-semibold">Aporte e dividendos</h2>
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
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
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
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[2rem] border-none bg-white shadow-sm">
          <CardHeader>
            <h3 className="text-lg font-semibold">Registrar aporte</h3>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void submitContribution(event)}>
              <FormRow
                label="Conta origem"
                field={(
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    value={contributionAccountId}
                    onChange={(event) => setContributionAccountId(event.target.value)}
                  >
                    {movementAccounts.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              <FormRow
                label="Data"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    type="date"
                    value={contributionDate}
                    onChange={(event) => setContributionDate(event.target.value)}
                  />
                )}
              />
              <FormRow
                label="Valor do aporte"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    inputMode="numeric"
                    placeholder="Ex: 30000"
                    value={contributionAmount}
                    onChange={(event) => setContributionAmount(event.target.value)}
                  />
                )}
              />
              <FormRow
                label="Valor de dividendos (opcional)"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    inputMode="numeric"
                    placeholder="Ex: 5000"
                    value={contributionDividendAmount}
                    onChange={(event) => setContributionDividendAmount(event.target.value)}
                  />
                )}
              />
              <FormRow
                label="Descrição"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    placeholder="Opcional"
                    value={contributionDescription}
                    onChange={(event) => setContributionDescription(event.target.value)}
                  />
                )}
              />
              <Button type="submit" disabled={isSubmitting || movementAccounts.length === 0}>
                Salvar aporte
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none bg-white shadow-sm">
          <CardHeader>
            <h3 className="text-lg font-semibold">Registrar resgate</h3>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void submitWithdrawal(event)}>
              <FormRow
                label="Conta destino"
                field={(
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    value={withdrawalAccountId}
                    onChange={(event) => setWithdrawalAccountId(event.target.value)}
                  >
                    {movementAccounts.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              <FormRow
                label="Data"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    type="date"
                    value={withdrawalDate}
                    onChange={(event) => setWithdrawalDate(event.target.value)}
                  />
                )}
              />
              <FormRow
                label="Valor líquido na conta"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    inputMode="numeric"
                    placeholder="Ex: 18000"
                    value={withdrawalCashAmount}
                    onChange={(event) => setWithdrawalCashAmount(event.target.value)}
                  />
                )}
              />
              <FormRow
                label="Redução do patrimônio investido"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    inputMode="numeric"
                    placeholder="Ex: 20000"
                    value={withdrawalInvestedAmount}
                    onChange={(event) => setWithdrawalInvestedAmount(event.target.value)}
                  />
                )}
              />
              <FormRow
                label="Descrição"
                field={(
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3"
                    placeholder="Opcional"
                    value={withdrawalDescription}
                    onChange={(event) => setWithdrawalDescription(event.target.value)}
                  />
                )}
              />
              <Button type="submit" disabled={isSubmitting || movementAccounts.length === 0}>
                Salvar resgate
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className={`rounded-[2rem] border-none bg-white shadow-sm ${chartClassNames.surface}`}>
        <CardHeader>
          <h2 className="text-lg font-semibold">Movimentos de investimento</h2>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Nenhum movimento no período.</p>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => (
                <div
                  key={movement.movement_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {movement.type === "contribution" ? "Aporte" : "Resgate"}
                    </p>
                    <p className="text-xs text-slate-600">
                      {movement.occurred_at.split("T")[0]} • {movement.description ?? "Sem descrição"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      Caixa: {formatCurrency(movement.cash_delta)}
                    </p>
                    <p className="text-xs text-slate-600">
                      Investido: {formatCurrency(movement.invested_delta)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="money-value mt-1 text-xl font-bold text-slate-900">{formatCurrency(value)}</p>
    </div>
  );
}

function FormRow({ label, field }: { label: string; field: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
      {label}
      {field}
    </label>
  );
}

function parseAmountInCents(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return 0;
  }
  return parseInt(digits, 10);
}

function toIsoAtMidday(dateValue: string): string {
  const normalizedDate = dateValue.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return `${normalizedDate}T12:00:00Z`;
  }
  return new Date(`${normalizedDate}T12:00:00`).toISOString().replace(".000", "");
}
