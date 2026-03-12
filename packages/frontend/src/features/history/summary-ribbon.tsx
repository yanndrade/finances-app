import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";
import type { MovementSummary, MovementScope } from "../../lib/api";

type SummaryRibbonProps = {
  summary: MovementSummary;
  activeScope: MovementScope;
  onScopeChange: (scope: MovementScope) => void;
  className?: string;
};

type Segment = {
  scope: MovementScope | null;
  label: string;
  value: number;
  variant: "income" | "expense" | "neutral" | "result-positive" | "result-negative" | "investment" | "review";
  sublabel?: string;
};

function SegmentCell({
  segment,
  isActive,
  onClick,
}: {
  segment: Segment;
  isActive: boolean;
  onClick?: () => void;
}) {
  const isClickable = segment.scope !== null;

  const valueClass = {
    income: "text-finance-income",
    expense: "text-finance-expense",
    neutral: "text-foreground",
    investment: "text-finance-investment",
    review: "text-finance-review",
    "result-positive": "text-finance-income",
    "result-negative": "text-finance-expense",
  }[segment.variant];

  const activeBorderClass = {
    income: "border-b-2 border-b-finance-income",
    expense: "border-b-2 border-b-finance-expense",
    neutral: "border-b-2 border-b-muted-foreground",
    investment: "border-b-2 border-b-finance-investment",
    review: "border-b-2 border-b-finance-review",
    "result-positive": "border-b-2 border-b-finance-income",
    "result-negative": "border-b-2 border-b-finance-expense",
  }[segment.variant];

  const resultVariant =
    segment.variant === "result-positive" || segment.variant === "result-negative";

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col items-start px-4 py-3 min-w-[120px] lg:min-w-0 flex-1 transition-colors duration-100",
        isClickable &&
          "cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isActive && activeBorderClass,
        resultVariant && "bg-muted/40",
      )}
    >
      <span
        className={cn(
          "text-[12px] font-bold uppercase tracking-widest mb-1 truncate w-full",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {segment.label}
      </span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums leading-none",
          valueClass,
          resultVariant && "text-base",
        )}
      >
        {segment.value >= 0 && (segment.variant === "income" || segment.variant === "result-positive")
          ? "+"
          : segment.variant === "result-negative"
            ? ""
            : ""}
        {formatCurrency(Math.abs(segment.value))}
      </span>
      {segment.sublabel && (
        <span className="text-[12px] text-muted-foreground mt-0.5 truncate w-full">
          {segment.sublabel}
        </span>
      )}
    </div>
  );
}

export function SummaryRibbon({
  summary,
  activeScope,
  onScopeChange,
  className,
}: SummaryRibbonProps) {
  const resultIsPositive = summary.total_result >= 0;

  const segments: Segment[] = [
    {
      scope: null,
      label: "Entradas",
      value: summary.total_income,
      variant: "income",
    },
    {
      scope: "fixed",
      label: "Fixos",
      value: summary.total_fixed,
      variant: "expense",
      sublabel: `${summary.counts.fixed} lançamentos`,
    },
    {
      scope: "installments",
      label: "Parcelas",
      value: summary.total_installments,
      variant: "expense",
      sublabel: `${summary.counts.installments} parcelas`,
    },
    {
      scope: "variable",
      label: "Variáveis",
      value: summary.total_variable,
      variant: "expense",
      sublabel: `${summary.counts.variable} lançamentos`,
    },
    {
      scope: "investments",
      label: "Investimentos",
      value: summary.total_investments,
      variant: "investment",
      sublabel: `${summary.counts.investments} lançamentos`,
    },
    {
      scope: "reimbursements",
      label: "Reembolsos",
      value: summary.total_reimbursements,
      variant: "review",
      sublabel: `${summary.counts.reimbursements} lançamentos`,
    },
    {
      scope: null,
      label: "Total saídas",
      value: summary.total_expenses,
      variant: "expense",
    },
    {
      scope: null,
      label: "Resultado",
      value: summary.total_result,
      variant: resultIsPositive ? "result-positive" : "result-negative",
    },
  ];

  return (
    <div
      className={cn(
        "flex items-stretch divide-x divide-border/60",
        "border border-border/70 rounded-xl overflow-x-auto overflow-y-hidden bg-surface scrollbar-hide",
        "shadow-sm",
        className,
      )}
    >
      {segments.map((segment, i) => (
        <SegmentCell
          key={i}
          segment={segment}
          isActive={segment.scope !== null && activeScope === segment.scope}
          onClick={
            segment.scope !== null
              ? () => onScopeChange(segment.scope as MovementScope)
              : undefined
          }
        />
      ))}
    </div>
  );
}
