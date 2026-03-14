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
    ? "text-foreground"
    : isPositive
      ? "text-finance-income"
      : isNegative
        ? "text-finance-expense"
        : "text-foreground";

  const formattedValue = formatCurrency(Math.abs(value));
  const sign = showSign ? (isPositive ? "+ " : isNegative ? "- " : "") : (isNegative ? "- " : "");

  return (
    <span className={cn("font-mono tabular-nums font-bold", colorClass, className)}>
      {sign}{formattedValue}
    </span>
  );
}
