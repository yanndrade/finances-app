import { type FormEvent, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import type { CardConversionPreview, CardSummary } from "../../../lib/api";
import { convertCardToHolder, previewCardConversion } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";

function createHolderId() {
  return `holder-${crypto.randomUUID()}`;
}

/**
 * Folds a card that is really an additional one into its titular. The issuer
 * bills a single invoice against a single shared limit, so the purchases move
 * to the titular carrying a holder and the payments follow them.
 */
export function ConvertCardDialog({
  card,
  cards,
  open,
  onOpenChange,
  onConverted,
  onError,
}: {
  card: CardSummary | null;
  cards: CardSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [targetCardId, setTargetCardId] = useState("");
  const [holderName, setHolderName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [reimbursablePersonId, setReimbursablePersonId] = useState("");
  const [preview, setPreview] = useState<CardConversionPreview | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const candidates = cards.filter(
    (candidate) => candidate.card_id !== card?.card_id && candidate.is_active,
  );

  useEffect(() => {
    if (!open || !card) {
      setTargetCardId("");
      setHolderName("");
      setLastFour("");
      setReimbursablePersonId("");
      setPreview(null);
      return;
    }
    // The card name usually already carries the holder, e.g.
    // "Bradesco Visa Infinite - Duda".
    const dashIndex = card.name.lastIndexOf(" - ");
    setHolderName(dashIndex > 0 ? card.name.slice(dashIndex + 3) : card.name);
  }, [open, card]);

  useEffect(() => {
    if (!open || !card || !targetCardId) {
      setPreview(null);
      return;
    }
    let active = true;
    previewCardConversion(card.card_id, targetCardId)
      .then((result) => {
        if (active) setPreview(result);
      })
      .catch(() => {
        if (active) setPreview(null);
      });
    return () => {
      active = false;
    };
  }, [open, card, targetCardId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card || !targetCardId) return;

    setIsConverting(true);
    try {
      const result = await convertCardToHolder(card.card_id, {
        targetCardId,
        holderId: createHolderId(),
        holderName: holderName.trim(),
        lastFour: lastFour.trim() || null,
        reimbursablePersonId: reimbursablePersonId.trim() || null,
      });
      const orphaned = result.payments_orphaned.length;
      onConverted(
        `${result.purchases_moved} compra(s) e ${result.payments_reassigned} pagamento(s) movidos para o cartão titular.` +
          (orphaned > 0
            ? ` ${orphaned} pagamento(s) ficaram no cartão antigo por não haver fatura correspondente.`
            : ""),
      );
      onOpenChange(false);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível converter o cartão.",
      );
    } finally {
      setIsConverting(false);
    }
  }

  const cycleMismatch = preview !== null && !preview.cycle_matches;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transformar {card?.name} em adicional</DialogTitle>
          <DialogDescription>
            As compras e os pagamentos passam para o cartão titular, atribuídos a
            um portador. O cartão atual é desativado.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Cartão titular
            <Select value={targetCardId} onValueChange={setTargetCardId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cartão titular" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.card_id} value={candidate.card_id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Nome do portador
              <input
                className="h-11 rounded-xl border border-input bg-background px-3"
                value={holderName}
                onChange={(event) => setHolderName(event.target.value)}
                maxLength={60}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              4 últimos dígitos
              <input
                className="h-11 rounded-xl border border-input bg-background px-3 tabular-nums"
                value={lastFour}
                onChange={(event) =>
                  setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                inputMode="numeric"
                placeholder="4321"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Reembolsável por (opcional)
            <input
              className="h-11 rounded-xl border border-input bg-background px-3"
              value={reimbursablePersonId}
              onChange={(event) => setReimbursablePersonId(event.target.value)}
              maxLength={60}
              placeholder="Nome de quem reembolsa"
            />
          </label>

          {preview ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">O que será movido</p>
              <p className="tabular-nums text-muted-foreground">
                {preview.purchase_count} compra(s) ·{" "}
                {formatCurrency(preview.purchase_total)}
              </p>
              <p className="tabular-nums text-muted-foreground">
                {preview.payment_count} pagamento(s) de fatura ·{" "}
                {formatCurrency(preview.payment_total)}
              </p>
              {cycleMismatch ? (
                <p className="flex items-start gap-2 text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Os dois cartões têm ciclos diferentes (fechamento ou vencimento).
                  Um adicional sempre compartilha o ciclo do titular, então a
                  conversão será recusada.
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-xs text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Esta operação gera eventos novos e não tem desfazer de um clique.
            Exporte um backup em Configurações antes de confirmar.
          </p>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isConverting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                isConverting ||
                !targetCardId ||
                !holderName.trim() ||
                cycleMismatch
              }
            >
              {isConverting ? "Convertendo…" : "Converter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
