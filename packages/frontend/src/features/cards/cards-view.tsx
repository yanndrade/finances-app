import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Receipt,
} from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/ui/drawer";
import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Progress } from "../../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import {
  type AccountSummary,
  type CardInstallmentSummary,
  type CardPayload,
  type CardPurchaseSummary,
  type CardPurchasePayload,
  type CardSummary,
  type CardUpdatePayload,
  type InvoiceItemSummary,
  type InvoiceSummary,
  type TransactionFilters,
  fetchCardInstallments,
  fetchCardPurchases,
} from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";
import { useInvoiceItems } from "./use-invoice-items";

type QuickAddOpenOptions = {
  invoiceId?: string;
};

type CardsViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  isSubmitting: boolean;
  onOpenSettings: () => void;
  onOpenQuickAdd: (preset: QuickAddPreset, options?: QuickAddOpenOptions) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onCreateCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
  onSetCardActive: (card: CardSummary, isActive: boolean) => Promise<void>;
  onUpdateCard: (cardId: string, payload: CardUpdatePayload) => Promise<void>;
  uiDensity: UiDensity;
};

type CardFormState = {
  name: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  paymentAccountId: string;
};

type CardEditFormState = CardFormState & {
  isActive: boolean;
};

const ALL_CARDS_SCOPE = "all";
const NO_PAYMENT_ACCOUNT_VALUE = "__card-no-payment-account__";

