import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import { Button } from "../../../components/ui/button";
import type {
  AccountSummary,
  CardSummary,
  RecurringPaymentMethod,
  RecurringRulePayload,
  RecurringRuleSummary,
  RecurringRuleUpdatePayload,
} from "../../../lib/api";
import type { CategoryOption } from "../../../lib/categories";

type RuleFormState = {
  name: string;
  amount: string;
  dueDay: string;
  paymentMethod: RecurringPaymentMethod;
  accountId: string;
  cardId: string;
  categoryId: string;
  description: string;
};

type RuleFormSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountSummary[];
  cards: CardSummary[];
  categories: CategoryOption[];
  ruleToEdit: RecurringRuleSummary | null;
  isSubmitting: boolean;
  onCreateRule: (payload: RecurringRulePayload) => Promise<void>;
  onUpdateRule: (id: string, payload: RecurringRuleUpdatePayload) => Promise<void>;
  onToggleRuleStatus: (rule: RecurringRuleSummary) => Promise<void>;
};

function toCents(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

function buildEmptyRuleForm(
  accounts: AccountSummary[],
  cards: CardSummary[],
  categories: CategoryOption[]
): RuleFormState {
  return {
    name: "",
    amount: "",
    dueDay: "1",
    paymentMethod: "PIX",
    accountId: accounts[0]?.account_id ?? "",
    cardId: cards[0]?.card_id ?? "",
    categoryId: categories[0]?.value ?? "",
    description: "",
  };
}

function ruleToFormState(rule: RecurringRuleSummary): RuleFormState {
  return {
    name: rule.name,
    amount: String(rule.amount / 100).replace(".", ","),
    dueDay: String(rule.due_day),
    paymentMethod: rule.payment_method,
    accountId: rule.account_id ?? "",
    cardId: rule.card_id ?? "",
    categoryId: rule.category_id,
    description: rule.description ?? "",
  };
}

export function RuleFormSheet({
  isOpen,
  onOpenChange,
  accounts,
  cards,
  categories,
  ruleToEdit,
  isSubmitting,
  onCreateRule,
  onUpdateRule,
  onToggleRuleStatus,
}: RuleFormSheetProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(() =>
    buildEmptyRuleForm(accounts, cards, categories)
  );

  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      if (ruleToEdit) {
        setFormState(ruleToFormState(ruleToEdit));
      } else {
        setFormState(buildEmptyRuleForm(accounts, cards, categories));
      }
    }
  }, [isOpen, ruleToEdit, accounts, cards, categories]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const amountInCents = toCents(formState.amount);
    const dueDay = Number.parseInt(formState.dueDay, 10);

    if (!formState.name.trim()) {
      setFormError("Informe um nome para o gasto fixo.");
      return;
    }
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28) {
      setFormError("Use um dia de vencimento entre 1 e 28.");
      return;
    }
    if (!formState.categoryId) {
      setFormError("Selecione uma categoria.");
      return;
    }
    if (formState.paymentMethod === "CARD" && !formState.cardId) {
      setFormError("Selecione o cartão do gasto fixo.");
      return;
    }
    if (formState.paymentMethod !== "CARD" && !formState.accountId) {
      setFormError("Selecione a conta de pagamento.");
      return;
    }

    const payload: RecurringRulePayload = {
      name: formState.name.trim(),
      amountInCents,
      dueDay,
      paymentMethod: formState.paymentMethod,
      accountId: formState.paymentMethod === "CARD" ? undefined : formState.accountId,
      cardId: formState.paymentMethod === "CARD" ? formState.cardId : undefined,
      categoryId: formState.categoryId,
      description: formState.description.trim() || undefined,
    };

    if (ruleToEdit === null) {
      await onCreateRule(payload);
    } else {
      await onUpdateRule(ruleToEdit.rule_id, payload);
    }

    onOpenChange(false);
  }

  const isEditing = ruleToEdit !== null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 w-full sm:max-w-md p-0 overflow-hidden">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>
            {isEditing ? "Editar gasto fixo" : "Novo gasto fixo"}
          </SheetTitle>
          <SheetDescription>
            {isEditing 
              ? "Modifique os detalhes deste cadastro recorrente." 
              : "Crie um cadastro para gerar pendências todo mês."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="rule-form" className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Nome
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ex.: Aluguel, Internet, Plano de saúde"
                  value={formState.name}
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Valor
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    inputMode="decimal"
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, amount: event.target.value }))
                    }
                    placeholder="0,00"
                    value={formState.amount}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Vencimento
                  </span>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    max={28}
                    min={1}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, dueDay: event.target.value }))
                    }
                    type="number"
                    value={formState.dueDay}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Como você paga
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      paymentMethod: event.target.value as RecurringPaymentMethod,
                    }))
                  }
                  value={formState.paymentMethod}
                >
                  <option value="PIX">Pix</option>
                  <option value="CARD">Cartão de Crédito</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="OTHER">Outro</option>
                </select>
              </label>

              {formState.paymentMethod === "CARD" ? (
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Cartão
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, cardId: event.target.value }))
                    }
                    value={formState.cardId}
                  >
                    <option disabled value="">
                      Selecione um cartão
                    </option>
                    {cards.map((card) => (
                      <option key={card.card_id} value={card.card_id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Conta
                  </span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, accountId: event.target.value }))
                    }
                    value={formState.accountId}
                  >
                    <option disabled value="">
                      Selecione uma conta
                    </option>
                    {accounts.map((acc) => (
                      <option key={acc.account_id} value={acc.account_id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Categoria
                </span>
                <select
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  value={formState.categoryId}
                >
                  <option disabled value="">
                    Selecione a categoria
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Descrição (Opcional)
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Detalhes adicionais..."
                  value={formState.description}
                />
              </label>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <p className="font-semibold">{formError}</p>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="border-t border-slate-200 p-6 flex flex-col gap-3">
          <Button
            type="submit"
            form="rule-form"
            className="w-full"
            disabled={isSubmitting}
          >
            {isEditing ? "Salvar alterações" : "Criar gasto fixo"}
          </Button>
          
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSubmitting}
              onClick={async () => {
                await onToggleRuleStatus(ruleToEdit);
                onOpenChange(false);
              }}
            >
              {ruleToEdit.is_active ? "Pausar este cadastro" : "Reativar este cadastro"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
