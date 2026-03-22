import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { format } from "date-fns";
import { z } from "zod";
import {
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Repeat,
  Wallet,
} from "lucide-react";

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
  RecurringRulePayload,
} from "../lib/api";
import { getCategoryOptions, type CategoryOption } from "../lib/categories";
import { CategoryManagerDialog } from "../features/categories/category-manager-dialog";
import {
  createInitialQuickAddState,
  quickAddReducer,
  type EntryType,
  type ExpensePaymentMode,
  type RecurringPaymentMode,
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
const QUICK_ADD_SELECT_CLASS_NAME =
  "h-11 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-base leading-tight focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm";

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabConfig = {
  type: EntryType;
  label: string;
  icon: React.ElementType;
  /** Tailwind classes applied to the active tab pill */
  activePill: string;
  /** Tailwind classes applied to the amount block background strip */
  amountBg: string;
  /** Tailwind classes for the amount value text */
  amountText: string;
  /** Tailwind class for the R$ currency label */
  currencyText: string;
  /** Tailwind classes for the mode banner border+bg */
  bannerBorder: string;
  bannerBg: string;
  /** Tailwind class for the submit button */
  submitClass: string;
};

const TAB_CONFIG: TabConfig[] = [
  {
    type: "expense",
    label: "Despesa",
    icon: TrendingDown,
    activePill: "bg-rose-500 text-white shadow-rose-200",
    amountBg: "bg-rose-50/60",
    amountText: "text-rose-600",
    currencyText: "text-rose-400",
    bannerBorder: "border-rose-100",
    bannerBg: "bg-rose-50/70",
    submitClass: "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200",
  },
  {
    type: "income",
    label: "Receita",
    icon: TrendingUp,
    activePill: "bg-emerald-500 text-white shadow-emerald-200",
    amountBg: "bg-emerald-50/60",
    amountText: "text-emerald-600",
    currencyText: "text-emerald-400",
    bannerBorder: "border-emerald-100",
    bannerBg: "bg-emerald-50/70",
    submitClass: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200",
  },
  {
    type: "transfer",
    label: "Transferência",
    icon: ArrowLeftRight,
    activePill: "bg-blue-500 text-white shadow-blue-200",
    amountBg: "bg-blue-50/60",
    amountText: "text-blue-600",
    currencyText: "text-blue-400",
    bannerBorder: "border-blue-100",
    bannerBg: "bg-blue-50/70",
    submitClass: "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-200",
  },
  {
    type: "investment",
    label: "Investimento",
    icon: Wallet,
    activePill: "bg-violet-500 text-white shadow-violet-200",
    amountBg: "bg-violet-50/60",
    amountText: "text-violet-600",
    currencyText: "text-violet-400",
    bannerBorder: "border-violet-100",
    bannerBg: "bg-violet-50/70",
    submitClass: "bg-violet-500 hover:bg-violet-600 text-white shadow-violet-200",
  },
  {
    type: "recurring",
    label: "Gasto Fixo",
    icon: Repeat,
    activePill: "bg-amber-500 text-white shadow-amber-200",
    amountBg: "bg-amber-50/60",
    amountText: "text-amber-600",
    currencyText: "text-amber-400",
    bannerBorder: "border-amber-100",
    bannerBg: "bg-amber-50/70",
    submitClass: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

type QuickAddComposerProps = {
  isOpen: boolean;
  onClose: () => void;
  preset?: QuickAddPreset;
  presetInvoiceId?: string;
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  categories?: CategoryOption[];
  onCreateCategory?: (label: string) => boolean;
  onRemoveCategory?: (categoryId: string) => void;
  onSubmitTransaction: (
    payload: CashTransactionPayload & { forceKeepContext?: boolean },
  ) => Promise<void>;
  onSubmitTransfer: (payload: TransferPayload) => Promise<void>;
  onSubmitCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
  onSubmitInvoicePayment: (payload: InvoicePaymentPayload) => Promise<void>;
  onSubmitInvestmentMovement: (payload: InvestmentMovementPayload) => Promise<void>;
  onSubmitRecurringRule?: (payload: RecurringRulePayload) => Promise<void>;
  isSubmitting?: boolean;
};

type ComposerMode = "quick" | "advanced";

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickAddComposer({
  isOpen,
  onClose,
  preset,
  presetInvoiceId,
  accounts,
  cards,
  invoices,
  categories: externalCategories,
  onCreateCategory,
  onRemoveCategory,
  onSubmitTransaction,
  onSubmitTransfer,
  onSubmitCardPurchase,
  onSubmitInvoicePayment,
  onSubmitInvestmentMovement,
  onSubmitRecurringRule,
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
    recurringPaymentMode,
    dueDay,
    validationErrors,
  } = quickAddState;
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [personId, setPersonId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("quick");

  const activeTab = TAB_CONFIG.find((t) => t.type === entryType) ?? TAB_CONFIG[0];
  const categoryOptions = getCategoryOptions(categoryId, externalCategories);
  const isCardExpense = entryType === "expense" && expensePaymentMode === "CARD";
  const isCardRecurring = entryType === "recurring" && recurringPaymentMode === "CARD";
  const showAccountSelect = !isCardExpense && !isCardRecurring;
  const showCardSelect = isCardExpense || isCardRecurring;
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

    const timeout = globalThis.setTimeout(() => {
      amountInputRef.current?.focus();
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
    };
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

  useEffect(() => {
    const requiresAdvancedMode =
      entryType === "transfer" ||
      entryType === "investment" ||
      (entryType === "expense" && expensePaymentMode === "CARD");

    if (requiresAdvancedMode) {
      setComposerMode("advanced");
    }
  }, [entryType, expensePaymentMode]);

  function resetForm() {
    setAmount("");
    setDescription("");
    setPersonId("");
    setCategoryId("");
    setComposerMode("quick");
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

    if (!amountResult.success) {
      nextErrors.amount = amountResult.error.issues[0]?.message;
    }
    if (!dateResult.success) {
      nextErrors.date = dateResult.error.issues[0]?.message;
    }
    if (!isCardExpense && entryType !== "recurring") {
      const accountResult = z.string().min(1, "Selecione uma conta.").safeParse(accountId);
      if (!accountResult.success) {
        nextErrors.accountId = accountResult.error.issues[0]?.message;
      }
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

    if (entryType === "recurring") {
      const dueDayCount = parseInt(dueDay, 10);
      const dueDayResult = z
        .number()
        .int()
        .min(1, "Dia de vencimento inválido (1-28).")
        .max(28, "Dia de vencimento inválido (1-28).")
        .safeParse(dueDayCount);

      if (!dueDayResult.success) {
        nextErrors.dueDay = dueDayResult.error.issues[0]?.message;
      }

      if (recurringPaymentMode === "CARD") {
        const cardResult = z.string().min(1, "Selecione um cartão.").safeParse(cardId);
        if (!cardResult.success) {
          nextErrors.cardId = cardResult.error.issues[0]?.message;
        }
      } else {
        const accountResult = z.string().min(1, "Selecione uma conta.").safeParse(accountId);
        if (!accountResult.success) {
          nextErrors.accountId = accountResult.error.issues[0]?.message;
        }
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
      if (entryType === "recurring") {
        if (onSubmitRecurringRule) {
          await onSubmitRecurringRule({
            name: description || "Gasto Fixo",
            amountInCents,
            dueDay: parseInt(dueDay, 10),
            paymentMethod: recurringPaymentMode,
            accountId: recurringPaymentMode !== "CARD" ? accountId : undefined,
            cardId: recurringPaymentMode === "CARD" ? cardId : undefined,
            categoryId: categoryId || "other",
          });
        }
      } else if (entryType === "investment") {
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

  const isAdvancedMode =
    composerMode === "advanced" ||
    entryType === "transfer" ||
    entryType === "investment" ||
    (entryType === "expense" && expensePaymentMode === "CARD");
  const isAdvancedModeForced =
    entryType === "transfer" ||
    entryType === "investment" ||
    (entryType === "expense" && expensePaymentMode === "CARD");

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  const tabBar = (
    <div className="relative">
      {/* fade masks so chips don't hard-clip at the edges on mobile */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />
      <div className="flex items-center gap-2 overflow-x-auto px-6 pb-3 pt-1 scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.type === entryType;
          return (
            <button
              key={tab.type}
              type="button"
              onClick={() =>
                dispatchQuickAdd({ type: "entryTypeChanged", entryType: tab.type })
              }
              className={[
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
                isActive
                  ? `${tab.activePill} shadow`
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ─── Amount block ────────────────────────────────────────────────────────────

  const amountBlock = (
    <div className={`flex flex-col items-center justify-center rounded-2xl py-5 mx-6 mb-2 ${activeTab.amountBg}`}>
      <div className={`mb-1 text-sm font-semibold ${activeTab.currencyText}`}>R$</div>
      <input
        autoFocus
        ref={amountInputRef}
        className={`w-full max-w-[280px] bg-transparent text-center text-4xl font-bold outline-none placeholder:text-muted-foreground/30 md:text-5xl ${activeTab.amountText}`}
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
      {validationErrors.amount && (
        <p className="mt-1 text-xs font-medium text-danger">{validationErrors.amount}</p>
      )}
    </div>
  );

  // ─── Mode banner ─────────────────────────────────────────────────────────────

  const modeBanner = (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${activeTab.bannerBorder} ${activeTab.bannerBg}`}>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {isAdvancedMode ? "Modo avançado" : "Modo rápido"}
        </p>
        <p className="text-sm font-medium text-foreground/70">
          {isAdvancedMode
            ? "Campos extras aparecem quando o contexto exige mais controle."
            : "Foque no essencial para registrar um lançamento em segundos."}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-xl text-xs"
        disabled={isAdvancedModeForced}
        onClick={() => setComposerMode((c) => (c === "quick" ? "advanced" : "quick"))}
      >
        {isAdvancedModeForced
          ? "Avançado obrigatório"
          : isAdvancedMode
            ? "Modo rápido"
            : "Modo avançado"}
      </Button>
    </div>
  );

  // ─── Form footer (CTA + keep-open) ──────────────────────────────────────────

  const formFooter = () => (
    <div className="flex items-center justify-between pt-1">
      {(entryType === "expense" || entryType === "income") &&
      expensePaymentMode !== "CARD" &&
      isAdvancedMode ? (
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
      ) : (
        <div />
      )}

      <Button
        disabled={isSubmitting || parseAmount(amount) <= 0}
        type="submit"
        size="lg"
        className={`rounded-xl px-8 shadow-lg ${activeTab.submitClass}`}
      >
        Lançar
      </Button>
    </div>
  );

  // ─── Form fields ─────────────────────────────────────────────────────────────

  const formContent = (showFooter: boolean) => (
    <form id="quick-add-form" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex flex-col gap-4 px-6 pb-6 pt-2">
      {!isMobile && modeBanner}

      {/* Common fields: date + description */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div className="space-y-2">
          <Label htmlFor="quick-add-date">Data</Label>
          <Input
            id="quick-add-date"
            type="date"
            className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
            value={date}
            onChange={(event) => {
              dispatchQuickAdd({ type: "dateChanged", date: event.target.value });
              dispatchQuickAdd({ type: "validationErrorsPatched", errors: { date: undefined } });
            }}
          />
          <FieldError message={validationErrors.date} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-add-description">Descrição</Label>
          <Input
            id="quick-add-description"
            className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
            placeholder={
              entryType === "expense"
                ? "No que você gastou?"
                : entryType === "income"
                  ? "De onde veio?"
                  : entryType === "transfer"
                    ? "Opcional"
                    : entryType === "investment"
                      ? "Opcional"
                      : "Nome do gasto fixo"
            }
            maxLength={300}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>

      {/* ── Expense fields ── */}
      {entryType === "expense" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="quick-add-payment-mode">Pagamento</Label>
            <select
              id="quick-add-payment-mode"
              aria-label="Modo de pagamento"
              className={QUICK_ADD_SELECT_CLASS_NAME}
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
              <option value="CARD">Cartão de crédito</option>
            </select>
          </div>

          <div className={isCardExpense ? "space-y-2" : "space-y-2"}>
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-add-category">Categoria</Label>
              {onCreateCategory && onRemoveCategory ? (
                <CategoryManagerDialog
                  categories={externalCategories ?? []}
                  onCreateCategory={onCreateCategory}
                  onRemoveCategory={onRemoveCategory}
                />
              ) : null}
            </div>
            <select
              id="quick-add-category"
              aria-label="Categoria"
              className={QUICK_ADD_SELECT_CLASS_NAME}
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

          {isCardExpense ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="quick-add-card">Cartão</Label>
                <select
                  id="quick-add-card"
                  aria-label="Cartão"
                  className={QUICK_ADD_SELECT_CLASS_NAME}
                  onChange={(event) => {
                    setCardId(event.target.value);
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { cardId: undefined } });
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
              <div className="space-y-2">
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
                    dispatchQuickAdd({ type: "installmentsChanged", installments: event.target.value });
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { installments: undefined } });
                  }}
                />
                <FieldError message={validationErrors.installments} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="quick-add-person-card">Pessoa relacionada</Label>
                <Input
                  id="quick-add-person-card"
                  className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                  placeholder="Opcional â€” para rastrear reembolsos"
                  maxLength={100}
                  value={personId}
                  onChange={(event) => setPersonId(event.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="quick-add-account">Conta</Label>
                <select
                  id="quick-add-account"
                  aria-label="Conta"
                  className={QUICK_ADD_SELECT_CLASS_NAME}
                  onChange={(event) => {
                    dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { accountId: undefined } });
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
              {isAdvancedMode && (
                <div className="space-y-2">
                  <Label htmlFor="quick-add-person">Pessoa relacionada</Label>
                  <Input
                    id="quick-add-person"
                    className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                    placeholder="Opcional — para rastrear reembolsos"
                    maxLength={100}
                    value={personId}
                    onChange={(event) => setPersonId(event.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Income fields ── */}
      {entryType === "income" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-add-category-income">Categoria</Label>
              {onCreateCategory && onRemoveCategory ? (
                <CategoryManagerDialog
                  categories={externalCategories ?? []}
                  onCreateCategory={onCreateCategory}
                  onRemoveCategory={onRemoveCategory}
                />
              ) : null}
            </div>
            <select
              id="quick-add-category-income"
              aria-label="Categoria"
              className={QUICK_ADD_SELECT_CLASS_NAME}
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

          <div className="space-y-2">
            <Label htmlFor="quick-add-account-income">Conta</Label>
            <select
              id="quick-add-account-income"
              aria-label="Conta"
              className={QUICK_ADD_SELECT_CLASS_NAME}
              onChange={(event) => {
                dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
                dispatchQuickAdd({ type: "validationErrorsPatched", errors: { accountId: undefined } });
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

          {isAdvancedMode && (
            <div className="space-y-2">
              <Label htmlFor="quick-add-person-income">Pessoa relacionada</Label>
              <Input
                id="quick-add-person-income"
                className="h-11 border-transparent bg-muted/50 focus-visible:bg-background"
                placeholder="Opcional"
                maxLength={100}
                value={personId}
                onChange={(event) => setPersonId(event.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Transfer fields ── */}
      {entryType === "transfer" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label htmlFor="quick-add-transfer-mode">Tipo de transferência</Label>
            <select
              id="quick-add-transfer-mode"
              aria-label="Modo da transferência"
              className={QUICK_ADD_SELECT_CLASS_NAME}
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "transferModeChanged",
                  mode: event.target.value as TransferMode,
                })
              }
              value={transferMode}
            >
              <option value="internal">Entre contas</option>
              <option value="invoice_payment">Quitar fatura do cartão</option>
            </select>
          </div>

          {transferMode === "internal" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="quick-add-account-from">Conta origem</Label>
                <select
                  id="quick-add-account-from"
                  aria-label="Conta origem"
                  className={QUICK_ADD_SELECT_CLASS_NAME}
                  onChange={(event) => {
                    dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { accountId: undefined } });
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
              <div className="space-y-2">
                <Label htmlFor="quick-add-account-to">Conta destino</Label>
                <select
                  id="quick-add-account-to"
                  aria-label="Conta destino"
                  className={QUICK_ADD_SELECT_CLASS_NAME}
                  onChange={(event) => {
                    dispatchQuickAdd({ type: "toAccountChanged", accountId: event.target.value });
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { toAccountId: undefined } });
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
            </>
          ) : (
            <>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="quick-add-account-payer">Conta para pagamento</Label>
                <select
                  id="quick-add-account-payer"
                  aria-label="Conta que vai pagar a fatura"
                  className={QUICK_ADD_SELECT_CLASS_NAME}
                  onChange={(event) => {
                    dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { accountId: undefined } });
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
              <div className="col-span-1 md:col-span-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground">
                Quitar saldo do cartão usando uma conta existente.
              </div>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="quick-add-invoice">Fatura</Label>
                <select
                  id="quick-add-invoice"
                  aria-label="Fatura"
                  className={QUICK_ADD_SELECT_CLASS_NAME}
                  onChange={(event) => {
                    dispatchQuickAdd({ type: "invoiceChanged", invoiceId: event.target.value });
                    dispatchQuickAdd({ type: "validationErrorsPatched", errors: { invoiceId: undefined } });
                  }}
                  value={invoiceId}
                >
                  <option value="">Selecione...</option>
                  {openInvoices.map((invoice) => {
                    const cardName =
                      cards.find((card) => card.card_id === invoice.card_id)?.name || "Cartão";
                    return (
                      <option key={invoice.invoice_id} value={invoice.invoice_id}>
                        {cardName} — {format(new Date(invoice.due_date), "dd/MM")}
                      </option>
                    );
                  })}
                </select>
                <FieldError message={validationErrors.invoiceId} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Investment fields ── */}
      {entryType === "investment" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="quick-add-investment-mode">Tipo do movimento</Label>
            <select
              id="quick-add-investment-mode"
              aria-label="Tipo do movimento"
              className={QUICK_ADD_SELECT_CLASS_NAME}
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "investmentModeChanged",
                  mode: event.target.value as InvestmentMode,
                })
              }
              value={investmentMode}
            >
              <option value="contribution">Aporte</option>
              <option value="withdrawal">Resgate</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-add-account-investment">Conta</Label>
            <select
              id="quick-add-account-investment"
              aria-label="Conta"
              className={QUICK_ADD_SELECT_CLASS_NAME}
              onChange={(event) => {
                dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
                dispatchQuickAdd({ type: "validationErrorsPatched", errors: { accountId: undefined } });
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

          {isAdvancedMode && investmentMode === "contribution" && (
            <div className="space-y-2">
              <Label htmlFor="quick-add-dividend">Dividendos (opcional)</Label>
              <Input
                id="quick-add-dividend"
                aria-label="Dividendos"
                className="h-11 border-transparent bg-muted/50"
                value={dividendAmount}
                onChange={(event) =>
                  dispatchQuickAdd({
                    type: "dividendAmountChanged",
                    amount: formatAmountInput(event.target.value),
                  })
                }
                placeholder="0,00"
              />
            </div>
          )}

          {isAdvancedMode && investmentMode === "withdrawal" && (
            <div className="space-y-2">
              <Label htmlFor="quick-add-invested-reduction">Redução do investido</Label>
              <Input
                id="quick-add-invested-reduction"
                aria-label="Redução do investido"
                className="h-11 border-transparent bg-muted/50"
                value={investedReductionAmount}
                onChange={(event) =>
                  dispatchQuickAdd({
                    type: "investedReductionAmountChanged",
                    amount: formatAmountInput(event.target.value),
                  })
                }
                placeholder="0,00"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Recurring fields ── */}
      {entryType === "recurring" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="space-y-2">
            <Label htmlFor="quick-add-recurring-mode">Pagamento</Label>
            <select
              id="quick-add-recurring-mode"
              aria-label="Modo de pagamento do gasto fixo"
              className={QUICK_ADD_SELECT_CLASS_NAME}
              onChange={(event) =>
                dispatchQuickAdd({
                  type: "recurringPaymentModeChanged",
                  mode: event.target.value as RecurringPaymentMode,
                })
              }
              value={recurringPaymentMode}
            >
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="OTHER">Outro</option>
              <option value="CARD">Cartão</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-add-due-day">Dia do vencimento</Label>
            <Input
              id="quick-add-due-day"
              aria-label="Dia do vencimento"
              type="number"
              min="1"
              max="28"
              className="h-11 border-transparent bg-muted/50"
              onChange={(event) =>
                dispatchQuickAdd({ type: "dueDayChanged", dueDay: event.target.value })
              }
              value={dueDay}
            />
            <FieldError message={validationErrors.dueDay} />
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="quick-add-category-recurring">Categoria</Label>
              {onCreateCategory && onRemoveCategory ? (
                <CategoryManagerDialog
                  categories={externalCategories ?? []}
                  onCreateCategory={onCreateCategory}
                  onRemoveCategory={onRemoveCategory}
                />
              ) : null}
            </div>
            <select
              id="quick-add-category-recurring"
              aria-label="Categoria"
              className={QUICK_ADD_SELECT_CLASS_NAME}
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

          {isCardRecurring ? (
            <div className="col-span-1 md:col-span-2 space-y-2">
              <Label htmlFor="quick-add-card-recurring">Cartão</Label>
              <select
                id="quick-add-card-recurring"
                aria-label="Cartão"
                className={QUICK_ADD_SELECT_CLASS_NAME}
                onChange={(event) => {
                  setCardId(event.target.value);
                  dispatchQuickAdd({ type: "validationErrorsPatched", errors: { cardId: undefined } });
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
          ) : (
            <div className="col-span-1 md:col-span-2 space-y-2">
              <Label htmlFor="quick-add-account-recurring">Conta</Label>
              <select
                id="quick-add-account-recurring"
                aria-label="Conta"
                className={QUICK_ADD_SELECT_CLASS_NAME}
                onChange={(event) => {
                  dispatchQuickAdd({ type: "accountChanged", accountId: event.target.value });
                  dispatchQuickAdd({ type: "validationErrorsPatched", errors: { accountId: undefined } });
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
          )}
        </div>
      )}

      {/* ── Footer ── */}
      {showFooter && formFooter()}
      {showFooter && (
        <p className="text-xs text-muted-foreground">Enter salva. Tab navega pelos campos.</p>
      )}
    </form>
  );

  // ─── Shell ────────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DrawerContent
          data-testid="quick-add-drawer"
          className="flex flex-col max-h-[92svh] rounded-t-[1.75rem] border bg-background overflow-hidden"
        >
          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
            <DrawerHeader className="px-6 pb-0 pt-5">
              <DrawerTitle className="text-lg font-semibold">Lançar</DrawerTitle>
            </DrawerHeader>
            {tabBar}
            {amountBlock}
            {formContent(false)}
          </div>
          {/* ── Fixed CTA footer ── */}
          <div className={`shrink-0 border-t px-6 py-4 bg-background`}>
            {(entryType === "expense" || entryType === "income") &&
            expensePaymentMode !== "CARD" &&
            isAdvancedMode ? (
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keepOpenMobile"
                    checked={keepOpen}
                    onCheckedChange={(checked: boolean | "indeterminate") =>
                      dispatchQuickAdd({
                        type: "keepOpenChanged",
                        keepOpen: checked === true,
                      })
                    }
                  />
                  <label
                    htmlFor="keepOpenMobile"
                    className="text-sm font-medium leading-none text-muted-foreground"
                  >
                    Salvar e adicionar outra
                  </label>
                </div>
              </div>
            ) : null}
            <Button
              form="quick-add-form"
              disabled={isSubmitting || parseAmount(amount) <= 0}
              type="submit"
              size="lg"
              className={`w-full rounded-xl shadow-lg ${activeTab.submitClass}`}
            >
              Lançar
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        data-testid="quick-add-dialog"
        className="max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-3xl border bg-background p-0 shadow-2xl sm:max-w-[680px] lg:max-w-[720px]"
      >
        <div className="px-6 pb-1 pt-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Lançar</DialogTitle>
            <DialogDescription>
              Registre um lançamento sem sair da tela atual.
            </DialogDescription>
          </DialogHeader>
        </div>
        {tabBar}
        {amountBlock}
        {formContent(true)}
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs font-medium text-danger">{message}</p>;
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
