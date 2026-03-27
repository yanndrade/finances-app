import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { getCategoryOptions } from "../../lib/categories";
import {
  formatCategoryName,
  formatKind,
  formatLifecycleStatus,
  formatOriginType,
  formatPaymentMethodExpanded,
} from "../../lib/format";
import type {
  AccountSummary,
  CardSummary,
  MovementFilters,
} from "../../lib/api";
import { cn } from "../../lib/utils";

type FilterPanelProps = {
  filters: MovementFilters;
  accounts: AccountSummary[];
  cards: CardSummary[];
  onFiltersChange: (filters: MovementFilters) => void;
  className?: string;
};

type SelectOption = {
  value: string;
  label: string;
};

const ALL_OPTION_VALUE = "__all__";
const WITH_COUNTERPARTY_OPTION_VALUE = "__with_counterparty__";
const WITHOUT_COUNTERPARTY_OPTION_VALUE = "__without_counterparty__";

function activeFilterCount(filters: MovementFilters): number {
  return [
    filters.kind !== undefined,
    filters.origin_type !== undefined,
    filters.lifecycle_status !== undefined,
    filters.account_id !== undefined,
    filters.card_id !== undefined,
    filters.category_id !== undefined,
    filters.payment_method !== undefined,
    filters.counterparty !== undefined,
    filters.has_counterparty !== undefined,
  ].filter(Boolean).length;
}

