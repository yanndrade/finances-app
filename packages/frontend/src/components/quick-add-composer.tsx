import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { format } from "date-fns";
import { z } from "zod";

import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";

import type {
  AccountSummary,
  CardPurchasePayload,
  CardSummary,
  CashTransactionPayload,
  InvestmentMovementPayload,
  InvoicePaymentPayload,
  InvoiceSummary,
  TransferPayload,
} from "../lib/api";
import { getCategoryOptions } from "../lib/categories";
import {
  createInitialQuickAddState,
  quickAddReducer,
  type EntryType,
  type ExpensePaymentMode,
  type InvestmentMode,
  type TransferMode,
  type QuickAddValidationErrors,
} from "./quick-add/use-quick-add-reducer";

type PaymentMethod = "PIX" | "CASH" | "OTHER";
export type QuickAddPreset =
  | "expense"
  | "income"
  | "transfer_internal"
  | "transfer_invoice_payment"
  | "investment_contribution"
  | "investment_withdrawal"
  | "expense_card";

const MOBILE_QUERY = "(max-width: 900px)";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ENTER_SUBMIT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "password",
  "tel",
  "url",
  "number",
]);

type QuickAddComposerProps = {
  isOpen: boolean;
  onClose: () => void;
  preset?: QuickAddPreset;
  presetInvoiceId?: string;
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  onSubmitTransaction: (
    payload: CashTransactionPayload & { forceKeepContext?: boolean },
  ) => Promise<void>;
  onSubmitTransfer: (payload: TransferPayload) => Promise<void>;
  onSubmitCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
  onSubmitInvoicePayment: (payload: InvoicePaymentPayload) => Promise<void>;
  onSubmitInvestmentMovement: (payload: InvestmentMovementPayload) => Promise<void>;
  isSubmitting?: boolean;
};

