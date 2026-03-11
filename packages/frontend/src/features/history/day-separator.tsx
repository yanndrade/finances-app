import { cn } from "../../lib/utils";
import { formatCurrency, formatDate } from "../../lib/format";

type DaySeparatorProps = {
  date: string;
  daySubtotal: number;
  runningBalance: number | null;
  className?: string;
};

export function DaySeparator({
  date,
  daySubtotal,
  runningBalance,
  className,
}: DaySeparatorProps) {
  const isPositive = daySubtotal >= 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 sticky top-0 z-10",
        "bg-surface-paper/95 backdrop-blur-sm border-b border-border/60",
        className,
      )}
    >
      {/* Date label */}
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground min-w-[80px]">
        {formatDate(date)}
      </span>

      {/* Hairline divider */}
      <div className="flex-1 h-px bg-border/50" />

      {/* Day subtotal */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Dia
        </span>
        <span
          className={cn(
            "text-xs font-bold tabular-nums",
            isPositive ? "text-finance-income" : "text-finance-expense",
          )}
        >
          {isPositive ? "+" : ""}
          {formatCurrency(daySubtotal)}
        </span>
      </div>

      {/* Running balance */}
      {runningBalance !== null && (
        <>
          <div className="w-px h-3.5 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Saldo
            </span>
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                runningBalance >= 0
                  ? "text-accent-navy"
                  : "text-finance-expense",
              )}
            >
              {formatCurrency(runningBalance)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
