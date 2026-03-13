import { resolveCategoryLabel } from "./categories";

export function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function formatCurrencyCompact(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(valueInCents / 100);
}

export function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);
  if (isNaN(date.getTime())) return isoValue;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDate(isoOrDateValue: string): string {
  const normalizedValue = isoOrDateValue.includes("T")
    ? isoOrDateValue
    : `${isoOrDateValue}T12:00:00Z`;
  const date = new Date(normalizedValue);
  if (isNaN(date.getTime())) return isoOrDateValue;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function toDateTimeInputValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toIsoDateTime(localValue: string): string {
  const date = new Date(localValue);
  if (isNaN(date.getTime())) return localValue;
  return date.toISOString().replace(".000", "");
}

export function formatAccountType(accountType: string): string {
  const labels: Record<string, string> = {
    checking: "Conta corrente",
    savings: "Poupan\u00E7a",
    wallet: "Carteira",
    investment: "Investimento",
    other: "Outra",
  };

  return labels[accountType] ?? accountType;
}

export function formatTransactionType(transactionType: string): string {
  const labels: Record<string, string> = {
    income: "Entrada",
    expense: "Sa\u00EDda",
    transfer: "Transfer\u00EAncia",
    investment: "Investimento",
  };

  return labels[transactionType] ?? transactionType;
}

export function formatPaymentMethod(paymentMethod: string): string {
  const labels: Record<string, string> = {
    PIX: "PIX",
    CASH: "Dinheiro",
    OTHER: "Outro",
    INVOICE: "Fatura",
  };

  return labels[paymentMethod] ?? paymentMethod;
}

export function formatTransactionStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "Efetivada",
    voided: "Estornada",
    readonly: "Somente leitura",
  };

  return labels[status] ?? status;
}

export type DeltaInfo = {
  value: string;
  percent: string;
  direction: "up" | "down" | "neutral";
};

export function formatDelta(current: number, previous: number): DeltaInfo {
  const diff = current - previous;

  if (previous === 0) {
    return {
      value: formatCurrency(diff),
      percent: current > 0 ? "+100%" : "0%",
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral",
    };
  }

  const pct = ((diff / Math.abs(previous)) * 100).toFixed(0);
  const sign = diff >= 0 ? "+" : "";

  return {
    value: `${sign}${formatCurrency(diff)}`,
    percent: `${sign}${pct}%`,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "neutral",
  };
}

export function formatCategoryName(categoryId: string): string {
  return resolveCategoryLabel(categoryId);
}

export function formatKind(kind: string): string {
  const labels: Record<string, string> = {
    income: "Entrada",
    expense: "Saída",
    transfer: "Transferência",
    investment: "Investimento",
    reimbursement: "Reembolso",
    adjustment: "Ajuste",
  };
  return labels[kind] ?? kind;
}

export function formatOriginType(originType: string): string {
  const labels: Record<string, string> = {
    manual: "Manual",
    recurring: "Recorrente",
    installment: "Parcelado",
    card_purchase: "Compra no Cartão",
    transfer: "Transferência",
    investment: "Investimento",
    reimbursement: "Reembolso",
    imported: "Importado",
  };
  return labels[originType] ?? originType;
}

export function formatLifecycleStatus(status: string): string {
  const labels: Record<string, string> = {
    forecast: "Prevista",
    pending: "Pendente",
    cleared: "Compensada",
    cancelled: "Cancelada",
    voided: "Estornada",
    // legacy
    active: "Compensada",
    readonly: "Automática",
  };
  return labels[status] ?? status;
}

export function formatPaymentMethodExpanded(method: string): string {
  const labels: Record<string, string> = {
    PIX: "PIX",
    CASH: "Dinheiro",
    DEBIT: "Débito",
    CREDIT_CASH: "Crédito à vista",
    CREDIT_INSTALLMENT: "Crédito parcelado",
    BOLETO: "Boleto",
    AUTO_DEBIT: "Débito automático",
    TRANSFER: "Transferência",
    BALANCE: "Saldo",
    OTHER: "Outro",
    // legacy
    INVOICE: "Fatura",
    CARD: "Cartão",
  };
  return labels[method] ?? method;
}

export function formatCompetenceMonth(month: string): string {
  const normalized = month.includes("T") ? month : `${month}-01T12:00:00Z`;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatShortDate(isoOrDateValue: string): string {
  const normalized = isoOrDateValue.includes("T")
    ? isoOrDateValue
    : `${isoOrDateValue}T12:00:00Z`;
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return isoOrDateValue;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function humanizeLedgerId(
  value: string | undefined | null,
  accounts: { account_id: string; name: string }[],
): string {
  if (!value) return "--";

  const separatorIndex = value.indexOf(":");
  const kind = separatorIndex >= 0 ? value.slice(0, separatorIndex) : value;
  const id = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : "";

  if (kind === "account") {
    return accounts.find((a) => a.account_id === id)?.name ?? id;
  }
  if (kind === "category") {
    return formatCategoryName(id);
  }
  if (kind === "transfer") {
    return "Transferência interna";
  }
  if (kind === "card_liability") {
    return `Passivo do Cartão ${id}`;
  }
  if (kind === "person") {
    return id || "Pessoa";
  }
  if (kind === "investment_asset") {
    return "Patrimônio investido";
  }

  return value;
}
