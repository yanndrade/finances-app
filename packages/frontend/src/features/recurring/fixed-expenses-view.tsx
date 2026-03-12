import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";

import { EmptyState } from "../../components/ui/empty-state";

import type {
  AccountSummary,
  CardSummary,
  PendingExpenseSummary,
  RecurringRulePayload,
  RecurringRuleSummary,
  RecurringRuleUpdatePayload,
  TransactionFilters,
} from "../../lib/api";
import type { CategoryOption } from "../../lib/categories";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/format";

import { MonthSummaryBar } from "./components/month-summary-bar";
import { PendingItem } from "./components/pending-item";
import { PendingGroup } from "./components/pending-group";
import { RuleListItem } from "./components/rule-list-item";
import { RuleFormSheet } from "./components/rule-form-sheet";
import { DetailDrawer } from "./components/detail-drawer";
import { groupPendingsByTemporal, TemporalStatus, getTemporalOrder } from "./helpers/temporal-status";

type FixedExpensesViewProps = {
  surface?: "desktop" | "mobile";
  accounts: AccountSummary[];
  cards: CardSummary[];
  categories: CategoryOption[];
  isSubmitting: boolean;
  month: string;
  pendingExpenses: PendingExpenseSummary[];
  recurringRules: RecurringRuleSummary[];
  onConfirmPending: (pendingId: string) => Promise<void>;
  onCreateRule: (payload: RecurringRulePayload) => Promise<void>;
  onMonthChange: (month: string) => void;
  onOpenLedgerFiltered: (filters: Partial<TransactionFilters>, month?: string) => void;
  onUpdateRule: (ruleId: string, payload: RecurringRuleUpdatePayload) => Promise<void>;
  uiDensity: UiDensity;
};

export function FixedExpensesView({
  surface = "desktop",
  accounts,
  cards,
  categories,
  isSubmitting,
  month,
  pendingExpenses,
  recurringRules,
  onConfirmPending,
  onCreateRule,
  onMonthChange: _onMonthChange,
  onOpenLedgerFiltered,
  onUpdateRule,
  uiDensity,
}: FixedExpensesViewProps) {
  const isMobileSurface = surface === "mobile";

  const [isRuleSheetOpen, setIsRuleSheetOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<RecurringRuleSummary | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedPending, setSelectedPending] = useState<PendingExpenseSummary | null>(null);

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.account_id, account.name])),
    [accounts],
  );
  const cardNameById = useMemo(
    () => new Map(cards.map((card) => [card.card_id, card.name])),
    [cards],
  );

  const activeRulesCount = recurringRules.filter((r) => r.is_active).length;

  let pendingCount = 0;
  let pendingAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;

  for (const pending of pendingExpenses) {
    if (pending.status === "confirmed") {
      paidCount += 1;
      paidAmount += pending.amount;
    } else {
      pendingCount += 1;
      pendingAmount += pending.amount;
    }
  }

  const totalPendingAmount = pendingAmount + paidAmount;
  const groupedPendings = useMemo(() => groupPendingsByTemporal(pendingExpenses), [pendingExpenses]);

  const sortedGroups = Array.from(groupedPendings.entries())
    .filter(([_, items]) => items.length > 0)
    .sort(([statusA], [statusB]) => getTemporalOrder(statusA) - getTemporalOrder(statusB));

  const handleOpenRuleSheet = (rule: RecurringRuleSummary | null = null) => {
    setRuleToEdit(rule);
    setIsRuleSheetOpen(true);
  };

  const handleOpenDetailDrawer = (pending: PendingExpenseSummary) => {
    setSelectedPending(pending);
    setIsDetailDrawerOpen(true);
  };

  return (
    <div className={cn("space-y-6", uiDensity === "dense" && "space-y-4")}>
      <MonthSummaryBar
        activeRulesCount={activeRulesCount}
        totalPendingAmount={totalPendingAmount}
        pendingCount={pendingCount}
        pendingAmount={pendingAmount}
        paidCount={paidCount}
        paidAmount={paidAmount}
      />

      <div className={cn("grid grid-cols-1 gap-6 items-start", !isMobileSurface && "lg:grid-cols-2")}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Ocorrencias do mes</h2>
          </div>

          <div
            className={cn(
              "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
              isMobileSurface ? "min-h-[280px]" : "min-h-[400px]",
            )}
          >
            {pendingExpenses.length === 0 ? (
              <EmptyState
                className="py-12"
                description="Nenhuma ocorrencia gerada para este mes."
                icon={CalendarClock}
                title="Sem pendencias"
              />
            ) : (
              <div className="space-y-6">
                {sortedGroups.map(([status, items]) => {
                  const totalGroupAmount = items.reduce((sum, item) => sum + item.amount, 0);
                  return (
                    <PendingGroup
                      key={status}
                      status={status as TemporalStatus}
                      count={items.length}
                      totalAmount={formatCurrency(totalGroupAmount)}
                    >
                      {items.map((pending) => (
                        <PendingItem
                          key={pending.pending_id}
                          pending={pending}
                          accountNameById={accountNameById}
                          cardNameById={cardNameById}
                          isSubmitting={isSubmitting}
                          onClick={() => handleOpenDetailDrawer(pending)}
                          onConfirm={(id) => onConfirmPending(id)}
                          onViewHistory={() =>
                            onOpenLedgerFiltered(
                              {
                                period: "month",
                                preset: "fixed",
                                text: pending.name,
                              },
                              month,
                            )
                          }
                        />
                      ))}
                    </PendingGroup>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {!isMobileSurface ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Cadastros fixos</h2>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[400px]">
              {recurringRules.length === 0 ? (
                <EmptyState
                  className="py-12"
                  description="Nenhum cadastro de gasto fixo criado."
                  icon={CalendarClock}
                  title="Sem cadastros"
                />
              ) : (
                <div className="flex flex-col">
                  {recurringRules.map((rule) => (
                    <RuleListItem
                      key={rule.rule_id}
                      rule={rule}
                      accountNameById={accountNameById}
                      cardNameById={cardNameById}
                      onClick={() => handleOpenRuleSheet(rule)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {!isMobileSurface ? (
        <RuleFormSheet
          isOpen={isRuleSheetOpen}
          onOpenChange={setIsRuleSheetOpen}
          accounts={accounts}
          cards={cards}
          categories={categories}
          ruleToEdit={ruleToEdit}
          isSubmitting={isSubmitting}
          onCreateRule={onCreateRule}
          onUpdateRule={onUpdateRule}
          onToggleRuleStatus={async (rule) => {
            await onUpdateRule(rule.rule_id, {
              isActive: !rule.is_active,
            });
          }}
        />
      ) : null}

      <DetailDrawer
        pending={selectedPending}
        isOpen={isDetailDrawerOpen}
        onOpenChange={setIsDetailDrawerOpen}
        accountNameById={accountNameById}
        cardNameById={cardNameById}
        isSubmitting={isSubmitting}
        onConfirm={async (id) => {
          await onConfirmPending(id);
          setIsDetailDrawerOpen(false);
        }}
        onViewHistory={() => {
          if (selectedPending) {
            onOpenLedgerFiltered(
              {
                period: "month",
                preset: "fixed",
                text: selectedPending.name,
              },
              month,
            );
            setIsDetailDrawerOpen(false);
          }
        }}
      />
    </div>
  );
}
