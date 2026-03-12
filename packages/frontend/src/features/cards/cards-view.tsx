import { useMemo, useState, useEffect } from "react";

import type { QuickAddPreset } from "../../components/quick-add-composer";
import {
  type AccountSummary,
  type CardInstallmentSummary,
  type CardPayload,
  type CardSummary,
  type CardUpdatePayload,
  type InvoiceSummary,
  type TransactionFilters,
  fetchCardInstallments,
} from "../../lib/api";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

import { CardsHeader, ALL_CARDS_SCOPE } from "./components/cards-header";
import { MonthSummary } from "./components/month-summary";
import { CardList } from "./components/card-list";
import { CardDetail } from "./components/card-detail";
import { ManageCardsSheet } from "./components/manage-cards-sheet";
import { CreateCardDialog, EditCardDialog } from "./components/card-form-dialog";
import { useInvoiceItems } from "./use-invoice-items";

type QuickAddOpenOptions = {
  invoiceId?: string;
};

type CardsViewProps = {
  surface?: "desktop" | "mobile";
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  selectedMonth: string; // "yyyy-MM" — vem do MonthPicker global
  isSubmitting: boolean;
  onOpenSettings: () => void;
  onOpenQuickAdd: (preset: QuickAddPreset, options?: QuickAddOpenOptions) => void;
  onOpenLedgerFiltered: (filters: Partial<TransactionFilters>, month?: string) => void;
  onCreateCard: (payload: CardPayload) => Promise<void>;
  onSetCardActive: (card: CardSummary, isActive: boolean) => Promise<void>;
  onUpdateCard: (cardId: string, payload: CardUpdatePayload) => Promise<void>;
  uiDensity: UiDensity;
};

