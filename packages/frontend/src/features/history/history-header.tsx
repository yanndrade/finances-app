import { Search } from "lucide-react";

import { cn } from "../../lib/utils";

type HistoryHeaderProps = {
  searchText: string;
  onSearchChange: (text: string) => void;
  className?: string;
};

export function HistoryHeader({
  searchText,
  onSearchChange,
  className,
}: HistoryHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
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
