import { formatCurrency } from "../../../lib/format";

type MonthSummaryBarProps = {
  activeRulesCount: number;
  totalPendingAmount: number;
  pendingCount: number;
  pendingAmount: number;
  paidCount: number;
  paidAmount: number;
};

export function MonthSummaryBar({
  activeRulesCount,
  totalPendingAmount,
  pendingCount,
  pendingAmount,
  paidCount,
  paidAmount,
}: MonthSummaryBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col space-y-1">
        <span className="text-[13px] font-black uppercase tracking-[0.16em] text-slate-500">
          Cadastrados
        </span>
        <span className="text-xl font-bold text-slate-900 tabular-nums">
          {activeRulesCount} <span className="text-sm font-medium text-slate-500">fixos</span>
        </span>
      </div>

      <div className="flex flex-col space-y-1 border-l border-slate-100 pl-4 min-w-0">
        <span className="text-[13px] font-black uppercase tracking-[0.16em] text-slate-500">
          Previstos
        </span>
        <span className="text-xl font-bold text-slate-900 tabular-nums truncate">
          {formatCurrency(totalPendingAmount)}
        </span>
      </div>

      <div className="flex flex-col space-y-1 lg:border-l border-slate-100 lg:pl-4 min-w-0">
        <span className="text-[13px] font-black uppercase tracking-[0.16em] text-amber-600">
          Pendentes
        </span>
        <span className="text-xl font-bold text-slate-900 tabular-nums flex items-baseline gap-2">
          <span className="truncate">{formatCurrency(pendingAmount)}</span>
          <span className="text-sm font-medium text-slate-500 shrink-0">
            ({pendingCount})
          </span>
        </span>
      </div>

      <div className="flex flex-col space-y-1 border-l border-slate-100 pl-4 min-w-0">
        <span className="text-[13px] font-black uppercase tracking-[0.16em] text-emerald-600">
          Pagos
        </span>
        <span className="text-xl font-bold text-slate-900 tabular-nums flex items-baseline gap-2">
          <span className="truncate">{formatCurrency(paidAmount)}</span>
          <span className="text-sm font-medium text-slate-500 shrink-0">
            ({paidCount})
          </span>
        </span>
      </div>
    </div>
  );
}
