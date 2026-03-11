import { useCallback, useEffect, useMemo, useState } from "react";

import { HistoryHeader } from "./history-header";
import { SummaryRibbon } from "./summary-ribbon";
import { ScopeBar } from "./scope-bar";
import { FilterPanel } from "./filter-panel";
import { MovementLedger } from "./movement-ledger";
import { MovementDrawer } from "./movement-drawer";

import {
  fetchMovements,
  fetchMovementsSummary,
  type AccountSummary,
  type CardSummary,
  type MovementFilters,
  type MovementPage,
  type MovementScope,
  type MovementSummary,
  type UnifiedMovement,
} from "../../lib/api";

import { cn } from "../../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryPageProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  month: string;
  className?: string;
};

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Empty states ─────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export function HistoryPage({
  accounts,
  cards,
  month,
  className,
}: HistoryPageProps) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [searchText, setSearchText] = useState("");
  const [activeScope, setActiveScope] = useState<MovementScope>("all");
  const [advancedFilters, setAdvancedFilters] = useState<MovementFilters>({});
  const [selectedMovement, setSelectedMovement] =
    useState<UnifiedMovement | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [movementPage, setMovementPage] = useState<MovementPage>(EMPTY_PAGE);
  const [summary, setSummary] = useState<MovementSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Derived filters ────────────────────────────────────────────────────────

  const activeFilters = useMemo<MovementFilters>(
    () => ({
      ...advancedFilters,
      competence_month: month,
      scope: activeScope !== "all" ? activeScope : undefined,
      text: searchText.trim() || undefined,
    }),
    [month, activeScope, searchText, advancedFilters],
  );

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadMovements = useCallback(
    async (filters: MovementFilters) => {
      setIsLoading(true);
      try {
        const page = await fetchMovements(filters);
        setMovementPage(page);
      } catch {
        setMovementPage(EMPTY_PAGE);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const loadSummary = useCallback(async (month: string) => {
    setSummaryLoading(true);
    try {
      const s = await fetchMovementsSummary(month);
      setSummary(s);
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Load summary whenever the month changes
  useEffect(() => {
    void loadSummary(month);
  }, [month, loadSummary]);

  // Load movements whenever any filter changes (debounced for text)
  useEffect(() => {
    const handle = globalThis.setTimeout(
      () => {
        void loadMovements(activeFilters);
      },
      searchText.trim() ? 300 : 0,
    );
    return () => globalThis.clearTimeout(handle);
  }, [activeFilters, searchText, loadMovements]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSelectMovement(movement: UnifiedMovement) {
    setSelectedMovement(movement);
    setIsDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setIsDrawerOpen(false);
  }

  function handleScopeChange(scope: MovementScope) {
    setActiveScope(scope);
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
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section 
      className={cn("flex flex-col gap-4", className)}
      role="region"
      aria-label="Histórico e filtros"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <HistoryHeader
        searchText={searchText}
        onSearchChange={setSearchText}
      />

      {/* ── Summary ribbon ──────────────────────────────────────────────── */}
      <div className={cn("transition-opacity duration-200", summaryLoading && "opacity-60")}>
        <SummaryRibbon
          summary={summary}
          activeScope={activeScope}
          onScopeChange={handleScopeChange}
        />
      </div>

      {/* ── Scope bar ───────────────────────────────────────────────────── */}
      <ScopeBar
        counts={summary.counts}
        activeScope={activeScope}
        onScopeChange={handleScopeChange}
      />

      {/* ── Advanced filters ────────────────────────────────────────────── */}
      <FilterPanel
        filters={advancedFilters}
        accounts={accounts}
        cards={cards}
        onFiltersChange={handleAdvancedFiltersChange}
      />

      {/* ── Ledger ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "rounded-xl border border-border/70 overflow-hidden bg-surface shadow-sm",
          "transition-opacity duration-200",
          isLoading && "opacity-60 pointer-events-none",
        )}
      >
        {/* Table header */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-surface-paper/80 border-b border-border/60">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-10 shrink-0">
            Data
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
            Movimentação
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-24 shrink-0 hidden sm:block">
            Origem
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0 text-right">
            Conta
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-28 shrink-0 text-right">
            Valor
          </span>
        </div>

        <MovementLedger
          movements={movementPage.items}
          accounts={accounts}
          cards={cards}
          selectedMovementId={selectedMovement?.movement_id ?? null}
          onSelectMovement={handleSelectMovement}
        />

        {/* Pagination hint */}
        {movementPage.total > movementPage.page_size && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-surface-paper/50">
            <span className="text-xs text-muted-foreground">
              Mostrando {movementPage.items.length} de {movementPage.total}{" "}
              movimentações
            </span>
            <span className="text-xs text-muted-foreground">
              Página {movementPage.page} de {movementPage.pages}
            </span>
          </div>
        )}
      </div>

      {/* ── Movement detail drawer ──────────────────────────────────────── */}
      <MovementDrawer
        movement={selectedMovement}
        accounts={accounts}
        cards={cards}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </section>
  );
}