export function QuickAddComposer({
  isOpen,
  onClose,
  preset,
  presetInvoiceId,
  accounts,
  cards,
  invoices,
  onSubmitTransaction,
  onSubmitTransfer,
  onSubmitCardPurchase,
  onSubmitInvoicePayment,
  onSubmitInvestmentMovement,
  isSubmitting,
}: QuickAddComposerProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [quickAddState, dispatchQuickAdd] = useReducer(
    quickAddReducer,
    createInitialQuickAddState({
      defaultAccountId: "",
      today: format(new Date(), "yyyy-MM-dd"),
    }),
  );
  const {
    entryType,
    expensePaymentMode,
    transferMode,
    investmentMode,
    date,
    accountId,
    keepOpen,
    toAccountId,
    installments,
    invoiceId,
    dividendAmount,
    investedReductionAmount,
    validationErrors,
  } = quickAddState;
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [personId, setPersonId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");

  const categoryOptions = getCategoryOptions(categoryId);
  const openInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status.toLowerCase() !== "paid"),
    [invoices],
  );

  useEffect(() => {
    if (isOpen && accounts.length > 0 && !accountId) {
      dispatchQuickAdd({
        type: "accountChanged",
        accountId: accounts[0].account_id,
      });
    }
  }, [isOpen, accounts, accountId]);

  useEffect(() => {
    if (isOpen && cards.length > 0 && !cardId) {
      setCardId(cards[0].card_id);
    }
  }, [isOpen, cards, cardId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    amountInputRef.current?.focus();
  }, [isOpen, isMobile, entryType, expensePaymentMode, transferMode, investmentMode]);

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
        dispatchQuickAdd({
          type: "toAccountChanged",
          accountId: fallbackAccount.account_id,
        });
      }
      return;
    }

    dispatchQuickAdd({ type: "toAccountChanged", accountId: "" });

    if (presetInvoiceId && invoiceId !== presetInvoiceId) {
      const selectedInvoice = openInvoices.find((invoice) => invoice.invoice_id === presetInvoiceId);
      if (selectedInvoice) {
        dispatchQuickAdd({ type: "invoiceChanged", invoiceId: selectedInvoice.invoice_id });
        return;
      }
    }

    if (!invoiceId && openInvoices.length > 0) {
      dispatchQuickAdd({ type: "invoiceChanged", invoiceId: openInvoices[0].invoice_id });
    }
  }, [accountId, accounts, entryType, invoiceId, openInvoices, presetInvoiceId, toAccountId, transferMode]);

  useEffect(() => {
    if (!isOpen || !preset) {
      return;
    }

    dispatchQuickAdd({ type: "validationErrorsSet", errors: {} });

    switch (preset) {
      case "expense":
      case "income":
        dispatchQuickAdd({ type: "entryTypeChanged", entryType: preset });
        return;
      case "expense_card":
        dispatchQuickAdd({ type: "entryTypeChanged", entryType: "expense" });
        dispatchQuickAdd({ type: "expensePaymentModeChanged", mode: "CARD" });
        return;
      case "transfer_internal":
        dispatchQuickAdd({ type: "entryTypeChanged", entryType: "transfer" });
        dispatchQuickAdd({ type: "transferModeChanged", mode: "internal" });
        return;
      case "transfer_invoice_payment":
        dispatchQuickAdd({ type: "entryTypeChanged", entryType: "transfer" });
        dispatchQuickAdd({ type: "transferModeChanged", mode: "invoice_payment" });
        if (presetInvoiceId) {
          const selectedInvoice = openInvoices.find((invoice) => invoice.invoice_id === presetInvoiceId);
          if (selectedInvoice) {
            dispatchQuickAdd({ type: "invoiceChanged", invoiceId: selectedInvoice.invoice_id });
            return;
          }
        }
        if (openInvoices.length > 0) {
          dispatchQuickAdd({ type: "invoiceChanged", invoiceId: openInvoices[0].invoice_id });
        }
        return;
      case "investment_contribution":
        dispatchQuickAdd({ type: "entryTypeChanged", entryType: "investment" });
        dispatchQuickAdd({ type: "investmentModeChanged", mode: "contribution" });
        return;
      case "investment_withdrawal":
        dispatchQuickAdd({ type: "entryTypeChanged", entryType: "investment" });
        dispatchQuickAdd({ type: "investmentModeChanged", mode: "withdrawal" });
        return;
      default:
        return;
    }
  }, [isOpen, openInvoices, preset, presetInvoiceId]);

  function resetForm() {
    setAmount("");
    setDescription("");
    setPersonId("");
    setCategoryId("");
    dispatchQuickAdd({
      type: "reset",
      defaultAccountId: accountId,
      today: date,
    });
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

  function validateForm(amountInCents: number): boolean {
    const nextErrors: QuickAddValidationErrors = {};
    const amountResult = z
      .number()
      .int()
      .positive("Informe um valor maior que zero.")
      .safeParse(amountInCents);
    const dateResult = z
      .string()
      .regex(DATE_PATTERN, "Informe uma data valida.")
      .safeParse(date);
    const accountResult = z.string().min(1, "Selecione uma conta.").safeParse(accountId);

    if (!amountResult.success) {
      nextErrors.amount = amountResult.error.issues[0]?.message;
    }
    if (!dateResult.success) {
      nextErrors.date = dateResult.error.issues[0]?.message;
    }
    if (!accountResult.success) {
      nextErrors.accountId = accountResult.error.issues[0]?.message;
    }

    if (entryType === "transfer" && transferMode === "internal") {
      const destinationResult = z
        .string()
        .min(1, "Selecione a conta de destino.")
        .safeParse(toAccountId);

      if (!destinationResult.success) {
        nextErrors.toAccountId = destinationResult.error.issues[0]?.message;
      } else if (toAccountId === accountId) {
        nextErrors.toAccountId = "A conta de destino deve ser diferente da origem.";
      }
    }

    if (entryType === "transfer" && transferMode === "invoice_payment") {
      const invoiceResult = z
        .string()
        .min(1, "Selecione uma fatura em aberto.")
        .safeParse(invoiceId);
      if (!invoiceResult.success) {
        nextErrors.invoiceId = invoiceResult.error.issues[0]?.message;
      }
    }

    if (entryType === "expense" && expensePaymentMode === "CARD") {
      const cardResult = z.string().min(1, "Selecione um cartao.").safeParse(cardId);
      const installmentsCount = parseInt(installments, 10);
      const installmentsResult = z
        .number()
        .int()
        .min(1, "Informe de 1 a 48 parcelas.")
        .max(48, "Informe de 1 a 48 parcelas.")
        .safeParse(installmentsCount);

      if (!cardResult.success) {
        nextErrors.cardId = cardResult.error.issues[0]?.message;
      }
      if (!installmentsResult.success) {
        nextErrors.installments = installmentsResult.error.issues[0]?.message;
      }
    }

    dispatchQuickAdd({ type: "validationErrorsSet", errors: nextErrors });
    return Object.keys(nextErrors).length === 0;
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const target = event.target as HTMLElement;
    if (
      !(target instanceof HTMLInputElement) ||
      !ENTER_SUBMIT_INPUT_TYPES.has(target.type) ||
      target.disabled ||
      target.readOnly
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const amountInCents = parseAmount(amount);
    if (!validateForm(amountInCents)) {
      return;
    }

    try {
      if (entryType === "investment") {
        if (investmentMode === "contribution") {
          await onSubmitInvestmentMovement({
            type: "contribution",
            accountId,
            occurredAt: `${date}T12:00:00Z`,
            contributionAmountInCents: amountInCents,
            dividendAmountInCents: parseAmount(dividendAmount),
            description,
          });
        } else {
          const investedAmount = parseAmount(investedReductionAmount) || amountInCents;
          await onSubmitInvestmentMovement({
            type: "withdrawal",
            accountId,
            occurredAt: `${date}T12:00:00Z`,
            cashAmountInCents: amountInCents,
            investedAmountInCents: investedAmount,
            description,
          });
        }
      } else if (entryType === "transfer") {
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
        const cardPurchasePayload: CardPurchasePayload = {
          description,
          amountInCents,
          cardId,
          categoryId: categoryId || "other",
          purchaseDate: `${date}T12:00:00Z`,
          installmentsCount: parseInt(installments, 10) || 1,
        };
        const trimmedPersonId = personId.trim();
        if (trimmedPersonId.length > 0) {
          cardPurchasePayload.personId = trimmedPersonId;
        }

        await onSubmitCardPurchase(cardPurchasePayload);
      } else {
        const transactionPayload: CashTransactionPayload & { forceKeepContext?: boolean } = {
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
        };
        const trimmedPersonId = personId.trim();
        if (trimmedPersonId.length > 0) {
          transactionPayload.personId = trimmedPersonId;
        }

        await onSubmitTransaction(transactionPayload);
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

  const formContent = (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6 p-6 pt-2">
      <div className="flex flex-col items-center justify-center py-2">
        <div className="mb-1 font-semibold text-muted-foreground">R$</div>
        <input
          ref={amountInputRef}
          className="w-full max-w-[300px] bg-transparent text-center text-4xl font-bold outline-none placeholder:text-muted-foreground/30 md:text-5xl"
          placeholder="0,00"
          value={amount}
          onChange={(event) => {
            setAmount(formatAmountInput(event.target.value));
            dispatchQuickAdd({
              type: "validationErrorsPatched",
              errors: { amount: undefined },
            });
          }}
        />
        <FieldError message={validationErrors.amount} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2 md:col-span-1">
          <Label htmlFor="quick-add-type">Tipo</Label>
          <select
            id="quick-add-type"
            aria-label="Tipo"
            className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
            onChange={(event) =>
              dispatchQuickAdd({
                type: "entryTypeChanged",
                entryType: event.target.value as EntryType,
              })}
            value={entryType}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            <option value="transfer">Transferencia</option>
            <option value="investment">Investimento</option>
          </select>
        </div>

        <div className="col-span-2 space-y-2 md:col-span-1">
          <Label htmlFor="quick-add-date">Data</Label>
          <Input
            id="quick-add-date"
            type="date"
            className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
            value={date}
            onChange={(event) => {
              dispatchQuickAdd({ type: "dateChanged", date: event.target.value });
              dispatchQuickAdd({
                type: "validationErrorsPatched",
                errors: { date: undefined },
              });
            }}
          />
          <FieldError message={validationErrors.date} />
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
            <Label htmlFor="quick-add-person">Pessoa relacionada</Label>
            <Input
              id="quick-add-person"
              className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
              placeholder="Opcional"
              value={personId}
              onChange={(event) => setPersonId(event.target.value)}
            />
          </div>
        ) : null}

        {entryType === "expense" ? (
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="quick-add-payment-mode">Modo de pagamento</Label>
            <select
              id="quick-add-payment-mode"
              aria-label="Modo de pagamento"
              className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "expensePaymentModeChanged",
                  mode: event.target.value as ExpensePaymentMode,
                })
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
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "transferModeChanged",
                  mode: event.target.value as TransferMode,
                })}
              value={transferMode}
            >
              <option value="internal">Entre contas</option>
              <option value="invoice_payment">Quitar fatura</option>
            </select>
          </div>
        ) : null}

        {entryType === "investment" ? (
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="quick-add-investment-mode">Tipo do movimento</Label>
            <select
              id="quick-add-investment-mode"
              aria-label="Tipo do movimento"
              className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "investmentModeChanged",
                  mode: event.target.value as InvestmentMode,
                })}
              value={investmentMode}
            >
              <option value="contribution">Aporte</option>
              <option value="withdrawal">Resgate</option>
            </select>
          </div>
        ) : null}

        {entryType === "expense" || entryType === "income" ? (
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

        {entryType === "investment" && investmentMode === "contribution" ? (
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="quick-add-dividend-amount">Dividendos (opcional)</Label>
            <Input
              id="quick-add-dividend-amount"
              aria-label="Dividendos"
              className="h-11 border-transparent bg-muted/50"
              value={dividendAmount}
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "dividendAmountChanged",
                  amount: formatAmountInput(event.target.value),
                })}
              placeholder="0,00"
            />
          </div>
        ) : null}

        {entryType === "investment" && investmentMode === "withdrawal" ? (
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="quick-add-invested-reduction">Reducao do investido</Label>
            <Input
              id="quick-add-invested-reduction"
              aria-label="Reducao do investido"
              className="h-11 border-transparent bg-muted/50"
              value={investedReductionAmount}
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "investedReductionAmountChanged",
                  amount: formatAmountInput(event.target.value),
                })}
              placeholder="0,00"
            />
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
            onChange={(event) => {
              dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
              dispatchQuickAdd({
                type: "validationErrorsPatched",
                errors: { accountId: undefined },
              });
            }}
            value={accountId}
          >
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.name}
              </option>
            ))}
          </select>
          <FieldError message={validationErrors.accountId} />
        </div>

        {entryType === "transfer" && transferMode === "internal" ? (
          <div className="col-span-2 space-y-2 md:col-span-1">
            <Label htmlFor="quick-add-destination-account">Conta destino</Label>
            <select
              id="quick-add-destination-account"
              aria-label="Conta destino"
              className="h-11 w-full rounded-md border border-input bg-muted/50 px-3"
              onChange={(event) => {
                dispatchQuickAdd({ type: "toAccountChanged", accountId: event.target.value });
                dispatchQuickAdd({
                  type: "validationErrorsPatched",
                  errors: { toAccountId: undefined },
                });
              }}
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
            <FieldError message={validationErrors.toAccountId} />
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
                onChange={(event) => {
                  dispatchQuickAdd({ type: "invoiceChanged", invoiceId: event.target.value });
                  dispatchQuickAdd({
                    type: "validationErrorsPatched",
                    errors: { invoiceId: undefined },
                  });
                }}
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
              <FieldError message={validationErrors.invoiceId} />
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
                onChange={(event) => {
                  setCardId(event.target.value);
                  dispatchQuickAdd({
                    type: "validationErrorsPatched",
                    errors: { cardId: undefined },
                  });
                }}
                value={cardId}
              >
                {cards.map((card) => (
                  <option key={card.card_id} value={card.card_id}>
                    {card.name}
                  </option>
                ))}
              </select>
              <FieldError message={validationErrors.cardId} />
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
                onChange={(event) => {
                  dispatchQuickAdd({
                    type: "installmentsChanged",
                    installments: event.target.value,
                  });
                  dispatchQuickAdd({
                    type: "validationErrorsPatched",
                    errors: { installments: undefined },
                  });
                }}
              />
              <FieldError message={validationErrors.installments} />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-2">
        {entryType === "expense" || entryType === "income"
          ? expensePaymentMode !== "CARD" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepOpen"
                  checked={keepOpen}
                  onCheckedChange={(checked: boolean | "indeterminate") =>
                    dispatchQuickAdd({
                      type: "keepOpenChanged",
                      keepOpen: checked === true,
                    })
                  }
                />
                <label
                  htmlFor="keepOpen"
                  className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Salvar e adicionar outra
                </label>
              </div>
            )
          : <div />}

        <Button
          disabled={isSubmitting || !amount}
          type="submit"
          size="lg"
          className="rounded-xl px-8 shadow-lg shadow-primary/20"
        >
          Lancar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Enter salva. Tab navega pelos campos.</p>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent
          data-testid="quick-add-drawer"
          className="max-h-[92vh] overflow-hidden rounded-t-[1.75rem] border bg-background"
        >
          <div className="overflow-y-auto px-2 pb-4">
            <DrawerHeader className="px-4 pb-2 pt-6">
              <DrawerTitle className="text-xl font-semibold">Lancar</DrawerTitle>
              <DrawerDescription>
                Registre um lancamento sem sair da tela atual.
              </DrawerDescription>
            </DrawerHeader>
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        data-testid="quick-add-dialog"
        className="sm:max-w-[550px] overflow-hidden rounded-3xl border bg-background p-0 shadow-2xl"
      >
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Lancar</DialogTitle>
            <DialogDescription>
              Registre um lancamento sem sair da tela atual.
            </DialogDescription>
          </DialogHeader>
        </div>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-medium text-rose-600">{message}</p>;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}


