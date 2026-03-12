import {
  formatCategoryName,
  formatCurrency,
  formatDate,
  formatLifecycleStatus,
  formatOriginType,
  formatPaymentMethodExpanded,
} from "../../lib/format";
import type {
  AccountSummary,
  CardSummary,
  UnifiedMovement,
} from "../../lib/api";
import { cn } from "../../lib/utils";

type MovementRowProps = {
  movement: UnifiedMovement;
  accounts: AccountSummary[];
  cards: CardSummary[];
  isSelected?: boolean;
  onClick: () => void;
};

function kindTextClass(kind: string): string {
  switch (kind) {
    case "income":
      return "text-finance-income";
    case "expense":
      return "text-finance-expense";
    case "transfer":
      return "text-finance-transfer";
    case "investment":
      return "text-finance-investment";
    case "reimbursement":
      return "text-finance-income";
    default:
      return "text-foreground";
  }
}

function lifecycleBadgeClass(status: string): string {
  switch (status) {
    case "forecast":
      return "bg-muted text-muted-foreground border-border";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "cleared":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border line-through";
    case "voided":
      return "bg-red-50 text-red-600 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function originBadgeClass(originType: string): string {
  switch (originType) {
    case "recurring":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "installment":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "card_purchase":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "investment":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "transfer":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "reimbursement":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "manual":
    default:
      return "hidden";
  }
}

function methodIcon(method: string): string {
  switch (method) {
    case "PIX":
      return "PIX";
    case "CASH":
      return "R$";
    case "DEBIT":
      return "DB";
    case "CREDIT_CASH":
    case "CREDIT_INSTALLMENT":
      return "CR";
    case "BOLETO":
      return "BL";
    case "AUTO_DEBIT":
      return "AD";
    case "TRANSFER":
      return "TR";
    case "BALANCE":
      return "SD";
    default:
      return "·";
  }
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[12px] font-semibold border leading-none select-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MovementRow({
  movement,
  accounts,
  cards,
  isSelected = false,
  onClick,
}: MovementRowProps) {
  const {
    kind,
    origin_type,
    title,
    amount,
    posted_at,
    category_id,
    payment_method,
    lifecycle_status,
    account_id,
    card_id,
    installment_number,
    installment_total,
    counterparty,
  } = movement;

  const isVoided = lifecycle_status === "voided";
  const accountName =
    accounts.find((account) => account.account_id === account_id)?.name ??
    account_id;
  const cardName = card_id
    ? cards.find((card) => card.card_id === card_id)?.name ?? card_id
    : null;

  const subtitleParts: string[] = [];
  if (
    category_id &&
    category_id !== "transfer" &&
    category_id !== "investment"
  ) {
    subtitleParts.push(formatCategoryName(category_id));
  }
  if (payment_method && payment_method !== "OTHER") {
    subtitleParts.push(formatPaymentMethodExpanded(payment_method));
  }
  if (installment_number != null && installment_total != null) {
    subtitleParts.push(`Parcela ${installment_number}/${installment_total}`);
  }
  if (counterparty && kind !== "transfer") {
    subtitleParts.push(counterparty);
  }

  const transferDestName =
    kind === "transfer" && counterparty
      ? accounts.find((account) => account.account_id === counterparty)?.name ??
        counterparty
      : null;

  const displayTitle =
    title && title !== category_id ? title : formatCategoryName(category_id);

  const amountSign = kind === "income" || kind === "reimbursement" ? 1 : -1;
  const signedAmount = amountSign > 0 ? amount : -amount;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-3 px-4 py-3 border-b border-border/40 transition-colors duration-100 group",
        "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isSelected && "bg-accent/60",
        isVoided && "opacity-50",
      )}
    >
      <time
        dateTime={posted_at}
        className="text-[13px] text-muted-foreground tabular-nums w-10 shrink-0 leading-tight"
      >
        {formatDate(posted_at).slice(0, 5)}
      </time>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              kind === "income" && "bg-finance-income",
              kind === "expense" && "bg-finance-expense",
              kind === "transfer" && "bg-finance-transfer",
              kind === "investment" && "bg-finance-investment",
              kind === "reimbursement" && "bg-finance-income",
            )}
          />
          <span
            className={cn(
              "text-sm font-semibold truncate leading-snug",
              isVoided
                ? "line-through text-muted-foreground"
                : "text-foreground",
            )}
          >
            {displayTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {subtitleParts.length > 0 && (
            <span className="text-[13px] text-muted-foreground truncate">
              {subtitleParts.join(" · ")}
            </span>
          )}
          {kind === "transfer" && transferDestName && (
            <span className="text-[13px] text-finance-transfer font-medium">
              {`-> ${transferDestName}`}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 hidden sm:flex items-center gap-1">
        {origin_type !== "manual" && (
          <Badge className={originBadgeClass(origin_type)}>
            {formatOriginType(origin_type)}
          </Badge>
        )}
      </div>

      <div className="shrink-0 hidden md:flex flex-col items-end gap-0.5 w-28">
        {cardName ? (
          <>
            <span className="text-[13px] font-medium text-foreground/70 truncate max-w-full">
              {cardName}
            </span>
            <span className="text-[12px] text-muted-foreground truncate max-w-full">
              {accountName}
            </span>
          </>
        ) : (
          <span className="text-[13px] font-medium text-foreground/70 truncate max-w-full">
            {accountName}
          </span>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1 w-28">
        <span
          className={cn(
            "text-sm font-bold tabular-nums leading-none",
            kindTextClass(kind),
            isVoided && "line-through opacity-60",
          )}
        >
          {signedAmount >= 0 ? "+" : ""}
          {formatCurrency(Math.abs(signedAmount))}
        </span>

        <div className="flex items-center gap-1">
          {payment_method &&
            payment_method !== "OTHER" &&
            payment_method !== "BALANCE" && (
              <span
                className="text-[13px] font-bold text-muted-foreground leading-none"
                title={formatPaymentMethodExpanded(payment_method)}
              >
                {methodIcon(payment_method)}
              </span>
            )}

          {lifecycle_status !== "cleared" && (
            <Badge className={cn("text-[13px]", lifecycleBadgeClass(lifecycle_status))}>
              {formatLifecycleStatus(lifecycle_status)}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
