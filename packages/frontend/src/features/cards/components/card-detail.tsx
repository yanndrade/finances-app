import { useState } from "react";
import { ArrowLeft, Calendar, ChevronDown, ChevronRight, Clock, ExternalLink, Receipt } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Progress } from "../../../components/ui/progress";
import type {
  CardInstallmentSummary,
  CardSummary,
  InvoiceItemSummary,
  InvoiceSummary,
  TransactionFilters,
} from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import type { QuickAddPreset } from "../../../components/quick-add-composer";
import { cn } from "../../../lib/utils";
import {
  getDisplayedInvoiceAmount,
  getInvoiceCycleDates,
  MetricPanel,
  MiniMetric,
  renderInvoiceStatusBadge,
} from "./shared";

type QuickAddOpenOptions = {
  invoiceId?: string;
};

type CardDetailProps = {
  card: CardSummary;
  invoice: InvoiceSummary | null;
  previousInvoices: InvoiceSummary[];
  futureInstallments: CardInstallmentSummary[];
  installmentsLoadError: string | null;
  invoiceItems: InvoiceItemSummary[];
  isLoadingItems: boolean;
  invoiceItemsError: string | null;
  onBack: () => void;
  onLoadInvoiceItems: (invoiceId: string) => Promise<void>;
  onOpenLedgerFiltered: (filters: Partial<TransactionFilters>, month?: string) => void;
  onOpenQuickAdd: (preset: QuickAddPreset, options?: QuickAddOpenOptions) => void;
  onSelectInvoice: (invoiceId: string) => void;
};