export function CardsView({
  accounts,
  cards,
  invoices,
  isSubmitting,
  onOpenSettings,
  onOpenQuickAdd,
  onOpenLedgerFiltered,
  onCreateCard,
  onCreateCardPurchase: _onCreateCardPurchase,
  onSetCardActive,
  onUpdateCard,
  uiDensity,
}: CardsViewProps) {
  const activeCards = useMemo(
    () => cards.filter((card) => card.is_active),
    [cards],
  );
  const [selectedScope, setSelectedScope] = useState<string>(ALL_CARDS_SCOPE);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CardFormState>(() => createEmptyCardForm());
  const [editForm, setEditForm] = useState<CardEditFormState | null>(null);
  const [selectedCycleInvoiceId, setSelectedCycleInvoiceId] = useState<string | null>(null);
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<"all" | "open" | "partial" | "paid">("all");
  const [cardPurchases, setCardPurchases] = useState<CardPurchaseSummary[]>([]);
  const [futureInstallments, setFutureInstallments] = useState<CardInstallmentSummary[]>([]);
  const [purchasesLoadError, setPurchasesLoadError] = useState<string | null>(null);
  const [installmentsLoadError, setInstallmentsLoadError] = useState<string | null>(null);
  const {
    invoiceItems,
    isLoadingItems,
    loadError: invoiceItemsError,
    loadInvoiceItems: fetchAndSetInvoiceItems,
    clearInvoiceItemsState,
  } = useInvoiceItems();

  const referenceMonth = format(referenceDate, "yyyy-MM");
  const isAggregateView = selectedScope === ALL_CARDS_SCOPE;
  const selectedCard = activeCards.find((card) => card.card_id === selectedScope) ?? null;
  const visibleInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => {
        if (invoice.reference_month !== referenceMonth) {
          return false;
        }

        if (isAggregateView) {
          return activeCards.some((card) => card.card_id === invoice.card_id);
        }

        return invoice.card_id === selectedScope;
      })
      .sort((left, right) => {
        if (left.remaining_amount !== right.remaining_amount) {
          return right.remaining_amount - left.remaining_amount;
        }

        return left.due_date.localeCompare(right.due_date);
      });
  }, [activeCards, invoices, isAggregateView, referenceMonth, selectedScope]);

  const currentInvoice = visibleInvoices[0] ?? null;
  const openInvoices = visibleInvoices.filter((invoice) => invoice.remaining_amount > 0);
  const totalOpenAmount = openInvoices.reduce(
    (sum, invoice) => sum + invoice.remaining_amount,
    0,
  );
  const totalPaidAmount = visibleInvoices.reduce(
    (sum, invoice) => sum + invoice.paid_amount,
    0,
  );
  const upcomingDueDate = openInvoices.map((invoice) => invoice.due_date).sort()[0] ?? null;
  const totalLimit = activeCards.reduce((sum, card) => sum + card.limit, 0);
  const totalFutureInstallments = activeCards.reduce(
    (sum, card) => sum + (card.future_installment_total ?? 0),
    0,
  );
  const cardsWithOpenInvoices = new Set(openInvoices.map((invoice) => invoice.card_id)).size;
  const committedLimit = totalOpenAmount + totalFutureInstallments;
  const availableLimit = Math.max(totalLimit - committedLimit, 0);
  const limitUsage = totalLimit > 0 ? Math.min((committedLimit / totalLimit) * 100, 100) : 0;
  const selectedCycleInvoice =
    visibleInvoices.find((invoice) => invoice.invoice_id === selectedCycleInvoiceId) ?? currentInvoice;
  const invoiceStatusById = new Map(visibleInvoices.map((invoice) => [invoice.invoice_id, invoice.status]));
  const visiblePurchases = cardPurchases.filter((purchase) => {
    if (isAggregateView) {
      if (purchase.reference_month !== referenceMonth) {
        return false;
      }
      if (purchaseStatusFilter === "all") {
        return true;
      }
      return invoiceStatusById.get(purchase.invoice_id) === purchaseStatusFilter;
    }

    if (purchase.invoice_id !== selectedCycleInvoice?.invoice_id) {
      return false;
    }
    if (purchaseStatusFilter === "all") {
      return true;
    }
    return invoiceStatusById.get(purchase.invoice_id) === purchaseStatusFilter;
  });
  const visibleFutureInstallments = futureInstallments.filter(
    (installment) => installment.reference_month > referenceMonth,
  );

  useEffect(() => {
    setSelectedCycleInvoiceId(currentInvoice?.invoice_id ?? null);
  }, [currentInvoice?.invoice_id, selectedScope, referenceMonth]);

  useEffect(() => {
    let cancelled = false;

    async function loadPurchases() {
      try {
        setPurchasesLoadError(null);
        const purchases = await fetchCardPurchases(isAggregateView ? undefined : selectedScope);
        if (!cancelled) {
          setCardPurchases(purchases);
        }
      } catch {
        if (!cancelled) {
          setCardPurchases([]);
          setPurchasesLoadError("Não foi possível carregar as compras do cartão.");
        }
      }
    }

    void loadPurchases();
    return () => {
      cancelled = true;
    };
  }, [isAggregateView, selectedScope]);

  useEffect(() => {
    if (isAggregateView) {
      setFutureInstallments([]);
      setInstallmentsLoadError(null);
      return;
    }

    let cancelled = false;

    async function loadInstallments() {
      try {
        setInstallmentsLoadError(null);
        const installments = await fetchCardInstallments({
          cardId: selectedScope,
          fromMonth: referenceMonth,
        });
        if (!cancelled) {
          setFutureInstallments(installments);
        }
      } catch {
        if (!cancelled) {
          setFutureInstallments([]);
          setInstallmentsLoadError("Não foi possível carregar as parcelas futuras.");
        }
      }
    }

    void loadInstallments();
    return () => {
      cancelled = true;
    };
  }, [isAggregateView, referenceMonth, selectedScope]);

  async function loadInvoiceItems(invoiceId: string) {
    setSelectedInvoiceId(invoiceId);
    await fetchAndSetInvoiceItems(invoiceId);
  }

  function jumpToInvoice(invoice: InvoiceSummary) {
    setSelectedScope(invoice.card_id);
    setReferenceDate(parseISO(`${invoice.reference_month}-01`));
  }

  function openCreateDialog() {
    setCreateForm(createEmptyCardForm());
    setIsCreateDialogOpen(true);
  }

  function openEditDialog(card: CardSummary) {
    setEditingCardId(card.card_id);
    setEditForm({
      name: card.name,
      limit: String(card.limit),
      closingDay: String(card.closing_day),
      dueDay: String(card.due_day),
      paymentAccountId: card.payment_account_id,
      isActive: card.is_active,
    });
  }

  async function handleCreateCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.name.trim()) {
      return;
    }

    await onCreateCard({
      name: createForm.name.trim(),
      limitInCents: parseInt(createForm.limit || "0", 10),
      closingDay: parseInt(createForm.closingDay || "0", 10),
      dueDay: parseInt(createForm.dueDay || "0", 10),
      paymentAccountId: createForm.paymentAccountId || undefined,
    });

    setIsCreateDialogOpen(false);
    setCreateForm(createEmptyCardForm());
  }

  async function handleUpdateCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCardId === null || editForm === null || !editForm.name.trim()) {
      return;
    }

    await onUpdateCard(editingCardId, {
      name: editForm.name.trim(),
      limitInCents: parseInt(editForm.limit || "0", 10),
      closingDay: parseInt(editForm.closingDay || "0", 10),
      dueDay: parseInt(editForm.dueDay || "0", 10),
      paymentAccountId: editForm.paymentAccountId,
      isActive: editForm.isActive,
    });

    setEditingCardId(null);
    setEditForm(null);
  }

  async function handleToggleCardActive(card: CardSummary) {
    const nextIsActive = !card.is_active;

    if (
      !nextIsActive &&
      !globalThis.confirm(
        "Excluir este cartão da operação ativa? Faturas e histórico serão preservados.",
      )
    ) {
      return;
    }

    await onSetCardActive(card, nextIsActive);

    if (!nextIsActive && selectedScope === card.card_id) {
      setSelectedScope(ALL_CARDS_SCOPE);
    }

    if (editingCardId === card.card_id) {
      setEditingCardId(null);
      setEditForm(null);
    }
  }

  return (
    <div
      className={cn(
        "pb-10",
        uiDensity === "comfort" ? "space-y-8" : uiDensity === "compact" ? "space-y-6" : "space-y-4",
      )}
    >
      <div
        className={cn(
          "finance-card finance-toolbar-card",
          uiDensity === "dense"
            ? "rounded-[1.6rem] p-3"
            : uiDensity === "compact"
              ? "rounded-[2rem] p-3.5"
              : "rounded-[2.5rem] p-4",
        )}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setReferenceDate((current) => subMonths(current, 1))}
              className="rounded-[1.2rem] h-11 w-11 text-slate-400 hover:bg-slate-50 hover:text-primary"
              type="button"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-[10rem] text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                Referência
              </p>
              <p className="text-xl font-black capitalize text-slate-800">
                {format(referenceDate, "MMMM yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setReferenceDate((current) => addMonths(current, 1))}
              className="rounded-[1.2rem] h-11 w-11 text-slate-400 hover:bg-slate-50 hover:text-primary"
              type="button"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              Escopo
              <select
                aria-label="Escopo dos cartoes"
                className="h-12 min-w-[15rem] rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-bold normal-case tracking-normal text-slate-700 outline-none"
                value={selectedScope}
                onChange={(event) => setSelectedScope(event.target.value)}
              >
                <option value={ALL_CARDS_SCOPE}>Todos os cartões</option>
                {activeCards.map((card) => (
                  <option key={card.card_id} value={card.card_id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              className="h-12 rounded-2xl bg-white border-none shadow-sm font-black px-6"
              type="button"
              onClick={() => onOpenQuickAdd("expense_card")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova compra
            </Button>
            <Button className="h-12 rounded-2xl font-black px-6" type="button" onClick={openCreateDialog}>
              Novo cartão
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <div className={cn("flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between", uiDensity === "dense" ? "mb-5" : "mb-8")}>
          <TabsList className="bg-slate-200/50 p-1.5 h-14 rounded-[1.75rem] backdrop-blur-sm">
            <TabsTrigger className="px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)] data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700" value="summary">
              Faturas
            </TabsTrigger>
            <TabsTrigger className="px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)] data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700" value="purchases">
              Compras
            </TabsTrigger>
            <TabsTrigger className="px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)] data-[state=active]:text-slate-900 text-slate-500 hover:text-slate-700" value="settings">
              Carteira
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary" className="space-y-6 outline-none focus:ring-0">
          {isAggregateView ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <SummaryStat label="Todos os cartões" value="Faturas abertas" />
                <SummaryStat label="Em aberto" value={formatCurrency(totalOpenAmount)} />
                <SummaryStat label="Pago no período" value={formatCurrency(totalPaidAmount)} />
                <SummaryStat label="Próximo vencimento" value={upcomingDueDate ?? "--"} />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
                <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-black text-slate-900">Faturas abertas</CardTitle>
                    <CardDescription className="font-bold text-slate-400">
                      Panorama do período por cartão. Clique para detalhar um ciclo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {visibleInvoices.length === 0 ? (
                      <EmptySurface message="Nenhuma fatura encontrada para o período selecionado." />
                    ) : (
                      visibleInvoices.map((invoice) => (
                        <button
                          key={invoice.invoice_id}
                          className="flex w-full flex-col gap-4 rounded-[2rem] border border-slate-100 bg-slate-50/70 p-5 text-left transition-colors hover:bg-white"
                          onClick={() => jumpToInvoice(invoice)}
                          type="button"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                                {cardName(invoice.card_id, cards)}
                              </p>
                              <p className="text-xl font-black text-slate-900">
                                Referencia {invoice.reference_month}
                              </p>
                            </div>
                            {renderStatusBadge(invoice.status)}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <MiniMetric label="Em aberto" value={formatCurrency(invoice.remaining_amount)} />
                            <MiniMetric label="Pago" value={formatCurrency(invoice.paid_amount)} />
                            <MiniMetric label="Vencimento" value={invoice.due_date} />
                          </div>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>

              <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[2.5rem]")}>
                <CardHeader className="pb-4 border-b border-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900">Saúde dos Cartões</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Visão consolidada
                      </CardDescription>
                    </div>
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Operação ativa" />
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Total em Aberto</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">
                      {formatCurrency(totalLimit - availableLimit)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Ativos</p>
                      <p className="text-lg font-black text-slate-800">{activeCards.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Pendentes</p>
                      <p className="text-lg font-black text-slate-800">{cardsWithOpenInvoices}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Uso do Limite</p>
                      <p className="text-xs font-black text-slate-600">
                        {Math.round(limitUsage)}%
                      </p>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          limitUsage > 80 ? "bg-rose-500" : "bg-slate-900",
                        )}
                        style={{ width: `${limitUsage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <span>{formatCurrency(committedLimit)}</span>
                      <span>Total {formatCurrency(totalLimit)}</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full h-11 rounded-xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900" 
                    type="button" 
                    onClick={onOpenSettings}
                  >
                    Gerenciar Carteira
                  </Button>
                </CardContent>
              </Card>
              </div>
            </div>
          ) : (
            <CardScopeDetail
              currentInvoice={currentInvoice}
              invoices={invoices}
              onLoadInvoiceItems={loadInvoiceItems}
              onOpenLedgerFiltered={onOpenLedgerFiltered}
              onOpenQuickAdd={onOpenQuickAdd}
              onSelectInvoice={jumpToInvoice}
              selectedCard={selectedCard}
              selectedScope={selectedScope}
              futureInstallments={visibleFutureInstallments}
              installmentsLoadError={installmentsLoadError}
              uiDensity={uiDensity}
            />
          )}
        </TabsContent>

        <TabsContent value="purchases" className="outline-none focus:ring-0">
          <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-black text-slate-900">
                {isAggregateView ? "Compras consolidadas" : "Histórico de compras"}
              </CardTitle>
              <CardDescription className="font-bold text-slate-400">
                {isAggregateView
                  ? "Compras do ciclo atual em todos os cartões ativos."
                  : "Compras do cartão por ciclo, com parcelas e vencimentos."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-8 pb-4 space-y-4">
                <label className="flex max-w-sm flex-col gap-2 text-sm font-medium text-slate-700">
                  Status da fatura
                  <select
                    aria-label="Status da fatura"
                    className="h-11 rounded-xl border border-slate-200 px-3"
                    onChange={(event) =>
                      setPurchaseStatusFilter(event.target.value as "all" | "open" | "partial" | "paid")
                    }
                    value={purchaseStatusFilter}
                  >
                    <option value="all">Todos</option>
                    <option value="open">Aberta</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Paga</option>
                  </select>
                </label>
              {!isAggregateView && visibleInvoices.length > 0 ? (
                <div>
                  <label className="flex max-w-sm flex-col gap-2 text-sm font-medium text-slate-700">
                    Ciclo da fatura
                    <select
                      aria-label="Ciclo da fatura"
                      className="h-11 rounded-xl border border-slate-200 px-3"
                      onChange={(event) => setSelectedCycleInvoiceId(event.target.value)}
                      value={selectedCycleInvoice?.invoice_id ?? ""}
                    >
                      {visibleInvoices.map((invoice) => (
                        <option key={invoice.invoice_id} value={invoice.invoice_id}>
                          {invoice.reference_month} • vence {invoice.due_date}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              </div>
              {purchasesLoadError ? (
                <div className="px-8 py-10 text-center">
                  <p className="text-sm font-bold text-rose-600">{purchasesLoadError}</p>
                </div>
              ) : (
                <div className={`table-shell table-shell--${uiDensity}`}>
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="border-slate-50 hover:bg-transparent">
                        <TableHead className="px-8 h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Cartão</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Compra</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Ciclo</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Parcelas</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePurchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center text-slate-300 font-bold">
                            Nada para mostrar neste período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visiblePurchases.map((purchase) => (
                          <TableRow key={purchase.purchase_id} className="border-slate-50">
                            <TableCell className="px-8 py-5 font-black text-slate-800">{cardName(purchase.card_id, cards)}</TableCell>
                            <TableCell className="font-bold text-slate-900">{purchase.description || "Compra no cartao"}</TableCell>
                            <TableCell className="font-bold text-slate-500">{purchase.reference_month}</TableCell>
                            <TableCell className="font-bold text-slate-500">{purchase.installments_count}x</TableCell>
                            <TableCell className="pr-8 text-right font-black text-slate-900">{formatCurrency(purchase.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="outline-none focus:ring-0">
          {isAggregateView ? (
            <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900">Carteira de cartões</CardTitle>
                    <CardDescription className="font-bold text-slate-400">
                      Visão estrutural compacta da carteira. Ajustes administrativos ficam em Configurações.
                    </CardDescription>
                  </div>
                  <Button variant="outline" type="button" onClick={onOpenSettings}>Abrir configurações</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <SummaryStat label="Cartões ativos" value={String(activeCards.length)} />
                  <SummaryStat label="Limite total" value={formatCurrency(totalLimit)} />
                  <SummaryStat label="Contas padrão" value={String(uniquePaymentAccounts(activeCards))} />
                </div>
                <div className="space-y-3">
                  {cards.length === 0 ? (
                    <EmptySurface message="Nenhum cartão cadastrado. Use Novo cartão para configurar a carteira." />
                  ) : (
                    cards.map((card) => (
                      <div
                        key={card.card_id}
                        className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-5 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <strong className="text-slate-900">{card.name}</strong>
                            {renderStatusBadge(card.is_active ? "open" : "inactive")}
                          </div>
                          <p className="text-sm text-slate-500">
                            Limite {formatCurrency(card.limit)} | Fecha dia {card.closing_day} | Vence dia {card.due_day}
                          </p>
                          <p className="text-sm text-slate-500">
                            Conta padrão: {accountName(card.payment_account_id, accounts)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button type="button" variant="outline" onClick={() => openEditDialog(card)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant={card.is_active ? "destructive" : "secondary"}
                            onClick={() => {
                              void handleToggleCardActive(card);
                            }}
                          >
                            {card.is_active ? "Excluir cartão" : "Reativar cartão"}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="field-hint">
                  Cadastros pesados continuam acessíveis aqui por compatibilidade, mas o fluxo recomendado passa por Configurações.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900">Ajustes do cartão</CardTitle>
                    <CardDescription className="font-bold text-slate-400">
                      Ciclo, limite, conta padrão opcional e status do cartão selecionado.
                    </CardDescription>
                  </div>
                  {selectedCard ? (
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" onClick={() => openEditDialog(selectedCard)}>Editar cartão</Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          void handleToggleCardActive(selectedCard);
                        }}
                      >
                        Excluir cartão
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <MiniMetric label="Nome" value={selectedCard?.name ?? "--"} />
                <MiniMetric label="Limite" value={formatCurrency(selectedCard?.limit ?? 0)} />
                <MiniMetric label="Fechamento" value={String(selectedCard?.closing_day ?? "--")} />
                <MiniMetric label="Vencimento" value={String(selectedCard?.due_day ?? "--")} />
                <MiniMetric
                  label="Conta padrão"
                  value={selectedCard ? accountName(selectedCard.payment_account_id, accounts) : "--"}
                />
                <MiniMetric label="Status" value={selectedCard?.is_active ? "Ativo" : "Inativo"} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Drawer
        open={selectedInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvoiceId(null);
            clearInvoiceItemsState();
          }
        }}
      >
        <DrawerContent className="max-h-[85vh] rounded-t-[3rem] border-none shadow-2xl finance-acrylic-surface">
          <div className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden px-8 py-10">
            <DrawerHeader className="mb-6 px-0">
              <DrawerTitle className="text-4xl font-black tracking-tighter">Resumo detalhado</DrawerTitle>
              <DrawerDescription className="text-base font-bold text-slate-400">
                Análise completa dos lançamentos deste período.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-auto rounded-[2.5rem] border border-slate-50 bg-white shadow-inner">
              {isLoadingItems ? (
                <div className="p-20 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                    Sincronizando faturas...
                  </p>
                </div>
              ) : invoiceItemsError ? (
                <div className="p-20 text-center">
                  <p className="text-sm font-bold text-rose-600">{invoiceItemsError}</p>
                </div>
              ) : (
                <InvoiceItemsTable invoiceItems={invoiceItems} />
              )}
            </div>

            <DrawerFooter className="px-0 pt-8">
              <Button
                variant="ghost"
                className="h-14 w-full rounded-[1.5rem] font-black text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setSelectedInvoiceId(null);
                  clearInvoiceItemsState();
                }}
                type="button"
              >
                Fechar
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Novo cartao</DialogTitle>
            <DialogDescription>
              Defina limite e ciclo do cartao. A conta padrao para pagamento pode ficar em branco.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleCreateCardSubmit(event)}>
            <CardFormFields form={createForm} accounts={accounts} onChange={setCreateForm} />
            <div className="flex gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Salvando..." : "Criar cartao"}
              </Button>
              <Button variant="outline" type="button" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingCardId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCardId(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="max-w-xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Editar cartao</DialogTitle>
            <DialogDescription>
              Atualize limite, ciclo, conta padrão opcional ou desative o cartão sem perder histórico.
            </DialogDescription>
          </DialogHeader>
          {editForm ? (
            <form className="space-y-4" onSubmit={(event) => void handleUpdateCardSubmit(event)}>
              <CardFormFields
                form={editForm}
                accounts={accounts}
                onChange={(updater) =>
                  setEditForm((current) => {
                    if (current === null) {
                      return current;
                    }
                    return updater(current);
                  })
                }
              />
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={editForm.isActive}
                  type="checkbox"
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, isActive: event.target.checked } : current,
                    )
                  }
                />
                Cartao ativo
              </label>
              <div className="flex gap-3">
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Salvando..." : "Salvar cartao"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setEditingCardId(null);
                    setEditForm(null);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardScopeDetail({
  currentInvoice,
  invoices,
  onLoadInvoiceItems,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  onSelectInvoice,
  selectedCard,
  selectedScope,
  futureInstallments,
  installmentsLoadError,
  uiDensity,
}: {
  currentInvoice: InvoiceSummary | null;
  invoices: InvoiceSummary[];
  onLoadInvoiceItems: (invoiceId: string) => Promise<void>;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: (preset: QuickAddPreset, options?: QuickAddOpenOptions) => void;
  onSelectInvoice: (invoice: InvoiceSummary) => void;
  selectedCard: CardSummary | null;
  selectedScope: string;
  futureInstallments: CardInstallmentSummary[];
  installmentsLoadError: string | null;
  uiDensity: UiDensity;
}) {
  if (selectedCard === null) {
    return <EmptySurface message="Selecione um cartão para ver os detalhes do ciclo." />;
  }

  if (currentInvoice === null) {
    return <EmptySurface message="Não há faturas para o cartão neste período." />;
  }

  const progress =
    currentInvoice.total_amount > 0
      ? (currentInvoice.paid_amount / currentInvoice.total_amount) * 100
      : 0;
  const futureInstallmentsTotal = selectedCard.future_installment_total ?? 0;
  const committedLimit = currentInvoice.remaining_amount + futureInstallmentsTotal;
  const availableLimit = Math.max(selectedCard.limit - committedLimit, 0);
  const limitUsage =
    selectedCard.limit > 0 ? Math.min((committedLimit / selectedCard.limit) * 100, 100) : 0;
  const previousInvoices = invoices
    .filter(
      (invoice) =>
        invoice.card_id === selectedScope && invoice.invoice_id !== currentInvoice.invoice_id,
    )
    .sort((left, right) => right.reference_month.localeCompare(left.reference_month))
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <Card className={cn("finance-card finance-card--strong lg:col-span-8 overflow-hidden", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
        <CardHeader className="flex flex-col gap-6 space-y-0 p-5 pb-3 sm:flex-row sm:items-start sm:justify-between md:p-8 md:pb-4">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
              Fatura de {currentInvoice.reference_month}
            </CardTitle>
            <div className="flex items-center gap-2">
              {renderStatusBadge(currentInvoice.status)}
              <Badge
                variant="outline"
                className="rounded-lg border-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400"
              >
                {selectedCard.name}
              </Badge>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onOpenLedgerFiltered(
                  {
                    period: "month",
                    reference: `${currentInvoice.reference_month}-01`,
                    card: selectedCard.card_id,
                  },
                  currentInvoice.reference_month,
                )
              }
              className="h-10 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
              type="button"
            >
              Ver gastos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onLoadInvoiceItems(currentInvoice.invoice_id)}
              className="h-10 rounded-xl px-4 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
              type="button"
            >
              Ver itens
            </Button>
            <Button
              onClick={() =>
                onOpenQuickAdd("transfer_invoice_payment", {
                  invoiceId: currentInvoice.invoice_id,
                })
              }
              disabled={
                currentInvoice.remaining_amount <= 0 || Number.isNaN(currentInvoice.remaining_amount)
              }
              className="h-10 rounded-xl bg-primary px-6 text-[9px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
              type="button"
            >
              Pagar agora
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5 pt-1 md:space-y-8 md:p-8 md:pt-2">
          <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
            <button
              className="space-y-0.5 text-left"
              onClick={() => void onLoadInvoiceItems(currentInvoice.invoice_id)}
              type="button"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">Valor total</p>
              <p className="text-base font-black text-slate-900">{formatCurrency(currentInvoice.total_amount)}</p>
            </button>
            <MiniMetric label="Pago" value={formatCurrency(currentInvoice.paid_amount)} />
            <MiniMetric label="Em aberto" value={formatCurrency(currentInvoice.remaining_amount)} />
            <MiniMetric label="Lançamentos" value={String(currentInvoice.purchase_count)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">
                Progresso de pagamento
              </span>
              <span className="text-xs font-black text-slate-900">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3 rounded-full bg-slate-50" />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-50 pt-8 md:grid-cols-2">
            <MetricPanel
              icon={<Calendar className="h-5 w-5" />}
              label="Fechamento"
              tone="neutral"
              value={currentInvoice.closing_date}
            />
            <MetricPanel
              icon={<Clock className="h-5 w-5" />}
              label="Vencimento"
              tone="danger"
              value={currentInvoice.due_date}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8 lg:col-span-4">
        <Card className={cn("finance-card finance-card--strong overflow-hidden", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[2.5rem]")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black text-slate-900">Limite do cartão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <MiniMetric label="Limite total" value={formatCurrency(selectedCard.limit)} />
            <MiniMetric label="Limite comprometido" value={formatCurrency(committedLimit)} />
            <MiniMetric label="Limite disponivel" value={formatCurrency(availableLimit)} />
            <div className="space-y-3 rounded-[1.75rem] bg-slate-50 p-4">
              <div className="flex items-end justify-between gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">
                  Uso do limite
                </span>
                <span className="text-sm font-black text-slate-900">{Math.round(limitUsage)}%</span>
              </div>
              <Progress value={limitUsage} className="h-3 rounded-full bg-slate-100" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong overflow-hidden", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[2.5rem]")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black text-slate-900">Parcelas futuras comprometidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {installmentsLoadError ? (
              <p className="text-sm font-bold text-rose-600">{installmentsLoadError}</p>
            ) : futureInstallments.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma parcela futura comprometida a partir deste ciclo.</p>
            ) : (
              futureInstallments.slice(0, 5).map((installment) => (
                <div key={installment.installment_id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {installment.description || "Compra parcelada"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {installment.installment_number}/{installment.installments_count} • {installment.reference_month}
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {formatCurrency(installment.amount)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--accent overflow-hidden", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[2.5rem]")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-black text-primary/80">Regra do Agora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-2xl bg-primary/10 p-2.5">
                <AlertCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-bold leading-relaxed text-primary/70">
                A fatura fecha no dia {selectedCard.closing_day}. Lançamentos antes do fechamento entram neste ciclo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong overflow-hidden", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[2.5rem]")}>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black text-slate-800">Ciclos anteriores</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-8">
            <div className="space-y-1">
              {previousInvoices.length === 0 ? (
                <p className="px-6 py-4 text-sm font-bold text-slate-400">Nenhum ciclo anterior carregado.</p>
              ) : (
                previousInvoices.map((invoice) => (
                  <Button
                    key={invoice.invoice_id}
                    variant="ghost"
                    onClick={() => onSelectInvoice(invoice)}
                    className="h-auto w-full justify-between rounded-2xl px-6 py-4 hover:bg-slate-50"
                    type="button"
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="rounded-xl bg-slate-100 p-2 text-slate-400">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-base font-black text-slate-700">{invoice.reference_month}</p>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                      </div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CardFormFields<TForm extends CardFormState>({
  form,
  accounts,
  onChange,
}: {
  form: TForm;
  accounts: AccountSummary[];
  onChange: (updater: (current: TForm) => TForm) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
        Nome do cartão
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          value={form.name}
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Limite total
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          inputMode="numeric"
          value={formatCurrencyInput(form.limit)}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              limit: event.target.value.replace(/\D/g, ""),
            }))
          }
          placeholder="R$ 0,00"
          required
        />
      </label>
      <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        <span>Conta padrão para pagamento</span>
        <Select
          value={form.paymentAccountId || NO_PAYMENT_ACCOUNT_VALUE}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              paymentAccountId: value === NO_PAYMENT_ACCOUNT_VALUE ? "" : value,
            }))
          }
        >
          <SelectTrigger
            aria-label="Conta de pagamento"
            className="h-11 rounded-xl border-slate-200 text-left shadow-none"
          >
            <SelectValue placeholder="Sem conta padrao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PAYMENT_ACCOUNT_VALUE}>Sem conta padrão</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.account_id} value={account.account_id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs font-medium text-slate-400">
          Opcional. Na quitação da fatura você escolhe de qual conta sai o dinheiro.
        </p>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Dia de fechamento
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          inputMode="numeric"
          value={form.closingDay}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              closingDay: event.target.value.replace(/\D/g, "").slice(0, 2),
            }))
          }
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Dia de vencimento
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          inputMode="numeric"
          value={form.dueDay}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              dueDay: event.target.value.replace(/\D/g, "").slice(0, 2),
            }))
          }
          required
        />
      </label>
      <p className="text-sm text-slate-500 md:col-span-2">
        Limite atual: {formatCurrency(parseInt(form.limit || "0", 10))}
      </p>
    </div>
  );
}

function InvoiceItemsTable({ invoiceItems }: { invoiceItems: InvoiceItemSummary[] }) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/50">
        <TableRow className="border-slate-50 hover:bg-transparent">
          <TableHead className="px-8 h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Data</TableHead>
          <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Descrição</TableHead>
          <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Parcela</TableHead>
          <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoiceItems.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="h-40 text-center text-slate-300 font-bold">
              Abra uma fatura no resumo para ver os itens.
            </TableCell>
          </TableRow>
        ) : (
          invoiceItems.map((item) => (
            <TableRow key={item.invoice_item_id} className="border-slate-50">
              <TableCell className="px-8 py-5 font-bold text-slate-500">
                {format(parseISO(item.purchase_date), "dd MMM")}
              </TableCell>
              <TableCell className="font-black text-slate-900">{item.description || "Compra no cartão"}</TableCell>
              <TableCell className="font-bold text-slate-500">
                {item.installment_number}/{item.installments_count}
              </TableCell>
              <TableCell className="pr-8 text-right font-black text-slate-900">
                {formatCurrency(item.amount)}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[1.6rem] border-none bg-white shadow-sm">
      <CardContent className="space-y-1 p-5">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">{label}</p>
        <p className="text-xl font-black text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">{label}</p>
      <p className="text-base font-black text-slate-900">{value}</p>
    </div>
  );
}

function MetricPanel({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  tone: "neutral" | "danger";
  value: string;
}) {
  const toneClasses =
    tone === "danger"
      ? "border border-rose-100/20 bg-rose-50/40 text-rose-500"
      : "bg-slate-50 text-slate-400";
  const valueClasses = tone === "danger" ? "text-rose-700" : "text-slate-700";

  return (
    <div className={`flex items-center gap-4 rounded-[1.5rem] p-4 ${toneClasses}`}>
      <div className="rounded-xl bg-white p-2.5 shadow-sm">{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300">{label}</p>
        <p className={`text-base font-black ${valueClasses}`}>{value}</p>
      </div>
    </div>
  );
}

function EmptySurface({ message }: { message: string }) {
  return (
    <Card className="rounded-[2.5rem] border-none bg-white p-16 text-center shadow-sm">
      <p className="font-bold text-slate-400">{message}</p>
    </Card>
  );
}

function renderStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="rounded-lg border-none bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">Paga</Badge>;
    case "partial":
      return <Badge className="rounded-lg border-none bg-orange-100 px-3 py-1 text-orange-700 hover:bg-orange-100">Parcial</Badge>;
    case "open":
      return <Badge className="rounded-lg border-none bg-blue-100 px-3 py-1 text-blue-700 hover:bg-blue-100">Aberta</Badge>;
    case "inactive":
      return <Badge variant="outline" className="rounded-lg px-3 py-1 text-slate-500">Inativo</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function cardName(cardId: string, cards: CardSummary[]) {
  return cards.find((card) => card.card_id === cardId)?.name ?? cardId;
}

function accountName(accountId: string, accounts: AccountSummary[]) {
  if (!accountId.trim()) {
    return "Sem conta padrao";
  }

  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

function uniquePaymentAccounts(cards: CardSummary[]) {
  return new Set(
    cards.map((card) => card.payment_account_id).filter((accountId) => accountId.trim().length > 0),
  ).size;
}

function createEmptyCardForm(): CardFormState {
  return {
    name: "",
    limit: "0",
    closingDay: "10",
    dueDay: "20",
    paymentAccountId: "",
  };
}

function formatCurrencyInput(value: string) {
  return formatCurrency(parseInt(value || "0", 10));
}

