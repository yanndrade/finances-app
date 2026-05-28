import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { InvestmentSnapshot } from "@/lib/api";
import {
  fetchInvestmentSnapshotByPeriod,
  saveMonthlyIncomeRecord,
  saveInvestmentSnapshot,
} from "@/lib/api";
import { formatMonthBR } from "@/lib/format";
import { createClientId } from "@/lib/uuid";
import { getErrorMessage } from "@/lib/utils";

import { normalizeSnapshot } from "./investment-calculations";

type ClosingDrawerProps = {
  open: boolean;
  period: string;
  fallbackSnapshot: InvestmentSnapshot | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

type ClosingFormState = {
  id: string;
  date: string;
  period: string;
  total_patrimony: number;
  applied_value: number;
  gross_balance: number;
  free_cash: number;
  accumulated_dividends: number;
  monthly_contribution_target: number;
  fii_applied_value: number;
  fii_monthly_income: number;
  stock_applied_value: number;
  stock_monthly_income: number;
  total_monthly_income: number;
  reinvested_income: number;
  notes: string;
};

function emptyForm(period: string): ClosingFormState {
  const [year, month] = period.split("-");
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    id: createClientId(),
    date: `${year}-${month}-${String(lastDay).padStart(2, "0")}T23:59:59Z`,
    period,
    total_patrimony: 0,
    applied_value: 0,
    gross_balance: 0,
    free_cash: 0,
    accumulated_dividends: 0,
    monthly_contribution_target: 0,
    fii_applied_value: 0,
    fii_monthly_income: 0,
    stock_applied_value: 0,
    stock_monthly_income: 0,
    total_monthly_income: 0,
    reinvested_income: 0,
    notes: "",
  };
}

function snapshotToForm(snapshot: InvestmentSnapshot): ClosingFormState {
  const normalized = normalizeSnapshot(snapshot)!;
  return {
    id: normalized.id,
    date: normalized.date,
    period: normalized.period,
    total_patrimony: normalized.total_patrimony,
    applied_value: normalized.applied_value,
    gross_balance: normalized.gross_balance,
    free_cash: normalized.free_cash,
    accumulated_dividends: normalized.accumulated_dividends,
    monthly_contribution_target: normalized.monthly_contribution_target,
    fii_applied_value: normalized.fii_applied_value,
    fii_monthly_income: normalized.fii_monthly_income,
    stock_applied_value: normalized.stock_applied_value,
    stock_monthly_income: normalized.stock_monthly_income,
    total_monthly_income: normalized.total_monthly_income,
    reinvested_income: normalized.reinvested_income,
    notes: normalized.notes ?? "",
  };
}

export function ClosingDrawer({
  open,
  period,
  fallbackSnapshot,
  onClose,
  onSaved,
  onError,
}: ClosingDrawerProps) {
  const [form, setForm] = useState<ClosingFormState>(() =>
    fallbackSnapshot ? snapshotToForm(fallbackSnapshot) : emptyForm(period),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    void fetchInvestmentSnapshotByPeriod(period)
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot) {
          setForm(snapshotToForm(snapshot));
          return;
        }
        if (fallbackSnapshot?.period === period) {
          setForm(snapshotToForm(fallbackSnapshot));
          return;
        }
        setForm(emptyForm(period));
      })
      .catch((error) => onError(getErrorMessage(error)))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, period, fallbackSnapshot, onError]);

  function updateField<K extends keyof ClosingFormState>(key: K, value: ClosingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const calculatedTotalIncome = form.fii_monthly_income + form.stock_monthly_income;
      await saveInvestmentSnapshot({
        ...form,
        total_patrimony: form.gross_balance,
        total_monthly_income: calculatedTotalIncome,
        notes: form.notes.trim() || null,
      });
      await saveMonthlyIncomeRecord({
        id: `closing-income-fii-${form.period}`,
        month: form.period,
        asset_class: "fii",
        asset_ticker: null,
        amount: form.fii_monthly_income,
      });
      await saveMonthlyIncomeRecord({
        id: `closing-income-stock-${form.period}`,
        month: form.period,
        asset_class: "acao",
        asset_ticker: null,
        amount: form.stock_monthly_income,
      });
      onSaved();
      onClose();
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Fechamento mensal — {formatMonthBR(period)}</SheetTitle>
          <SheetDescription>
            Edite os valores de análise como na sua planilha, sem precisar registrar uma transação.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <p className="py-8 text-sm text-muted-foreground">Carregando fechamento...</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-4">
              {/* Seção 1: Carteira */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Carteira
                </h4>
                <Field label="Valor aplicado">
                  <CurrencyInput
                    aria-label="Valor aplicado"
                    valueInCents={form.applied_value}
                    onValueChange={(value) => updateField("applied_value", value)}
                  />
                </Field>
                <Field label="Saldo bruto">
                  <CurrencyInput
                    aria-label="Saldo bruto"
                    valueInCents={form.gross_balance}
                    onValueChange={(value) => updateField("gross_balance", value)}
                  />
                </Field>
              </div>

              {/* Seção 2: FIIs */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  FIIs
                </h4>
                <Field label="Aplicado em FIIs">
                  <CurrencyInput
                    aria-label="Aplicado em FIIs"
                    valueInCents={form.fii_applied_value}
                    onValueChange={(value) => updateField("fii_applied_value", value)}
                  />
                </Field>
                <Field label="Provento mensal FIIs">
                  <CurrencyInput
                    aria-label="Provento mensal FIIs"
                    valueInCents={form.fii_monthly_income}
                    onValueChange={(value) => updateField("fii_monthly_income", value)}
                  />
                </Field>
              </div>

              {/* Seção 3: Avançado */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="flex w-full items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors py-1"
                >
                  <span>Avançado</span>
                  {advancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {advancedOpen && (
                  <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Field label="Aplicado em ações">
                      <CurrencyInput
                        aria-label="Aplicado em ações"
                        valueInCents={form.stock_applied_value}
                        onValueChange={(value) => updateField("stock_applied_value", value)}
                      />
                    </Field>
                    <Field label="Provento mensal ações">
                      <CurrencyInput
                        aria-label="Provento mensal ações"
                        valueInCents={form.stock_monthly_income}
                        onValueChange={(value) => updateField("stock_monthly_income", value)}
                      />
                    </Field>
                    <Field label="Proventos reinvestidos">
                      <CurrencyInput
                        aria-label="Proventos reinvestidos"
                        valueInCents={form.reinvested_income}
                        onValueChange={(value) => updateField("reinvested_income", value)}
                      />
                    </Field>
                    <Field label="Observações">
                      <Input
                        value={form.notes}
                        onChange={(event) => updateField("notes", event.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>

            <Button type="button" className="w-full" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Salvando..." : "Salvar fechamento"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
