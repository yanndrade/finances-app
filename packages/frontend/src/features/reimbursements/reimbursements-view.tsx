import { useEffect, useState } from "react";

import {
  cancelReimbursement,
  getReimbursementsSummary,
  listReimbursements,
  markReimbursementReceived,
  updateReimbursement,
  type AccountSummary,
  type CardSummary,
  type PendingReimbursementSummary,
  type ReimbursementSummary,
  type TransactionFilters,
} from "../../lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

import { SummaryStrip } from "./summary-strip";
import { ReimbursementList } from "./reimbursement-list";
import { ReimbursementPersonList } from "./reimbursement-person-list";
import { ReimbursementDrawer } from "./reimbursement-drawer";
import { ReceivePaymentDialog } from "./receive-payment-dialog";

type ReimbursementsViewProps = {
  surface?: "desktop" | "mobile";
  accounts: AccountSummary[];
  cards: CardSummary[];
  month: string;
  refreshKey?: number;
  onError?: (error: unknown) => void;
  onOpenQuickAdd?: () => void;
  onOpenLedgerFiltered?: (filters: Partial<TransactionFilters>, month?: string) => void;
};

const EMPTY_SUMMARY: ReimbursementSummary = {
  total_outstanding: 0,
  received_in_month: 0,
  expiring_soon_count: 0,
  expiring_soon_total: 0,
  overdue_count: 0,
  overdue_total: 0,
};

export function ReimbursementsView({
  surface = "desktop",
  accounts,
  cards,
  month,
  refreshKey,
  onError,
  onOpenQuickAdd,
  onOpenLedgerFiltered,
}: ReimbursementsViewProps) {
  const isMobileSurface = surface === "mobile";
  const [reimbursements, setReimbursements] = useState<PendingReimbursementSummary[]>([]);
  const [summary, setSummary] = useState<ReimbursementSummary>(EMPTY_SUMMARY);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"entries" | "people">("entries");

  const [selectedReimbursement, setSelectedReimbursement] =
    useState<PendingReimbursementSummary | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  async function reload() {
    await Promise.all([
      listReimbursements({ month, includeSourceDetails: true })
        .then(setReimbursements)
        .catch(() => setReimbursements([])),
      getReimbursementsSummary({ month }).then(setSummary).catch(() => setSummary(EMPTY_SUMMARY)),
    ]);
  }

  useEffect(() => {
    let cancelled = false;
    setIsListLoading(true);
    listReimbursements({ month, includeSourceDetails: true }).then(
      (data) => { if (!cancelled) setReimbursements(data); },
      (err) => {
        if (!cancelled) {
          setReimbursements([]);
          onError?.(err);
        }
      },
    ).finally(() => { if (!cancelled) setIsListLoading(false); });
    return () => { cancelled = true; };
  }, [month, refreshKey, onError]);

  useEffect(() => {
    let cancelled = false;
    setIsSummaryLoading(true);
    getReimbursementsSummary({ month }).then(
      (data) => { if (!cancelled) setSummary(data); },
      (err) => {
        if (!cancelled) {
          setSummary(EMPTY_SUMMARY);
          onError?.(err);
        }
      },
    ).finally(() => { if (!cancelled) setIsSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [month, refreshKey, onError]);

  function handleSelectReimbursement(reimbursement: PendingReimbursementSummary) {
    setSelectedReimbursement(reimbursement);
    setIsDrawerOpen(true);
  }

  function handleOpenPaymentDialog() {
    setIsPaymentDialogOpen(true);
  }

  function handleOpenRelatedPurchase(reimbursement: PendingReimbursementSummary) {
    if (!onOpenLedgerFiltered) {
      return;
    }

    const searchText =
      reimbursement.source_transaction_id?.trim() ||
      reimbursement.source_title?.trim() ||
      reimbursement.source_description?.trim();

    if (!searchText) {
      return;
    }

    const sourceMonth = resolveSourceMonth(reimbursement) ?? month;
    const filters: Partial<TransactionFilters> = {
      period: "month",
      text: searchText,
    };

    if (reimbursement.source_card_id) {
      filters.card = reimbursement.source_card_id;
    }

    onOpenLedgerFiltered(filters, sourceMonth);
    setIsDrawerOpen(false);
  }

  async function handleUpdate(
    id: string,
    expectedAt: string | null,
    notes: string | null,
  ) {
    setIsSubmitting(true);
    try {
      const updated = await updateReimbursement(id, { expectedAt, notes });
      setReimbursements((previous) =>
        previous.map((item) => (
          item.transaction_id === id
            ? { ...item, ...updated }
            : item
        )),
      );
      setSelectedReimbursement((previous) => (
        previous && previous.transaction_id === id
          ? { ...previous, ...updated }
          : updated
      ));
    } catch (error) {
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    setIsSubmitting(true);
    try {
      await cancelReimbursement(id);
      await reload();
    } catch (error) {
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePaymentSubmit(params: {
    transactionId: string;
    amount: number | undefined;
    receivedAt: string;
    accountId: string | undefined;
  }) {
    setIsSubmitting(true);
    try {
      await markReimbursementReceived(params.transactionId, {
        receivedAt: params.receivedAt,
        accountId: params.accountId,
        amount: params.amount,
      });
      await reload();
      setIsDrawerOpen(false);
    } catch (error) {
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SummaryStrip summary={summary} loading={isSummaryLoading} />

      <Tabs
        className="space-y-4"
        value={viewMode}
        onValueChange={(value) => {
          if (value === "entries" || value === "people") {
            setViewMode(value);
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="entries">Por lançamentos</TabsTrigger>
          <TabsTrigger value="people">Por pessoa</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-0">
          <ReimbursementList
            reimbursements={reimbursements}
            loading={isListLoading}
            onSelectReimbursement={handleSelectReimbursement}
            onOpenQuickAdd={onOpenQuickAdd}
          />
        </TabsContent>

        <TabsContent value="people" className="mt-0">
          <ReimbursementPersonList
            reimbursements={reimbursements}
            loading={isListLoading}
            onSelectReimbursement={handleSelectReimbursement}
            onOpenQuickAdd={onOpenQuickAdd}
          />
        </TabsContent>
      </Tabs>

      <ReimbursementDrawer
        reimbursement={selectedReimbursement}
        cards={cards}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        isSubmitting={isSubmitting}
        onUpdate={handleUpdate}
        onCancel={handleCancel}
        onRegisterPayment={handleOpenPaymentDialog}
        onOpenRelatedPurchase={handleOpenRelatedPurchase}
        allowSecondaryActions={!isMobileSurface}
      />

      <ReceivePaymentDialog
        reimbursement={selectedReimbursement}
        accounts={accounts}
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        isSubmitting={isSubmitting}
        onSubmit={handlePaymentSubmit}
      />
    </div>
  );
}

function resolveSourceMonth(
  reimbursement: PendingReimbursementSummary,
): string | null {
  const value =
    reimbursement.source_purchase_date ??
    reimbursement.source_posted_at ??
    reimbursement.occurred_at;
  const month = value.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) ? month : null;
}
