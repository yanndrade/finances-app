import { formatCategoryName, formatCurrency, formatPaymentMethod } from "../../../lib/format";
import type { RecurringRuleSummary } from "../../../lib/api";

type RuleListItemProps = {
  rule: RecurringRuleSummary;
  accountNameById: Map<string, string>;
  cardNameById: Map<string, string>;
  onClick: () => void;
};

export function RuleListItem({ rule, accountNameById, cardNameById, onClick }: RuleListItemProps) {
  const sourceName =
    rule.payment_method === "CARD"
      ? cardNameById.get(rule.card_id ?? "") ?? rule.card_id ?? "Cartão"
      : accountNameById.get(rule.account_id ?? "") ?? rule.account_id ?? "Conta";

  return (
    <article
      onClick={onClick}
      className={`group flex items-center justify-between p-4 bg-white border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors last:border-0 ${
        !rule.is_active ? "opacity-50 grayscale" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <span className="text-sm font-bold">{rule.due_day}</span>
        </div>
        <div className="min-w-0 space-y-0.5">
          <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
            {rule.name}
            {!rule.is_active && (
              <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                Inativo
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500">
            {formatCategoryName(rule.category_id)} • {sourceName} • {formatPaymentMethod(rule.payment_method)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="text-sm font-bold text-slate-900 tabular-nums">
          {formatCurrency(rule.amount)}
        </span>
      </div>
    </article>
  );
}
