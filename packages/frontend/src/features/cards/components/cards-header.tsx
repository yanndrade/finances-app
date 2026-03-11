import { Settings2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import type { CardSummary } from "../../../lib/api";

type CardsHeaderProps = {
  selectedScope: string;
  onScopeChange: (scope: string) => void;
  activeCards: CardSummary[];
  onOpenManageCards: () => void;
};

export const ALL_CARDS_SCOPE = "all";

export function CardsHeader({
  selectedScope,
  onScopeChange,
  activeCards,
  onOpenManageCards,
}: CardsHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Select value={selectedScope} onValueChange={onScopeChange}>
        <SelectTrigger
          aria-label="Escopo dos cartões"
          className="h-8 w-48 rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CARDS_SCOPE}>Todos os cartões</SelectItem>
          {activeCards.map((card) => (
            <SelectItem key={card.card_id} value={card.card_id}>
              {card.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        className="h-8 rounded-xl px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        type="button"
        onClick={onOpenManageCards}
        title="Gerenciar cartões"
      >
        <Settings2 className="h-3.5 w-3.5 mr-1.5" />
        Gerenciar cartões
      </Button>
    </div>
  );
}
