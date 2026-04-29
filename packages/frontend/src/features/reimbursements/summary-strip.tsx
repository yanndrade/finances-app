import { formatCurrency } from "../../lib/format";
import type { ReimbursementSummary } from "../../lib/api";

type SummaryStripProps = {
  summary: ReimbursementSummary;
  loading: boolean;
};

export function SummaryStrip({ summary, loading }: SummaryStripProps) {
  if (loading) {
    return (
      <div className="flex items-baseline gap-6 pb-5 border-b border-border/40">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="flex gap-6 ml-auto">
          <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-6 pb-5 border-b border-border/40">
      {/* Dominant: A receber */}
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">A receber</p>
        <p className="text-4xl font-black tracking-tight text-foreground tabular-nums">
          {formatCurrency(summary.total_outstanding)}
        </p>
      </div>

      {/* Supporting total for the selected period */}
      <div className="flex gap-6 ml-auto flex-wrap justify-end">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">Recebido</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">
            {formatCurrency(summary.received_in_month)}
          </p>
        </div>
      </div>
    </div>
  );
}
