import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import {
  fetchCardPurchases,
  type CardPurchaseUpdatePayload,
  fetchMovements,
  fetchMovementsSummary,
  type AccountSummary,
  type CardSummary,
  type MovementFilters,
  type MovementPage,
  type MovementScope,
  type MovementSummary,
  type TransactionFilters,
  type TransactionPatchPayload,
  type UnifiedMovement,
} from "../../lib/api";
import { getCategoryOptions } from "../../lib/categories";
import { toDateTimeInputValue, toIsoDateTime } from "../../lib/format";
import { cn } from "../../lib/utils";

import { FilterPanel } from "./filter-panel";
import { HistoryHeader } from "./history-header";
import { MovementDrawer } from "./movement-drawer";
import { MovementLedger } from "./movement-ledger";
import { ScopeBar } from "./scope-bar";
import { SummaryRibbon } from "./summary-ribbon";
import { isCardPurchaseMovement } from "./card-purchase-utils";

type HistoryPageProps = {
  surface?: "desktop" | "mobile";
  accounts: AccountSummary[];
  cards: CardSummary[];
  month: string;
  refreshKey?: number;
  initialFilters?: Partial<TransactionFilters>;
  isSubmitting?: boolean;
  onConfirmPending?: (pendingId: string) => Promise<void>;
  onError?: (error: unknown) => void;
  onUpdateCardPurchase?: (
    purchaseId: string,
    payload: CardPurchaseUpdatePayload,
  ) => Promise<void>;
  onUpdateTransaction?: (
    transactionId: string,
    payload: TransactionPatchPayload,
  ) => Promise<void>;
  onVoidCardPurchase?: (purchaseId: string) => Promise<void>;
  onVoidTransaction?: (transactionId: string) => Promise<void>;
  className?: string;
};

type EditableMovementForm = {
  transactionId: string;
  occurredAt: string;
  transactionType: "income" | "expense";
  amount: string;
  accountId: string;
  paymentMethod: "PIX" | "CASH" | "OTHER";
  categoryId: string;
  description: string;
  personId: string;
};

type CardPurchaseEditForm = {
  purchaseId: string;
  occurredAt: string;
  amount: string;
  installmentsCount: string;
  categoryId: string;
  cardId: string;
  description: string;
  personId: string;
  title: string;
};

type InitialHistoryState = {
  searchText: string;
  activeScope: MovementScope;
  advancedFilters: MovementFilters;
};

const EMPTY_SUMMARY: MovementSummary = {
  total_income: 0,
  total_fixed: 0,
  total_installments: 0,
  total_variable: 0,
  total_investments: 0,
  total_reimbursements: 0,
  total_expenses: 0,
  total_result: 0,
  counts: {
    all: 0,
    fixed: 0,
    installments: 0,
    variable: 0,
    transfers: 0,
    investments: 0,
    reimbursements: 0,
  },
};

const EMPTY_PAGE: MovementPage = {
  items: [],
  total: 0,
  page: 1,
  page_size: 50,
  pages: 1,
};

