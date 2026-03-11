import { Pencil, Plus } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import type { AccountSummary, CardSummary } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import { accountName, renderStatusBadge } from "./shared";

type ManageCardsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: CardSummary[];
  accounts: AccountSummary[];
  onAddCard: () => void;
  onEditCard: (card: CardSummary) => void;
  onToggleCardActive: (card: CardSummary) => void;
};

export function ManageCardsSheet({
  open,
  onOpenChange,
  cards,
  accounts,
  onAddCard,
  onEditCard,
  onToggleCardActive,
}: ManageCardsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-md flex-col overflow-hidden border-l-0 bg-slate-50 p-0 sm:max-w-lg">
        <div className="flex flex-col border-b border-slate-200 bg-white px-6 py-6 sm:px-8">
          <SheetHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-2xl font-black text-slate-900">Gerenciar cartões</SheetTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-4 font-black"
                onClick={() => {
                  onAddCard();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo
              </Button>
            </div>
            <SheetDescription className="font-bold text-slate-400">
              Administre os limites, ciclos e status dos cartões da carteira.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-auto p-6 sm:p-8">
          <div className="space-y-4">
            {cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm font-bold text-slate-400">Nenhum cartão cadastrado ainda.</p>
              </div>
            ) : (
              cards.map((card) => (
                <div
                  key={card.card_id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <strong className="text-lg font-black tracking-tight text-slate-900">{card.name}</strong>
                        {renderStatusBadge(card.is_active ? "open" : "inactive")}
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        Limite {formatCurrency(card.limit)} • Fecha dia {card.closing_day} • Vence dia {card.due_day}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Conta: {accountName(card.payment_account_id, accounts)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl font-bold"
                      onClick={() => onEditCard(card)}
                    >
                      <Pencil className="mr-2 h-4 w-4 text-slate-400" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant={card.is_active ? "ghost" : "secondary"}
                      className={`h-10 rounded-xl font-bold ${
                        card.is_active
                          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          : "text-slate-700"
                      }`}
                      onClick={() => onToggleCardActive(card)}
                    >
                      {card.is_active ? "Desativar" : "Reativar"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
