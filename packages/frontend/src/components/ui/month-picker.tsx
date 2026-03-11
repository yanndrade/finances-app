import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatCompetenceMonth } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";

type MonthPickerProps = {
  month: string;
  onMonthChange: (month: string) => void;
  uiDensity?: UiDensity;
  className?: string;
};

function prevMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthPicker({
  month,
  onMonthChange,
  uiDensity = "comfort",
  className,
}: MonthPickerProps) {
  const isCurrentMonth = month === currentMonthKey();

  const sizeClasses = uiDensity === "dense" 
    ? "h-6 w-6 text-[10px]"
    : uiDensity === "compact"
      ? "h-7 w-7 text-xs"
      : "h-8 w-8 text-sm";
  
  const labelSizeClasses = uiDensity === "dense" 
    ? "text-xs min-w-[100px] px-1.5 py-0.5"
    : uiDensity === "compact"
      ? "text-sm min-w-[110px] px-2 py-1"
      : "text-base min-w-[120px] px-2 py-1.5";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface overflow-hidden shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => onMonthChange(prevMonth(month))}
          className={cn(
            "flex items-center justify-center",
            sizeClasses,
            "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <label className="relative cursor-pointer group">
          <span
            className={cn(
              "block font-semibold text-foreground text-center",
              "group-hover:text-primary transition-colors duration-100 capitalize",
              labelSizeClasses,
              isCurrentMonth && "text-primary",
            )}
          >
            {formatCompetenceMonth(month)}
          </span>
          <input
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) {
                onMonthChange(event.target.value);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Selecionar competência"
          />
        </label>

        <button
          type="button"
          onClick={() => onMonthChange(nextMonth(month))}
          className={cn(
            "flex items-center justify-center",
            sizeClasses,
            "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onMonthChange(currentMonthKey())}
          className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors duration-100 focus-visible:outline-none focus-visible:underline shrink-0"
        >
          Hoje
        </button>
      )}
    </div>
  );
}