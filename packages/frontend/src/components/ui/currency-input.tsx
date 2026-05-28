import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type CurrencyInputProps = {
  valueInCents: number;
  onValueChange: (valueInCents: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  showSymbol?: boolean;
};

export function CurrencyInput({
  valueInCents,
  onValueChange,
  className,
  disabled,
  placeholder = "0,00",
  "aria-label": ariaLabel,
  id,
  showSymbol = true,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => {
    return valueInCents > 0 ? formatCurrencyWithoutSymbol(valueInCents) : "";
  });

  useEffect(() => {
    const formatted = valueInCents > 0 ? formatCurrencyWithoutSymbol(valueInCents) : "";
    const currentCents = parseCurrencyToCents(displayValue);
    if (currentCents !== valueInCents) {
      setDisplayValue(formatted);
    }
  }, [valueInCents]);

  function formatCurrencyWithoutSymbol(cents: number): string {
    const formatted = formatCurrency(cents);
    return formatted.replace(/R\$\s?/gi, "").trim();
  }

  function parseCurrencyToCents(val: string): number {
    const rawDigits = val.replace(/\D/g, "");
    if (!rawDigits) return 0;
    return parseInt(rawDigits, 10);
  }

  function handleChange(val: string) {
    const rawDigits = val.replace(/\D/g, "");
    const cappedDigits = rawDigits.slice(0, 12);
    const cents = cappedDigits ? parseInt(cappedDigits, 10) : 0;

    if (cents === 0) {
      setDisplayValue("");
      onValueChange(0);
    } else {
      const formatted = formatCurrencyWithoutSymbol(cents);
      setDisplayValue(formatted);
      onValueChange(cents);
    }
  }

  return (
    <div className="relative flex w-full items-center">
      {showSymbol && (
        <span className="absolute left-3 text-sm font-semibold text-slate-400 select-none pointer-events-none">
          R$
        </span>
      )}
      <Input
        id={id}
        aria-label={ariaLabel}
        className={cn("text-right font-medium", showSymbol && "pl-9", className)}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  );
}

export function parseCurrencyInputToCents(value: string): number {
  const rawDigits = value.replace(/\D/g, "");
  return rawDigits ? parseInt(rawDigits, 10) : 0;
}

export function formatCurrencyInputFromCents(valueInCents: number): string {
  const formatted = formatCurrency(valueInCents);
  return formatted.replace(/R\$\s?/gi, "").trim();
}
