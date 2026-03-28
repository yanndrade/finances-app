import type { ReactNode } from "react";
import { isAfter, parseISO, startOfDay } from "date-fns";

import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import type { AccountSummary, CardSummary, InvoiceSummary } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import type { UiDensity } from "../../../lib/ui-density";

function shiftMonth(year: number, month: number, delta: number) {
  const totalMonths = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1,
  };
}

function buildCycleDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getInvoiceCycleDates(invoice: InvoiceSummary, card?: CardSummary) {
  if (!card) {
    return {
      closingDate: invoice.closing_date,
      dueDate: invoice.due_date,
    };
  }

  const [yearPart, monthPart] = invoice.reference_month.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return {
      closingDate: invoice.closing_date,
      dueDate: invoice.due_date,
    };
  }

  const closingDate = buildCycleDate(year, month, card.closing_day);
  const dueTarget = card.due_day < card.closing_day ? shiftMonth(year, month, 1) : { year, month };

  return {
    closingDate,
    dueDate: buildCycleDate(dueTarget.year, dueTarget.month, card.due_day),
  };
}

export function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[12px] font-black uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="text-2xl font-black tracking-tight text-foreground truncate">{value}</p>
    </div>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[13px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">{label}</p>
      <p className="text-base font-black text-foreground truncate">{value}</p>
    </div>
  );
}

export function MetricPanel({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "neutral" | "danger";
  value: string;
}) {
  const toneClasses =
    tone === "danger"
      ? "border border-danger/20 bg-danger/5 text-danger"
      : "bg-muted text-muted-foreground";
  const valueClasses = tone === "danger" ? "text-danger" : "text-foreground";

  return (
    <div className={`flex items-center gap-4 rounded-[1.5rem] p-4 ${toneClasses}`}>
      <div className="rounded-xl bg-surface p-2.5 shadow-sm">{icon}</div>
      <div>
        <p className="text-[13px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">{label}</p>
        <p className={`text-base font-black ${valueClasses}`}>{value}</p>
      </div>
    </div>
  );
}

export function EmptySurface({ message }: { message: string }) {
  return (
    <Card className="rounded-[2.5rem] border-none bg-surface p-16 text-center shadow-sm">
      <p className="font-bold text-muted-foreground">{message}</p>
    </Card>
  );
}

export function renderStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge className="rounded-lg border-none bg-success/10 px-3 py-1 text-success hover:bg-success/10">
          Paga
        </Badge>
      );
    case "partial":
      return (
        <Badge className="rounded-lg border-none bg-warning/10 px-3 py-1 text-warning hover:bg-warning/10">
          Parcial
        </Badge>
      );
    case "open":
      return (
        <Badge className="rounded-lg border-none bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
          Aberta
        </Badge>
      );
    case "inactive":
      return (
        <Badge variant="outline" className="rounded-lg px-3 py-1 text-muted-foreground">
          Inativo
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getInvoiceBadgeStatus(invoice: InvoiceSummary, card?: CardSummary) {
  if (invoice.status !== "open") {
    return invoice.status;
  }

  const today = startOfDay(new Date());
  const { closingDate } = getInvoiceCycleDates(invoice, card);

  return isAfter(today, startOfDay(parseISO(closingDate))) ? "closed" : "open";
}

export function renderInvoiceStatusBadge(invoice: InvoiceSummary, card?: CardSummary) {
  const badgeStatus = getInvoiceBadgeStatus(invoice, card);

  if (badgeStatus === "closed") {
    return (
      <Badge className="rounded-lg border-none bg-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-200">
        Fechada
      </Badge>
    );
  }

  return renderStatusBadge(badgeStatus);
}

export function cardName(cardId: string, cards: CardSummary[]) {
  return cards.find((card) => card.card_id === cardId)?.name ?? cardId;
}

export function accountName(accountId: string, accounts: AccountSummary[]) {
  if (!accountId.trim()) {
    return "Sem conta padrão";
  }

  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

export function formatCurrencyInput(value: string) {
  return formatCurrency(parseInt(value || "0", 10));
}

export function getDisplayedInvoiceAmount(invoice: InvoiceSummary) {
  return invoice.status === "partial" ? invoice.remaining_amount : invoice.total_amount;
}

export function getCardPadding(uiDensity: UiDensity) {
  return uiDensity === "dense" ? "p-4" : uiDensity === "compact" ? "p-5" : "p-6";
}

export function getCardRadius(uiDensity: UiDensity) {
  return uiDensity === "dense" ? "rounded-[1.5rem]" : uiDensity === "compact" ? "rounded-[2rem]" : "rounded-[2.5rem]";
}
