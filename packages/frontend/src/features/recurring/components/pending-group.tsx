import { ReactNode } from "react";
import { TemporalStatus, getTemporalLabel } from "../helpers/temporal-status";
import { cn } from "../../../lib/utils";

type PendingGroupProps = {
  status: TemporalStatus;
  count: number;
  totalAmount: string;
  children: ReactNode;
};

export function PendingGroup({ status, count, totalAmount, children }: PendingGroupProps) {
  if (count === 0) return null;

  let headerColorClass = "";
  switch (status) {
    case "overdue":
      headerColorClass = "text-rose-600 border-rose-200 bg-rose-50";
      break;
    case "due_today":
      headerColorClass = "text-amber-600 border-amber-200 bg-amber-50";
      break;
    case "upcoming":
      headerColorClass = "text-slate-700 border-slate-200 bg-slate-50";
      break;
    case "paid":
      headerColorClass = "text-emerald-700 border-emerald-200 bg-emerald-50";
      break;
  }

  return (
    <section className="flex flex-col gap-3 mb-8">
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-lg border",
          headerColorClass
        )}
      >
        <h2 className="text-sm font-bold uppercase tracking-wide">
          {getTemporalLabel(status)} ({count})
        </h2>
        <span className="text-sm font-semibold tabular-nums">
          {totalAmount}
        </span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
