import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { AccountSummary, PendingReimbursementSummary } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

type ReceivePaymentDialogProps = {
  reimbursement: PendingReimbursementSummary | null;
  accounts: AccountSummary[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (params: {
    transactionId: string;
    amount: number | undefined;
    receivedAt: string;
    accountId: string | undefined;
  }) => Promise<void>;
};

function todayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ReceivePaymentDialog({
  reimbursement,
  accounts,
  isOpen,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: ReceivePaymentDialogProps) {
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayIsoLocal());
  const [accountId, setAccountId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  if (!reimbursement) return null;

  const outstanding = reimbursement.amount - (reimbursement.amount_received ?? 0);
  const activeAccounts = accounts.filter((a) => a.is_active);

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Reset state on close
      setIsPartial(false);
      setPartialAmount("");
      setReceivedAt(todayIsoLocal());
      setAccountId("");
      setError(null);
    }
    onOpenChange(open);
  }

  async function handleSubmit() {
    setError(null);

    // Capture ref so TypeScript knows it's non-null inside async body
    const r = reimbursement;
    if (!r) return;

    let amount: number | undefined;

    if (isPartial) {
      const parsed = parseFloat(partialAmount.replace(",", "."));
      if (isNaN(parsed) || parsed <= 0) {
        setError("Informe um valor parcial válido.");
        return;
      }
      // UI shows BRL units; API expects cents
      amount = Math.round(parsed * 100);
      if (amount > outstanding) {
        setError(`O valor não pode exceder o saldo pendente (${formatCurrency(outstanding)}).`);
        return;
      }
    }

    if (!receivedAt) {
      setError("Informe a data de recebimento.");
      return;
    }

    await onSubmit({
      transactionId: r.transaction_id,
      amount,
      receivedAt: `${receivedAt}T12:00:00`,
      accountId: accountId || undefined,
    });

    handleOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar recebimento</DialogTitle>
          <DialogDescription>
          {(reimbursement.person_id || "Pessoa não identificada")} · {formatCurrency(outstanding)} pendente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Payment type toggle */}
          <div className="flex gap-2" role="group" aria-label="Tipo de recebimento">
            <button
              type="button"
              aria-pressed={!isPartial}
              onClick={() => setIsPartial(false)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                !isPartial
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted"
              }`}
            >
              Total ({formatCurrency(outstanding)})
            </button>
            <button
              type="button"
              aria-pressed={isPartial}
              onClick={() => setIsPartial(true)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                isPartial
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted-foreground hover:bg-muted"
              }`}
            >
              Parcial
            </button>
          </div>

          {/* Partial amount */}
          {isPartial && (
            <div className="space-y-1.5">
              <Label htmlFor="partial-amount">Valor recebido (R$)</Label>
              <Input
                id="partial-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ex: 50,00"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                className="h-9"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Máximo: {formatCurrency(outstanding)}
              </p>
            </div>
          )}

          {/* Received at */}
          <div className="space-y-1.5">
            <Label htmlFor="received-at">Data de recebimento</Label>
            <Input
              id="received-at"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Account */}
          {activeAccounts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="account-select">Conta de destino (opcional)</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="account-select" className="h-9">
                  <SelectValue placeholder="Selecione uma conta..." />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
