import { type FormEvent, type ReactNode, useMemo, useState } from "react";
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
  type CardPayload,
  type CardPurchasePayload,
  type CardSummary,
  type CardUpdatePayload,
  type InvoiceItemSummary,
  type InvoiceSummary,
  type TransactionFilters,
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
  onOpenQuickAdd: (preset: QuickAddPreset, options?: QuickAddOpenOptions) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onCreateCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
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

export function CardsView({
  accounts,
  cards,
  invoices,
  isSubmitting,
  onOpenQuickAdd,
  onOpenLedgerFiltered,
  onCreateCard,
  onCreateCardPurchase: _onCreateCardPurchase,
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
  const [createForm, setCreateForm] = useState<CardFormState>(() =>
    createEmptyCardForm(accounts[0]?.account_id ?? ""),
  );
  const [editForm, setEditForm] = useState<CardEditFormState | null>(null);
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
  const cardsWithOpenInvoices = new Set(openInvoices.map((invoice) => invoice.card_id)).size;
  const committedLimit = totalOpenAmount;
  const availableLimit = Math.max(totalLimit - committedLimit, 0);
  const limitUsage = totalLimit > 0 ? Math.min((committedLimit / totalLimit) * 100, 100) : 0;

  async function loadInvoiceItems(invoiceId: string) {
    setSelectedInvoiceId(invoiceId);
    await fetchAndSetInvoiceItems(invoiceId);
  }

  function jumpToInvoice(invoice: InvoiceSummary) {
    setSelectedScope(invoice.card_id);
    setReferenceDate(parseISO(`${invoice.reference_month}-01`));
  }

  function openCreateDialog() {
    setCreateForm(createEmptyCardForm(accounts[0]?.account_id ?? ""));
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
    if (!createForm.paymentAccountId || !createForm.name.trim()) {
      return;
    }

    await onCreateCard({
      name: createForm.name.trim(),
      limitInCents: parseInt(createForm.limit || "0", 10),
      closingDay: parseInt(createForm.closingDay || "0", 10),
      dueDay: parseInt(createForm.dueDay || "0", 10),
      paymentAccountId: createForm.paymentAccountId,
    });

    setIsCreateDialogOpen(false);
    setCreateForm(createEmptyCardForm(accounts[0]?.account_id ?? ""));
  }

  async function handleUpdateCardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCardId === null || editForm === null || !editForm.paymentAccountId || !editForm.name.trim()) {
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
                Referencia
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
                <option value={ALL_CARDS_SCOPE}>Todos os cartoes</option>
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
              Novo cartao
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className={cn("grid h-auto w-full grid-cols-1 gap-1.5 rounded-[1.5rem] bg-[rgba(214,226,239,0.46)] p-1.5 sm:grid-cols-3 md:w-auto", uiDensity === "dense" ? "mb-5" : "mb-8")}>
          <TabsTrigger value="summary" className="rounded-2xl px-6 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-black text-xs uppercase tracking-widest">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-2xl px-6 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-black text-xs uppercase tracking-widest">
            Compras
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-2xl px-6 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-black text-xs uppercase tracking-widest">
            Ajustes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 outline-none focus:ring-0">
          {isAggregateView ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <SummaryStat label="Todos os cartoes" value="Faturas abertas" />
                <SummaryStat label="Em aberto" value={formatCurrency(totalOpenAmount)} />
                <SummaryStat label="Pago no periodo" value={formatCurrency(totalPaidAmount)} />
                <SummaryStat label="Proximo vencimento" value={upcomingDueDate ?? "--"} />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
                <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-black text-slate-900">Faturas abertas</CardTitle>
                    <CardDescription className="font-bold text-slate-400">
                      Panorama do periodo por cartao. Clique para detalhar um ciclo.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {visibleInvoices.length === 0 ? (
                      <EmptySurface message="Nenhuma fatura encontrada para o periodo selecionado." />
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
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-black text-slate-900">Carteira</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <MiniMetric label="Cartoes ativos" value={String(activeCards.length)} />
                    <MiniMetric label="Limite total" value={formatCurrency(totalLimit)} />
                    <MiniMetric label="Limite comprometido" value={formatCurrency(committedLimit)} />
                    <MiniMetric label="Limite disponivel" value={formatCurrency(availableLimit)} />
                    <MiniMetric label="Com faturas abertas" value={String(cardsWithOpenInvoices)} />
                    <div className="space-y-3 rounded-[1.75rem] bg-slate-50 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                          Uso do limite
                        </span>
                        <span className="text-sm font-black text-slate-900">{Math.round(limitUsage)}%</span>
                      </div>
                      <Progress value={limitUsage} className="h-3 rounded-full bg-slate-100" />
                    </div>
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
              uiDensity={uiDensity}
            />
          )}
        </TabsContent>

        <TabsContent value="purchases" className="outline-none focus:ring-0">
          <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-black text-slate-900">
                {isAggregateView ? "Compras consolidadas" : "Historico de compras"}
              </CardTitle>
              <CardDescription className="font-bold text-slate-400">
                {isAggregateView
                  ? "Resumo do periodo por fatura. Selecione um cartao para ver itens detalhados."
                  : "Abra os itens de uma fatura no resumo para listar os lancamentos aqui."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isAggregateView ? (
                <div className={`table-shell table-shell--${uiDensity}`}>
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="border-slate-50 hover:bg-transparent">
                        <TableHead className="px-8 h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Cartao</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Referencia</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Lancamentos</TableHead>
                        <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-40 text-center text-slate-300 font-bold">
                            Nada para mostrar neste periodo.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleInvoices.map((invoice) => (
                          <TableRow key={invoice.invoice_id} className="border-slate-50">
                            <TableCell className="px-8 py-5 font-black text-slate-800">{cardName(invoice.card_id, cards)}</TableCell>
                            <TableCell className="font-bold text-slate-500">{invoice.reference_month}</TableCell>
                            <TableCell className="font-bold text-slate-500">{invoice.purchase_count}</TableCell>
                            <TableCell className="pr-8 text-right font-black text-slate-900">{formatCurrency(invoice.total_amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <>
                  {invoiceItemsError ? (
                    <div className="px-8 py-10 text-center">
                      <p className="text-sm font-bold text-rose-600">{invoiceItemsError}</p>
                    </div>
                  ) : null}
                  <InvoiceItemsTable invoiceItems={invoiceItems} />
                </>
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
                    <CardTitle className="text-2xl font-black text-slate-900">Ajustes da carteira</CardTitle>
                    <CardDescription className="font-bold text-slate-400">
                      Cadastre novos cartoes e revise limite, ciclo e conta de pagamento sem sair desta tela.
                    </CardDescription>
                  </div>
                  <Button type="button" onClick={openCreateDialog}>Novo cartao</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <SummaryStat label="Cartoes ativos" value={String(activeCards.length)} />
                  <SummaryStat label="Limite total" value={formatCurrency(totalLimit)} />
                  <SummaryStat label="Contas de pagamento" value={String(uniquePaymentAccounts(activeCards))} />
                </div>
                <div className="space-y-3">
                  {cards.length === 0 ? (
                    <EmptySurface message="Nenhum cartao cadastrado. Use Novo cartao para configurar a carteira." />
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
                            Conta de pagamento: {accountName(card.payment_account_id, accounts)}
                          </p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => openEditDialog(card)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" ? "rounded-[1.75rem]" : "rounded-[3rem]")}>
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900">Ajustes do cartao</CardTitle>
                    <CardDescription className="font-bold text-slate-400">
                      Ciclo, limite e conta de pagamento do cartao selecionado.
                    </CardDescription>
                  </div>
                  {selectedCard ? (
                    <Button type="button" onClick={() => openEditDialog(selectedCard)}>Editar cartao</Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <MiniMetric label="Nome" value={selectedCard?.name ?? "--"} />
                <MiniMetric label="Limite" value={formatCurrency(selectedCard?.limit ?? 0)} />
                <MiniMetric label="Fechamento" value={String(selectedCard?.closing_day ?? "--")} />
                <MiniMetric label="Vencimento" value={String(selectedCard?.due_day ?? "--")} />
                <MiniMetric
                  label="Conta de pagamento"
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
                Analise completa dos lancamentos deste periodo.
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
              Defina limite, ciclo e conta de pagamento para liberar compras e conciliacao.
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
              Atualize limite, ciclo, conta de pagamento ou desative o cartao sem perder historico.
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
  uiDensity: UiDensity;
}) {
  if (selectedCard === null) {
    return <EmptySurface message="Selecione um cartao para ver os detalhes do ciclo." />;
  }

  if (currentInvoice === null) {
    return <EmptySurface message="Nao ha faturas para o cartao neste periodo." />;
  }

  const progress =
    currentInvoice.total_amount > 0
      ? (currentInvoice.paid_amount / currentInvoice.total_amount) * 100
      : 0;
  const committedLimit = currentInvoice.remaining_amount;
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
        <CardHeader className="flex flex-col gap-6 space-y-0 p-6 pb-4 sm:flex-row sm:items-start sm:justify-between md:p-10 md:pb-6">
          <div className="min-w-0 space-y-2">
            <CardTitle className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Fatura de {currentInvoice.reference_month}
            </CardTitle>
            <div className="flex items-center gap-3">
              {renderStatusBadge(currentInvoice.status)}
              <Badge
                variant="outline"
                className="rounded-lg border-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-300"
              >
                {selectedCard.name}
              </Badge>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
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
              className="h-11 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
              type="button"
            >
              Ver gastos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onLoadInvoiceItems(currentInvoice.invoice_id)}
              className="h-11 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5"
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
              className="h-11 rounded-2xl bg-primary px-8 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
              type="button"
            >
              Pagar agora
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 p-6 pt-2 md:space-y-10 md:p-10 md:pt-4">
          <div className="grid grid-cols-2 gap-6 md:gap-8 lg:grid-cols-4">
            <MiniMetric label="Valor total" value={formatCurrency(currentInvoice.total_amount)} />
            <MiniMetric label="Pago" value={formatCurrency(currentInvoice.paid_amount)} />
            <MiniMetric label="Em aberto" value={formatCurrency(currentInvoice.remaining_amount)} />
            <MiniMetric label="Lancamentos" value={String(currentInvoice.purchase_count)} />
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                Progresso de pagamento
              </span>
              <span className="text-sm font-black text-slate-900">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-4 rounded-full bg-slate-50" />
          </div>

          <div className="grid grid-cols-1 gap-6 border-t border-slate-50 pt-10 md:grid-cols-2">
            <MetricPanel
              icon={<Calendar className="h-6 w-6" />}
              label="Fechamento"
              tone="neutral"
              value={currentInvoice.closing_date}
            />
            <MetricPanel
              icon={<Clock className="h-6 w-6" />}
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
            <CardTitle className="text-xl font-black text-slate-900">Limite do cartao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <MiniMetric label="Limite total" value={formatCurrency(selectedCard.limit)} />
            <MiniMetric label="Limite comprometido" value={formatCurrency(committedLimit)} />
            <MiniMetric label="Limite disponivel" value={formatCurrency(availableLimit)} />
            <div className="space-y-3 rounded-[1.75rem] bg-slate-50 p-4">
              <div className="flex items-end justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                  Uso do limite
                </span>
                <span className="text-sm font-black text-slate-900">{Math.round(limitUsage)}%</span>
              </div>
              <Progress value={limitUsage} className="h-3 rounded-full bg-slate-100" />
            </div>
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
                A fatura fecha no dia {selectedCard.closing_day}. Lancamentos antes do fechamento entram neste ciclo.
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

function CardFormFields({
  form,
  accounts,
  onChange,
}: {
  form: CardFormState;
  accounts: AccountSummary[];
  onChange: React.Dispatch<React.SetStateAction<CardFormState>>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
        Nome do cartao
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
          value={form.limit}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              limit: event.target.value.replace(/\D/g, ""),
            }))
          }
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Conta de pagamento
        <select
          className="h-11 rounded-xl border border-slate-200 px-3"
          value={form.paymentAccountId}
          onChange={(event) =>
            onChange((current) => ({ ...current, paymentAccountId: event.target.value }))
          }
          required
        >
          <option value="">Selecione</option>
          {accounts.map((account) => (
            <option key={account.account_id} value={account.account_id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
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
          <TableHead className="h-14 font-black text-[10px] uppercase tracking-widest text-slate-400">Descricao</TableHead>
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
              <TableCell className="font-black text-slate-900">{item.description || "Compra no cartao"}</TableCell>
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
    <Card className="rounded-[2.2rem] border-none bg-white shadow-sm">
      <CardContent className="space-y-2 p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">{label}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="text-lg font-black text-slate-900">{value}</p>
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
    <div className={`flex items-center gap-5 rounded-[2rem] p-6 ${toneClasses}`}>
      <div className="rounded-2xl bg-white p-3 shadow-sm">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">{label}</p>
        <p className={`text-lg font-black ${valueClasses}`}>{value}</p>
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
  return accounts.find((account) => account.account_id === accountId)?.name ?? accountId;
}

function uniquePaymentAccounts(cards: CardSummary[]) {
  return new Set(cards.map((card) => card.payment_account_id)).size;
}

function createEmptyCardForm(paymentAccountId: string): CardFormState {
  return {
    name: "",
    limit: "0",
    closingDay: "10",
    dueDay: "20",
    paymentAccountId,
  };
}


