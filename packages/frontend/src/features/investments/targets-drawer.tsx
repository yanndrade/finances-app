import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PercentInput } from "@/components/ui/percent-input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AllocationTarget } from "@/lib/api";
import { saveAllocationTarget } from "@/lib/api";
import { createClientId } from "@/lib/uuid";
import { getErrorMessage } from "@/lib/utils";

import { INVESTMENT_ALLOCATION_CLASSES, labelAssetClass } from "./investment-calculations";

type TargetsDrawerProps = {
  open: boolean;
  targets: AllocationTarget[];
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

type TargetDraft = {
  id: string;
  asset_class: string;
  label: string;
  ideal_percentage: number;
  current_value: number;
};

function targetsToDrafts(targets: AllocationTarget[]): TargetDraft[] {
  const byClass = new Map(targets.map((target) => [target.asset_class, target]));
  return INVESTMENT_ALLOCATION_CLASSES.map((assetClass) => {
    const existing = byClass.get(assetClass);
    if (!existing) {
      return {
        id: createClientId(),
        asset_class: assetClass,
        label: labelAssetClass(assetClass),
        ideal_percentage: 0,
        current_value: 0,
      };
    }
    return {
      id: existing.id,
      asset_class: existing.asset_class,
      label: existing.label,
      ideal_percentage: existing.ideal_percentage,
      current_value: existing.current_value,
    };
  });
}

export function TargetsDrawer({
  open,
  targets,
  onClose,
  onSaved,
  onError,
}: TargetsDrawerProps) {
  const [drafts, setDrafts] = useState<TargetDraft[]>(() => targetsToDrafts(targets));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDrafts(targetsToDrafts(targets));
    }
  }, [open, targets]);

  function updateDraft(assetClass: string, ideal_percentage: number) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.asset_class === assetClass ? { ...draft, ideal_percentage } : draft,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const draft of drafts) {
        await saveAllocationTarget({
          id: draft.id,
          asset_class: draft.asset_class,
          label: draft.label,
          ideal_percentage: draft.ideal_percentage,
          current_value: draft.current_value,
        });
      }
      onSaved();
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Metas de alocação</SheetTitle>
          <SheetDescription>
            Defina o percentual ideal de cada classe para o Kraken.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {drafts.map((draft) => (
            <div
              key={draft.asset_class}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <span className="text-sm font-semibold text-slate-800">{draft.label}</span>
              <div className="w-28">
                <PercentInput
                  aria-label={`Meta ideal ${draft.label}`}
                  className="h-9 text-right"
                  valueInBasisPoints={draft.ideal_percentage}
                  onValueChange={(value) => updateDraft(draft.asset_class, value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          className="mt-6 w-full"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Salvando..." : "Salvar metas"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
