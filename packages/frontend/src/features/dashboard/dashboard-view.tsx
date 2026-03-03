import type { DashboardSummary } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { StatCard } from "../../components/stat-card";

type DashboardViewProps = {
  dashboard: DashboardSummary | null;
  loading: boolean;
};

export function DashboardView({ dashboard, loading }: DashboardViewProps) {
  return (
    <section className="panel-stack">
      <section className="hero-panel">
        <p className="eyebrow">Cash Flow</p>
        <h1>Dashboard mensal</h1>
        <p className="hero-copy">
          Resumo do mes atual usando as projecoes em `app.db`.
        </p>
        {loading && dashboard === null ? (
          <div className="loading-panel">Carregando dados...</div>
        ) : null}
        {!loading && dashboard === null ? (
          <div className="empty-state">Nao foi possivel carregar o dashboard.</div>
        ) : null}
        {dashboard !== null ? (
          <div className="stats-grid">
            <StatCard
              label="Saldo atual"
              tone="default"
              value={formatCurrency(dashboard.current_balance)}
            />
            <StatCard
              label="Entradas"
              tone="positive"
              value={formatCurrency(dashboard.total_income)}
            />
            <StatCard
              label="Saidas"
              tone="negative"
              value={formatCurrency(dashboard.total_expense)}
            />
            <StatCard
              label="Fluxo liquido"
              tone={dashboard.net_flow >= 0 ? "positive" : "negative"}
              value={formatCurrency(dashboard.net_flow)}
            />
          </div>
        ) : null}
      </section>
    </section>
  );
}