function ensureCurrentOption(
  value: string,
  options: SelectOption[],
  fallbackLabel: (rawValue: string) => string,
): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label: fallbackLabel(value) }, ...options];
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <Select
        value={value || ALL_OPTION_VALUE}
        onValueChange={(nextValue) =>
          onChange(nextValue === ALL_OPTION_VALUE ? "" : nextValue)
        }
      >
        <SelectTrigger
          aria-label={label}
          className={cn(
            "h-8 rounded-lg border bg-surface px-2.5 text-xs font-medium text-foreground shadow-none",
            "focus:ring-2 focus:ring-ring focus:ring-offset-0",
            value && "border-primary/50 bg-primary/5",
          )}
        >
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_OPTION_VALUE}>Todos</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterPanel({
  filters,
  accounts,
  cards,
  onFiltersChange,
  className,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const count = activeFilterCount(filters);

  function update(patch: Partial<MovementFilters>) {
    onFiltersChange({ ...filters, ...patch });
  }

  function clearAll() {
    onFiltersChange({
      ...filters,
      kind: undefined,
      origin_type: undefined,
      lifecycle_status: undefined,
      account_id: undefined,
      card_id: undefined,
      category_id: undefined,
      payment_method: undefined,
      counterparty: undefined,
      has_counterparty: undefined,
    });
  }

  const personFilterValue =
    filters.has_counterparty === true
      ? WITH_COUNTERPARTY_OPTION_VALUE
      : filters.has_counterparty === false
        ? WITHOUT_COUNTERPARTY_OPTION_VALUE
        : "";

  const categoryOptions = getCategoryOptions().map((option) => ({
    value: option.value,
    label: option.label,
  }));
  const accountOptions = accounts.map((account) => ({
    value: account.account_id,
    label: account.name,
  }));
  const cardOptions = cards.map((card) => ({
    value: card.card_id,
    label: card.name,
  }));

  const kindOptions = ensureCurrentOption(
    filters.kind ?? "",
    [
      { value: "income", label: "Entrada" },
      { value: "expense", label: "Saída" },
      { value: "transfer", label: "Transferência" },
      { value: "investment", label: "Investimento" },
      { value: "reimbursement", label: "Reembolso" },
      { value: "adjustment", label: "Ajuste" },
    ],
    formatKind,
  );

  const originOptions = ensureCurrentOption(
    filters.origin_type ?? "",
    [
      { value: "manual", label: "Manual" },
      { value: "recurring", label: "Recorrente" },
      { value: "installment", label: "Parcelado" },
      { value: "card_purchase", label: "Compra no cartão" },
      { value: "transfer", label: "Transferência" },
      { value: "investment", label: "Investimento" },
      { value: "reimbursement", label: "Reembolso" },
      { value: "imported", label: "Importado" },
    ],
    formatOriginType,
  );

  const lifecycleOptions = ensureCurrentOption(
    filters.lifecycle_status ?? "",
    [
      { value: "forecast", label: "Prevista" },
      { value: "pending", label: "Pendente" },
      { value: "cleared", label: "Compensada" },
      { value: "cancelled", label: "Cancelada" },
      { value: "voided", label: "Estornada" },
      { value: "active", label: "Compensada" },
      { value: "readonly", label: "Automática" },
    ],
    formatLifecycleStatus,
  );

  const paymentMethodOptions = ensureCurrentOption(
    filters.payment_method ?? "",
    [
      { value: "PIX", label: "PIX" },
      { value: "CASH", label: "Dinheiro" },
      { value: "DEBIT", label: "Debito" },
      { value: "CREDIT_CASH", label: "Credito a vista" },
      { value: "CREDIT_INSTALLMENT", label: "Credito parcelado" },
      { value: "BOLETO", label: "Boleto" },
      { value: "AUTO_DEBIT", label: "Débito automático" },
      { value: "TRANSFER", label: "Transferência" },
      { value: "BALANCE", label: "Saldo" },
      { value: "OTHER", label: "Outro" },
      { value: "CARD", label: "Cartão" },
      { value: "INVOICE", label: "Fatura" },
    ],
    formatPaymentMethodExpanded,
  );

  const resolvedAccountOptions = ensureCurrentOption(
    filters.account_id ?? "",
    accountOptions,
    (rawValue) => rawValue,
  );

  const resolvedCardOptions = ensureCurrentOption(
    filters.card_id ?? "",
    cardOptions,
    (rawValue) => rawValue,
  );

  const resolvedCategoryOptions = ensureCurrentOption(
    filters.category_id ?? "",
    categoryOptions,
    formatCategoryName,
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 overflow-hidden bg-surface",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          isExpanded && "border-b border-border/60",
        )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className={cn(
            "flex flex-1 items-center gap-2.5 text-left transition-colors duration-100",
            "rounded-lg hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground flex-1">
            Filtros avancados
          </span>

          {count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[12px] font-bold leading-none min-w-[18px] h-[18px] px-1">
              {count}
            </span>
          )}

          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Limpar filtros"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-4">
          <SelectField
            label="Tipo"
            value={filters.kind ?? ""}
            options={kindOptions}
            onChange={(value) =>
              update({ kind: (value as MovementFilters["kind"]) || undefined })
            }
          />

          <SelectField
            label="Origem"
            value={filters.origin_type ?? ""}
            options={originOptions}
            onChange={(value) =>
              update({
                origin_type:
                  (value as MovementFilters["origin_type"]) || undefined,
              })
            }
          />

          <SelectField
            label="Situação"
            value={filters.lifecycle_status ?? ""}
            options={lifecycleOptions}
            onChange={(value) =>
              update({
                lifecycle_status:
                  (value as MovementFilters["lifecycle_status"]) || undefined,
              })
            }
          />

          <SelectField
            label="Método"
            value={filters.payment_method ?? ""}
            options={paymentMethodOptions}
            onChange={(value) => update({ payment_method: value || undefined })}
          />

          <SelectField
            label="Conta"
            value={filters.account_id ?? ""}
            options={resolvedAccountOptions}
            onChange={(value) => update({ account_id: value || undefined })}
          />

          <SelectField
            label="Cartão"
            value={filters.card_id ?? ""}
            options={resolvedCardOptions}
            onChange={(value) => update({ card_id: value || undefined })}
          />

          <SelectField
            label="Categoria"
            value={filters.category_id ?? ""}
            options={resolvedCategoryOptions}
            onChange={(value) => update({ category_id: value || undefined })}
          />

          <SelectField
            label="Pessoa"
            value={personFilterValue}
            options={[
              {
                value: WITH_COUNTERPARTY_OPTION_VALUE,
                label: "Com pessoa / reembolso",
              },
              {
                value: WITHOUT_COUNTERPARTY_OPTION_VALUE,
                label: "Sem pessoa",
              },
            ]}
            onChange={(value) =>
              update({
                has_counterparty:
                  value === WITH_COUNTERPARTY_OPTION_VALUE
                    ? true
                    : value === WITHOUT_COUNTERPARTY_OPTION_VALUE
                      ? false
                      : undefined,
              })
            }
          />
        </div>
      )}
    </div>
  );
}
