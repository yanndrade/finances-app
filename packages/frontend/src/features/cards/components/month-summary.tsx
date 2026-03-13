import type { InvoiceSummary } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";

type MonthSummaryProps = {
  invoices: InvoiceSummary[];
  totalLimitCommitted: number;
};

export function MonthSummary({ invoices, totalLimitCommitted }: MonthSummaryProps) {
  const totalFaturas = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
  const totalPago = invoices.reduce((acc, inv) => acc + inv.paid_amount, 0);
  const totalEmAberto = invoices.reduce((acc, inv) => acc + inv.remaining_amount, 0);
  const limitPct = totalLimitCommitted > 0
    ? Math.round((totalFaturas / totalLimitCommitted) * 100)
    : 0;

  return (
    <div className="flex items-baseline gap-6 pb-5 border-b border-border/40">
      {/* Dominant: A pagar */}
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">A pagar</p>
        <p className="text-4xl font-black tracking-tight text-foreground tabular-nums">
          {formatCurrency(totalEmAberto)}
        </p>
      </div>

      {/* Supporting: total + pago — inline, subordinate */}
      <div className="flex gap-6 ml-auto">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total do mês</p>
          <p className="text-lg font-bold text-foreground tabular-nums">
            {formatCurrency(totalFaturas)}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Já pago</p>
          <div>
            <p className="text-lg font-bold text-muted-foreground tabular-nums">
              {formatCurrency(totalPago)}
            </p>
            {totalFaturas > 0 && (
              <p className="text-[11px] text-muted-foreground/60">
                {Math.round((totalPago / totalFaturas) * 100)}%
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