export function CardsView({
  surface = "desktop",
  accounts,
  cards,
  invoices,
  selectedMonth,
  isSubmitting,
  onOpenSettings,
  onOpenQuickAdd,
  onOpenLedgerFiltered,
  onCreateCard,
  onSetCardActive,
  onUpdateCard,
  uiDensity,
}: CardsViewProps) {
  const isMobileSurface = surface === "mobile";
  const activeCards = useMemo(() => cards.filter((card) => card.is_active), [cards]);

  const [selectedScope, setSelectedScope] = useState<string>(ALL_CARDS_SCOPE);
  const [isManageSheetOpen, setIsManageSheetOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardSummary | null>(null);

  const [futureInstallments, setFutureInstallments] = useState<CardInstallmentSummary[]>([]);
  const [installmentsLoadError, setInstallmentsLoadError] = useState<string | null>(null);

  const {
    invoiceItems,
    isLoadingItems,
    loadError: invoiceItemsError,
    loadInvoiceItems: fetchAndSetInvoiceItems,
    clearInvoiceItemsState,
  } = useInvoiceItems();

  const referenceMonth = selectedMonth;
  const isAggregateView = selectedScope === ALL_CARDS_SCOPE;
  const selectedCard = activeCards.find((card) => card.card_id === selectedScope) ?? null;

  // Filter invoices for the current month across ALL active cards (for aggregate view)
  const monthInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.reference_month === referenceMonth && activeCards.some((c) => c.card_id === inv.card_id),
    );
  }, [invoices, referenceMonth, activeCards]);

  const invoicesByCardId = useMemo(() => {
    const map = new Map<string, InvoiceSummary>();
    monthInvoices.forEach((inv) => map.set(inv.card_id, inv));
    return map;
  }, [monthInvoices]);

  const totalOpenAmount = monthInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
  const totalFutureInstallments = activeCards.reduce(
    (sum, card) => sum + (card.future_installment_total ?? 0),
    0,
  );
  const totalLimitCommitted = totalOpenAmount + totalFutureInstallments;

  // For Detail View
  const detailCurrentInvoice = useMemo(() => {
    if (isAggregateView) return null;
    return monthInvoices.find((inv) => inv.card_id === selectedScope) ?? null;
  }, [monthInvoices, isAggregateView, selectedScope]);

  const detailPreviousInvoices = useMemo(() => {
    if (isAggregateView) return [];
    return invoices
      .filter((inv) => inv.card_id === selectedScope && inv.reference_month < referenceMonth)
      .sort((a, b) => b.reference_month.localeCompare(a.reference_month));
  }, [invoices, isAggregateView, selectedScope, referenceMonth]);

  // Clear invoice items when switching scope or going back to aggregate
  useEffect(() => {
    clearInvoiceItemsState();
  }, [selectedScope, clearInvoiceItemsState]);

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
          setFutureInstallments(installments.filter((i) => i.reference_month > referenceMonth));
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

  function handleSelectCard(cardId: string) {
    setSelectedScope(cardId);
  }

  function handleOpenHistory(cardId: string, month: string) {
    onOpenLedgerFiltered(
      {
        period: "month",
        reference: `${month}-01`,
        card: cardId,
      },
      month,
    );
  }

  function jumpToInvoice(invoiceId: string) {
    const inv = invoices.find((i) => i.invoice_id === invoiceId);
    if (inv) {
      // mês controlado pelo MonthPicker global — apenas navega para o cartão
      setSelectedScope(inv.card_id);
    }
  }

  async function handleToggleCardActive(card: CardSummary) {
    const nextIsActive = !card.is_active;
    if (!nextIsActive && !globalThis.confirm("Desativar este cartão? Faturas e histórico serão preservados.")) {
      return;
    }
    await onSetCardActive(card, nextIsActive);
    if (!nextIsActive && selectedScope === card.card_id) {
      setSelectedScope(ALL_CARDS_SCOPE);
    }
    if (editingCard?.card_id === card.card_id) {
      setEditingCard(null);
    }
  }

  return (
    <div
      className={cn(
        "pb-10",
        uiDensity === "comfort" ? "space-y-8" : uiDensity === "compact" ? "space-y-6" : "space-y-4",
      )}
    >
      <CardsHeader
        selectedScope={selectedScope}
        onScopeChange={setSelectedScope}
        activeCards={activeCards}
        showManageCardsAction={!isMobileSurface}
        onOpenManageCards={() => setIsManageSheetOpen(true)}
      />

      {isAggregateView ? (
        <div className="space-y-6">
          <MonthSummary invoices={monthInvoices} totalLimitCommitted={totalLimitCommitted} />
          <CardList
            activeCards={activeCards}
            invoicesByCard={invoicesByCardId}
            onSelectCard={handleSelectCard}
            onOpenHistory={handleOpenHistory}
          />
        </div>
      ) : (
        selectedCard && (
          <CardDetail
            card={selectedCard}
            invoice={detailCurrentInvoice}
            previousInvoices={detailPreviousInvoices}
            futureInstallments={futureInstallments}
            installmentsLoadError={installmentsLoadError}
            invoiceItems={invoiceItems}
            isLoadingItems={isLoadingItems}
            invoiceItemsError={invoiceItemsError}
            onBack={() => setSelectedScope(ALL_CARDS_SCOPE)}
            onLoadInvoiceItems={fetchAndSetInvoiceItems}
            onOpenLedgerFiltered={onOpenLedgerFiltered}
            onOpenQuickAdd={onOpenQuickAdd}
            onSelectInvoice={jumpToInvoice}
          />
        )
      )}

      {/* Sheets and dialogs remain desktop-only in v1 mobile surface */}
      {!isMobileSurface ? (
        <>
          <ManageCardsSheet
            open={isManageSheetOpen}
            onOpenChange={setIsManageSheetOpen}
            cards={cards} // all cards, including inactive
            accounts={accounts}
            onAddCard={() => setIsCreateDialogOpen(true)}
            onEditCard={(card) => setEditingCard(card)}
            onToggleCardActive={(card) => void handleToggleCardActive(card)}
          />

          <CreateCardDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            accounts={accounts}
            isSubmitting={isSubmitting}
            onCreateCard={onCreateCard}
          />

          <EditCardDialog
            open={editingCard !== null}
            onOpenChange={(open) => {
              if (!open) setEditingCard(null);
            }}
            card={editingCard}
            accounts={accounts}
            isSubmitting={isSubmitting}
            onUpdateCard={onUpdateCard}
          />
        </>
      ) : null}
    </div>
  );
}
