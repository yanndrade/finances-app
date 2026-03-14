import { RotateCcw } from "lucide-react";

import type { PendingReimbursementSummary } from "../../lib/api";
import { EmptyState } from "../../components/ui/empty-state";
import { ReimbursementRow } from "./reimbursement-row";

type ReimbursementListProps = {
  reimbursements: PendingReimbursementSummary[];
  loading: boolean;
  onSelectReimbursement: (r: PendingReimbursementSummary) => void;
  onOpenQuickAdd?: () => void;
};

type GroupKey = "overdue" | "active" | "received" | "canceled";

const GROUP_ORDER: GroupKey[] = ["overdue", "active", "received", "canceled"];

const GROUP_META: Record<GroupKey, { label: string; description: string }> = {
  overdue: {
    label: "Em atraso",
    description: "Vencimento passou e ainda não foram recebidos",
  },
  active: {
    label: "Pendentes / Parciais",
    description: "Aguardando recebimento total",
  },
  received: {
    label: "Recebidos",
    description: "Pagamentos confirmados",
  },
  canceled: {
    label: "Cancelados",
    description: "Marcados como cancelados",
  },
};

function getGroupKey(status: PendingReimbursementSummary["status"]): GroupKey {
  if (status === "overdue") return "overdue";
  if (status === "pending" || status === "partial") return "active";
  if (status === "received") return "received";
  return "canceled";
}

export function ReimbursementList({
  reimbursements,
  loading,
  onSelectReimbursement,
  onOpenQuickAdd,
}: ReimbursementListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (reimbursements.length === 0) {
    return (
      <EmptyState
        className="py-16"
        description="Reembolsos aparecem quando você registra uma despesa com pessoa. Adicione uma para começar a rastrear."
        icon={RotateCcw}
        title="Sem reembolsos"
        action={onOpenQuickAdd ? { label: "Nova despesa", onClick: onOpenQuickAdd } : undefined}
      />
    );
  }

  // Group
  const groups = new Map<GroupKey, PendingReimbursementSummary[]>();
  for (const key of GROUP_ORDER) {
    groups.set(key, []);
  }
  for (const r of reimbursements) {
    const key = getGroupKey(r.status);
    groups.get(key)!.push(r);
  }

  const visibleGroups = GROUP_ORDER.filter((key) => (groups.get(key)?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {visibleGroups.map((key) => {
        const items = groups.get(key)!;
        const meta = GROUP_META[key];
        return (
          <div key={key}>
            <div className="mb-3 flex items-baseline gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta.label}</h3>
              <span className="text-xs text-muted-foreground/60">
                {items.length} {items.length === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="divide-y divide-border/60">
              {items.map((r) => (
                <ReimbursementRow
                  key={r.transaction_id}
                  reimbursement={r}
                  onClick={() => onSelectReimbursement(r)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
