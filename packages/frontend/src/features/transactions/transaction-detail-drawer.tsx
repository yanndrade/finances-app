import {
  Calendar,
  CreditCard,
  History,
  Info,
  Layout,
  MoreHorizontal,
  Receipt,
  Split,
  User,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { MoneyValue } from "../../components/ui/money-value";
import {
  formatCategoryName,
  formatCurrency,
  formatDateTime,
  formatPaymentMethod,
  formatTransactionType,
  humanizeLedgerId,
} from "../../lib/format";
import { cn } from "../../lib/utils";
import type {
  AccountSummary,
  CardSummary,
  TransactionSummary,
} from "../../lib/api";

type TransactionDetailDrawerProps = {
  transaction: TransactionSummary | null;
  accounts: AccountSummary[];
  cards: CardSummary[];
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (transaction: TransactionSummary) => void;
  onVoid?: (transactionId: string) => void;
  onStartSplit?: () => void;
};

export function TransactionDetailDrawer({
  transaction,
  accounts,
  cards,
  isOpen,
  onClose,
  onEdit,
  onVoid,
  onStartSplit,
}: TransactionDetailDrawerProps) {
  if (!transaction) return null;

  const isReadOnly =
    transaction.status === "readonly" ||
    transaction.ledger_event_type === "invoice_payment" ||
    transaction.ledger_event_type === "card_purchase";
  const isVoided = transaction.status === "voided";

  const cardId = extractCardId(transaction);
  const card = cards.find((candidate) => candidate.card_id === cardId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l shadow-2xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{transaction.description || formatCategoryName(transaction.category_id)}</SheetTitle>
          <SheetDescription>
            {`${formatTransactionType(transaction.type)} em ${formatDateTime(transaction.occurred_at)} no valor de ${formatCurrency(transaction.amount)}.`}
          </SheetDescription>
        </SheetHeader>
        <header className="px-5 pt-6 pb-5 border-b bg-slate-50/50">
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                    transaction.type === "income"
                      ? "bg-emerald-100 text-emerald-700"
                      : transaction.type === "expense"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-700",
                  )}
                >
                  {formatTransactionType(transaction.type)}
                </span>
                {isReadOnly ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 flex items-center gap-1">
                    <Info className="h-2.5 w-2.5" />
                    Auto
                  </span>
                ) : null}
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                {transaction.description || formatCategoryName(transaction.category_id)}
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {formatDateTime(transaction.occurred_at)}
              </p>
            </div>
            <MoneyValue
              value={transaction.amount}
              className="text-2xl font-bold tracking-tight text-slate-900"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <History className="h-3.5 w-3.5" />
              Resumo da Operação
            </h3>
            <div className="grid grid-cols-2 gap-y-5 gap-x-8 rounded-2xl border border-slate-100 p-5 bg-white shadow-sm">
              <InfoRow
                label="Categoria"
                value={formatCategoryName(transaction.category_id)}
                icon={<Layout className="h-4 w-4 text-primary/60" />}
              />
              <InfoRow
                label="Conta / Origem"
                value={
                  accounts.find((account) => account.account_id === transaction.account_id)?.name ||
                  transaction.account_id
                }
                icon={<Receipt className="h-4 w-4 text-primary/60" />}
              />
              <InfoRow
                label="Forma de Pagamento"
                value={formatPaymentMethod(transaction.payment_method)}
                icon={<CreditCard className="h-4 w-4 text-primary/60" />}
              />
              {transaction.person_id ? (
                <InfoRow
                  label="Pessoa / Reembolso"
                  value={transaction.person_id}
                  icon={<User className="h-4 w-4 text-primary/60" />}
                />
              ) : null}
              <InfoRow
                label="Origem Real"
                value={humanizeLedgerId(transaction.ledger_source, accounts)}
                className="col-span-2"
                icon={<Info className="h-4 w-4 text-primary/60" />}
              />
            </div>
          </section>

          {(card || transaction.ledger_event_type === "invoice_payment") ? (
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <MoreHorizontal className="h-3.5 w-3.5" />
                Relacionamentos
              </h3>
              <div className="rounded-2xl border border-indigo-50 bg-indigo-50/30 p-5 flex items-center gap-4">
                <div className="rounded-xl bg-indigo-100 p-3">
                  <CreditCard className="h-6 w-6 text-indigo-700" />
                </div>
                <div>
                  <h4 className="font-semibold text-indigo-900 leading-none mb-1">
                    {card ? `Cartão ${card.name}` : "Passivo de Cartão"}
                  </h4>
                  <p className="text-sm text-indigo-700/70">
                    {transaction.ledger_event_type === "invoice_payment"
                      ? "Pagamento de fatura consolidada."
                      : "Lançamento afetando limite do cartão."}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="space-y-4 pb-12">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Split className="h-3.5 w-3.5" />
                Classificação & Split
              </h3>
              {!isReadOnly && onStartSplit ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStartSplit}
                  className="h-7 text-[11px] rounded-lg"
                >
                  Iniciar Split
                </Button>
              ) : null}
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 flex flex-col items-center justify-center text-center bg-slate-50/30">
              <p className="text-sm text-slate-500 italic">
                Nenhuma divisão de categorias aplicada.
              </p>
            </div>
          </section>
        </div>

        <footer className="px-6 py-6 border-t bg-white flex items-center gap-3">
          {!isReadOnly && !isVoided ? (
            <>
              <Button
                onClick={() => onEdit?.(transaction)}
                className="flex-1 bg-primary text-white rounded-xl h-11 font-bold shadow-md hover:bg-primary/90"
              >
                Editar Transação
              </Button>
              <Button
                variant="ghost"
                onClick={() => onVoid?.(transaction.transaction_id)}
                className="text-rose-600 hover:bg-rose-50 rounded-xl h-11 px-6 border border-rose-100"
              >
                Estornar
              </Button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 text-slate-400 text-sm font-medium">
              <Info className="h-4 w-4" />
              Lançamento protegido contra alterações manuais.
            </div>
          )}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
        {label}
      </span>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function extractCardId(transaction: TransactionSummary): string | null {
  const ledgerSource = transaction.ledger_source ?? "";
  if (ledgerSource.startsWith("card_liability:")) {
    return ledgerSource.slice("card_liability:".length);
  }
  return null;
}

