import { useState } from "react";
import { AlertTriangle, Ban, ExternalLink, Pencil } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import type { PendingReimbursementSummary } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/format";

type ReimbursementDrawerProps = {
  reimbursement: PendingReimbursementSummary | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onUpdate: (id: string, expectedAt: string | null, notes: string | null) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onRegisterPayment: () => void;
  allowSecondaryActions?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  overdue: "Em atraso",
  partial: "Parcial",
  received: "Recebido",
  canceled: "Cancelado",
};

export function ReimbursementDrawer({
  reimbursement,
  isOpen,
  onOpenChange,
  isSubmitting,
  onUpdate,
  onCancel,
  onRegisterPayment,
  allowSecondaryActions = true,
}: ReimbursementDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedExpectedAt, setEditedExpectedAt] = useState("");
  const [editedNotes, setEditedNotes] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!reimbursement) return null;

  const outstanding = reimbursement.amount - (reimbursement.amount_received ?? 0);
  const isCanceled = reimbursement.status === "canceled";
  const isReceived = reimbursement.status === "received";
  const canAct = !isCanceled && !isReceived;

  function handleEditStart() {
    if (!reimbursement) return;
    setEditedExpectedAt(reimbursement.expected_at ?? "");
    setEditedNotes(reimbursement.notes ?? "");
    setIsEditing(true);
  }

  function handleEditCancel() {
    setIsEditing(false);
    setShowCancelConfirm(false);
  }

  async function handleEditSave() {
    if (!reimbursement) return;
    await onUpdate(
      reimbursement.transaction_id,
      editedExpectedAt.trim() || null,
      editedNotes.trim() || null,
    );
    setIsEditing(false);
  }

  async function handleConfirmCancel() {
    if (!reimbursement) return;
    await onCancel(reimbursement.transaction_id);
    setShowCancelConfirm(false);
    onOpenChange(false);
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setIsEditing(false);
          setShowCancelConfirm(false);
        }
        onOpenChange(open);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0 overflow-hidden">
        <SheetHeader className="p-6 pb-4 border-b border-slate-100">
          <SheetTitle className="text-lg">{reimbursement.person_id}</SheetTitle>
          <SheetDescription>Detalhes do reembolso</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-5 gap-1">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Valor total</span>
            <span className="text-3xl font-black text-slate-900 tabular-nums">
              {formatCurrency(reimbursement.amount)}
            </span>
            {reimbursement.status === "partial" ? (
              <span className="text-sm font-medium text-blue-600 tabular-nums">
                {formatCurrency(outstanding)} ainda pendente
              </span>
            ) : null}
            {reimbursement.status === "received" ? (
              <span className="text-sm font-medium text-emerald-600">Totalmente recebido</span>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Status</span>
              <span className="text-sm font-semibold">
                {STATUS_LABEL[reimbursement.status] ?? reimbursement.status}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">Lancado em</span>
              <span className="text-sm font-semibold">
                {formatDate(reimbursement.occurred_at)}
              </span>
            </div>

            {reimbursement.amount_received > 0 ? (
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Ja recebido</span>
                <span className="text-sm font-semibold text-emerald-700">
                  {formatCurrency(reimbursement.amount_received)}
                </span>
              </div>
            ) : null}

            {isEditing ? (
              <div className="flex flex-col gap-1.5 py-2 border-b border-slate-100">
                <Label htmlFor="expected-at" className="text-sm text-slate-500">
                  Data de vencimento
                </Label>
                <Input
                  id="expected-at"
                  type="date"
                  value={editedExpectedAt}
                  onChange={(event) => setEditedExpectedAt(event.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            ) : (
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Vencimento</span>
                <span className="text-sm font-semibold">
                  {reimbursement.expected_at ? formatDate(reimbursement.expected_at) : "-"}
                </span>
              </div>
            )}

            {isEditing ? (
              <div className="flex flex-col gap-1.5 py-2 border-b border-slate-100">
                <Label htmlFor="notes" className="text-sm text-slate-500">
                  Observações
                </Label>
                <Input
                  id="notes"
                  type="text"
                  value={editedNotes}
                  onChange={(event) => setEditedNotes(event.target.value)}
                  placeholder="Adicione uma observação..."
                  className="h-8 text-sm"
                />
              </div>
            ) : reimbursement.notes ? (
              <div className="flex flex-col gap-1 py-2 border-b border-slate-100">
                <span className="text-sm text-slate-500">Observações</span>
                <span className="text-sm">{reimbursement.notes}</span>
              </div>
            ) : null}
          </div>

          {showCancelConfirm ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={16} />
                <span className="text-sm font-semibold">Cancelar reembolso?</span>
              </div>
              <p className="text-xs text-red-600">
                Esta ação não pode ser desfeita. O reembolso será marcado como cancelado.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleConfirmCancel}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Confirmar cancelamento
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="p-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
          {isEditing ? (
            <div className="flex gap-2 w-full">
              <Button onClick={handleEditSave} disabled={isSubmitting} className="flex-1">
                Salvar alterações
              </Button>
              <Button variant="outline" onClick={handleEditCancel} disabled={isSubmitting}>
                Cancelar
              </Button>
            </div>
          ) : canAct ? (
            <>
              <Button
                onClick={onRegisterPayment}
                disabled={isSubmitting}
                className="w-full"
              >
                <ExternalLink size={14} className="mr-1.5" />
                Registrar recebimento
              </Button>
              {allowSecondaryActions ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditStart}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    <Pencil size={13} className="mr-1.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={isSubmitting || showCancelConfirm}
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Ban size={13} className="mr-1.5" />
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              {isCanceled ? "Este reembolso foi cancelado." : "Reembolso totalmente recebido."}
            </p>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
