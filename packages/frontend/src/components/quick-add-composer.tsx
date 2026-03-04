import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
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
  const [activeTab, setActiveTab] = useState<
    "expense" | "income" | "transfer" | "card" | "invoice"
  >("expense");

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod] = useState<PaymentMethod>("PIX");
  const [keepOpen, setKeepOpen] = useState(false);
  const [toAccountId, setToAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [invoiceId, setInvoiceId] = useState("");

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

  const categoryOptions = getCategoryOptions(categoryId);

  function resetForm() {
    setAmount("");
    setDescription("");
    setCategoryId("");
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
      if (activeTab === "expense" || activeTab === "income") {
        await onSubmitTransaction({
          type: activeTab,
          description,
          amountInCents,
          accountId,
          paymentMethod,
          categoryId: categoryId || "other",
          occurredAt: `${date}T12:00:00Z`,
          forceKeepContext: keepOpen,
        });
      } else if (activeTab === "transfer") {
        await onSubmitTransfer({
          description,
          amountInCents,
          fromAccountId: accountId,
          toAccountId,
          occurredAt: `${date}T12:00:00Z`,
        });
      } else if (activeTab === "card") {
        await onSubmitCardPurchase({
          description,
          amountInCents,
          cardId,
          categoryId: categoryId || "other",
          purchaseDate: `${date}T12:00:00Z`,
          installmentsCount: parseInt(installments, 10) || 1,
        });
      } else if (activeTab === "invoice") {
        await onSubmitInvoicePayment({
          invoiceId,
          accountId,
          amountInCents,
          paidAt: `${date}T12:00:00Z`,
        });
      }

      if (keepOpen && (activeTab === "expense" || activeTab === "income")) {
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
            <DialogTitle className="text-xl font-semibold">Lançamento</DialogTitle>
            <DialogDescription>
              Registre um lançamento sem sair da tela atual.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="w-full"
        >
          <div className="border-b border-border/40 px-6">
            <TabsList className="h-12 w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
              <TabsTrigger
                value="expense"
                className="rounded-full px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Despesa
              </TabsTrigger>
              <TabsTrigger
                value="income"
                className="rounded-full px-4 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none"
              >
                Receita
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="rounded-full px-4 data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-700 data-[state=active]:shadow-none"
              >
                Transferência
              </TabsTrigger>
              <TabsTrigger
                value="card"
                className="rounded-full px-4 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-700 data-[state=active]:shadow-none"
              >
                Cartão
              </TabsTrigger>
              <TabsTrigger
                value="invoice"
                className="rounded-full px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                Pagamento de fatura
              </TabsTrigger>
            </TabsList>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
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
              <div className="col-span-2 space-y-2">
                <Label>Descrição</Label>
                <Input
                  className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                  placeholder="No que você gastou?"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              {(activeTab === "expense" || activeTab === "income" || activeTab === "card") && (
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Label>Categoria</Label>
                  <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                    <SelectTrigger
                      aria-label="Categoria"
                      className="h-11 border-transparent bg-muted/50"
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="col-span-2 space-y-2 md:col-span-1">
                <Label>Data</Label>
                <Input
                  type="date"
                  className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              {(activeTab === "expense" ||
                activeTab === "income" ||
                activeTab === "transfer" ||
                activeTab === "invoice") && (
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Label>{activeTab === "transfer" ? "Conta origem" : "Conta"}</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger
                      aria-label={activeTab === "transfer" ? "Conta origem" : "Conta"}
                      className="h-11 border-transparent bg-muted/50"
                    >
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeTab === "transfer" && (
                <div className="col-span-2 space-y-2 md:col-span-1">
                  <Label>Conta destino</Label>
                  <Select value={toAccountId} onValueChange={setToAccountId}>
                    <SelectTrigger aria-label="Conta destino" className="h-11 border-transparent bg-muted/50">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.account_id} value={account.account_id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {activeTab === "card" && (
                <>
                  <div className="col-span-2 space-y-2 md:col-span-1">
                    <Label>Cartão</Label>
                    <Select value={cardId} onValueChange={setCardId}>
                      <SelectTrigger aria-label="Cartão" className="h-11 border-transparent bg-muted/50">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {cards.map((card) => (
                          <SelectItem key={card.card_id} value={card.card_id}>
                            {card.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2 md:col-span-1">
                    <Label>Parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={48}
                      className="h-11 border-transparent bg-muted/50"
                      value={installments}
                      onChange={(event) => setInstallments(event.target.value)}
                    />
                  </div>
                </>
              )}

              {activeTab === "invoice" && (
                <>
                  <div className="col-span-2 rounded-2xl bg-primary/5 px-4 py-3 text-sm font-medium text-primary/80">
                    Quitar saldo do cartao usando uma conta existente.
                  </div>
                  <div className="col-span-2 space-y-2 md:col-span-1">
                    <Label>Fatura</Label>
                    <Select value={invoiceId} onValueChange={setInvoiceId}>
                      <SelectTrigger aria-label="Fatura" className="h-11 border-transparent bg-muted/50">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {invoices
                          .filter((invoice) => invoice.status !== "PAID")
                          .map((invoice) => {
                          const cardName =
                            cards.find((card) => card.card_id === invoice.card_id)?.name || "Cartão";

                          return (
                            <SelectItem key={invoice.invoice_id} value={invoice.invoice_id}>
                              {cardName} - {format(new Date(invoice.due_date), "dd/MM")}
                            </SelectItem>
                          );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              {activeTab === "expense" || activeTab === "income" ? (
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
                Lançar
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
