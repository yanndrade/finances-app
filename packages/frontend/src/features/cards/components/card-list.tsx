import { ArrowRight, CreditCard, History } from "lucide-react";

import { EmptyState } from "../../../components/ui/empty-state";
import { Progress } from "../../../components/ui/progress";
import type { CardSummary, InvoiceSummary } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import { getDisplayedInvoiceAmount, renderInvoiceStatusBadge } from "./shared";

type CardListProps = {
  activeCards: CardSummary[];
  invoicesByCard: Map<string, InvoiceSummary>;
  onSelectCard: (cardId: string) => void;
  onOpenHistory: (cardId: string, referenceMonth: string) => void;
  onOpenManageCards?: () => void;
};

export function CardList({ activeCards, invoicesByCard, onSelectCard, onOpenHistory, onOpenManageCards }: CardListProps) {
  if (activeCards.length === 0) {
    return (
      <EmptyState
        className="py-16"
        icon={CreditCard}
        title="Nenhum cartão ativo"
        description="Adicione um cartão para acompanhar faturas, limites e gastos parcelados."
        action={onOpenManageCards ? { label: "Gerenciar cartões", onClick: onOpenManageCards } : undefined}
      />
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {activeCards.map((card) => {
        const currentInvoice = invoicesByCard.get(card.card_id);
        const invoiceAmount = currentInvoice ? getDisplayedInvoiceAmount(currentInvoice) : 0;
        const futureInstallments = card.future_installment_total ?? 0;
        const remainingAmount = currentInvoice?.remaining_amount ?? 0;

        const committedLimit = remainingAmount + futureInstallments;
        const availableLimit = Math.max(card.limit - committedLimit, 0);
        const limitUsage = card.limit > 0 ? Math.min((committedLimit / card.limit) * 100, 100) : 0;

        return (
          <div
            key={card.card_id}
            className="flex items-center gap-4 px-1 py-3.5 hover:bg-muted/30 transition-colors rounded-lg -mx-1"
          >
            {/* Nome + ciclo — fixo */}
            <div className="w-40 shrink-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold text-foreground">{card.name}</span>
                {currentInvoice && renderInvoiceStatusBadge(currentInvoice, card)}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Fecha {card.closing_day} · Vence {card.due_day}
              </p>
            </div>

            {/* Fatura — fixo */}
            <div className="w-28 shrink-0">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">Fatura</p>
              <p className="mt-0.5 text-base font-black tracking-tight text-foreground">
                {formatCurrency(invoiceAmount)}
              </p>
            </div>

            {/* Barra de limite — cresce para preencher o espaço disponível */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Limite
                </span>
                <span className="text-[13px] font-bold text-muted-foreground">{Math.round(limitUsage)}%</span>
              </div>
              <Progress value={limitUsage} className="h-1 rounded-full bg-border/60" />
              <div className="flex justify-between text-[12px] text-muted-foreground/70">
                <span>Disp. {formatCurrency(availableLimit)}</span>
                <span>{formatCurrency(card.limit)}</span>
              </div>
            </div>

            {/* Ações — encostadas na direita */}
            <div className="flex shrink-0 items-center gap-1 pl-4">
              <button
                type="button"
                onClick={() => {
                  if (currentInvoice) {
                    onOpenHistory(card.card_id, currentInvoice.reference_month);
                  }
                }}
                disabled={!currentInvoice}
                aria-label="Histórico"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onSelectCard(card.card_id)}
                className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-bold text-primary transition-colors hover:bg-primary/5"
              >
                Detalhes
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
