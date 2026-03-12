import { formatCategoryName, formatCurrency, formatDate, formatPaymentMethod } from "../../../lib/format";
import type { PendingExpenseSummary } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { getTemporalStatus, TemporalStatus } from "../helpers/temporal-status";

type PendingItemProps = {
  pending: PendingExpenseSummary;
  accountNameById: Map<string, string>;
  cardNameById: Map<string, string>;
  onClick: () => void;
  onConfirm: (id: string) => void;
  onViewHistory: () => void;
  isSubmitting: boolean;
};

export function PendingItem({
  pending,
  accountNameById,
  cardNameById,
  onClick,
  onConfirm,
  onViewHistory,
  isSubmitting,
}: PendingItemProps) {
  const isConfirmed = pending.status === "confirmed";
  const status = getTemporalStatus(pending.due_date, pending.status);

  const sourceName =
    pending.payment_method === "CARD"
      ? cardNameById.get(pending.card_id ?? "") ?? pending.card_id ?? "Cartão"
      : accountNameById.get(pending.account_id ?? "") ?? pending.account_id ?? "Conta";

  return (
    <article
      onClick={onClick}
      className="group flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
            {pending.name}
          </h3>
          <StatusBadge status={status} />
        </div>
        <p className="text-xs text-slate-600">
          {formatCategoryName(pending.category_id)} • vence em {formatDate(pending.due_date)}
        </p>
        <p className="text-xs text-slate-500">
          {sourceName} • {formatPaymentMethod(pending.payment_method)}
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 lg:items-end">
        <span className="text-sm font-bold text-slate-900 tabular-nums">
          {formatCurrency(pending.amount)}
        </span>
        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {isConfirmed ? (
            <button
              type="button"
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              onClick={onViewHistory}
            >
              Ver no histórico
            </button>
          ) : (
            <button
              disabled={isSubmitting}
              type="button"
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-transparent bg-primary text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onConfirm(pending.pending_id)}
            >
              Pagar agora
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: TemporalStatus }) {
  let classes = "";
  let label = "";

  switch (status) {
    case "paid":
      classes = "bg-emerald-100 text-emerald-700";
      label = "pago";
      break;
    case "overdue":
      classes = "bg-rose-100 text-rose-700";
      label = "atrasado";
      break;
    case "due_today":
      classes = "bg-amber-100 text-amber-700";
      label = "hoje";
      break;
    case "upcoming":
      classes = "bg-slate-100 text-slate-600";
      label = "a vencer";
      break;
  }

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-black uppercase tracking-[0.14em]", classes)}>
      {label}
    </span>
  );
}
