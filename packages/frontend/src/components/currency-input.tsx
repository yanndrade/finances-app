import { type InputHTMLAttributes } from "react";

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function CurrencyInput({
  value,
  onChange,
  label,
  id,
  ...props
}: CurrencyInputProps) {
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    let rawValue = event.target.value.replace(/\D/g, "");
    
    // Limit to reasonable number of digits to avoid overflow
    if (rawValue.length > 12) {
      rawValue = rawValue.slice(0, 12);
    }
    
    onChange(rawValue);
  }

  const formattedValue = formatRawValue(value);

  return (
    <div className="quick-entry-field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="quick-entry-currency">
        <span className="quick-entry-currency__prefix">R$</span>
        <input
          {...props}
          id={id}
          onChange={handleChange}
          type="text"
          value={formattedValue}
        />
      </div>
    </div>
  );
}

function formatRawValue(rawValue: string): string {
  if (!rawValue) return "0,00";
  
  const numberValue = parseInt(rawValue, 10);
  const integerPart = Math.floor(numberValue / 100);
  const decimalPart = numberValue % 100;

  const formattedInteger = new Intl.NumberFormat("pt-BR").format(integerPart);
  const formattedDecimal = String(decimalPart).padStart(2, "0");

  return `${formattedInteger},${formattedDecimal}`;
}
