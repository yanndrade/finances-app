import { ArrowRight, History } from "lucide-react";

import { Progress } from "../../../components/ui/progress";
import type { CardSummary, InvoiceSummary } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import { EmptySurface, renderStatusBadge } from "./shared";

type CardListProps = {
  activeCards: CardSummary[];
  invoicesByCard: Map<string, InvoiceSummary>;
  onSelectCard: (cardId: string) => void;
  onOpenHistory: (cardId: string, referenceMonth: string) => void;
};

export function CardList({ activeCards, invoicesByCard, onSelectCard, onOpenHistory }: CardListProps) {
  if (activeCards.length === 0) {
    return <EmptySurface message="Nenhum cartão ativo encontrado." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {activeCards.map((card) => {
        const currentInvoice = invoicesByCard.get(card.card_id);
        const invoiceAmount = currentInvoice?.total_amount ?? 0;
        const futureInstallments = card.future_installment_total ?? 0;
        const remainingAmount = currentInvoice?.remaining_amount ?? 0;

        const committedLimit = remainingAmount + futureInstallments;
        const availableLimit = Math.max(card.limit - committedLimit, 0);
        const limitUsage = card.limit > 0 ? Math.min((committedLimit / card.limit) * 100, 100) : 0;

        return (
          <div
            key={card.card_id}
            className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white px-5 py-3 shadow-sm transition-colors hover:border-slate-200"
          >
            {/* Nome + ciclo — fixo */}
            <div className="w-40 shrink-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold text-slate-900">{card.name}</span>
                {currentInvoice && renderStatusBadge(currentInvoice.status)}
              </div>
              <p className="mt-0.5 text-[13px] text-slate-400">
                Fecha {card.closing_day} · Vence {card.due_day}
              </p>
            </div>

            {/* Fatura — fixo */}
            <div className="w-28 shrink-0">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-400">Fatura</p>
              <p className="mt-0.5 text-base font-black tracking-tight text-slate-900">
                {formatCurrency(invoiceAmount)}
              </p>
            </div>

            {/* Barra de limite — cresce para preencher o espaço disponível */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-400">
                  Limite
                </span>
                <span className="text-[13px] font-bold text-slate-500">{Math.round(limitUsage)}%</span>
              </div>
              <Progress value={limitUsage} className="h-1.5 rounded-full bg-slate-100" />
              <div className="flex justify-between text-[12px] text-slate-400">
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
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
