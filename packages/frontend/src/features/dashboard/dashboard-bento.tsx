import { useMemo } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import type {
  AccountSummary,
  CardSummary,
  DashboardSummary,
  InvestmentOverview,
  InvoiceSummary,
  TransactionFilters,
} from "../../lib/api";
import { formatCategoryName, formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type DashboardBentoProps = {
  dashboard: DashboardSummary;
  investmentOverview: InvestmentOverview | null;
  accounts: AccountSummary[];
  cards: CardSummary[];
  invoices: InvoiceSummary[];
  isSubmitting: boolean;
  onMarkReimbursementReceived: (transactionId: string) => Promise<void>;
  onNavigate: (view: "transactions" | "investments" | "cards" | "settings") => void;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  onOpenQuickAdd: (preset?: QuickAddPreset) => void;
  uiDensity: UiDensity;
};

export function DashboardBento({
  dashboard,
  investmentOverview,
  accounts: _accounts,
  cards,
  invoices,
  isSubmitting,
  onMarkReimbursementReceived,
  onNavigate,
  onOpenLedgerFiltered,
  onOpenQuickAdd,
  uiDensity,
}: DashboardBentoProps) {
  const categoryComposition = dashboard.spending_by_category.slice(0, 5);
  const investmentMeta = investmentOverview?.goal.target ?? dashboard.total_income * 0.1;
  const realizedInvestment =
    investmentOverview?.goal.realized ??
    dashboard.spending_by_category.find(
      (category) =>
        category.category_id === "investment" || category.category_id === "investimentos",
    )?.total ??
    0;
  const metaProgress =
    investmentMeta > 0 ? Math.min((realizedInvestment / investmentMeta) * 100, 100) : 0;
  const topCategories = dashboard.spending_by_category.slice(0, 3);
  const totalExpense = dashboard.total_expense || 1;
  const compositionTotal =
    categoryComposition.reduce((sum, category) => sum + category.total, 0) || 1;
  const categoryColors = [
    CHART_THEME.primary,
    CHART_THEME.income,
    CHART_THEME.transfer,
    "hsl(var(--warning))",
    CHART_THEME.expense,
  ];
  const pendingReimbursements = dashboard.pending_reimbursements ?? [];
  const pendingReimbursementsTotal = dashboard.pending_reimbursements_total ?? 0;
  const categoryBudgets = dashboard.category_budgets ?? [];
  const budgetAlerts = dashboard.budget_alerts ?? [];
  const cardNameById = useMemo(() => {
    return new Map(cards.map((card) => [card.card_id, card.name]));
  }, [cards]);
  const upcomingInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => invoice.status === "open" || invoice.status === "partial")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);
  }, [invoices]);

  const primaryBudgetAlert = budgetAlerts[0];
  function handleOpenBudgetAlerts() {
    if (primaryBudgetAlert) {
      onOpenLedgerFiltered(
        {
          period: "month",
          reference: `${primaryBudgetAlert.month}-01`,
          category: primaryBudgetAlert.category_id,
          text: formatCategoryName(primaryBudgetAlert.category_id),
        },
        primaryBudgetAlert.month,
      );
      return;
    }

    onNavigate("transactions");
  }

  function handleOpenReviewQueueItem(transaction: DashboardSummary["review_queue"][number]) {
    const searchText =
      transaction.description?.trim() || formatCategoryName(transaction.category_id);

    onOpenLedgerFiltered(
      {
        period: "month",
        text: searchText,
      },
      dashboard.month,
    );
  }

  return (
    <div
      className={cn(
        "space-y-6",
        uiDensity === "compact" && "space-y-5",
        uiDensity === "dense" && "space-y-4",
      )}
    >
      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-4",
          uiDensity === "dense" ? "gap-4" : "gap-6",
        )}
      >
        <KpiCard
          title={"Entradas do m\u00EAs"}
          value={dashboard.total_income}
          trend="up"
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          uiDensity={uiDensity}
        />
        <KpiCard
          title={"Sa\u00EDdas do m\u00EAs"}
          value={dashboard.total_expense}
          trend="down"
          color="text-rose-600"
          bgColor="bg-rose-50"
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Saldo consolidado"
          value={dashboard.current_balance}
          icon={<Wallet className="h-5 w-5 text-primary" />}
          color="text-slate-900"
          bgColor="bg-primary/5"
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Resultado do mes"
          value={dashboard.net_flow}
          trend={dashboard.net_flow >= 0 ? "up" : "down"}
          color={dashboard.net_flow >= 0 ? "text-emerald-700" : "text-rose-700"}
          bgColor={dashboard.net_flow >= 0 ? "bg-emerald-50" : "bg-rose-50"}
          uiDensity={uiDensity}
        />
      </div>

      <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" && "rounded-[1.6rem]")}>
        <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-amber-100 p-2">
                <HandCoins className="h-5 w-5 text-amber-700" />
              </div>
              <CardTitle className="text-lg font-semibold">Reembolsos pendentes</CardTitle>
            </div>
            <span className="money-value text-sm font-bold text-amber-700">
              {formatCurrency(pendingReimbursementsTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
          {pendingReimbursements.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              Nenhum valor pendente para receber no momento.
            </p>
          ) : (
            pendingReimbursements.slice(0, 5).map((reimbursement) => (
              <div
                key={reimbursement.transaction_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    {reimbursement.person_id}
                  </p>
                  <p className="text-xs text-amber-700">
                    {formatCurrency(reimbursement.amount)} {"\u2022"}{" "}
                    {reimbursement.occurred_at.split("T")[0]}
                  </p>
                </div>
                <Button
                  onClick={() => void onMarkReimbursementReceived(reimbursement.transaction_id)}
                  disabled={isSubmitting}
                  size="sm"
                  className="rounded-xl bg-amber-600 text-white hover:bg-amber-700"
                >
                  Marcar recebido
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className={cn("finance-card finance-card--strong", uiDensity === "dense" && "rounded-[1.6rem]")}>
        <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-indigo-100 p-2">
                <AlertCircle className="h-5 w-5 text-indigo-700" />
              </div>
              <CardTitle className="text-lg font-semibold">Proximos eventos</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("cards")}
              className="rounded-xl text-primary hover:bg-primary/5 hover:text-primary/80"
            >
              Abrir cartoes
            </Button>
          </div>
        </CardHeader>
        <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
          {upcomingInvoices.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              Nenhum vencimento aberto para os proximos dias.
            </p>
          ) : (
            upcomingInvoices.map((invoice) => (
              <div
                key={invoice.invoice_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-900">
                    {cardNameById.get(invoice.card_id) ?? invoice.card_id}
                  </p>
                  <p className="text-xs text-indigo-700">
                    vence em {invoice.due_date}
                  </p>
                </div>
                <span className="money-value text-sm font-bold text-indigo-800">
                  {formatCurrency(invoice.remaining_amount)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className={cn("finance-card finance-card--strong", chartClassNames.surface, uiDensity === "dense" && "rounded-[1.6rem]")}>
        <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-rose-100 p-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <CardTitle className="text-lg font-semibold">Orcamentos por categoria</CardTitle>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                budgetAlerts.length > 0
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {budgetAlerts.length > 0
                ? `${budgetAlerts.length} alerta(s)`
                : "Sem alertas"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenBudgetAlerts}
              className="rounded-xl text-primary hover:bg-primary/5 hover:text-primary/80"
            >
              Ver categorias em alerta
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("settings")}
              className="rounded-xl text-primary hover:bg-primary/5 hover:text-primary/80"
            >
              Ajustar limites em configuracoes
            </Button>
          </div>
        </CardHeader>
        <CardContent className={cn(uiDensity === "dense" ? "space-y-4 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-5 px-5 pb-5 pt-0" : "space-y-5")}>
          {categoryBudgets.length > 0 ? (
            <div className="space-y-3">
              {categoryBudgets.map((budget) => {
                const progress = Math.min(budget.usage_percent, 100);
                const statusCopy = budget.status === "exceeded"
                  ? "Excedido"
                  : budget.status === "warning"
                    ? "Em alerta"
                    : "Saudavel";
                const statusClass = budget.status === "exceeded"
                  ? "bg-rose-100 text-rose-700"
                  : budget.status === "warning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700";

                return (
                  <div key={`${budget.month}:${budget.category_id}`} className="space-y-2 rounded-2xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatCategoryName(budget.category_id)}
                      </p>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                        {statusCopy}
                      </span>
                    </div>
                    <Progress
                      className="h-2 bg-slate-100"
                      value={progress}
                    />
                    <p className="text-xs text-slate-600">
                      {formatCurrency(budget.spent)} de {formatCurrency(budget.limit)} ({budget.usage_percent}%)
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Nenhum limite cadastrado para {dashboard.month}.
            </p>
          )}
        </CardContent>
      </Card>

      <div className={cn("grid grid-cols-1 lg:grid-cols-12", uiDensity === "dense" ? "gap-4" : "gap-6")}>
        <Card className={cn("finance-card finance-card--strong overflow-hidden lg:col-span-4", chartClassNames.surface, uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
          <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : "pb-2")}>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Meta investimento 10%</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={cn("flex flex-col items-center justify-center text-center", uiDensity === "dense" ? "px-5 py-5 pt-0" : uiDensity === "compact" ? "px-5 py-6 pt-0" : "py-6")}>
            <div className="relative mb-6 h-40 w-40">
              <PieChart width={160} height={160}>
                <Pie
                  data={[
                    { value: realizedInvestment },
                    { value: Math.max(investmentMeta - realizedInvestment, 0) },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={66}
                  paddingAngle={0}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="hsl(var(--primary))" stroke="none" />
                  <Cell fill="hsl(var(--primary) / 0.1)" stroke="none" />
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="money-value text-3xl font-bold text-primary">{metaProgress.toFixed(0)}%</span>
                <span className="text-xs font-medium text-muted-foreground">do objetivo</span>
              </div>
            </div>

            <div className="mb-8 space-y-1">
              <p className="text-sm text-muted-foreground">
                Sua meta:{" "}
                <span className="font-semibold text-slate-900">{formatCurrency(investmentMeta)}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Falta:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(Math.max(investmentMeta - realizedInvestment, 0))}
                </span>
              </p>
            </div>

            <Button
              onClick={() => onOpenQuickAdd("investment_contribution")}
              className="h-auto w-full rounded-2xl bg-primary py-6 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Registrar aporte agora
            </Button>
            <Button
              variant="ghost"
              onClick={() => onNavigate("investments")}
              className="mt-2 h-auto w-full rounded-2xl text-primary hover:bg-primary/5"
            >
              Ver visão completa
            </Button>
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong lg:col-span-8", uiDensity === "dense" ? "rounded-[1.6rem]" : "rounded-[2rem]")}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-slate-100 p-2">
                  <TrendingUp className="h-5 w-5 text-slate-600" />
                </div>
                <CardTitle className="text-lg font-semibold">Raio-X de despesas</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("transactions")}
                className="rounded-xl text-primary hover:bg-primary/5 hover:text-primary/80"
              >
                Ver tudo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="grid gap-6 rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-5 lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
                {categoryComposition.length > 0 ? (
                  <>
                    <div className="flex items-center justify-center">
                      <PieChart width={180} height={180}>
                        <Pie
                          data={categoryComposition}
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="total"
                        >
                          {categoryComposition.map((category, index) => (
                            <Cell
                              key={category.category_id}
                              fill={categoryColors[index % categoryColors.length]}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Composição real por categoria
                      </p>
                      {categoryComposition.map((category, index) => {
                        const share = Math.round((category.total / compositionTotal) * 100);

                        return (
                          <div
                            key={category.category_id}
                            className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="h-3 w-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    categoryColors[index % categoryColors.length],
                                }}
                              />
                              <span className="truncate text-sm font-medium text-slate-700">
                                {formatCategoryName(category.category_id)}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-900">
                                {formatCurrency(category.total)}
                              </p>
                              <p className="text-[11px] font-semibold text-muted-foreground">
                                {share}% do total
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    {"Sem dados suficientes este m\u00EAs."}
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Top 3 categorias
                </p>
                <div className="space-y-4">
                  {topCategories.length > 0 ? (
                    topCategories.map((category) => (
                      <div key={category.category_id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">
                            {formatCategoryName(category.category_id)}
                          </span>
                          <span className="font-bold">{formatCurrency(category.total)}</span>
                        </div>
                        <Progress
                          value={(category.total / totalExpense) * 100}
                          className="h-2 bg-slate-100"
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      {"Sem dados suficientes este m\u00EAs."}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {"Aten\u00E7\u00E3o"}
                </p>
                <div className="space-y-3">
                  {dashboard.review_queue.length > 0 ? (
                    dashboard.review_queue.slice(0, 2).map((transaction) => (
                      <div
                        key={transaction.transaction_id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-100/50 bg-amber-50 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-xl bg-amber-100 p-2">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-amber-900">
                              Sem{" "}
                              {!transaction.description
                                ? "descri\u00E7\u00E3o"
                                : "categoria"}
                            </p>
                            <p className="text-xs text-amber-700">
                              {formatCurrency(transaction.amount)} {"\u2022"}{" "}
                              {transaction.occurred_at.split("T")[0]}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenReviewQueueItem(transaction)}
                          className="rounded-lg text-amber-700 hover:bg-amber-100"
                        >
                          Resolver
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-100/50 bg-emerald-50 p-4">
                      <div className="rounded-xl bg-emerald-100 p-2">
                        <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="text-sm font-medium text-emerald-900">
                        {"Nenhuma pend\u00EAncia encontrada. Parab\u00E9ns!"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  trend,
  color,
  bgColor,
  uiDensity,
}: {
  title: string;
  value: number;
  icon?: React.ReactNode;
  trend?: "up" | "down";
  color: string;
  bgColor: string;
  uiDensity: UiDensity;
}) {
  return (
    <Card
      className={cn(
        "finance-card finance-card--strong overflow-hidden rounded-[2.2rem]",
        uiDensity === "dense" && "rounded-[1.6rem]",
      )}
    >
      <CardContent className={cn(uiDensity === "dense" ? "p-5" : uiDensity === "compact" ? "p-6" : "p-7")}>
        <div className="mb-4 flex items-start justify-between">
          <div className={`rounded-2xl p-3 ${bgColor}`}>
            {icon ||
              (trend === "up" ? (
                <ArrowUpRight className={`h-5 w-5 ${color}`} />
              ) : (
                <ArrowDownRight className={`h-5 w-5 ${color}`} />
              ))}
          </div>
          {trend && (
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${bgColor} ${color}`}>
              {trend === "up" ? "+4%" : "-2%"}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`money-value text-2xl font-bold ${color}`}>{formatCurrency(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
