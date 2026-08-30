import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Progress } from "../../../components/ui/progress";
import type { CardHolderSummary, CardSummary } from "../../../lib/api";
import { fetchCardHolders, removeCardHolder, upsertCardHolder } from "../../../lib/api";
import { formatCurrency } from "../../../lib/format";
import { cn } from "../../../lib/utils";

type HolderFormState = {
  holderId: string;
  name: string;
  lastFour: string;
  isPrimary: boolean;
  subLimit: string;
  reimbursablePersonId: string;
};

function createEmptyHolderForm(): HolderFormState {
  return {
    holderId: "",
    name: "",
    lastFour: "",
    isPrimary: false,
    subLimit: "",
    reimbursablePersonId: "",
  };
}

function toFormState(holder: CardHolderSummary): HolderFormState {
  return {
    holderId: holder.holder_id,
    name: holder.name,
    lastFour: holder.last_four ?? "",
    isPrimary: holder.is_primary,
    subLimit: holder.sub_limit === null ? "" : String(holder.sub_limit),
    reimbursablePersonId: holder.reimbursable_person_id ?? "",
  };
}

function createHolderId() {
  return `holder-${crypto.randomUUID()}`;
}

export function CardHoldersPanel({
  card,
  onError,
}: {
  card: CardSummary;
  onError: (message: string) => void;
}) {
  const [holders, setHolders] = useState<CardHolderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingHolder, setEditingHolder] = useState<HolderFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [removingHolder, setRemovingHolder] = useState<CardHolderSummary | null>(null);

  const cardId = card.card_id;

  const reload = useCallback(async () => {
    try {
      setHolders(await fetchCardHolders(cardId));
    } catch {
      onError("Não foi possível carregar os portadores do cartão.");
    } finally {
      setIsLoading(false);
    }
  }, [cardId, onError]);

  useEffect(() => {
    setIsLoading(true);
    void reload();
  }, [reload]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingHolder) return;

    const trimmedLastFour = editingHolder.lastFour.trim();
    const parsedSubLimit = Number.parseInt(editingHolder.subLimit, 10);

    setIsSaving(true);
    try {
      await upsertCardHolder(cardId, {
        holderId: editingHolder.holderId || createHolderId(),
        name: editingHolder.name.trim(),
        lastFour: trimmedLastFour || null,
        isPrimary: editingHolder.isPrimary,
        subLimitInCents: Number.isFinite(parsedSubLimit) && parsedSubLimit > 0
          ? parsedSubLimit
          : null,
        reimbursablePersonId: editingHolder.reimbursablePersonId.trim() || null,
      });
      setEditingHolder(null);
      await reload();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o portador.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove() {
    if (!removingHolder) return;
    setIsSaving(true);
    try {
      await removeCardHolder(cardId, removingHolder.holder_id);
      setRemovingHolder(null);
      await reload();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o portador.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 shrink-0" aria-hidden />
            Portadores
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Adicionais dividem o limite de {formatCurrency(card.limit)} e a mesma fatura.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditingHolder(createEmptyHolderForm())}
        >
          <Plus className="size-4" aria-hidden />
          Adicionar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Carregando portadores…</p>
        ) : holders.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum portador cadastrado. Todo gasto deste cartão é do titular.
          </p>
        ) : (
          holders.map((holder) => (
            <HolderRow
              key={holder.holder_id}
              holder={holder}
              onEdit={() => setEditingHolder(toFormState(holder))}
              onRemove={() => setRemovingHolder(holder)}
            />
          ))
        )}
      </CardContent>

      <Dialog
        open={editingHolder !== null}
        onOpenChange={(open) => {
          if (!open) setEditingHolder(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHolder?.holderId ? "Editar portador" : "Novo portador"}
            </DialogTitle>
            <DialogDescription>
              O sub-limite é um alerta, não um bloqueio: o limite real continua sendo
              o do cartão.
            </DialogDescription>
          </DialogHeader>
          {editingHolder ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Nome
                <input
                  className="h-11 rounded-xl border border-input bg-background px-3"
                  value={editingHolder.name}
                  onChange={(event) =>
                    setEditingHolder((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  maxLength={60}
                  required
                  autoFocus
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  4 últimos dígitos
                  <input
                    className="h-11 rounded-xl border border-input bg-background px-3 tabular-nums"
                    value={editingHolder.lastFour}
                    onChange={(event) =>
                      setEditingHolder((current) =>
                        current
                          ? {
                              ...current,
                              lastFour: event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 4),
                            }
                          : current,
                      )
                    }
                    inputMode="numeric"
                    placeholder="4321"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Sub-limite (centavos)
                  <input
                    className="h-11 rounded-xl border border-input bg-background px-3 tabular-nums"
                    value={editingHolder.subLimit}
                    onChange={(event) =>
                      setEditingHolder((current) =>
                        current
                          ? {
                              ...current,
                              subLimit: event.target.value.replace(/\D/g, ""),
                            }
                          : current,
                      )
                    }
                    inputMode="numeric"
                    placeholder="Sem sub-limite"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Reembolsável por (opcional)
                <input
                  className="h-11 rounded-xl border border-input bg-background px-3"
                  value={editingHolder.reimbursablePersonId}
                  onChange={(event) =>
                    setEditingHolder((current) =>
                      current
                        ? { ...current, reimbursablePersonId: event.target.value }
                        : current,
                    )
                  }
                  maxLength={60}
                  placeholder="Nome de quem reembolsa"
                />
                <span className="text-xs font-normal text-muted-foreground">
                  Preenchido, todo gasto deste portador já entra como reembolso pendente.
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={editingHolder.isPrimary}
                  onChange={(event) =>
                    setEditingHolder((current) =>
                      current
                        ? { ...current, isPrimary: event.target.checked }
                        : current,
                    )
                  }
                />
                É o titular do cartão
              </label>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingHolder(null)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={removingHolder !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingHolder(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover {removingHolder?.name}?</DialogTitle>
            <DialogDescription>
              As compras já lançadas continuam atribuídas a este portador no histórico.
              Ele apenas deixa de aparecer para novos lançamentos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRemovingHolder(null)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isSaving}>
              {isSaving ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HolderRow({
  holder,
  onEdit,
  onRemove,
}: {
  holder: CardHolderSummary;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const committed = holder.spent_open_invoice + holder.spent_future_installments;
  const usagePercent =
    holder.sub_limit && holder.sub_limit > 0
      ? Math.min(Math.round((committed / holder.sub_limit) * 100), 100)
      : null;
  const isOverSubLimit = holder.sub_limit !== null && committed > holder.sub_limit;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-foreground">{holder.name}</span>
            {holder.is_primary ? <Badge variant="secondary">Titular</Badge> : null}
            {holder.last_four ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                ····{holder.last_four}
              </span>
            ) : null}
            {holder.reimbursable_person_id ? (
              <Badge variant="outline">
                Reembolso · {holder.reimbursable_person_id}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Fatura aberta{" "}
            <span className="tabular-nums text-foreground">
              {formatCurrency(holder.spent_open_invoice)}
            </span>
            {holder.spent_future_installments > 0 ? (
              <>
                {" · parcelas futuras "}
                <span className="tabular-nums text-foreground">
                  {formatCurrency(holder.spent_future_installments)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Editar portador">
            <Pencil className="size-4" aria-hidden />
          </Button>
          <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remover portador">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {usagePercent !== null ? (
        <div className="mt-2 space-y-1">
          <Progress value={usagePercent} />
          <p
            className={cn(
              "text-xs tabular-nums",
              isOverSubLimit ? "text-danger" : "text-muted-foreground",
            )}
          >
            {formatCurrency(committed)} de {formatCurrency(holder.sub_limit ?? 0)}
            {isOverSubLimit ? " · sub-limite estourado" : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
