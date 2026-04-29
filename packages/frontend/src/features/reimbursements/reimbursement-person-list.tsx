import { RotateCcw } from "lucide-react";

import type { PendingReimbursementSummary } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { EmptyState } from "../../components/ui/empty-state";

import { groupReimbursementsByPerson } from "./person-grouping";
import { ReimbursementRow } from "./reimbursement-row";

type ReimbursementPersonListProps = {
  reimbursements: PendingReimbursementSummary[];
  loading: boolean;
  onSelectReimbursement: (reimbursement: PendingReimbursementSummary) => void;
  onOpenQuickAdd?: () => void;
};

const STATUS_ORDER: PendingReimbursementSummary["status"][] = [
  "pending",
  "partial",
  "received",
  "canceled",
];

export function ReimbursementPersonList({
  reimbursements,
  loading,
  onSelectReimbursement,
  onOpenQuickAdd,
}: ReimbursementPersonListProps) {
  const groups = groupReimbursementsByPerson(reimbursements);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (reimbursements.length === 0 || groups.length === 0) {
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

  return (
    <Accordion type="multiple" className="rounded-xl border border-border/60 bg-background">
      {groups.map((group) => {
        const statusSummary = formatStatusSummary(group.status_counts);

        return (
          <AccordionItem key={group.group_id} value={group.group_id} className="border-b border-border/60 last:border-b-0">
            <AccordionTrigger className="gap-4 px-4 py-4 hover:no-underline">
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {group.canonical_name}
                </p>

                {group.aliases.length > 0 ? (
                  <p className="truncate text-xs text-muted-foreground">
                    Também encontrado como: {group.aliases.join(", ")}
                  </p>
                ) : null}

                {statusSummary ? (
                  <p className="text-xs text-muted-foreground/80">{statusSummary}</p>
                ) : null}
              </div>

              <div className="shrink-0 pr-1 text-right">
                <p className="text-sm font-bold tabular-nums text-slate-900">
                  {formatCurrency(group.outstanding_total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.item_count} {group.item_count === 1 ? "lançamento" : "lançamentos"}
                </p>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-2 pt-0">
              <div className="divide-y divide-border/60 px-2">
                {group.items.map((reimbursement) => (
                  <ReimbursementRow
                    key={reimbursement.transaction_id}
                    reimbursement={reimbursement}
                    onClick={() => onSelectReimbursement(reimbursement)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function formatStatusSummary(
  statusCounts: Record<PendingReimbursementSummary["status"], number>,
): string | null {
  const parts: string[] = [];

  for (const status of STATUS_ORDER) {
    const count = statusCounts[status];
    if (count <= 0) {
      continue;
    }

    if (status === "pending") {
      parts.push(`${count} pendente${count > 1 ? "s" : ""}`);
      continue;
    }
    if (status === "partial") {
      parts.push(`${count} parcial${count > 1 ? "is" : ""}`);
      continue;
    }
    if (status === "received") {
      parts.push(`${count} recebido${count > 1 ? "s" : ""}`);
      continue;
    }

    parts.push(`${count} cancelado${count > 1 ? "s" : ""}`);
  }

  if (parts.length <= 1) {
    return null;
  }

  return parts.join(", ");
}
