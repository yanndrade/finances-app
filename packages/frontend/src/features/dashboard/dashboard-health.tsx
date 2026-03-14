import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import type { DailyBalancePoint, DashboardSummary } from "../../lib/api";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency, formatDelta } from "../../lib/format";
import { prefersReducedMotion } from "../../lib/motion";

type DashboardHealthProps = {
  dashboard: DashboardSummary;
  onNavigateToTransactions: (filters?: { type?: string }) => void;
};

export function DashboardHealth({
  dashboard,
  onNavigateToTransactions,
}: DashboardHealthProps) {
  const incomeDelta = formatDelta(
    dashboard.total_income,
    dashboard.previous_month.total_income,
  );
  const expenseDelta = formatDelta(
    dashboard.total_expense,
    dashboard.previous_month.total_expense,
  );
  const netDelta = formatDelta(
    dashboard.net_flow,
    dashboard.previous_month.net_flow,
  );

  return (
    <section aria-label="Saúde financeira" className="dashboard-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Saúde</p>
          <h2 className="section-title">Como você está</h2>
        </div>
      </div>

      <div className="health-grid">
        <article className="health-card health-card--balance">
          <p className="health-card__label">Saldo consolidado</p>
          <strong className="health-card__value money-value">
            {formatCurrency(dashboard.current_balance)}
          </strong>
          {dashboard.daily_balance_series.length > 1 ? (
            <div className="sparkline-container">
              <ResponsiveContainer height={64} width="100%">
                <AreaChart data={dashboard.daily_balance_series}>
                  <defs>
                    <linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={CHART_THEME.primary} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_THEME.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <Tooltip
                    content={<SparklineTooltip />}
                    cursor={false}
                  />
                   <Area
                    dataKey="balance"
                    fill="url(#sparkGradient)"
                    stroke={CHART_THEME.primary}
                    strokeWidth={2}
                    type="monotone"
                    isAnimationActive={!prefersReducedMotion()}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="health-card__hint">Sparkline aparece com 2+ dias de dados</p>
          )}
        </article>

        <article className="health-card health-card--cashflow">
          <p className="health-card__label">Cash flow do mês</p>
          <div className="cashflow-grid">
            <button
              className="cashflow-item"
              onClick={() => onNavigateToTransactions({ type: "income" })}
              type="button"
            >
              <span className="cashflow-item__label">Entradas</span>
              <strong className="cashflow-item__value cashflow-item__value--positive money-value">
                {formatCurrency(dashboard.total_income)}
              </strong>
              <DeltaBadge delta={incomeDelta} invertTone />
            </button>

            <button
              className="cashflow-item"
              onClick={() => onNavigateToTransactions({ type: "expense" })}
              type="button"
            >
              <span className="cashflow-item__label">Saídas</span>
              <strong className="cashflow-item__value cashflow-item__value--negative money-value">
                {formatCurrency(dashboard.total_expense)}
              </strong>
              <DeltaBadge delta={expenseDelta} />
            </button>

            <button
              className="cashflow-item"
              onClick={() => onNavigateToTransactions()}
              type="button"
            >
              <span className="cashflow-item__label">Resultado</span>
              <strong
                className={`cashflow-item__value ${
                  dashboard.net_flow >= 0
                    ? "cashflow-item__value--positive"
                    : "cashflow-item__value--negative"
                } money-value`}
              >
                {formatCurrency(dashboard.net_flow)}
              </strong>
              <DeltaBadge delta={netDelta} />
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function DeltaBadge({
  delta,
  invertTone,
}: {
  delta: { percent: string; direction: "up" | "down" | "neutral" };
  invertTone?: boolean;
}) {
  const tone = (() => {
    if (delta.direction === "neutral") return "neutral";
    if (invertTone) {
      return delta.direction === "up" ? "negative" : "positive";
    }
    return delta.direction === "up" ? "positive" : "negative";
  })();

  return (
    <span className={`delta-badge delta-badge--${tone}`}       aria-label={`Variação: ${delta.percent}`}>
      {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→"}{" "}
      {delta.percent}
    </span>
  );
}

function SparklineTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: DailyBalancePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className={`sparkline-tooltip ${chartClassNames.tooltip}`}>
      <span>{point.date}</span>
      <strong>{formatCurrency(point.balance)}</strong>
    </div>
  );
}
