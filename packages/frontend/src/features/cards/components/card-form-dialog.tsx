import { type FormEvent, useState } from "react";

import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import type { AccountSummary, CardPayload, CardSummary, CardUpdatePayload } from "../../../lib/api";
import { formatCurrencyInput } from "./shared";

const NO_PAYMENT_ACCOUNT_VALUE = "__card-no-payment-account__";

export type CardFormState = {
  name: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  paymentAccountId: string;
};

export type CardEditFormState = CardFormState & {
  isActive: boolean;
};

export function createEmptyCardForm(): CardFormState {
  return {
    name: "",
    limit: "0",
    closingDay: "10",
    dueDay: "20",
    paymentAccountId: "",
  };
}

function CardFormFields<TForm extends CardFormState>({
  form,
  accounts,
  onChange,
}: {
  form: TForm;
  accounts: AccountSummary[];
  onChange: (updater: (current: TForm) => TForm) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
        Nome do cartão
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          value={form.name}
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Limite total
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          inputMode="numeric"
          value={formatCurrencyInput(form.limit)}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              limit: event.target.value.replace(/\D/g, ""),
            }))
          }
          placeholder="R$ 0,00"
          required
        />
      </label>
      <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        <span>Conta padrão para pagamento</span>
        <Select
          value={form.paymentAccountId || NO_PAYMENT_ACCOUNT_VALUE}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              paymentAccountId: value === NO_PAYMENT_ACCOUNT_VALUE ? "" : value,
            }))
          }
        >
          <SelectTrigger
            aria-label="Conta de pagamento"
            className="h-11 rounded-xl border-slate-200 text-left shadow-none"
          >
            <SelectValue placeholder="Sem conta padrão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PAYMENT_ACCOUNT_VALUE}>Sem conta padrão</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.account_id} value={account.account_id}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Dia de fechamento
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          inputMode="numeric"
          value={form.closingDay}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              closingDay: event.target.value.replace(/\D/g, "").slice(0, 2),
            }))
          }
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Dia de vencimento
        <input
          className="h-11 rounded-xl border border-slate-200 px-3"
          inputMode="numeric"
          value={form.dueDay}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              dueDay: event.target.value.replace(/\D/g, "").slice(0, 2),
            }))
          }
          required
        />
      </label>
    </div>
  );
}

// --- Create Card Dialog ---

export type CreateCardDialogProps = {
  accounts: AccountSummary[];
  isSubmitting: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCard: (payload: CardPayload) => Promise<void>;
};

export function CreateCardDialog({
  accounts,
  isSubmitting,
  open,
  onOpenChange,
  onCreateCard,
}: CreateCardDialogProps) {
  const [form, setForm] = useState<CardFormState>(() => createEmptyCardForm());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;

    await onCreateCard({
      name: form.name.trim(),
      limitInCents: parseInt(form.limit || "0", 10),
      closingDay: parseInt(form.closingDay || "0", 10),
      dueDay: parseInt(form.dueDay || "0", 10),
      paymentAccountId: form.paymentAccountId || undefined,
    });

    onOpenChange(false);
    setForm(createEmptyCardForm());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setForm(createEmptyCardForm());
      }}
    >
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
          <DialogDescription>
            Defina limite e ciclo do cartão. A conta padrão para pagamento pode ficar em branco.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <CardFormFields form={form} accounts={accounts} onChange={setForm} />
          <div className="flex gap-3">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Salvando..." : "Criar cartão"}
            </Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit Card Dialog ---

export type EditCardDialogProps = {
  accounts: AccountSummary[];
  card: CardSummary | null;
  isSubmitting: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateCard: (cardId: string, payload: CardUpdatePayload) => Promise<void>;
};

export function EditCardDialog({
  accounts,
  card,
  isSubmitting,
  open,
  onOpenChange,
  onUpdateCard,
}: EditCardDialogProps) {
  const [form, setForm] = useState<CardEditFormState | null>(null);

  function initForm(c: CardSummary) {
    setForm({
      name: c.name,
      limit: String(c.limit),
      closingDay: String(c.closing_day),
      dueDay: String(c.due_day),
      paymentAccountId: c.payment_account_id,
      isActive: c.is_active,
    });
  }

  if (open && card && form === null) {
    initForm(card);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!card || !form || !form.name.trim()) return;

    await onUpdateCard(card.card_id, {
      name: form.name.trim(),
      limitInCents: parseInt(form.limit || "0", 10),
      closingDay: parseInt(form.closingDay || "0", 10),
      dueDay: parseInt(form.dueDay || "0", 10),
      paymentAccountId: form.paymentAccountId,
      isActive: form.isActive,
    });

    onOpenChange(false);
    setForm(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setForm(null);
      }}
    >
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Editar cartão</DialogTitle>
          <DialogDescription>
            Atualize limite, ciclo, conta padrão opcional ou desative o cartão sem perder histórico.
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <CardFormFields
              form={form}
              accounts={accounts}
              onChange={(updater) =>
                setForm((current) => {
                  if (current === null) return current;
                  return updater(current);
                })
              }
            />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                checked={form.isActive}
                type="checkbox"
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, isActive: event.target.checked } : current,
                  )
                }
              />
              Cartão ativo
            </label>
            <div className="flex gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Salvando..." : "Salvar cartão"}
              </Button>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
