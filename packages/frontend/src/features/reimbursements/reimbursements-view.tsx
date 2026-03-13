import { useEffect, useState } from "react";

import {
  cancelReimbursement,
  getReimbursementsSummary,
  listReimbursements,
  markReimbursementReceived,
  updateReimbursement,
  type AccountSummary,
  type PendingReimbursementSummary,
  type ReimbursementSummary,
} from "../../lib/api";
import { getErrorMessage } from "../../lib/utils";

import { SummaryStrip } from "./summary-strip";
import { ReimbursementList } from "./reimbursement-list";
import { ReimbursementDrawer } from "./reimbursement-drawer";
import { ReceivePaymentDialog } from "./receive-payment-dialog";

type ReimbursementsViewProps = {
  surface?: "desktop" | "mobile";
  accounts: AccountSummary[];
  month: string;
  refreshKey?: number;
  onError?: (message: string) => void;
  onOpenQuickAdd?: () => void;
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
  month,
  refreshKey,
  onError,
  onOpenQuickAdd,
}: ReimbursementsViewProps) {
  const isMobileSurface = surface === "mobile";
  const [reimbursements, setReimbursements] = useState<PendingReimbursementSummary[]>([]);
  const [summary, setSummary] = useState<ReimbursementSummary>(EMPTY_SUMMARY);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedReimbursement, setSelectedReimbursement] =
    useState<PendingReimbursementSummary | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  async function reload() {
    await Promise.all([
      listReimbursements({ month }).then(setReimbursements).catch(() => setReimbursements([])),
      getReimbursementsSummary({ month }).then(setSummary).catch(() => setSummary(EMPTY_SUMMARY)),
    ]);
  }

  useEffect(() => {
    let cancelled = false;
    setIsListLoading(true);
    listReimbursements({ month }).then(
      (data) => { if (!cancelled) setReimbursements(data); },
      (err) => {
        if (!cancelled) {
          setReimbursements([]);
          onError?.(getErrorMessage(err));
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
          onError?.(getErrorMessage(err));
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

  async function handleUpdate(
    id: string,
    expectedAt: string | null,
    notes: string | null,
  ) {
    setIsSubmitting(true);
    try {
      const updated = await updateReimbursement(id, { expectedAt, notes });
      setReimbursements((previous) =>
        previous.map((item) => (item.transaction_id === id ? updated : item)),
      );
      setSelectedReimbursement(updated);
    } catch (error) {
      onError?.(getErrorMessage(error));
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
      onError?.(getErrorMessage(error));
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
      onError?.(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SummaryStrip summary={summary} loading={isSummaryLoading} />

      <ReimbursementList
        reimbursements={reimbursements}
        loading={isListLoading}
        onSelectReimbursement={handleSelectReimbursement}
        onOpenQuickAdd={onOpenQuickAdd}
      />

      <ReimbursementDrawer
        reimbursement={selectedReimbursement}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        isSubmitting={isSubmitting}
        onUpdate={handleUpdate}
        onCancel={handleCancel}
        onRegisterPayment={handleOpenPaymentDialog}
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
