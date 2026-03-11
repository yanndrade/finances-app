import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../../components/ui/drawer";
import { Button } from "../../../components/ui/button";
import { formatCategoryName, formatCurrency, formatDate, formatPaymentMethod } from "../../../lib/format";
import type { PendingExpenseSummary } from "../../../lib/api";
import { getTemporalStatus } from "../helpers/temporal-status";

type DetailDrawerProps = {
  pending: PendingExpenseSummary | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  accountNameById: Map<string, string>;
  cardNameById: Map<string, string>;
  onConfirm: (id: string) => void;
  onViewHistory: () => void;
  isSubmitting: boolean;
};

export function DetailDrawer({
  pending,
  isOpen,
  onOpenChange,
  accountNameById,
  cardNameById,
  onConfirm,
  onViewHistory,
  isSubmitting,
}: DetailDrawerProps) {
  if (!pending) return null;

  const isConfirmed = pending.status === "confirmed";
  const status = getTemporalStatus(pending.due_date, pending.status);

  const sourceName =
    pending.payment_method === "CARD"
      ? cardNameById.get(pending.card_id ?? "") ?? pending.card_id ?? "Cartão"
      : accountNameById.get(pending.account_id ?? "") ?? pending.account_id ?? "Conta";

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle className="text-xl">{pending.name}</DrawerTitle>
            <DrawerDescription>
              Detalhes da pendência gerada neste mês
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-4 pb-0 space-y-4">
            <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-2xl">
              <span className="text-sm text-slate-500 font-medium">Valor a pagar</span>
              <span className="text-3xl font-black text-slate-900 tabular-nums">
                {formatCurrency(pending.amount)}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Status</span>
                <span className="text-sm font-semibold capitalize">
                  {status === "paid" ? "Pago" : status === "overdue" ? "Atrasado" : status === "due_today" ? "Vence hoje" : "A vencer"}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Vencimento</span>
                <span className="text-sm font-semibold">
                  {formatDate(pending.due_date)}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Categoria</span>
                <span className="text-sm font-semibold">
                  {formatCategoryName(pending.category_id)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Pagamento</span>
                <span className="text-sm font-semibold">
                  {formatPaymentMethod(pending.payment_method)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Origem</span>
                <span className="text-sm font-semibold">
                  {sourceName}
                </span>
              </div>

              {pending.description && (
                <div className="flex flex-col gap-1 py-2">
                  <span className="text-sm text-slate-500">Descrição</span>
                  <span className="text-sm">{pending.description}</span>
                </div>
              )}
            </div>
          </div>
          
          <DrawerFooter>
            {isConfirmed ? (
              <Button onClick={onViewHistory} variant="outline" className="w-full">
                Ver no histórico
              </Button>
            ) : (
              <Button 
                onClick={() => onConfirm(pending.pending_id)} 
                disabled={isSubmitting}
                className="w-full"
              >
                Pagar agora
              </Button>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
