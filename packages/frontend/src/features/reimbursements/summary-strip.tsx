import { formatCurrency } from "../../lib/format";
import type { ReimbursementSummary } from "../../lib/api";
import { cn } from "../../lib/utils";

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

      {/* Supporting: os três restantes — inline, subordinados */}
      <div className="flex gap-6 ml-auto flex-wrap justify-end">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600">Recebido</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">
            {formatCurrency(summary.received_in_month)}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className={cn("text-[11px] font-medium uppercase tracking-wider", summary.expiring_soon_count > 0 ? "text-amber-600" : "text-muted-foreground")}>
            Vencendo
          </p>
          <div>
            <p className={cn("text-lg font-bold tabular-nums", summary.expiring_soon_count > 0 ? "text-amber-600" : "text-muted-foreground")}>
              {formatCurrency(summary.expiring_soon_total)}
            </p>
            {summary.expiring_soon_count > 0 && (
              <p className="text-[11px] text-amber-600/70">
                {summary.expiring_soon_count} em 7 dias
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className={cn("text-[11px] font-medium uppercase tracking-wider", summary.overdue_count > 0 ? "text-red-600" : "text-muted-foreground")}>
            Em atraso
          </p>
          <div>
            <p className={cn("text-lg font-bold tabular-nums", summary.overdue_count > 0 ? "text-red-600" : "text-muted-foreground")}>
              {formatCurrency(summary.overdue_total)}
            </p>
            {summary.overdue_count > 0 && (
              <p className="text-[11px] text-red-600/70">
                {summary.overdue_count} vencido{summary.overdue_count > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
