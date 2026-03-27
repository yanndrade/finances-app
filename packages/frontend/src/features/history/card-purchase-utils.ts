import type { UnifiedMovement } from "../../lib/api";
import { formatLifecycleStatus } from "../../lib/format";

export function isCardPurchaseMovement(movement: UnifiedMovement): boolean {
  return (
    movement.origin_type === "card_purchase" ||
    movement.origin_type === "installment" ||
    movement.source_event_type === "CardPurchaseCreated" ||
    movement.source_event_type === "CardPurchaseUpdated"
  );
}

export function formatHistoryMovementLifecycleStatus(
  movement: UnifiedMovement,
): string {
  if (
    isCardPurchaseMovement(movement) &&
    movement.lifecycle_status === "cleared"
  ) {
    return "Fatura paga";
  }

  return formatLifecycleStatus(movement.lifecycle_status);
}