// Group future installments by reference_month
function groupInstallmentsByMonth(installments: CardInstallmentSummary[]) {
  const groups = new Map<string, CardInstallmentSummary[]>();
  for (const item of installments) {
    const month = item.reference_month;
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(item);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function CardDetail({
  card,
  invoice,
  previousInvoices,
  futureInstallments,
  installmentsLoadError,
  invoiceItems,
  isLoadingItems,
  invoiceItemsError,
  onBack,
  onLoadInvoiceItems,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  onSelectInvoice,
}: CardDetailProps) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  function toggleMonth(month: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  async function handleToggleItems() {
    if (!invoice) return;
    if (!itemsOpen && invoiceItems.length === 0 && !isLoadingItems) {
      await onLoadInvoiceItems(invoice.invoice_id);
    }
    setItemsOpen((v) => !v);
  }

  if (!invoice) {
    return (
      <div className="rounded-[2.5rem] bg-white p-16 text-center shadow-sm">
        <p className="font-bold text-slate-400">Não há faturas para este cartão no período selecionado.</p>
        <Button variant="link" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const displayedInvoiceAmount = getDisplayedInvoiceAmount(invoice);
  const progress = invoice.total_amount > 0 ? (invoice.paid_amount / invoice.total_amount) * 100 : 0;
  const isPaidFull = progress >= 100;
  const { closingDate, dueDate } = getInvoiceCycleDates(invoice, card);

  const committedLimit = invoice.remaining_amount + (card.future_installment_total ?? 0);
  const availableLimit = Math.max(card.limit - committedLimit, 0);
  const limitUsage = card.limit > 0 ? Math.min((committedLimit / card.limit) * 100, 100) : 0;

  const installmentGroups = groupInstallmentsByMonth(futureInstallments);
  const itemsTotal = invoiceItems.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header: back + name + cycle */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Voltar para visão geral"
          className="h-10 w-10 rounded-xl bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-900 shadow-sm border border-slate-100/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-black text-slate-900 leading-none">{card.name}</h2>
          <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
            {invoice.reference_month}
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        {/* ── Main column (col-span-8) ── */}
        <div className="lg:col-span-8 space-y-4">

          {/* Band 1: Invoice summary */}
          <Card className="rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
            <CardContent className="p-5">
              {/* Total + status + actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black tracking-tighter text-slate-900 truncate tabular-nums">
                    {formatCurrency(displayedInvoiceAmount)}
                  </span>
                  {renderInvoiceStatusBadge(invoice, card)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onOpenLedgerFiltered(
                        {
                          period: "month",
                          reference: `${invoice.reference_month}-01`,
                          card: card.card_id,
                        },
                        invoice.reference_month,
                      )
                    }
                    className="h-8 rounded-lg px-3 text-[12px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Ver no histórico
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleToggleItems()}
                    className={cn(
                      "h-8 rounded-lg px-3 text-[12px] font-black uppercase tracking-widest",
                      itemsOpen
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    Itens da fatura
                    {itemsOpen ? (
                      <ChevronDown className="ml-1.5 h-3 w-3" />
                    ) : (
                      <ChevronRight className="ml-1.5 h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      onOpenQuickAdd("transfer_invoice_payment", { invoiceId: invoice.invoice_id })
                    }
                    disabled={invoice.remaining_amount <= 0 || Number.isNaN(invoice.remaining_amount)}
                    className="h-8 rounded-lg px-4 text-[12px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow shadow-primary/20 hover:bg-primary/90"
                  >
                    Pagar fatura
                  </Button>
                </div>
              </div>

              {/* Band 2: compact metrics row */}
              <div className="mt-4 flex flex-wrap gap-6 border-t border-slate-50 pt-4">
                <MiniMetric label="Pago" value={formatCurrency(invoice.paid_amount)} />
                <MiniMetric label="Em aberto" value={formatCurrency(invoice.remaining_amount)} />
                <MetricPanel
                  icon={<Calendar className="h-4 w-4" />}
                  label="Fechamento"
                  tone="neutral"
                  value={closingDate}
                />
                <MetricPanel
                  icon={<Clock className="h-4 w-4" />}
                  label="Vencimento"
                  tone="danger"
                  value={dueDate}
                />
                {/* Progress: text when 100%, bar when partial */}
                {isPaidFull ? (
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-black uppercase tracking-[0.15em] text-slate-300">Progresso</p>
                    <p className="text-sm font-black text-emerald-600">Pago integralmente</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 min-w-[100px] flex-1">
                    <p className="text-[13px] font-black uppercase tracking-[0.15em] text-slate-300">Progresso</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Progress value={progress} className="h-1.5 flex-1 rounded-full bg-slate-100" />
                      <span className="text-[12px] font-black text-slate-500 tabular-nums">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Inline invoice items panel */}
          {itemsOpen && (
            <Card className="rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
              <CardContent className="p-5">
                {isLoadingItems ? (
                  <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-300 py-8 text-center">
                    Carregando itens...
                  </p>
                ) : invoiceItemsError ? (
                  <p className="text-sm font-bold text-rose-600 py-4">{invoiceItemsError}</p>
                ) : (
                  <>
                    {/* Summary line */}
                    <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-3">
                      {invoiceItems.length} lançamento{invoiceItems.length !== 1 ? "s" : ""} ·{" "}
                      {formatCurrency(itemsTotal)}
                    </p>
                    {/* Compact list */}
                    <div className="space-y-1">
                      {invoiceItems.map((item) => (
                        <div
                          key={item.invoice_item_id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors"
                        >
                          <span className="w-12 shrink-0 text-[12px] font-bold text-slate-400 tabular-nums">
                            {format(parseISO(item.purchase_date), "dd MMM")}
                          </span>
                          <span className="flex-1 truncate text-sm font-bold text-slate-900">
                            {item.description || "Compra no cartão"}
                          </span>
                          {item.installments_count > 1 && (
                            <span className="shrink-0 text-[12px] font-bold text-slate-400 tabular-nums">
                              {item.installment_number}/{item.installments_count}
                            </span>
                          )}
                          <span className="shrink-0 text-sm font-black text-slate-900 tabular-nums">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Link to history */}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenLedgerFiltered(
                          {
                            period: "month",
                            reference: `${invoice.reference_month}-01`,
                            card: card.card_id,
                          },
                          invoice.reference_month,
                        )
                      }
                      className="mt-3 text-[12px] font-black uppercase tracking-widest text-primary hover:underline"
                    >
                      Ver tudo no histórico →
                    </button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar (col-span-4) ── */}
        <div className="lg:col-span-4 space-y-4">

          {/* Limit usage */}
          <Card className="rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <p className="text-[12px] font-black uppercase tracking-widest text-slate-400">Uso de Limite</p>
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-black text-slate-900">{Math.round(limitUsage)}%</span>
                  <span className="text-[12px] font-bold text-slate-400 tabular-nums">
                    {formatCurrency(committedLimit)} / {formatCurrency(card.limit)}
                  </span>
                </div>
                <Progress value={limitUsage} className="h-2 rounded-full bg-slate-100" />
              </div>
              <div className="border-t border-slate-50 pt-3">
                <p className="text-[13px] font-black uppercase tracking-[0.15em] text-slate-300">Disponível</p>
                <p className="text-xl font-black text-slate-900 truncate tabular-nums">{formatCurrency(availableLimit)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Future installments — grouped by month */}
          {(futureInstallments.length > 0 || installmentsLoadError) && (
            <Card className="rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-[12px] font-black uppercase tracking-widest text-slate-400">
                  Parcelas Futuras
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                {installmentsLoadError ? (
                  <p className="text-sm font-bold text-rose-600">{installmentsLoadError}</p>
                ) : (
                  <div className="space-y-1">
                    {installmentGroups.map(([month, items]) => {
                      const monthTotal = items.reduce((s, i) => s + i.amount, 0);
                      const isExpanded = expandedMonths.has(month);
                      return (
                        <div key={month}>
                          <button
                            type="button"
                            onClick={() => toggleMonth(month)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                          >
                            <span className="text-xs font-bold text-slate-700">{month}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-bold text-slate-400">
                                {items.length} lançamento{items.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-xs font-black text-slate-900 tabular-nums">
                                {formatCurrency(monthTotal)}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                              )}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="ml-3 space-y-0.5 pb-1">
                              {items.map((item) => (
                                <div
                                  key={item.installment_id}
                                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-slate-50/60"
                                >
                                  <span className="flex-1 truncate text-xs font-bold text-slate-700">
                                    {item.description || "Compra parcelada"}
                                  </span>
                                  <span className="shrink-0 text-[12px] font-bold text-slate-400 tabular-nums">
                                    {item.installment_number}/{item.installments_count}
                                  </span>
                                  <span className="shrink-0 text-xs font-black text-slate-900 tabular-nums">
                                    {formatCurrency(item.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Previous invoices */}
          {previousInvoices.length > 0 && (
            <Card className="rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-[12px] font-black uppercase tracking-widest text-slate-400">
                  Ciclos Anteriores
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <div className="space-y-0.5">
                  {previousInvoices.map((inv) => (
                    <button
                      key={inv.invoice_id}
                      type="button"
                      onClick={() => onSelectInvoice(inv.invoice_id)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Receipt className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-bold text-slate-700">{inv.reference_month}</span>
                        {renderInvoiceStatusBadge(inv)}
                      </div>
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        {formatCurrency(getDisplayedInvoiceAmount(inv))}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
