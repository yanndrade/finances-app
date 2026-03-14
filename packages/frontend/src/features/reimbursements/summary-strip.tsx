import { AlertCircle, Clock, TrendingDown, TrendingUp } from "lucide-react";

import { formatCurrency } from "../../lib/format";
import type { ReimbursementSummary } from "../../lib/api";

type SummaryStripProps = {
  summary: ReimbursementSummary;
  loading: boolean;
};

type MetricCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  variant?: "default" | "warning" | "danger" | "success";
};

function MetricCard({ label, value, sub, icon, variant = "default" }: MetricCardProps) {
  const variantClass = {
    default: "text-slate-500",
    warning: "text-amber-600",
    danger: "text-red-600",
    success: "text-emerald-600",
  }[variant];

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm">
      <div className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide ${variantClass}`}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function SummaryStrip({ summary, loading }: SummaryStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="A receber"
        value={formatCurrency(summary.total_outstanding)}
        sub="Total pendente"
        icon={<TrendingDown size={13} />}
        variant="default"
      />
      <MetricCard
        label="Recebido no mês"
        value={formatCurrency(summary.received_in_month)}
        sub="Entradas confirmadas"
        icon={<TrendingUp size={13} />}
        variant="success"
      />
      <MetricCard
        label="Vencendo em breve"
        value={formatCurrency(summary.expiring_soon_total)}
        sub={
          summary.expiring_soon_count > 0
            ? `${summary.expiring_soon_count} reembolso${summary.expiring_soon_count > 1 ? "s" : ""} em até 7 dias`
            : "Nenhum nos próximos 7 dias"
        }
        icon={<Clock size={13} />}
        variant={summary.expiring_soon_count > 0 ? "warning" : "default"}
      />
      <MetricCard
        label="Em atraso"
        value={formatCurrency(summary.overdue_total)}
        sub={
          summary.overdue_count > 0
            ? `${summary.overdue_count} reembolso${summary.overdue_count > 1 ? "s" : ""} vencido${summary.overdue_count > 1 ? "s" : ""}`
            : "Nenhum em atraso"
        }
        icon={<AlertCircle size={13} />}
        variant={summary.overdue_count > 0 ? "danger" : "default"}
      />
    </div>
  );
}
