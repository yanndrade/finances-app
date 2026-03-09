import React, { useMemo } from "react";
import { Clock, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { MoneyValue } from "../../components/ui/money-value";
import { EmptyState } from "../../components/ui/empty-state";
import {
  formatCategoryName,
  formatCurrency,
  formatDate,
  formatPaymentMethod,
} from "../../lib/format";
import type {
  DashboardSummary,
  TransactionFilters,
  CardSummary,
} from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type MonthCommitmentsProps = {
  dashboard: DashboardSummary;
  cards: CardSummary[];
  className?: string;
  uiDensity: UiDensity;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
};

export function MonthCommitments({
  dashboard,
  cards,
  className,
  uiDensity,
  onOpenLedgerFiltered,
}: MonthCommitmentsProps) {
  const cardNameById = useMemo(() => {
    return new Map(cards.map((card) => [card.card_id, card.name]));
  }, [cards]);

  const monthlyCommitments = dashboard.monthly_commitments ?? [];
  const pendingCommitments = monthlyCommitments
    .filter((c) => c.status !== "confirmed" && c.status !== "paid")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const totalPending = pendingCommitments.reduce((sum, c) => sum + c.amount, 0);

  function formatCommitmentTitle(
    commitment: NonNullable<DashboardSummary["monthly_commitments"]>[number],
    cardNameMap: Map<string, string>,
  ): string {
    if (commitment.kind === "invoice") {
      const cardId = commitment.card_id ?? commitment.title;
      const cardName = cardNameMap.get(cardId) ?? cardId;
      return `Fatura: ${cardName}`;
    }

    return commitment.title;
  }

  function formatCommitmentCategory(categoryId: string | null): string {
    return categoryId ? formatCategoryName(categoryId) : "Diversos";
  }

  return (
    <Card
      className={cn(
        "finance-card flex flex-col rounded-xl border border-slate-100/40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] bg-white",
        className,
      )}
    >
      <CardHeader className="pb-4 shrink-0 flex flex-row items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-2 text-slate-800">
          <Clock className="h-5 w-5 text-slate-400" />
          <CardTitle className="text-lg font-semibold">
            Próximos Compromissos
          </CardTitle>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-2 text-sm bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            <span className="text-slate-500 font-medium">A vencer:</span>
            <MoneyValue
              value={totalPending}
              className="font-bold text-slate-900 tabular-nums"
            />
          </div>
        )}
      </CardHeader>

      <CardContent
        className={cn("flex-1", uiDensity === "dense" ? "p-4" : "p-0")}
      >
        {pendingCommitments.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Tudo em dia"
            description="Nenhum compromisso financeiro pendente para este mês."
            className="py-10 border-none bg-transparent"
          />
        ) : (
          <div className="flex flex-col relative">
            {pendingCommitments.slice(0, 5).map((commitment, i) => (
              <button
                key={`${commitment.commitment_id}-${i}`}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group"
                onClick={() =>
                  onOpenLedgerFiltered(
                    {
                      period: "month",
                      preset: commitment.kind === "invoice" ? "cards" : "fixed",
                    },
                    dashboard.month,
                  )
                }
                type="button"
              >
                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center">
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {formatCommitmentTitle(commitment, cardNameById)}
                    </p>
                    <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5">
                      {commitment.kind === "invoice"
                        ? "Fatura de cartão"
                        : "Despesa fixa"}
                    </p>
                  </div>

                  <div className="flex flex-col md:items-center">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span
                        className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full mr-1",
                          commitment.status === "partial"
                            ? "bg-amber-400"
                            : "bg-slate-300",
                        )}
                      />
                      Vence em{" "}
                      <strong className="text-slate-700">
                        {formatDate(commitment.due_date)}
                      </strong>
                    </span>
                  </div>

                  <div className="flex flex-col md:items-end">
                    <MoneyValue
                      value={commitment.amount}
                      className="text-sm font-bold text-slate-900 tabular-nums"
                    />
                    <p className="text-[11px] text-slate-400">
                      {formatCommitmentCategory(commitment.category_id)}
                    </p>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors shrink-0 ml-2" />
              </button>
            ))}
            {pendingCommitments.length > 5 && (
              <div className="p-2 border-t border-slate-50">
                <Button
                  variant="ghost"
                  className="w-full text-xs font-semibold text-slate-500 hover:text-primary transition-colors h-9"
                  onClick={() =>
                    onOpenLedgerFiltered({ period: "month" }, dashboard.month)
                  }
                >
                  Ver mais {pendingCommitments.length - 5} compromisso
                  {pendingCommitments.length - 5 > 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
