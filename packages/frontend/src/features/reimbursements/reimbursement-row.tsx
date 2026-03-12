import { AlertCircle, CheckCircle2, Clock, MinusCircle } from "lucide-react";

import type { PendingReimbursementSummary } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/format";

type ReimbursementRowProps = {
  reimbursement: PendingReimbursementSummary;
  onClick: () => void;
};

const STATUS_CONFIG = {
  pending: {
    label: "Pendente",
    icon: Clock,
    colorClass: "text-amber-600 bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  overdue: {
    label: "Em atraso",
    icon: AlertCircle,
    colorClass: "text-red-600 bg-red-50",
    badgeClass: "bg-red-100 text-red-700",
  },
  partial: {
    label: "Parcial",
    icon: MinusCircle,
    colorClass: "text-blue-600 bg-blue-50",
    badgeClass: "bg-blue-100 text-blue-700",
  },
  received: {
    label: "Recebido",
    icon: CheckCircle2,
    colorClass: "text-emerald-600 bg-emerald-50",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  canceled: {
    label: "Cancelado",
    icon: MinusCircle,
    colorClass: "text-slate-400 bg-slate-50",
    badgeClass: "bg-slate-100 text-slate-500",
  },
} as const;

export function ReimbursementRow({ reimbursement, onClick }: ReimbursementRowProps) {
  const statusKey = reimbursement.status as keyof typeof STATUS_CONFIG;
  const config = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const outstanding = reimbursement.amount - (reimbursement.amount_received ?? 0);
  const isCanceled = reimbursement.status === "canceled";

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      onClick={onClick}
    >
      {/* Status icon */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.colorClass}`}>
        <StatusIcon size={16} aria-hidden="true" />
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate text-sm font-semibold ${isCanceled ? "text-slate-400 line-through" : "text-slate-800"}`}>
            {reimbursement.person_id}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${config.badgeClass}`}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Lançado em {formatDate(reimbursement.occurred_at)}
          {reimbursement.expected_at ? ` · vence em ${formatDate(reimbursement.expected_at)}` : ""}
        </p>
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <p className={`text-sm font-bold tabular-nums ${isCanceled ? "text-slate-400 line-through" : "text-slate-800"}`}>
          {formatCurrency(reimbursement.amount)}
        </p>
        {reimbursement.status === "partial" && (
          <p className="text-xs text-blue-600 tabular-nums">
            {formatCurrency(outstanding)} restante
          </p>
        )}
        {reimbursement.status === "received" && (
          <p className="text-xs text-emerald-600">Recebido</p>
        )}
      </div>
    </button>
  );
}
