import { useCallback, useEffect, useState } from "react";

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

import { SummaryStrip } from "./summary-strip";
import { ReimbursementList } from "./reimbursement-list";
import { ReimbursementDrawer } from "./reimbursement-drawer";
import { ReceivePaymentDialog } from "./receive-payment-dialog";

type ReimbursementsViewProps = {
  surface?: "desktop" | "mobile";
  accounts: AccountSummary[];
  month: string;
  refreshKey?: number;
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

  const loadList = useCallback(async () => {
    setIsListLoading(true);
    try {
      const data = await listReimbursements({ month });
      setReimbursements(data);
    } catch {
      setReimbursements([]);
    } finally {
      setIsListLoading(false);
    }
  }, [month]);

  const loadSummary = useCallback(async (targetMonth: string) => {
    setIsSummaryLoading(true);
    try {
      const data = await getReimbursementsSummary({ month: targetMonth });
      setSummary(data);
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  async function reload() {
    await Promise.all([loadList(), loadSummary(month)]);
  }

  useEffect(() => {
    void loadList();
  }, [loadList, refreshKey]);

  useEffect(() => {
    void loadSummary(month);
  }, [month, refreshKey, loadSummary]);

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
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    setIsSubmitting(true);
    try {
      await cancelReimbursement(id);
      await reload();
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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SummaryStrip summary={summary} loading={isSummaryLoading} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ReimbursementList
          reimbursements={reimbursements}
          loading={isListLoading}
          onSelectReimbursement={handleSelectReimbursement}
        />
      </div>

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
