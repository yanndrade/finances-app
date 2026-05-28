import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PercentInputProps = {
  valueInBasisPoints: number; // e.g. 15% is 1500 basis points
  onValueChange: (valueInBasisPoints: number) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
};

export function PercentInput({
  valueInBasisPoints,
  onValueChange,
  className,
  disabled,
  placeholder = "0,00",
  id,
  "aria-label": ariaLabel,
}: PercentInputProps) {
  const [displayValue, setDisplayValue] = useState(() => {
    return valueInBasisPoints > 0 ? formatBasisPoints(valueInBasisPoints) : "";
  });

  useEffect(() => {
    const formatted = valueInBasisPoints > 0 ? formatBasisPoints(valueInBasisPoints) : "";
    const currentBasisPoints = parsePercentToBasisPoints(displayValue);
    if (currentBasisPoints !== valueInBasisPoints) {
      setDisplayValue(formatted);
    }
  }, [valueInBasisPoints]);

  function formatBasisPoints(bp: number): string {
    const percent = bp / 100;
    return percent.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parsePercentToBasisPoints(val: string): number {
    const rawDigits = val.replace(/\D/g, "");
    if (!rawDigits) return 0;
    return parseInt(rawDigits, 10);
  }

  function handleChange(val: string) {
    const rawDigits = val.replace(/\D/g, "");
    const cappedDigits = rawDigits.slice(0, 5); // 10000 bp = 100.00% is 5 digits
    let bp = cappedDigits ? parseInt(cappedDigits, 10) : 0;

    if (bp > 10000) {
      bp = 10000;
    }

    if (bp === 0) {
      setDisplayValue("");
      onValueChange(0);
    } else {
      const formatted = formatBasisPoints(bp);
      setDisplayValue(formatted);
      onValueChange(bp);
    }
  }

  return (
    <div className="relative flex w-full items-center">
      <Input
        id={id}
        aria-label={ariaLabel}
        className={cn("text-right font-medium pr-8", className)}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
      />
      <span className="absolute right-3 text-sm font-semibold text-slate-400 select-none pointer-events-none">
        %
      </span>
    </div>
  );
}
