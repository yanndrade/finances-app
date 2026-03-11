import { useMemo } from "react";
import { DaySeparator } from "./day-separator";
import { MovementRow } from "./movement-row";
import type { UnifiedMovement, AccountSummary, CardSummary } from "../../lib/api";
import { cn } from "../../lib/utils";

type MovementLedgerProps = {
  movements: UnifiedMovement[];
  accounts: AccountSummary[];
  cards: CardSummary[];
  selectedMovementId: string | null;
  onSelectMovement: (movement: UnifiedMovement) => void;
  initialBalance?: number;
  className?: string;
};

type DayGroup = {
  date: string;            // YYYY-MM-DD
  movements: UnifiedMovement[];
  daySubtotal: number;
  runningBalance: number;
};

function isoToDateKey(iso: string): string {
  // Handles both "2024-01-15T10:30:00Z" and "2024-01-15"
  return iso.slice(0, 10);
}

function signedAmount(movement: UnifiedMovement): number {
  const { kind, lifecycle_status, amount } = movement;
  if (lifecycle_status === "voided" || lifecycle_status === "cancelled") {
    return 0;
  }
  switch (kind) {
    case "income":
    case "reimbursement":
      return amount;
    case "expense":
    case "investment":
      return -amount;
    case "transfer":
      return 0; // transfers are neutral for running balance
    default:
      return 0;
  }
}

function buildDayGroups(
  movements: UnifiedMovement[],
  initialBalance: number,
): DayGroup[] {
  // Group by date key (sorted ascending for running balance, then reversed for display)
  const byDate = new Map<string, UnifiedMovement[]>();

  for (const m of movements) {
    const key = isoToDateKey(m.posted_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  // Sort dates ascending (oldest first) for running balance computation
  const sortedDates = Array.from(byDate.keys()).sort();

  let running = initialBalance;
  const groups: DayGroup[] = sortedDates.map((date) => {
    const dayMovements = byDate.get(date)!;
    const daySubtotal = dayMovements.reduce(
      (acc, m) => acc + signedAmount(m),
      0,
    );
    running += daySubtotal;
    return {
      date,
      movements: dayMovements,
      daySubtotal,
      runningBalance: running,
    };
  });

  // Reverse so most-recent day is at the top
  return groups.reverse();
}

export function MovementLedger({
  movements,
  accounts,
  cards,
  selectedMovementId,
  onSelectMovement,
  initialBalance = 0,
  className,
}: MovementLedgerProps) {
  const dayGroups = useMemo(
    () => buildDayGroups(movements, initialBalance),
    [movements, initialBalance],
  );

  if (dayGroups.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-20 text-center",
          className,
        )}
      >
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">
          Nenhuma movimentação encontrada
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Tente ajustar os filtros ou alterar a competência.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {dayGroups.map((group) => (
        <div key={group.date} className="flex flex-col">
          <DaySeparator
            date={group.date}
            daySubtotal={group.daySubtotal}
            runningBalance={initialBalance !== 0 ? group.runningBalance : null}
          />
          <div className="flex flex-col">
            {group.movements.map((movement) => (
              <MovementRow
                key={movement.movement_id}
                movement={movement}
                accounts={accounts}
                cards={cards}
                isSelected={selectedMovementId === movement.movement_id}
                onClick={() => onSelectMovement(movement)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
