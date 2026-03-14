import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import type { AccountSummary, CategorySpending } from "../../lib/api";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import { formatCurrency, formatCategoryName } from "../../lib/format";

const CHART_COLORS = [
  CHART_THEME.primary,
  "hsl(var(--primary))",
  "hsl(var(--primary-soft))",
  CHART_THEME.income,
  "hsl(var(--warning))",
  CHART_THEME.expense,
  CHART_THEME.transfer,
];

type DashboardControlProps = {
  spendingByCategory: CategorySpending[];
  accounts: AccountSummary[];
};

export function DashboardControl({
  spendingByCategory,
  accounts,
}: DashboardControlProps) {
  const topCategories = spendingByCategory.slice(0, 6);
  const othersTotal = spendingByCategory
    .slice(6)
    .reduce((sum, item) => sum + item.total, 0);
  const chartData = [
    ...topCategories.map((item) => ({
      name: formatCategoryName(item.category_id),
      value: item.total,
    })),
    ...(othersTotal > 0 ? [{ name: "Outros", value: othersTotal }] : []),
  ];
  const totalExpense = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section aria-label="Controle financeiro" className="dashboard-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Controle</p>
          <h2 className="section-title">Onde você está gastando</h2>
        </div>
      </div>

      <div className="control-grid">
        <article className={`panel-card ${chartClassNames.surface}`}>
          <p className="eyebrow">Gastos por categoria</p>
          <h3 className="section-title">Este mês</h3>

          {chartData.length === 0 ? (
            <div className="empty-state empty-state--guided">
              <p>Sem despesas registradas ainda.</p>
              <p className="empty-state__hint">
                Adicione transações para ver seus gastos por categoria.
              </p>
            </div>
          ) : (
            <div className="donut-layout">
              <div className="donut-container">
                <ResponsiveContainer height={200} width={200}>
                  <PieChart>
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={chartData}
                      dataKey="value"
                      innerRadius={55}
                      nameKey="name"
                      outerRadius={90}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {chartData.map((_entry, index) => (
                        <Cell
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          key={`cell-${index}`}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip total={totalExpense} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="category-legend">
                {chartData.map((entry, index) => (
                  <li className="category-legend__item" key={entry.name}>
                    <span
                      className="category-legend__dot"
                      style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="category-legend__name">{entry.name}</span>
                    <strong className="category-legend__value money-value">
                      {formatCurrency(entry.value)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="panel-card">
          <p className="eyebrow">Contas</p>
          <h3 className="section-title">Resumo por conta</h3>

          {accounts.length === 0 ? (
            <div className="empty-state empty-state--guided">
              <p>Nenhuma conta cadastrada.</p>
              <p className="empty-state__hint">
                Crie sua primeira conta para começar a organizar seu dinheiro.
              </p>
            </div>
          ) : (
            <div className="dashboard-list">
              {accounts.slice(0, 5).map((account) => (
                <div className="dashboard-list__item" key={account.account_id}>
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.type}</p>
                  </div>
                  <strong className="money-value">{formatCurrency(account.current_balance)}</strong>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel-card">
          <p className="eyebrow">Próximas contas</p>
          <h3 className="section-title">Recorrências</h3>

          <div className="empty-state empty-state--guided">
            <p>Recorrências ainda não implementadas.</p>
            <p className="empty-state__hint">
              Em breve: assinaturas, boletos fixos e lembretes de pagamento.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = total > 0 ? ((value / total) * 100).toFixed(0) : "0";

  return (
    <div className={`sparkline-tooltip ${chartClassNames.tooltip}`}>
      <span>{name}</span>
      <strong>
        {formatCurrency(value)} ({pct}%)
      </strong>
    </div>
  );
}
