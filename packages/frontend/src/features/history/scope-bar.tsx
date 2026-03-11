import type { MovementScope, ScopeCount } from "../../lib/api";
import { cn } from "../../lib/utils";

type ScopeBarProps = {
  counts: ScopeCount;
  activeScope: MovementScope;
  onScopeChange: (scope: MovementScope) => void;
  className?: string;
};

type ScopeItem = {
  scope: MovementScope;
  label: string;
};

const SCOPE_ITEMS: ScopeItem[] = [
  { scope: "all", label: "Todos" },
  { scope: "fixed", label: "Fixos" },
  { scope: "installments", label: "Parcelas" },
  { scope: "variable", label: "Variáveis" },
  { scope: "transfers", label: "Transferências" },
  { scope: "investments", label: "Investimentos" },
  { scope: "reimbursements", label: "Reembolsos" },
];

function countFor(scope: MovementScope, counts: ScopeCount): number {
  switch (scope) {
    case "all":
      return counts.all;
    case "fixed":
      return counts.fixed;
    case "installments":
      return counts.installments;
    case "variable":
      return counts.variable;
    case "transfers":
      return counts.transfers;
    case "investments":
      return counts.investments;
    case "reimbursements":
      return counts.reimbursements;
    default:
      return 0;
  }
}

export function ScopeBar({
  counts,
  activeScope,
  onScopeChange,
  className,
}: ScopeBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Escopo de movimentações"
      className={cn(
        "flex items-center gap-1 overflow-x-auto pb-0.5",
        "scrollbar-none",
        className,
      )}
    >
      {SCOPE_ITEMS.map(({ scope, label }) => {
        const count = countFor(scope, counts);
        const isActive = activeScope === scope;

        return (
          <button
            key={scope}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onScopeChange(scope)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
              "whitespace-nowrap transition-all duration-100 shrink-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              !isActive && [
                "bg-muted/60 text-muted-foreground",
                "hover:bg-muted hover:text-foreground",
              ],
              isActive && ["bg-accent-navy text-white shadow-sm"],
            )}
          >
            {label}
            {count > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none",
                  "min-w-[16px] h-4 px-1",
                  isActive
                    ? "bg-white/25 text-white"
                    : "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
