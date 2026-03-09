import { cn } from "../../lib/utils";
import type { UiDensity } from "../../lib/ui-density";

type MonthPickerProps = {
  month: string;
  onMonthChange: (month: string) => void;
  uiDensity?: UiDensity;
  className?: string;
};

export function MonthPicker({
  month,
  onMonthChange,
  uiDensity = "comfort",
  className,
}: MonthPickerProps) {
  return (
    <input
      onChange={(event) => onMonthChange(event.target.value)}
      type="month"
      className={cn(
        "bg-muted/70 border border-input rounded-xl font-semibold text-slate-700 cursor-pointer outline-none transition-colors hover:bg-muted focus:ring-1 focus:ring-ring focus:bg-background",
        uiDensity === "dense"
          ? "px-2.5 py-2 text-xs"
          : uiDensity === "compact"
            ? "px-3 py-2 text-sm"
            : "px-3 py-2.5 text-sm",
        className,
      )}
      value={month}
    />
  );
}
