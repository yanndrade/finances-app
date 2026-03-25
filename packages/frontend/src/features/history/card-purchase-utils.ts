import type { UnifiedMovement } from "../../lib/api";

export function isCardPurchaseMovement(movement: UnifiedMovement): boolean {
  return (
    movement.origin_type === "card_purchase" ||
    movement.origin_type === "installment" ||
    movement.source_event_type === "CardPurchaseCreated" ||
    movement.source_event_type === "CardPurchaseUpdated"
  );
}
