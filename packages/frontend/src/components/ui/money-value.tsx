import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";

type MoneyValueProps = {
  value: number;
  className?: string;
  showSign?: boolean;
  neutral?: boolean;
};

export function MoneyValue({ value, className, showSign = false, neutral = false }: MoneyValueProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  const colorClass = neutral 
    ? "text-slate-900" 
    : isPositive 
      ? "text-emerald-600" 
      : isNegative 
        ? "text-rose-600" 
        : "text-slate-900";

  const formattedValue = formatCurrency(Math.abs(value));
  const sign = showSign ? (isPositive ? "+ " : isNegative ? "- " : "") : (isNegative ? "- " : "");

  return (
    <span className={cn("font-mono tabular-nums font-bold", colorClass, className)}>
      {sign}{formattedValue}
    </span>
  );
}
