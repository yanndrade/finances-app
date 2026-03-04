import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";

import type {
  AccountSummary,
  CardPurchasePayload,
  CardSummary,
  CashTransactionPayload,
  InvoicePaymentPayload,
  InvoiceSummary,
  TransferPayload,
} from "../lib/api";
import { getCategoryOptions } from "../lib/categories";

type PaymentMethod = "PIX" | "CASH" | "OTHER";
type EntryType = "expense" | "income" | "transfer";
type ExpensePaymentMode = PaymentMethod | "CARD";
type TransferMode = "internal" | "invoice_payment";

type QuickAddComposerProps = {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  onSubmitTransaction: (
    payload: CashTransactionPayload & { forceKeepContext?: boolean },
  ) => Promise<void>;
  onSubmitTransfer: (payload: TransferPayload) => Promise<void>;
  onSubmitCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
  onSubmitInvoicePayment: (payload: InvoicePaymentPayload) => Promise<void>;
  isSubmitting?: boolean;
};

export function QuickAddComposer({
  isOpen,
  onClose,
  accounts,
  cards,
  invoices,
  onSubmitTransaction,
  onSubmitTransfer,
  onSubmitCardPurchase,
  onSubmitInvoicePayment,
  isSubmitting,
}: QuickAddComposerProps) {
  const [entryType, setEntryType] = useState<EntryType>("expense");
  const [expensePaymentMode, setExpensePaymentMode] = useState<ExpensePaymentMode>("PIX");
  const [transferMode, setTransferMode] = useState<TransferMode>("internal");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [keepOpen, setKeepOpen] = useState(false);
  const [toAccountId, setToAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [invoiceId, setInvoiceId] = useState("");

  const categoryOptions = getCategoryOptions(categoryId);
  const openInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status !== "PAID"),
    [invoices],
  );

  useEffect(() => {
    if (isOpen && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].account_id);
    }
  }, [isOpen, accounts, accountId]);

  useEffect(() => {
    if (isOpen && cards.length > 0 && !cardId) {
      setCardId(cards[0].card_id);
    }
  }, [isOpen, cards, cardId]);

  useEffect(() => {
    if (entryType !== "transfer") {
      setTransferMode("internal");
      setToAccountId("");
      setInvoiceId("");
    }

    if (entryType !== "expense") {
      setExpensePaymentMode("PIX");
      setInstallments("1");
      setKeepOpen(false);
    }
  }, [entryType]);

  useEffect(() => {
    if (expensePaymentMode !== "CARD") {
      setInstallments("1");
    }
  }, [expensePaymentMode]);

  useEffect(() => {
    if (entryType !== "transfer") {
      return;
    }

    if (transferMode === "internal") {
      if (toAccountId) {
        return;
      }

      const fallbackAccount = accounts.find((account) => account.account_id !== accountId);
      if (fallbackAccount) {
        setToAccountId(fallbackAccount.account_id);
      }
      return;
    }

    setToAccountId("");

    if (!invoiceId && openInvoices.length > 0) {
      setInvoiceId(openInvoices[0].invoice_id);
    }
  }, [accountId, accounts, entryType, invoiceId, openInvoices, toAccountId, transferMode]);

  function resetForm() {
    setEntryType("expense");
    setExpensePaymentMode("PIX");
    setTransferMode("internal");
    setAmount("");
    setDescription("");
    setCategoryId("");
    setKeepOpen(false);
    setToAccountId("");
    setInstallments("1");
    setInvoiceId("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function parseAmount(value: string): number {
    const cleaned = value.replace(/\D/g, "");
    return parseInt(cleaned || "0", 10);
  }

  function formatAmountInput(value: string): string {
    const numericValue = parseAmount(value);

    return (numericValue / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const amountInCents = parseAmount(amount);
    if (!amountInCents) {
      return;
    }

    try {
      if (entryType === "transfer") {
        if (transferMode === "invoice_payment") {
          if (!invoiceId) {
            return;
          }

          await onSubmitInvoicePayment({
            invoiceId,
            accountId,
            amountInCents,
            paidAt: `${date}T12:00:00Z`,
          });
        } else {
          if (!toAccountId) {
            return;
          }

          await onSubmitTransfer({
            description,
            amountInCents,
            fromAccountId: accountId,
            toAccountId,
            occurredAt: `${date}T12:00:00Z`,
          });
        }
      } else if (entryType === "expense" && expensePaymentMode === "CARD") {
        await onSubmitCardPurchase({
          description,
          amountInCents,
          cardId,
          categoryId: categoryId || "other",
          purchaseDate: `${date}T12:00:00Z`,
          installmentsCount: parseInt(installments, 10) || 1,
        });
      } else {
        await onSubmitTransaction({
          type: entryType,
          description,
          amountInCents,
          accountId,
          paymentMethod:
            entryType === "expense" && expensePaymentMode !== "CARD"
              ? expensePaymentMode
              : "PIX",
          categoryId: categoryId || "other",
          occurredAt: `${date}T12:00:00Z`,
          forceKeepContext: keepOpen,
        });
      }

      if (keepOpen && entryType !== "transfer" && expensePaymentMode !== "CARD") {
        resetForm();
      } else {
        handleClose();
      }
    } catch {
      // Parent handles mutation feedback.
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] overflow-hidden rounded-3xl border bg-background p-0 shadow-2xl">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Lancar</DialogTitle>
            <DialogDescription>
              Registre um lancamento sem sair da tela atual.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 pt-2">
          <div className="flex flex-col items-center justify-center py-2">
            <div className="mb-1 font-semibold text-muted-foreground">R$</div>
            <input
              autoFocus
              className="w-full max-w-[300px] bg-transparent text-center text-4xl font-bold outline-none placeholder:text-muted-foreground/30 md:text-5xl"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(formatAmountInput(event.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2 md:col-span-1">
              <Label htmlFor="quick-add-type">Tipo</Label>
              <select
                id="quick-add-type"
                aria-label="Tipo"
                className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                onChange={(event) => setEntryType(event.target.value as EntryType)}
                value={entryType}
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>

            <div className="col-span-2 space-y-2 md:col-span-1">
              <Label htmlFor="quick-add-date">Data</Label>
              <Input
                id="quick-add-date"
                type="date"
                className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="quick-add-description">Descricao</Label>
              <Input
                id="quick-add-description"
                className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                placeholder="No que voce gastou?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {entryType === "expense" ? (
              <div className="col-span-2 space-y-2 md:col-span-1">
                <Label htmlFor="quick-add-payment-mode">Modo de pagamento</Label>
                <select
                  id="quick-add-payment-mode"
                  aria-label="Modo de pagamento"
                  className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                  onChange={(event) =>
                    setExpensePaymentMode(event.target.value as ExpensePaymentMode)
                  }
                  value={expensePaymentMode}
                >
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="OTHER">Outro</option>
                  <option value="CARD">Cartao</option>
                </select>
              </div>
            ) : null}

            {entryType === "transfer" ? (
              <div className="col-span-2 space-y-2 md:col-span-1">
                <Label htmlFor="quick-add-transfer-mode">Modo da transferencia</Label>
                <select
                  id="quick-add-transfer-mode"
                  aria-label="Modo da transferencia"
                  className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                  onChange={(event) => setTransferMode(event.target.value as TransferMode)}
                  value={transferMode}
                >
                  <option value="internal">Entre contas</option>
                  <option value="invoice_payment">Quitar fatura</option>
                </select>
              </div>
            ) : null}

            {(entryType === "expense" || entryType === "income") ? (
              <div className="col-span-2 space-y-2 md:col-span-1">
                <Label htmlFor="quick-add-category">Categoria</Label>
                <select
                  id="quick-add-category"
                  aria-label="Categoria"
                  className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                  onChange={(event) => setCategoryId(event.target.value)}
                  value={categoryId}
                >
                  <option value="">Selecione...</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="col-span-2 space-y-2 md:col-span-1">
              <Label htmlFor="quick-add-account">
                {entryType === "transfer" ? "Conta origem" : "Conta"}
              </Label>
              <select
                id="quick-add-account"
                aria-label={entryType === "transfer" ? "Conta origem" : "Conta"}
                className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                onChange={(event) => setAccountId(event.target.value)}
                value={accountId}
              >
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {entryType === "transfer" && transferMode === "internal" ? (
              <div className="col-span-2 space-y-2 md:col-span-1">
                <Label htmlFor="quick-add-destination-account">Conta destino</Label>
                <select
                  id="quick-add-destination-account"
                  aria-label="Conta destino"
                  className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                  onChange={(event) => setToAccountId(event.target.value)}
                  value={toAccountId}
                >
                  <option value="">Selecione...</option>
                  {accounts
                    .filter((account) => account.account_id !== accountId)
                    .map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            {entryType === "transfer" && transferMode === "invoice_payment" ? (
              <>
                <div className="col-span-2 rounded-2xl bg-primary/5 px-4 py-3 text-sm font-medium text-primary/80">
                  Quitar saldo do cartao usando uma conta existente.
                </div>
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Label htmlFor="quick-add-invoice">Fatura</Label>
                  <select
                    id="quick-add-invoice"
                    aria-label="Fatura"
                    className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                    onChange={(event) => setInvoiceId(event.target.value)}
                    value={invoiceId}
                  >
                    <option value="">Selecione...</option>
                    {openInvoices.map((invoice) => {
                      const cardName =
                        cards.find((card) => card.card_id === invoice.card_id)?.name || "Cartao";

                      return (
                        <option key={invoice.invoice_id} value={invoice.invoice_id}>
                          {cardName} - {format(new Date(invoice.due_date), "dd/MM")}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            ) : null}

            {entryType === "expense" && expensePaymentMode === "CARD" ? (
              <>
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Label htmlFor="quick-add-card">Cartao</Label>
                  <select
                    id="quick-add-card"
                    aria-label="Cartao"
                    className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
                    onChange={(event) => setCardId(event.target.value)}
                    value={cardId}
                  >
                    {cards.map((card) => (
                      <option key={card.card_id} value={card.card_id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Label htmlFor="quick-add-installments">Parcelas</Label>
                  <Input
                    id="quick-add-installments"
                    aria-label="Parcelas"
                    type="number"
                    min={1}
                    max={48}
                    className="h-11 border-transparent bg-muted/50"
                    value={installments}
                    onChange={(event) => setInstallments(event.target.value)}
                  />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between pt-4">
            {entryType !== "transfer" && expensePaymentMode !== "CARD" ? (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepOpen"
                  checked={keepOpen}
                  onCheckedChange={(checked: boolean | "indeterminate") =>
                    setKeepOpen(checked === true)
                  }
                />
                <label
                  htmlFor="keepOpen"
                  className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Salvar e adicionar outra
                </label>
              </div>
            ) : (
              <div />
            )}

            <Button
              disabled={isSubmitting || !amount}
              type="submit"
              size="lg"
              className="rounded-xl px-8 shadow-lg shadow-primary/20"
            >
              Lancar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
