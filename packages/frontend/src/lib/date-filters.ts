import type { ReportFilters, TransactionFilters } from "./api";

export function currentMonth(): string {
  return currentDate().slice(0, 7);
}

export function currentDate(): string {
  return formatLocalDate(new Date());
}

export function monthFirstDay(month: string): string {
  return `${month}-01`;
}

export function monthLastDay(month: string): string {
  const [yearText, monthText] = month.split("-");
  const year = parseInt(yearText ?? "1970", 10);
  const monthValue = parseInt(monthText ?? "1", 10);
  const lastDay = new Date(year, monthValue, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

export function toTransactionApiFilters(
  filters: TransactionFilters,
): Partial<TransactionFilters> {
  const normalized = normalizeReportFilters(filters);
  const range = resolveFilterRange(normalized);

  return {
    from: range.from,
    to: range.to,
    category: normalized.category,
    account: normalized.account,
    method: normalized.method,
    person: normalized.person,
    text: normalized.text,
  };
}

export function toReportApiFilters(filters: TransactionFilters): ReportFilters {
  const normalized = normalizeReportFilters(filters);
  const range = resolveFilterRange(normalized);

  return {
    period: normalized.period,
    reference: normalized.reference,
    from: range.from,
    to: range.to,
    category: normalized.category,
    account: normalized.account,
    method: normalized.method,
    person: normalized.person,
    text: normalized.text,
  };
}

export function toIsoFromDate(value: string, endOfDay: boolean): string {
  const suffix = endOfDay ? "T23:59:59Z" : "T00:00:00Z";
  return `${value}${suffix}`;
}

function normalizeReportFilters(filters: TransactionFilters): ReportFilters {
  return {
    period: filters.period ?? "month",
    reference: filters.reference ?? currentDate(),
    from: filters.from,
    to: filters.to,
    category: filters.category,
    account: filters.account,
    method: filters.method,
    person: filters.person,
    text: filters.text,
  };
}

function resolveFilterRange(filters: ReportFilters): { from: string; to: string } {
  if (filters.period === "custom") {
    if (!filters.from || !filters.to) {
      return { from: "", to: "" };
    }
    return {
      from: toIsoFromDate(filters.from, false),
      to: toIsoFromDate(filters.to, true),
    };
  }

  const safeReference = normalizeReferenceDate(filters.reference);
  const [yearText, monthText, dayText] = safeReference.split("-");
  const year = parseInt(yearText ?? "1970", 10);
  const month = parseInt(monthText ?? "1", 10);
  const day = parseInt(dayText ?? "1", 10);
  const referenceDate = new Date(Date.UTC(year, month - 1, day));
  let start = new Date(referenceDate);
  let end = new Date(referenceDate);

  if (filters.period === "week") {
    const weekDay = referenceDate.getUTCDay();
    const mondayOffset = (weekDay + 6) % 7;
    start = new Date(referenceDate);
    start.setUTCDate(referenceDate.getUTCDate() - mondayOffset);
    end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (filters.period === "month") {
    start = new Date(Date.UTC(year, month - 1, 1));
    end = new Date(Date.UTC(year, month, 0));
  }

  return {
    from: `${start.toISOString().slice(0, 10)}T00:00:00Z`,
    to: `${end.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}

function normalizeReferenceDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return currentDate();
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
