export function formatCurrency(valueInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function formatDateTime(isoValue: string): string {
  const date = new Date(isoValue);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toDateTimeInputValue(isoValue: string): string {
  const date = new Date(isoValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toIsoDateTime(localValue: string): string {
  return new Date(localValue).toISOString().replace(".000", "");
}

export function formatAccountType(accountType: string): string {
  const labels: Record<string, string> = {
    checking: "Conta corrente",
    savings: "Poupanca",
    wallet: "Carteira",
    investment: "Investimento",
    other: "Outra",
  };

  return labels[accountType] ?? accountType;
}

export function formatTransactionType(transactionType: string): string {
  const labels: Record<string, string> = {
    income: "Entrada",
    expense: "Saida",
    transfer: "Transferencia",
  };

  return labels[transactionType] ?? transactionType;
}

export function formatTransactionStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "Ativa",
    voided: "Estornada",
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
  const labels: Record<string, string> = {
    food: "Alimentação",
    transport: "Transporte",
    housing: "Moradia",
    health: "Saúde",
    education: "Educação",
    entertainment: "Lazer",
    clothing: "Vestuário",
    utilities: "Contas",
    salary: "Salário",
    freelance: "Freelance",
    transfer: "Transferência",
    other: "Outros",
  };

  return labels[categoryId] ?? categoryId;
}