export function HistoryPage({
  surface = "desktop",
  accounts,
  cards,
  month,
  refreshKey,
  initialFilters,
  isSubmitting = false,
  onConfirmPending,
  onError,
  onUpdateCardPurchase,
  onUpdateTransaction,
  onVoidCardPurchase,
  onVoidTransaction,
  className,
}: HistoryPageProps) {
  const initialHistoryState = useMemo(
    () => mapInitialFilters(initialFilters),
    [initialFilters],
  );

  const [searchText, setSearchText] = useState(initialHistoryState.searchText);
  const [activeScope, setActiveScope] = useState<MovementScope>(
    initialHistoryState.activeScope,
  );
  const [advancedFilters, setAdvancedFilters] = useState<MovementFilters>(
    initialHistoryState.advancedFilters,
  );
  const [selectedMovement, setSelectedMovement] =
    useState<UnifiedMovement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingMovement, setEditingMovement] =
    useState<EditableMovementForm | null>(null);
  const [editingCardPurchase, setEditingCardPurchase] =
    useState<CardPurchaseEditForm | null>(null);
  const editingCategoryOptions = getCategoryOptions(editingMovement?.categoryId);
  const editingCardPurchaseCategoryOptions = getCategoryOptions(
    editingCardPurchase?.categoryId,
  );

  const [movementPage, setMovementPage] = useState<MovementPage>(EMPTY_PAGE);
  const [summary, setSummary] = useState<MovementSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(EMPTY_PAGE.page);

  const activeFilters = useMemo<MovementFilters>(
    () => ({
      ...advancedFilters,
      competence_month: month,
      scope:
        surface === "mobile" || activeScope === "all"
          ? undefined
          : activeScope,
      text: searchText.trim() || undefined,
      page: currentPage,
    }),
    [month, activeScope, searchText, advancedFilters, surface, currentPage],
  );

  const loadMovements = useCallback(
    async (filters: MovementFilters, signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const page = await fetchMovements(filters);
        if (!signal?.aborted) {
          setMovementPage(page);
          setCurrentPage(page.page);
        }
      } catch (error) {
        if (!signal?.aborted) {
          setMovementPage(EMPTY_PAGE);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as movimentações.",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const loadSummary = useCallback(
    async (targetMonth: string) => {
      setSummaryLoading(true);
      try {
        const nextSummary = await fetchMovementsSummary(targetMonth);
        setSummary(nextSummary);
      } catch (error) {
        setSummary(EMPTY_SUMMARY);
        onError?.(error);
      } finally {
        setSummaryLoading(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    const nextState = mapInitialFilters(initialFilters);
    setSearchText(nextState.searchText);
    setAdvancedFilters(nextState.advancedFilters);
    setActiveScope(surface === "mobile" ? "all" : nextState.activeScope);
    setCurrentPage(1);
  }, [initialFilters, surface]);

  useEffect(() => {
    void loadSummary(month);
  }, [month, refreshKey, loadSummary]);

  useEffect(() => {
    if (surface === "mobile" && activeScope !== "all") {
      setActiveScope("all");
      setCurrentPage(1);
    }
  }, [activeScope, surface]);

  useEffect(() => {
    const controller = new AbortController();
    const handle = globalThis.setTimeout(
      () => {
        void loadMovements(activeFilters, controller.signal);
      },
      searchText.trim() ? 300 : 0,
    );
    return () => {
      globalThis.clearTimeout(handle);
      controller.abort();
    };
  }, [activeFilters, searchText, refreshKey, loadMovements]);

  function handleSelectMovement(movement: UnifiedMovement) {
    setSelectedMovement(movement);
    setIsDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setIsDrawerOpen(false);
  }

  function handleScopeChange(scope: MovementScope) {
    setActiveScope(scope);
    setCurrentPage(1);
  }

  function handleAdvancedFiltersChange(filters: MovementFilters) {
    setAdvancedFilters({
      kind: filters.kind,
      origin_type: filters.origin_type,
      lifecycle_status: filters.lifecycle_status,
      account_id: filters.account_id,
      card_id: filters.card_id,
      category_id: filters.category_id,
      payment_method: filters.payment_method,
      counterparty: filters.counterparty,
      has_counterparty: filters.has_counterparty,
    });
    setCurrentPage(1);
  }

  function handleSearchChange(text: string) {
    setSearchText(text);
    setCurrentPage(1);
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
  }

  async function handleEditMovement(movement: UnifiedMovement) {
    if (isCardPurchaseMovement(movement)) {
      if (onUpdateCardPurchase === undefined) {
        return;
      }
      const purchaseId = resolveCardPurchaseId(movement);
      if (purchaseId === null) {
        return;
      }

      try {
        const purchases = await fetchCardPurchases();
        const purchase = purchases.find((item) => item.purchase_id === purchaseId);
        const nextForm = buildCardPurchaseEditForm(movement, purchase ?? null);
        if (nextForm !== null) {
          setEditingCardPurchase(nextForm);
          setEditingMovement(null);
        } else {
          onError?.(new Error("Não foi possível localizar a compra no cartão."));
        }
      } catch (error) {
        onError?.(error);
      }
      return;
    }

    const nextForm = buildEditableMovementForm(movement);
    if (nextForm === null) {
      return;
    }
    setEditingMovement(nextForm);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingMovement === null || onUpdateTransaction === undefined) {
      return;
    }

    await onUpdateTransaction(editingMovement.transactionId, {
      occurredAt: toIsoDateTime(editingMovement.occurredAt),
      type: editingMovement.transactionType,
      amountInCents: toCents(editingMovement.amount),
      accountId: editingMovement.accountId,
      paymentMethod: editingMovement.paymentMethod,
      categoryId: editingMovement.categoryId,
      description: editingMovement.description,
      personId: editingMovement.personId || undefined,
    });

    setEditingMovement(null);
    setSelectedMovement(null);
    setIsDrawerOpen(false);
  }

  async function handleCardPurchaseEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingCardPurchase === null || onUpdateCardPurchase === undefined) {
      return;
    }

    await onUpdateCardPurchase(editingCardPurchase.purchaseId, {
      purchaseDate: toIsoDateTime(editingCardPurchase.occurredAt),
      amountInCents: toCents(editingCardPurchase.amount),
      installmentsCount: Math.max(
        1,
        Number.parseInt(editingCardPurchase.installmentsCount, 10) || 1,
      ),
      categoryId: editingCardPurchase.categoryId,
      cardId: editingCardPurchase.cardId,
      description: editingCardPurchase.description,
      personId: editingCardPurchase.personId || null,
    });

    setEditingCardPurchase(null);
    setSelectedMovement(null);
    setIsDrawerOpen(false);
  }

  async function handleVoidMovement(movement: UnifiedMovement) {
    if (isCardPurchaseMovement(movement)) {
      const purchaseId = resolveCardPurchaseId(movement);
      if (purchaseId === null || onVoidCardPurchase === undefined) {
        return;
      }
      await onVoidCardPurchase(purchaseId);
    } else {
      if (onVoidTransaction === undefined) {
        return;
      }
      await onVoidTransaction(movement.movement_id);
    }

    setSelectedMovement(null);
    setIsDrawerOpen(false);
  }

  async function handleMarkPaidMovement(pendingId: string) {
    if (onConfirmPending === undefined) {
      return;
    }
    await onConfirmPending(pendingId);
    setSelectedMovement(null);
    setIsDrawerOpen(false);
  }

  return (
    <section
      className={cn("flex flex-col gap-4", className)}
      role="region"
      aria-label="Histórico e filtros"
    >
      <HistoryHeader
        searchText={searchText}
        onSearchChange={handleSearchChange}
      />

      {surface === "desktop" ? (
        <div
          className={cn(
            "transition-opacity duration-200",
            summaryLoading && "opacity-60",
          )}
        >
          <SummaryRibbon
            summary={summary}
            activeScope={activeScope}
            onScopeChange={handleScopeChange}
          />
        </div>
      ) : null}

      {surface === "desktop" ? (
        <ScopeBar
          counts={summary.counts}
          activeScope={activeScope}
          onScopeChange={handleScopeChange}
        />
      ) : null}

      <FilterPanel
        filters={advancedFilters}
        accounts={accounts}
        cards={cards}
        onFiltersChange={handleAdvancedFiltersChange}
      />

      <div
        className={cn(
          "rounded-xl border border-border/70 overflow-hidden bg-surface shadow-sm",
          "transition-opacity duration-200",
          isLoading && "opacity-60 pointer-events-none",
        )}
      >
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-surface-paper/80 border-b border-border/60">
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground w-10 shrink-0">
            Data
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
            Movimentação
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground w-24 shrink-0 hidden sm:block">
            Origem
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0 text-right">
            Debito em
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0 text-right">
            Conta
          </span>
          <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0 text-right">
            Valor
          </span>
        </div>

        {isLoading && movementPage.items.length === 0 ? (
          <div
            aria-hidden="true"
            className="flex flex-col divide-y divide-border/40"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-10 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
                <div className="h-4 w-24 rounded bg-muted animate-pulse shrink-0 hidden sm:block" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <MovementLedger
            movements={movementPage.items}
            accounts={accounts}
            cards={cards}
            selectedMovementId={selectedMovement?.movement_id ?? null}
            onSelectMovement={handleSelectMovement}
          />
        )}

        {loadError && !isLoading ? (
          <div
            role="alert"
            className="flex items-center gap-2 px-4 py-3 text-sm text-destructive border-t border-border/50"
          >
            <span>{loadError}</span>
          </div>
        ) : null}

        {movementPage.total > movementPage.page_size && (
          <div className="flex flex-col gap-2 px-4 py-2.5 border-t border-border/50 bg-surface-paper/50 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Mostrando {movementPage.items.length} de {movementPage.total}{" "}
              movimentações
            </span>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                Pagina {movementPage.page} de {movementPage.pages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading || movementPage.page <= 1}
                  onClick={() => handlePageChange(movementPage.page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLoading || movementPage.page >= movementPage.pages}
                  onClick={() => handlePageChange(movementPage.page + 1)}
                >
                  Proxima
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <MovementDrawer
        movement={selectedMovement}
        accounts={accounts}
        cards={cards}
        isOpen={isDrawerOpen}
        isSubmitting={isSubmitting}
        onClose={handleCloseDrawer}
        onEdit={
          onUpdateTransaction || onUpdateCardPurchase
            ? handleEditMovement
            : undefined
        }
        onVoid={
          onVoidTransaction || onVoidCardPurchase
            ? handleVoidMovement
            : undefined
        }
        onMarkPaid={onConfirmPending ? handleMarkPaidMovement : undefined}
      />

      <Dialog
        open={editingMovement !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMovement(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
            <DialogDescription>
              Ajuste os dados do lançamento e salve para reprojetar saldo e
              histórico.
            </DialogDescription>
          </DialogHeader>

          {editingMovement ? (
            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-foreground">
                  Data
                  <Input
                    type="datetime-local"
                    value={editingMovement.occurredAt}
                    onChange={(event) =>
                      setEditingMovement((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              occurredAt: event.target.value,
                            },
                      )
                    }
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Valor
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editingMovement.amount}
                    onChange={(event) =>
                      setEditingMovement((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              amount: event.target.value,
                            },
                      )
                    }
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Tipo
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editingMovement.transactionType}
                    onChange={(event) =>
                      setEditingMovement((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              transactionType: event.target
                                .value as EditableMovementForm["transactionType"],
                            },
                      )
                    }
                  >
                    <option value="expense">Saída</option>
                    <option value="income">Entrada</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Método
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editingMovement.paymentMethod}
                    onChange={(event) =>
                      setEditingMovement((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              paymentMethod: event.target
                                .value as EditableMovementForm["paymentMethod"],
                            },
                      )
                    }
                  >
                    <option value="PIX">PIX</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Conta
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editingMovement.accountId}
                    onChange={(event) =>
                      setEditingMovement((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              accountId: event.target.value,
                            },
                      )
                    }
                  >
                    {accounts.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Categoria
                  <Input
                    list="history-edit-category-options"
                    value={editingMovement.categoryId}
                    onChange={(event) =>
                      setEditingMovement((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              categoryId: event.target.value,
                        },
                      )
                    }
                  />
                  <datalist id="history-edit-category-options">
                    {editingCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </datalist>
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-foreground block">
                Descricao
                <textarea
                  className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editingMovement.description}
                  onChange={(event) =>
                    setEditingMovement((current) =>
                      current === null
                        ? null
                        : {
                            ...current,
                            description: event.target.value,
                          },
                    )
                  }
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-foreground block">
                Pessoa
                <Input
                  value={editingMovement.personId}
                  onChange={(event) =>
                    setEditingMovement((current) =>
                      current === null
                        ? null
                        : {
                            ...current,
                            personId: event.target.value,
                          },
                    )
                  }
                />
              </label>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMovement(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Salvar alterações
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingCardPurchase !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCardPurchase(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar compra no cartão</DialogTitle>
            <DialogDescription>
              Ajuste a compra para reprojetar parcelas, faturas e reembolsos
              relacionados.
            </DialogDescription>
          </DialogHeader>

          {editingCardPurchase ? (
            <form className="space-y-4" onSubmit={handleCardPurchaseEditSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-foreground">
                  Data da compra
                  <Input
                    type="datetime-local"
                    value={editingCardPurchase.occurredAt}
                    onChange={(event) =>
                      setEditingCardPurchase((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              occurredAt: event.target.value,
                            },
                      )
                    }
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Valor total
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editingCardPurchase.amount}
                    onChange={(event) =>
                      setEditingCardPurchase((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              amount: event.target.value,
                            },
                      )
                    }
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Cartão da compra
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={editingCardPurchase.cardId}
                    onChange={(event) =>
                      setEditingCardPurchase((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              cardId: event.target.value,
                            },
                      )
                    }
                  >
                    {cards.map((card) => (
                      <option key={card.card_id} value={card.card_id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Parcelas
                  <Input
                    type="number"
                    min="1"
                    max="48"
                    value={editingCardPurchase.installmentsCount}
                    onChange={(event) =>
                      setEditingCardPurchase((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              installmentsCount: event.target.value,
                            },
                      )
                    }
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Categoria
                  <Input
                    list="history-edit-card-purchase-category-options"
                    value={editingCardPurchase.categoryId}
                    onChange={(event) =>
                      setEditingCardPurchase((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              categoryId: event.target.value,
                            },
                      )
                    }
                  />
                  <datalist id="history-edit-card-purchase-category-options">
                    {editingCardPurchaseCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </datalist>
                </label>

                <label className="space-y-2 text-sm font-medium text-foreground">
                  Pessoa
                  <Input
                    value={editingCardPurchase.personId}
                    onChange={(event) =>
                      setEditingCardPurchase((current) =>
                        current === null
                          ? null
                          : {
                              ...current,
                              personId: event.target.value,
                            },
                      )
                    }
                  />
                </label>
              </div>

              <label className="space-y-2 text-sm font-medium text-foreground block">
                Descricao
                <textarea
                  className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editingCardPurchase.description}
                  onChange={(event) =>
                    setEditingCardPurchase((current) =>
                      current === null
                        ? null
                        : {
                            ...current,
                            description: event.target.value,
                          },
                    )
                  }
                />
              </label>

              <p className="text-sm text-muted-foreground">
                Compra: <span className="font-medium text-foreground">{editingCardPurchase.title}</span>
              </p>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCardPurchase(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Salvar alterações
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function mapInitialFilters(
  filters?: Partial<TransactionFilters>,
): InitialHistoryState {
  return {
    searchText: filters?.text?.trim() ?? "",
    activeScope: mapPresetToScope(filters?.preset),
    advancedFilters: {
      account_id: filters?.account || undefined,
      card_id: filters?.card || undefined,
      category_id: filters?.category || undefined,
      payment_method: filters?.method || undefined,
      counterparty: filters?.person || undefined,
    },
  };
}

function mapPresetToScope(preset?: string): MovementScope {
  switch (preset) {
    case "fixed":
      return "fixed";
    case "installments":
      return "installments";
    case "transfers":
      return "transfers";
    case "investments":
      return "investments";
    case "reimbursements":
      return "reimbursements";
    default:
      return "all";
  }
}

function buildEditableMovementForm(
  movement: UnifiedMovement,
): EditableMovementForm | null {
  if (movement.edit_policy !== "editable" || movement.lifecycle_status === "voided") {
    return null;
  }

  const transactionType = resolveEditableTransactionType(movement);
  if (transactionType === null) {
    return null;
  }

  return {
    transactionId: movement.movement_id,
    occurredAt: toDateTimeInputValue(movement.posted_at),
    transactionType,
    amount: (movement.amount / 100).toFixed(2),
    accountId: movement.account_id,
    paymentMethod: normalizeEditablePaymentMethod(movement.payment_method),
    categoryId: movement.category_id,
    description: movement.description ?? movement.title,
    personId: movement.counterparty ?? "",
  };
}

function buildCardPurchaseEditForm(
  movement: UnifiedMovement,
  purchase: {
    purchase_date: string;
    amount: number;
    category_id: string;
    card_id: string;
    description: string | null;
    installments_count: number;
  } | null,
): CardPurchaseEditForm | null {
  const purchaseId = resolveCardPurchaseId(movement);
  if (!isCardPurchaseMovement(movement) || purchaseId === null || purchase === null) {
    return null;
  }

  return {
    purchaseId,
    occurredAt: toDateTimeInputValue(purchase.purchase_date),
    amount: (purchase.amount / 100).toFixed(2),
    installmentsCount: String(purchase.installments_count),
    categoryId: purchase.category_id,
    cardId: purchase.card_id,
    description: purchase.description ?? movement.description ?? movement.title,
    personId: movement.counterparty ?? "",
    title: purchase.description ?? movement.description ?? movement.title,
  };
}

function resolveCardPurchaseId(movement: UnifiedMovement): string | null {
  if (movement.parent_id) {
    return movement.parent_id;
  }

  const [purchaseId] = movement.movement_id.split(":");
  return purchaseId?.trim() ? purchaseId : null;
}

function resolveEditableTransactionType(
  movement: UnifiedMovement,
): "income" | "expense" | null {
  if (movement.source_event_type === "IncomeCreated") {
    return "income";
  }
  if (movement.source_event_type === "ExpenseCreated") {
    return "expense";
  }
  return null;
}

function normalizeEditablePaymentMethod(
  paymentMethod: string,
): "PIX" | "CASH" | "OTHER" {
  if (paymentMethod === "PIX" || paymentMethod === "CASH") {
    return paymentMethod;
  }
  return "OTHER";
}

function toCents(rawValue: string): number {
  const parsed = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}
