import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, Download, RotateCcw } from "lucide-react";

import type { CardSummary, PendingReimbursementSummary } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Accordion, AccordionContent, AccordionItem } from "../../components/ui/accordion";
import { EmptyState } from "../../components/ui/empty-state";
import { cn } from "../../lib/utils";

import {
  exportPersonReimbursementsPdf,
  type ExportPersonReimbursementsPdfResult,
} from "./export-person-reimbursements-pdf";
import { groupReimbursementsByPerson } from "./person-grouping";
import { ReimbursementRow } from "./reimbursement-row";

type ReimbursementPersonListProps = {
  reimbursements: PendingReimbursementSummary[];
  loading: boolean;
  month: string;
  cards: CardSummary[];
  onSelectReimbursement: (reimbursement: PendingReimbursementSummary) => void;
  onOpenQuickAdd?: () => void;
  onError?: (error: unknown) => void;
  onExported?: (result: ExportPersonReimbursementsPdfResult) => void;
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
  month,
  cards,
  onSelectReimbursement,
  onOpenQuickAdd,
  onError,
  onExported,
}: ReimbursementPersonListProps) {
  const groups = groupReimbursementsByPerson(reimbursements);

  async function handleExport(group: ReturnType<typeof groupReimbursementsByPerson>[number]) {
    try {
      const result = await exportPersonReimbursementsPdf({ group, month, cards });
      onExported?.(result);
    } catch (error) {
      onError?.(error);
    }
  }

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
            <AccordionPrimitive.Header className="flex items-start gap-3 px-4 py-4">
              <AccordionPrimitive.Trigger
                className={cn(
                  "flex min-w-0 flex-1 items-start justify-between gap-4 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2",
                  "[&[data-state=open]_.reimbursement-chevron]:rotate-180",
                )}
              >
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

                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-slate-900">
                    {formatCurrency(group.outstanding_total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {group.item_count} {group.item_count === 1 ? "lançamento" : "lançamentos"}
                  </p>
                </div>

                <ChevronDown className="reimbursement-chevron mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
              </AccordionPrimitive.Trigger>

              <button
                type="button"
                title={`Exportar PDF de ${group.canonical_name}`}
                aria-label={`Exportar PDF de ${group.canonical_name}`}
                onClick={() => {
                  void handleExport(group);
                }}
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
              >
                <Download size={14} />
              </button>
            </AccordionPrimitive.Header>

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
