import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, PencilLine, Repeat, WalletCards } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { EmptyState } from "../../components/ui/empty-state";
import { MoneyValue } from "../../components/ui/money-value";
import { MonthPicker } from "../../components/ui/month-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import type {
  AccountSummary,
  CardSummary,
  PendingExpenseSummary,
  RecurringPaymentMethod,
  RecurringRulePayload,
  RecurringRuleSummary,
  RecurringRuleUpdatePayload,
  TransactionFilters,
} from "../../lib/api";
import type { CategoryOption } from "../../lib/categories";
import { formatCategoryName, formatCurrency, formatDate, formatPaymentMethod } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type FixedExpensesViewProps = {
  accounts: AccountSummary[];
  cards: CardSummary[];
  categories: CategoryOption[];
  isSubmitting: boolean;
  month: string;
  pendingExpenses: PendingExpenseSummary[];
  recurringRules: RecurringRuleSummary[];
  onConfirmPending: (pendingId: string) => Promise<void>;
  onCreateRule: (payload: RecurringRulePayload) => Promise<void>;
  onMonthChange: (month: string) => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onUpdateRule: (ruleId: string, payload: RecurringRuleUpdatePayload) => Promise<void>;
  uiDensity: UiDensity;
};

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

export function FixedExpensesView({
  accounts,
  cards,
  categories,
  isSubmitting,
  month,
  pendingExpenses,
  recurringRules,
  onConfirmPending,
  onCreateRule,
  onMonthChange,
  onOpenLedgerFiltered,
  onUpdateRule,
  uiDensity,
}: FixedExpensesViewProps) {
  const [activeTab, setActiveTab] = useState<"rules" | "pendings">("rules");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<RuleFormState>(() =>
    buildEmptyRuleForm(accounts, cards, categories),
  );

  const accountNameById = useMemo(
    () => new Map(accounts.map((account) => [account.account_id, account.name])),
    [accounts],
  );
  const cardNameById = useMemo(
    () => new Map(cards.map((card) => [card.card_id, card.name])),
    [cards],
  );

  useEffect(() => {
    if (editingRuleId !== null) {
      const rule = recurringRules.find((item) => item.rule_id === editingRuleId);
      if (rule) {
        setFormState(ruleToFormState(rule));
        setFormError(null);
      }
      return;
    }

    setFormState(buildEmptyRuleForm(accounts, cards, categories));
  }, [accounts, cards, categories, editingRuleId, recurringRules]);

  const activeRules = recurringRules.filter((rule) => rule.is_active);
  const confirmedPendings = pendingExpenses.filter((pending) => pending.status === "confirmed");
  const pendingOnly = pendingExpenses.filter((pending) => pending.status !== "confirmed");

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
      setFormError("Selecione o cartao do gasto fixo.");
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

    if (editingRuleId === null) {
      await onCreateRule(payload);
    } else {
      await onUpdateRule(editingRuleId, payload);
    }

    setEditingRuleId(null);
    setFormState(buildEmptyRuleForm(accounts, cards, categories));
  }

  async function handleToggleRule(rule: RecurringRuleSummary) {
    await onUpdateRule(rule.rule_id, {
      isActive: !rule.is_active,
    });
    if (editingRuleId === rule.rule_id) {
      setEditingRuleId(null);
    }
  }

  return (
    <div className={cn("space-y-6", uiDensity === "dense" && "space-y-4")}>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
        <StatCard
          description="Recorrencias ativas prontas para materializar pendencias."
          icon={Repeat}
          title="Regras ativas"
          value={`${activeRules.length}`}
        />
        <StatCard
          description={`Pendencias ainda abertas em ${month}.`}
          icon={CalendarClock}
          title="Pendentes do mes"
          value={`${pendingOnly.length}`}
        />
        <StatCard
          description="Total ja confirmado dentro do mes selecionado."
          icon={CheckCircle2}
          title="Confirmado no mes"
          value={formatCurrency(confirmedPendings.reduce((sum, item) => sum + item.amount, 0))}
        />
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "rules" | "pendings")}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="w-full max-w-[360px] bg-slate-100/80 p-1">
            <TabsTrigger value="rules">Regras</TabsTrigger>
            <TabsTrigger value="pendings">Pendencias</TabsTrigger>
          </TabsList>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <span>Mes</span>
            <MonthPicker
              month={month}
              onMonthChange={onMonthChange}
              uiDensity={uiDensity}
              className="bg-white hover:bg-slate-50 border-slate-200"
            />
          </label>
        </div>

        <TabsContent value="rules" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="finance-card finance-card--strong">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-100 p-3">
                      <PencilLine className="h-5 w-5 text-slate-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {editingRuleId === null ? "Novo gasto fixo" : "Editar gasto fixo"}
                      </CardTitle>
                      <p className="text-sm text-slate-500">
                        Defina categoria, origem e vencimento para materializar a pendencia todo mes.
                      </p>
                    </div>
                  </div>
                  {editingRuleId !== null ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingRuleId(null);
                        setFormError(null);
                        setFormState(buildEmptyRuleForm(accounts, cards, categories));
                      }}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Nome
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ex.: Aluguel, Internet, Plano de saude"
                      value={formState.name}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Valor
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      inputMode="decimal"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, amount: event.target.value }))
                      }
                      placeholder="0,00"
                      value={formState.amount}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Vencimento
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      max={28}
                      min={1}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, dueDay: event.target.value }))
                      }
                      type="number"
                      value={formState.dueDay}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Como voce paga
                    </span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      onChange={(event) => {
                        const nextMethod = event.target.value as RecurringPaymentMethod;
                        setFormState((current) => ({
                          ...current,
                          paymentMethod: nextMethod,
                          accountId:
                            nextMethod === "CARD" ? "" : current.accountId || accounts[0]?.account_id || "",
                          cardId: nextMethod === "CARD" ? current.cardId || cards[0]?.card_id || "" : "",
                        }));
                      }}
                      value={formState.paymentMethod}
                    >
                      <option value="PIX">PIX</option>
                      <option value="CASH">Dinheiro</option>
                      <option value="OTHER">Boleto / outra saida</option>
                      <option value="CARD">Cartao</option>
                    </select>
                  </label>

                  {formState.paymentMethod === "CARD" ? (
                    <label className="space-y-2">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Cartao
                      </span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, cardId: event.target.value }))
                        }
                        value={formState.cardId}
                      >
                        <option value="">Selecione</option>
                        {cards.map((card) => (
                          <option key={card.card_id} value={card.card_id}>
                            {card.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label className="space-y-2">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                        Conta
                      </span>
                      <select
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, accountId: event.target.value }))
                        }
                        value={formState.accountId}
                      >
                        <option value="">Selecione</option>
                        {accounts.map((account) => (
                          <option key={account.account_id} value={account.account_id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Categoria
                    </span>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, categoryId: event.target.value }))
                      }
                      value={formState.categoryId}
                    >
                      <option value="">Selecione</option>
                      {categories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Observacao
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Opcional"
                      value={formState.description}
                    />
                  </label>

                  {formError ? (
                    <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                      {formError}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                    <Button disabled={isSubmitting} type="submit">
                      {editingRuleId === null ? "Salvar regra" : "Atualizar regra"}
                    </Button>
                    <p className="text-sm text-slate-500">
                      A transacao so entra no caixa ou no cartao quando a pendencia for confirmada.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="finance-card finance-card--strong">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary/10 p-3">
                    <WalletCards className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Regras cadastradas</CardTitle>
                    <p className="text-sm text-slate-500">
                      Ative, pause ou revise rapidamente a origem de cada fixo.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {recurringRules.length === 0 ? (
                  <EmptyState
                    className="py-12"
                    description="Cadastre a primeira recorrencia para o app gerar pendencias automaticamente."
                    icon={Repeat}
                    title="Nenhum gasto fixo ainda"
                  />
                ) : (
                  recurringRules.map((rule) => (
                    <article
                      key={rule.rule_id}
                      className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{rule.name}</h3>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                rule.is_active
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-500",
                              )}
                            >
                              {rule.is_active ? "ativo" : "pausado"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {formatCategoryName(rule.category_id)} • vence dia {String(rule.due_day).padStart(2, "0")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {resolveRuleSource(rule, accountNameById, cardNameById)} • {formatPaymentMethod(rule.payment_method)}
                          </p>
                          {rule.description ? (
                            <p className="text-xs text-slate-500">{rule.description}</p>
                          ) : null}
                        </div>
                        <MoneyValue value={rule.amount} className="text-sm font-bold text-slate-900" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          disabled={isSubmitting}
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditingRuleId(rule.rule_id);
                            setActiveTab("rules");
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          disabled={isSubmitting}
                          size="sm"
                          type="button"
                          variant="ghost"
                          onClick={() => void handleToggleRule(rule)}
                        >
                          {rule.is_active ? "Pausar" : "Reativar"}
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pendings" className="space-y-6">
          <Card className="finance-card finance-card--strong">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-3">
                  <CalendarClock className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Pendencias de {month}</CardTitle>
                  <p className="text-sm text-slate-500">
                    Confirme no vencimento para efetivar no caixa ou lancar no cartao correto.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingExpenses.length === 0 ? (
                <EmptyState
                  className="py-12"
                  description="Nao ha recorrencias materializadas para este mes."
                  icon={CalendarClock}
                  title="Sem pendencias"
                />
              ) : (
                pendingExpenses.map((pending) => {
                  const isConfirmed = pending.status === "confirmed";
                  return (
                    <article
                      key={pending.pending_id}
                      className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{pending.name}</h3>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                isConfirmed
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700",
                              )}
                            >
                              {isConfirmed ? "confirmado" : "pendente"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {formatCategoryName(pending.category_id)} • vence em {formatDate(pending.due_date)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {resolvePendingSource(pending, accountNameById, cardNameById)} • {formatPaymentMethod(pending.payment_method)}
                          </p>
                          {pending.description ? (
                            <p className="text-xs text-slate-500">{pending.description}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-3 lg:items-end">
                          <MoneyValue value={pending.amount} className="text-sm font-bold text-slate-900" />
                          <div className="flex flex-wrap gap-2">
                            {isConfirmed ? (
                              <Button
                                size="sm"
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                  onOpenLedgerFiltered(
                                    {
                                      period: "month",
                                      preset: "fixed",
                                      text: pending.name,
                                    },
                                    month,
                                  )
                                }
                              >
                                Ver no historico
                              </Button>
                            ) : (
                              <Button
                                disabled={isSubmitting}
                                size="sm"
                                type="button"
                                onClick={() => void onConfirmPending(pending.pending_id)}
                              >
                                Confirmar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function buildEmptyRuleForm(
  accounts: AccountSummary[],
  cards: CardSummary[],
  categories: CategoryOption[],
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

function resolveRuleSource(
  rule: RecurringRuleSummary,
  accountNameById: Map<string, string>,
  cardNameById: Map<string, string>,
): string {
  if (rule.payment_method === "CARD") {
    return cardNameById.get(rule.card_id ?? "") ?? rule.card_id ?? "Cartao";
  }
  return accountNameById.get(rule.account_id ?? "") ?? rule.account_id ?? "Conta";
}

function resolvePendingSource(
  pending: PendingExpenseSummary,
  accountNameById: Map<string, string>,
  cardNameById: Map<string, string>,
): string {
  if (pending.payment_method === "CARD") {
    return cardNameById.get(pending.card_id ?? "") ?? pending.card_id ?? "Cartao";
  }
  return accountNameById.get(pending.account_id ?? "") ?? pending.account_id ?? "Conta";
}

function toCents(rawValue: string): number {
  return Math.round(Number(rawValue.replace(",", ".")) * 100);
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Repeat;
}) {
  return (
    <Card className="finance-card finance-card--strong">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-2xl bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
