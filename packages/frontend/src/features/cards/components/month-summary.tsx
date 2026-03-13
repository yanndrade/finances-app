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
    <div className="grid grid-cols-3 gap-3">
      {/* Âncora principal: A pagar */}
      <div className="col-span-1 flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-3 shadow-sm gap-3 overflow-hidden">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">A pagar</p>
        <p className="text-xl font-black tracking-tight text-foreground truncate tabular-nums">
          {formatCurrency(totalEmAberto)}
        </p>
      </div>

      <div className="col-span-1 flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-3 shadow-sm gap-3 overflow-hidden">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">Total do mês</p>
        <p className="text-xl font-black tracking-tight text-foreground truncate tabular-nums">
          {formatCurrency(totalFaturas)}
        </p>
      </div>

      <div className="col-span-1 flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-3 shadow-sm gap-3 overflow-hidden">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">Já pago</p>
        <div className="text-right min-w-0">
          <p className="text-xl font-black tracking-tight text-muted-foreground truncate tabular-nums">
            {formatCurrency(totalPago)}
          </p>
          {totalFaturas > 0 && (
            <p className="text-[12px] font-semibold text-muted-foreground">
              {Math.round((totalPago / totalFaturas) * 100)}% do total
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
