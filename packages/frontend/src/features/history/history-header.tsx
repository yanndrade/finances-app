import { Search, ChevronLeft, ChevronRight } from "lucide-react";

import { formatCompetenceMonth } from "../../lib/format";
import { cn } from "../../lib/utils";

type HistoryHeaderProps = {
  competenceMonth: string;
  searchText: string;
  onCompetenceChange: (month: string) => void;
  onSearchChange: (text: string) => void;
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

export function HistoryHeader({
  competenceMonth,
  searchText,
  onCompetenceChange,
  onSearchChange,
  className,
}: HistoryHeaderProps) {
  const isCurrentMonth = competenceMonth === currentMonthKey();

  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface overflow-hidden shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => onCompetenceChange(prevMonth(competenceMonth))}
            className={cn(
              "h-7 w-7 flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <label className="relative cursor-pointer group">
            <span
              className={cn(
                "block px-2 py-1 text-xs font-semibold text-foreground min-w-[110px] text-center",
                "group-hover:text-primary transition-colors duration-100 capitalize",
                isCurrentMonth && "text-primary",
              )}
            >
              {formatCompetenceMonth(competenceMonth)}
            </span>
            <input
              type="month"
              value={competenceMonth}
              onChange={(event) => {
                if (event.target.value) {
                  onCompetenceChange(event.target.value);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Selecionar competência"
            />
          </label>

          <button
            type="button"
            onClick={() => onCompetenceChange(nextMonth(competenceMonth))}
            className={cn(
              "h-7 w-7 flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              "transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => onCompetenceChange(currentMonthKey())}
            className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors duration-100 focus-visible:outline-none focus-visible:underline shrink-0"
          >
            Hoje
          </button>
        )}
      </div>

      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar movimentações..."
          className={cn(
            "h-8 w-full rounded-lg border border-input bg-surface pl-8 pr-3 text-xs",
            "placeholder:text-muted-foreground/60 text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 focus:border-ring",
            "transition-colors duration-100",
          )}
        />
      </div>
    </div>
  );
}
