import { useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";

import { getCategoryOptions } from "../../lib/categories";
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

function activeFilterCount(filters: MovementFilters): number {
  return [
    filters.kind,
    filters.origin_type,
    filters.lifecycle_status,
    filters.account_id,
    filters.card_id,
    filters.category_id,
    filters.payment_method,
    filters.counterparty,
  ].filter(Boolean).length;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 w-full rounded-lg border border-input bg-surface px-2.5 text-xs font-medium text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 focus:border-ring",
          "transition-colors duration-100",
          value && "border-primary/50 bg-primary/5",
        )}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
    });
  }

  const categoryOptions = getCategoryOptions().map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 overflow-hidden bg-surface",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className={cn(
          "w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors duration-100",
          "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          isExpanded && "border-b border-border/60",
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground flex-1">
          Filtros avançados
        </span>

        {count > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none min-w-[18px] h-[18px] px-1">
            {count}
          </span>
        )}

        {count > 0 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              clearAll();
            }}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Limpar filtros"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <SelectField
            label="Tipo"
            value={filters.kind ?? ""}
            options={[
              { value: "income", label: "Entrada" },
              { value: "expense", label: "Saída" },
              { value: "transfer", label: "Transferência" },
              { value: "investment", label: "Investimento" },
              { value: "reimbursement", label: "Reembolso" },
            ]}
            onChange={(value) =>
              update({ kind: (value as MovementFilters["kind"]) || undefined })
            }
          />

          <SelectField
            label="Origem"
            value={filters.origin_type ?? ""}
            options={[
              { value: "manual", label: "Manual" },
              { value: "recurring", label: "Recorrente" },
              { value: "installment", label: "Parcelado" },
              { value: "card_purchase", label: "Compra no cartão" },
              { value: "transfer", label: "Transferência" },
              { value: "investment", label: "Investimento" },
              { value: "reimbursement", label: "Reembolso" },
            ]}
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
            options={[
              { value: "forecast", label: "Prevista" },
              { value: "pending", label: "Pendente" },
              { value: "cleared", label: "Compensada" },
              { value: "cancelled", label: "Cancelada" },
              { value: "voided", label: "Estornada" },
            ]}
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
            options={[
              { value: "PIX", label: "PIX" },
              { value: "CASH", label: "Dinheiro" },
              { value: "DEBIT", label: "Débito" },
              { value: "CREDIT_CASH", label: "Crédito à vista" },
              { value: "CREDIT_INSTALLMENT", label: "Crédito parcelado" },
              { value: "BOLETO", label: "Boleto" },
              { value: "AUTO_DEBIT", label: "Débito automático" },
              { value: "TRANSFER", label: "Transferência" },
              { value: "BALANCE", label: "Saldo" },
              { value: "OTHER", label: "Outro" },
            ]}
            onChange={(value) => update({ payment_method: value || undefined })}
          />

          <SelectField
            label="Conta"
            value={filters.account_id ?? ""}
            options={accounts.map((account) => ({
              value: account.account_id,
              label: account.name,
            }))}
            onChange={(value) => update({ account_id: value || undefined })}
          />

          <SelectField
            label="Cartão"
            value={filters.card_id ?? ""}
            options={cards.map((card) => ({
              value: card.card_id,
              label: card.name,
            }))}
            onChange={(value) => update({ card_id: value || undefined })}
          />

          <SelectField
            label="Categoria"
            value={filters.category_id ?? ""}
            options={categoryOptions}
            onChange={(value) => update({ category_id: value || undefined })}
          />
        </div>
      )}
    </div>
  );
}
