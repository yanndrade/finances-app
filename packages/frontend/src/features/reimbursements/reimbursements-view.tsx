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

// ─── Types ────────────────────────────────────────────────────────────────────

type ReimbursementsViewProps = {
  accounts: AccountSummary[];
  month: string;
  refreshKey?: number;
};

// ─── Empty defaults ───────────────────────────────────────────────────────────

const EMPTY_SUMMARY: ReimbursementSummary = {
  total_outstanding: 0,
  received_in_month: 0,
  expiring_soon_count: 0,
  expiring_soon_total: 0,
  overdue_count: 0,
  overdue_total: 0,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ReimbursementsView({ accounts, month, refreshKey }: ReimbursementsViewProps) {
  // ── Data state ────────────────────────────────────────────────────────────
  const [reimbursements, setReimbursements] = useState<PendingReimbursementSummary[]>([]);
  const [summary, setSummary] = useState<ReimbursementSummary>(EMPTY_SUMMARY);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedReimbursement, setSelectedReimbursement] =
    useState<PendingReimbursementSummary | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectReimbursement(r: PendingReimbursementSummary) {
    setSelectedReimbursement(r);
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
      // Update in place so drawer reflects new values without full reload
      setReimbursements((prev) =>
        prev.map((r) => (r.transaction_id === id ? updated : r)),
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Summary strip — 4 metric cards */}
      <SummaryStrip summary={summary} loading={isSummaryLoading} />

      {/* Operational list — grouped by status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ReimbursementList
          reimbursements={reimbursements}
          loading={isListLoading}
          onSelectReimbursement={handleSelectReimbursement}
        />
      </div>

      {/* Detail drawer */}
      <ReimbursementDrawer
        reimbursement={selectedReimbursement}
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        isSubmitting={isSubmitting}
        onUpdate={handleUpdate}
        onCancel={handleCancel}
        onRegisterPayment={handleOpenPaymentDialog}
      />

      {/* Payment dialog */}
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
