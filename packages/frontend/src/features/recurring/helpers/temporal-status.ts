import { isBefore, isToday, parseISO, startOfDay } from "date-fns";
import type { PendingExpenseSummary } from "../../../lib/api";

export type TemporalStatus = "overdue" | "due_today" | "upcoming" | "paid";

export function getTemporalStatus(dueDate: string, status: string): TemporalStatus {
  if (status === "confirmed") {
    return "paid";
  }

  const due = startOfDay(parseISO(dueDate));
  const today = startOfDay(new Date());

  if (isBefore(due, today)) {
    return "overdue";
  }
  if (isToday(due)) {
    return "due_today";
  }
  return "upcoming";
}

export function groupPendingsByTemporal(
  pendings: PendingExpenseSummary[],
): Map<TemporalStatus, PendingExpenseSummary[]> {
  const groups = new Map<TemporalStatus, PendingExpenseSummary[]>([
    ["overdue", []],
    ["due_today", []],
    ["upcoming", []],
    ["paid", []],
  ]);

  for (const pending of pendings) {
    const status = getTemporalStatus(pending.due_date, pending.status);
    groups.get(status)?.push(pending);
  }

  return groups;
}

export function getTemporalLabel(status: TemporalStatus): string {
  switch (status) {
    case "overdue":
      return "Atrasados";
    case "due_today":
      return "Vencendo hoje";
    case "upcoming":
      return "Proximos dias";
    case "paid":
      return "Pagos";
  }
}

export function getTemporalOrder(status: TemporalStatus): number {
  switch (status) {
    case "overdue":
      return 1;
    case "due_today":
      return 2;
    case "upcoming":
      return 3;
    case "paid":
      return 4;
  }
}
