import { type ReactNode, useMemo, useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
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
  DialogFooter,
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
import { formatCurrency } from "../../lib/format";
import {
  type AccountSummary,
  type CardPayload,
  type CardPurchasePayload,
  type CardSummary,
  type CardUpdatePayload,
  type InvoiceItemSummary,
  type InvoicePaymentPayload,
  type InvoiceSummary,
} from "../../lib/api";
import { useInvoiceItems } from "./use-invoice-items";

type CardsViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  isSubmitting: boolean;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onCreateCardPurchase: (payload: CardPurchasePayload) => Promise<void>;
  onPayInvoice: (payload: InvoicePaymentPayload) => Promise<void>;
  onUpdateCard: (cardId: string, payload: CardUpdatePayload) => Promise<void>;
};

const ALL_CARDS_SCOPE = "all";

export function CardsView({
  accounts,
  cards,
  invoices,
  isSubmitting,
  onCreateCard: _onCreateCard,
  onCreateCardPurchase: _onCreateCardPurchase,
  onPayInvoice,
  onUpdateCard: _onUpdateCard,
}: CardsViewProps) {
  const activeCards = useMemo(
    () => cards.filter((card) => card.is_active),
    [cards],
  );
  const [selectedScope, setSelectedScope] = useState<string>(ALL_CARDS_SCOPE);
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const {
    invoiceItems,
    isLoadingItems,
    loadError: invoiceItemsError,
    loadInvoiceItems: fetchAndSetInvoiceItems,
    clearInvoiceItemsState,
  } = useInvoiceItems();
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");

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
  const upcomingDueDate = openInvoices
    .map((invoice) => invoice.due_date)
    .sort()[0] ?? null;
  const totalLimit = activeCards.reduce((sum, card) => sum + card.limit, 0);
  const cardsWithOpenInvoices = new Set(openInvoices.map((invoice) => invoice.card_id)).size;
  const committedLimit = totalOpenAmount;
  const availableLimit = Math.max(totalLimit - committedLimit, 0);
  const limitUsage =
    totalLimit > 0 ? Math.min((committedLimit / totalLimit) * 100, 100) : 0;

  async function loadInvoiceItems(invoiceId: string) {
    setSelectedInvoiceId(invoiceId);
    await fetchAndSetInvoiceItems(invoiceId);
  }

  function openPayment(invoice: InvoiceSummary) {
    setSelectedInvoiceId(invoice.invoice_id);
    setPaymentAmount(String(invoice.remaining_amount));
    setPaymentAccountId(
      selectedCard?.payment_account_id ?? accounts[0]?.account_id ?? "",
    );
    setIsPayDialogOpen(true);
  }

  async function handlePaymentSubmit() {
    if (selectedInvoiceId === null || paymentAccountId.length === 0) {
      return;
    }

    await onPayInvoice({
      invoiceId: selectedInvoiceId,
      amountInCents: parseInt(paymentAmount, 10),
      accountId: paymentAccountId,
      paidAt: new Date().toISOString(),
    });

    setIsPayDialogOpen(false);
    setSelectedInvoiceId(null);
  }

  function jumpToInvoice(invoice: InvoiceSummary) {
    setSelectedScope(invoice.card_id);
    setReferenceDate(parseISO(`${invoice.reference_month}-01`));
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="rounded-[2.5rem] border-none bg-white p-4 shadow-sm">
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
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-8 grid h-auto w-full grid-cols-1 gap-1.5 rounded-[1.5rem] bg-slate-100/50 p-1.5 sm:grid-cols-3 md:w-auto">
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
                <Card className="rounded-[3rem] border-none shadow-sm bg-white">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl font-black text-slate-900">
                      Faturas abertas
                    </CardTitle>
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

                <Card className="rounded-[2.5rem] border-none shadow-sm bg-white">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-black text-slate-900">
                      Carteira
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <MiniMetric label="Cartoes ativos" value={String(activeCards.length)} />
                    <MiniMetric label="Limite total" value={formatCurrency(totalLimit)} />
                    <MiniMetric
                      label="Limite comprometido"
                      value={formatCurrency(committedLimit)}
                    />
                    <MiniMetric
                      label="Limite disponivel"
                      value={formatCurrency(availableLimit)}
                    />
                    <MiniMetric label="Com faturas abertas" value={String(cardsWithOpenInvoices)} />
                    <div className="space-y-3 rounded-[1.75rem] bg-slate-50 p-4">
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                          Uso do limite
                        </span>
                        <span className="text-sm font-black text-slate-900">
                          {Math.round(limitUsage)}%
                        </span>
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
              onOpenPayment={openPayment}
              onSelectInvoice={jumpToInvoice}
              selectedCard={selectedCard}
              selectedScope={selectedScope}
            />
          )}
        </TabsContent>

        <TabsContent value="purchases" className="outline-none focus:ring-0">
          <Card className="rounded-[3rem] border-none shadow-sm bg-white">
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
            <Card className="rounded-[3rem] border-none shadow-sm bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-black text-slate-900">
                  Ajustes da carteira
                </CardTitle>
                <CardDescription className="font-bold text-slate-400">
                  Resumo rapido dos cartoes ativos no ambiente atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <SummaryStat label="Cartoes ativos" value={String(activeCards.length)} />
                <SummaryStat label="Limite total" value={formatCurrency(totalLimit)} />
                <SummaryStat label="Contas de pagamento" value={String(uniquePaymentAccounts(activeCards))} />
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[3rem] border-none shadow-sm bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-black text-slate-900">
                  Ajustes do cartao
                </CardTitle>
                <CardDescription className="font-bold text-slate-400">
                  Ciclo e parametros do cartao selecionado.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <MiniMetric label="Nome" value={selectedCard?.name ?? "--"} />
                <MiniMetric label="Limite" value={formatCurrency(selectedCard?.limit ?? 0)} />
                <MiniMetric label="Fechamento" value={String(selectedCard?.closing_day ?? "--")} />
                <MiniMetric label="Vencimento" value={String(selectedCard?.due_day ?? "--")} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Drawer
        open={selectedInvoiceId !== null && !isPayDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvoiceId(null);
            clearInvoiceItemsState();
          }
        }}
      >
        <DrawerContent className="max-h-[85vh] rounded-t-[3rem] border-none shadow-2xl">
          <div className="mx-auto w-full max-w-4xl px-8 py-10 overflow-hidden flex flex-col">
            <DrawerHeader className="px-0 mb-6">
              <DrawerTitle className="text-4xl font-black tracking-tighter">
                Resumo detalhado
              </DrawerTitle>
              <DrawerDescription className="font-bold text-slate-400 text-base">
                Analise completa dos lancamentos deste periodo.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 rounded-[2.5rem] border border-slate-50 shadow-inner bg-white overflow-auto">
              {isLoadingItems ? (
                <div className="p-20 text-center">
                  <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-[10px]">
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
                className="w-full h-14 rounded-[1.5rem] font-black text-slate-400 hover:text-slate-600"
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

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-md rounded-[3rem] p-10 border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black tracking-tight">
              Pagar fatura
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-400 text-base">
              Escolha uma conta para liquidar esta pendencia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              Valor do pagamento
              <input
                type="number"
                className="h-16 rounded-[1.5rem] bg-slate-50 border-none px-6 font-black text-2xl outline-none"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              Conta
              <select
                aria-label="Conta para pagamento"
                className="h-14 rounded-[1.5rem] bg-slate-50 border-none px-4 text-base font-bold outline-none"
                value={paymentAccountId}
                onChange={(event) => setPaymentAccountId(event.target.value)}
              >
                <option value="">Selecione a conta</option>
                {accounts.map((account) => (
                  <option key={account.account_id} value={account.account_id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <DialogFooter className="mt-8 flex flex-col gap-3">
            <Button
              onClick={() => void handlePaymentSubmit()}
              disabled={isSubmitting}
              className="w-full h-14 rounded-[1.5rem] font-black"
              type="button"
            >
              {isSubmitting ? "Processando..." : "Confirmar pagamento"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsPayDialogOpen(false)}
              className="w-full h-12 rounded-[1.5rem] font-black text-slate-400"
              type="button"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardScopeDetail({
  currentInvoice,
  invoices,
  onLoadInvoiceItems,
  onOpenPayment,
  onSelectInvoice,
  selectedCard,
  selectedScope,
}: {
  currentInvoice: InvoiceSummary | null;
  invoices: InvoiceSummary[];
  onLoadInvoiceItems: (invoiceId: string) => Promise<void>;
  onOpenPayment: (invoice: InvoiceSummary) => void;
  onSelectInvoice: (invoice: InvoiceSummary) => void;
  selectedCard: CardSummary | null;
  selectedScope: string;
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
        invoice.card_id === selectedScope &&
        invoice.invoice_id !== currentInvoice.invoice_id,
    )
    .sort((left, right) => right.reference_month.localeCompare(left.reference_month))
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <Card className="lg:col-span-8 rounded-[3rem] border-none shadow-sm overflow-hidden bg-white">
        <CardHeader className="flex flex-col gap-6 space-y-0 p-6 pb-4 sm:flex-row sm:items-start sm:justify-between md:p-10 md:pb-6">
          <div className="min-w-0 space-y-2">
            <CardTitle className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Fatura de {currentInvoice.reference_month}
            </CardTitle>
            <div className="flex items-center gap-3">
              {renderStatusBadge(currentInvoice.status)}
              <Badge
                variant="outline"
                className="rounded-lg border-slate-100 text-slate-300 font-bold px-2 py-0.5 text-[10px]"
              >
                {selectedCard.name}
              </Badge>
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
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
              onClick={() => onOpenPayment(currentInvoice)}
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
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                Progresso de pagamento
              </span>
              <span className="text-sm font-black text-slate-900">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-4 bg-slate-50 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-10 border-slate-50">
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

      <div className="lg:col-span-4 space-y-8">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black text-slate-900">
              Limite do cartao
            </CardTitle>
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
                <span className="text-sm font-black text-slate-900">
                  {Math.round(limitUsage)}%
                </span>
              </div>
              <Progress value={limitUsage} className="h-3 rounded-full bg-slate-100" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-sm bg-primary/5 border-primary/10 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-black text-primary/80">
              Regra do Agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-start">
              <div className="p-2.5 bg-primary/10 rounded-2xl shrink-0">
                <AlertCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-primary/70 leading-relaxed font-bold">
                A fatura fecha no dia {selectedCard.closing_day}. Lancamentos antes do fechamento entram neste ciclo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-black text-slate-800">
              Ciclos anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-8">
            <div className="space-y-1">
              {previousInvoices.length === 0 ? (
                <p className="px-6 py-4 text-sm font-bold text-slate-400">
                  Nenhum ciclo anterior carregado.
                </p>
              ) : (
                previousInvoices.map((invoice) => (
                  <Button
                    key={invoice.invoice_id}
                    variant="ghost"
                    onClick={() => onSelectInvoice(invoice)}
                    className="w-full justify-between h-auto py-4 px-6 rounded-2xl hover:bg-slate-50"
                    type="button"
                  >
                    <div className="text-left flex items-center gap-4">
                      <div className="p-2 bg-slate-100 rounded-xl text-slate-400">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-black text-slate-700 text-base">
                          {invoice.reference_month}
                        </p>
                        <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
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
              <TableCell className="font-black text-slate-900">
                {item.description || "Compra no cartao"}
              </TableCell>
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
    <Card className="rounded-[2.2rem] border-none shadow-sm bg-white">
      <CardContent className="space-y-2 p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
        {label}
      </p>
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
      ? "bg-rose-50/40 border border-rose-100/20 text-rose-500"
      : "bg-slate-50 text-slate-400";
  const valueClasses = tone === "danger" ? "text-rose-700" : "text-slate-700";

  return (
    <div className={`flex items-center gap-5 p-6 rounded-[2rem] ${toneClasses}`}>
      <div className="p-3 bg-white rounded-2xl shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
          {label}
        </p>
        <p className={`font-black text-lg ${valueClasses}`}>{value}</p>
      </div>
    </div>
  );
}

function EmptySurface({ message }: { message: string }) {
  return (
    <Card className="rounded-[2.5rem] border-none shadow-sm p-16 text-center bg-white">
      <p className="text-slate-400 font-bold">{message}</p>
    </Card>
  );
}

function renderStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-3 py-1 rounded-lg">
          Paga
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none px-3 py-1 rounded-lg">
          Parcial
        </Badge>
      );
    case "open":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3 py-1 rounded-lg">
          Aberta
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function cardName(cardId: string, cards: CardSummary[]) {
  return cards.find((card) => card.card_id === cardId)?.name ?? cardId;
}

function uniquePaymentAccounts(cards: CardSummary[]) {
  return new Set(cards.map((card) => card.payment_account_id)).size;
}
