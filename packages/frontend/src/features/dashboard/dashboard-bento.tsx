import { useMemo } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Clock,
  CreditCard,
  HandCoins,
  Layout,
  PieChart as PieChartIcon,
  Receipt,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import type { QuickAddPreset } from "../../components/quick-add-composer";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { CHART_THEME, chartClassNames } from "../../lib/chart-theme";
import type {
  AccountSummary,
  CardSummary,
  CategoryBudgetSummary,
  DashboardSummary,
  InvestmentOverview,
  InvoiceSummary,
  TransactionFilters,
} from "../../lib/api";
import { EmptyState } from "../../components/ui/empty-state";
import { MoneyValue } from "../../components/ui/money-value";
import {
  formatCategoryName,
  formatCurrency,
  formatDate,
  formatPaymentMethod,
} from "../../lib/format";
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
  onNavigate: (
    view: "transactions" | "fixedExpenses" | "investments" | "cards" | "reports" | "settings",
  ) => void;
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
  accounts,
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
  const monthlyCommitments = dashboard.monthly_commitments ?? [];
  const monthlyFixedExpenses = dashboard.monthly_fixed_expenses ?? [];
  const monthlyInstallments = dashboard.monthly_installments ?? [];
  const accountNameById = useMemo(() => {
    return new Map(accounts.map((account) => [account.account_id, account.name]));
  }, [accounts]);
  const cardNameById = useMemo(() => {
    return new Map(cards.map((card) => [card.card_id, card.name]));
  }, [cards]);
  const upcomingInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => invoice.status === "open" || invoice.status === "partial")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);
  }, [invoices]);
  const recentExpenses = dashboard.recent_transactions
    .filter((transaction) => transaction.type === "expense")
    .slice(0, 5);
  const overdueReimbursements = useMemo(() => {
    return pendingReimbursements.filter((reimbursement) =>
      isOlderThanDays(reimbursement.occurred_at, 7),
    );
  }, [pendingReimbursements]);
  const alertItems = useMemo(
    () =>
      buildDashboardAlerts({
        dashboardMonth: dashboard.month,
        onOpenLedgerFiltered,
        overdueReimbursements,
        reviewQueue: dashboard.review_queue,
        upcomingInvoices,
      }),
    [
      dashboard.month,
      dashboard.review_queue,
      onOpenLedgerFiltered,
      overdueReimbursements,
      upcomingInvoices,
    ],
  );

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
        "dashboard-workbench space-y-5",
        uiDensity === "compact" && "space-y-4",
        uiDensity === "dense" && "space-y-3",
      )}
    >
      <div
        className={cn(
          "dashboard-kpi-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8",
          uiDensity === "dense" ? "gap-4" : "gap-6",
        )}
      >
        <KpiCard
          title={"Entradas do mês"}
          value={dashboard.total_income}
          trend="up"
          color="text-emerald-600"
          bgColor="bg-emerald-50"
          onClick={() =>
            onOpenLedgerFiltered({ period: "month", type: "income", preset: "month" }, dashboard.month)
          }
          uiDensity={uiDensity}
        />
        <KpiCard
          title={"Saídas do mês"}
          value={dashboard.total_expense}
          trend="down"
          color="text-rose-600"
          bgColor="bg-rose-50"
          onClick={() =>
            onOpenLedgerFiltered({ period: "month", type: "expense", preset: "month" }, dashboard.month)
          }
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Resultado do mês"
          value={dashboard.net_flow}
          trend={dashboard.net_flow >= 0 ? "up" : "down"}
          color={dashboard.net_flow >= 0 ? "text-emerald-700" : "text-rose-700"}
          bgColor={dashboard.net_flow >= 0 ? "bg-emerald-50" : "bg-rose-50"}
          onClick={() => onOpenLedgerFiltered({ period: "month", preset: "month" }, dashboard.month)}
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Livre para gastar"
          value={dashboard.free_to_spend}
          icon={<Wallet className="h-5 w-5 text-primary" />}
          color={dashboard.free_to_spend >= 0 ? "text-slate-900" : "text-rose-700"}
          bgColor={dashboard.free_to_spend >= 0 ? "bg-primary/5" : "bg-rose-50"}
          onClick={() => onOpenLedgerFiltered({ period: "month", preset: "month" }, dashboard.month)}
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Gastos fixos do mês"
          value={dashboard.fixed_expenses_total}
          color="text-slate-900"
          bgColor="bg-slate-100"
          onClick={() => onNavigate("fixedExpenses")}
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Parcelas do mês"
          value={dashboard.installment_total}
          color="text-slate-900"
          bgColor="bg-indigo-50"
          onClick={() =>
            onOpenLedgerFiltered({ period: "month", type: "expense", preset: "installments" }, dashboard.month)
          }
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Faturas a vencer"
          value={dashboard.invoices_due_total}
          color="text-slate-900"
          bgColor="bg-amber-50"
          onClick={() => onOpenLedgerFiltered({ period: "month", preset: "cards" }, dashboard.month)}
          uiDensity={uiDensity}
        />
        <KpiCard
          title="Reembolsos pendentes"
          value={pendingReimbursementsTotal}
          color="text-amber-700"
          bgColor="bg-amber-50"
          onClick={() =>
            onOpenLedgerFiltered({ period: "month", type: "expense", preset: "reimbursements" }, dashboard.month)
          }
          uiDensity={uiDensity}
        />
      </div>

      <Tabs defaultValue="radar" className="dashboard-tabs w-full">
        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            uiDensity === "dense" ? "mb-3" : "mb-4",
          )}
        >
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              Navegacao interna
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Visao geral sem empilhar tudo</h2>
          </div>
          <TabsList className="h-14 rounded-[1.75rem] bg-slate-200/50 p-1.5">
            <TabsTrigger
              value="radar"
              className="rounded-2xl px-8 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)]"
            >
              Radar
            </TabsTrigger>
            <TabsTrigger
              value="commitments"
              className="rounded-2xl px-8 text-xs font-black uppercase tracking-widest text-slate-500 transition-all hover:text-slate-700 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.3)]"
            >
              Compromissos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="commitments" className="space-y-6 outline-none focus:ring-0">
      <div className={cn("dashboard-commitment-rail grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3", uiDensity === "dense" ? "gap-3" : uiDensity === "compact" ? "gap-4" : "gap-5")}>
        <Card className={cn("finance-card finance-card--strong dashboard-commitment-card", uiDensity === "dense" && "rounded-[1.6rem]")}>
          <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-100 p-2">
                <Clock className="h-5 w-5 text-indigo-700" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Compromissos do mês</CardTitle>
                <p className="text-sm text-muted-foreground">O que ainda pressiona o caixa.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
            {monthlyCommitments.length === 0 ? (
              <EmptyState 
                icon={Clock} 
                title="Tudo em dia" 
                description="Nenhum compromisso pendente para este mês." 
                className="py-10"
              />
            ) : (
              monthlyCommitments.slice(0, 5).map((commitment) => (
                <button
                  key={commitment.commitment_id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left"
                  onClick={() =>
                    onOpenLedgerFiltered(
                      {
                        period: "month",
                        preset: commitment.kind === "invoice" ? "cards" : "fixed",
                      },
                      dashboard.month,
                    )
                  }
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCommitmentTitle(commitment, cardNameById)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {commitment.source} • vence em {commitment.due_date}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCommitmentCategory(commitment.category_id)} • {formatCommitmentKind(commitment.kind)} • {formatPaymentMethod(commitment.payment_method ?? "OTHER")} • {formatCommitmentStatus(commitment.status)}
                    </p>
                  </div>
                  <MoneyValue value={commitment.amount} className="text-sm font-bold" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong dashboard-commitment-card", uiDensity === "dense" && "rounded-[1.6rem]")}>
          <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-2">
                <Receipt className="h-5 w-5 text-slate-700" />
              </div>
              <CardTitle className="text-lg font-semibold">Gastos fixos do mês</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
            {monthlyFixedExpenses.length === 0 ? (
              <EmptyState 
                icon={Receipt} 
                title="Sem fixos" 
                description="Nenhuma recorrência materializada para este mês." 
                className="py-10"
              />
            ) : (
              monthlyFixedExpenses.slice(0, 5).map((expense) => (
                <button
                  key={expense.pending_id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left"
                  onClick={() => onNavigate("fixedExpenses")}
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{expense.title}</p>
                    <p className="text-xs text-slate-500">
                      {accountNameById.get(expense.account_id) ?? expense.account_id} • {formatPaymentMethod(expense.payment_method)} • {formatDate(expense.due_date)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatCategoryName(expense.category_id)} • {expense.status === "confirmed" ? "pago" : "pendente"}
                    </p>
                  </div>
                  <MoneyValue value={expense.amount} className="text-sm font-bold" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong dashboard-commitment-card", uiDensity === "dense" && "rounded-[1.6rem]")}>
          <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-2">
                <CreditCard className="h-5 w-5 text-amber-700" />
              </div>
              <CardTitle className="text-lg font-semibold">Parcelas do mês</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
            {monthlyInstallments.length === 0 ? (
              <EmptyState 
                icon={CreditCard} 
                title="Sem parcelas" 
                description="Nenhuma parcela alocada para este mês." 
                className="py-10"
              />
            ) : (
              monthlyInstallments.slice(0, 5).map((installment) => (
                <button
                  key={installment.installment_id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-left"
                  onClick={() =>
                    onOpenLedgerFiltered(
                      { period: "month", type: "expense", preset: "installments", card: installment.card_id },
                      dashboard.month,
                    )
                  }
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{installment.title ?? "Compra parcelada"}</p>
                    <p className="text-xs text-slate-500">
                      {formatCategoryName(installment.category_id)} • vence {formatDate(installment.due_date)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Faltam {installment.installments_count - installment.installment_number} parcela(s)
                    </p>
                    <p className="text-xs text-slate-600">
                      {installment.installment_number}/{installment.installments_count} • {cardNameById.get(installment.card_id) ?? installment.card_id}
                    </p>
                  </div>
                  <MoneyValue value={installment.amount} className="text-sm font-bold" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className={cn("dashboard-support-grid grid grid-cols-1 lg:grid-cols-2", uiDensity === "dense" ? "gap-3" : uiDensity === "compact" ? "gap-4" : "gap-5")}>
        <Card className={cn("finance-card finance-card--strong dashboard-support-card", uiDensity === "dense" && "rounded-[1.6rem]")}>
          <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-amber-100 p-2">
                  <HandCoins className="h-5 w-5 text-amber-700" />
                </div>
                <CardTitle className="text-lg font-semibold">Reembolsos pendentes</CardTitle>
              </div>
              <MoneyValue value={pendingReimbursementsTotal} className="text-sm font-bold text-amber-700" />
            </div>
          </CardHeader>
          <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
            {pendingReimbursements.length === 0 ? (
              <EmptyState 
                icon={HandCoins} 
                title="Tudo recebido" 
                description="Nenhum valor pendente." 
                className="py-10"
              />
            ) : (
              pendingReimbursements.slice(0, 3).map((reimbursement) => (
                <div
                  key={reimbursement.transaction_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-amber-900">{reimbursement.person_id}</p>
                    <MoneyValue value={reimbursement.amount} className="text-[10px] text-amber-700" />
                  </div>
                  <Button
                    onClick={() => void onMarkReimbursementReceived(reimbursement.transaction_id)}
                    disabled={isSubmitting}
                    size="sm"
                    className="h-7 rounded-lg bg-amber-600 px-3 text-[10px] text-white"
                  >
                    Marcar recebido
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={cn("finance-card finance-card--strong dashboard-support-card", uiDensity === "dense" && "rounded-[1.6rem]")}>
          <CardHeader className={cn(uiDensity === "dense" ? "pb-2 px-5 pt-5" : uiDensity === "compact" ? "pb-3 px-5 pt-5" : "pb-3")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-100 p-2">
                  <AlertCircle className="h-5 w-5 text-indigo-700" />
                </div>
                <CardTitle className="text-lg font-semibold">Próximos eventos</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn(uiDensity === "dense" ? "space-y-2.5 px-5 pb-5 pt-0" : uiDensity === "compact" ? "space-y-3 px-5 pb-5 pt-0" : "space-y-3")}>
            {upcomingInvoices.length === 0 ? (
              <EmptyState 
                icon={AlertCircle} 
                title="Sem faturas" 
                description="Nenhum vencimento aberto." 
                className="py-10"
              />
            ) : (
              upcomingInvoices.slice(0, 3).map((invoice) => (
                <button
                  key={invoice.invoice_id}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-left"
                  onClick={() =>
                    onOpenLedgerFiltered({ period: "month", preset: "cards", card: invoice.card_id }, dashboard.month)
                  }
                  type="button"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-indigo-900">{cardNameById.get(invoice.card_id) ?? invoice.card_id}</p>
                    <p className="text-[10px] text-indigo-700">vence em {invoice.due_date}</p>
                  </div>
                  <MoneyValue value={invoice.remaining_amount} className="text-xs font-bold text-indigo-800" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Alertas e atenção
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
          {alertItems.length > 0 ? (
            alertItems.slice(0, 4).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${alert.containerClassName}`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`shrink-0 rounded-lg p-1.5 ${alert.iconWrapperClassName}`}>
                    <AlertCircle className={`h-3.5 w-3.5 ${alert.iconClassName}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-[11px] font-bold ${alert.titleClassName}`}>
                      {alert.title}
                    </p>
                    <p className={`truncate text-[10px] ${alert.detailClassName}`}>
                      {alert.detail}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={alert.onClick}
                  className={cn("h-7 rounded-lg px-2 text-[9px]", alert.buttonClassName)}
                >
                  {alert.actionLabel}
                </Button>
              </div>
            ))
          ) : (
            <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-emerald-100/50 bg-emerald-50 p-3">
              <div className="rounded-lg bg-emerald-100 p-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] font-bold text-emerald-900">
                Nenhuma pendÃªncia encontrada. ParabÃ©ns!
              </p>
            </div>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="radar" className="space-y-6 outline-none focus:ring-0">
      <div className={cn("dashboard-focus-grid grid grid-cols-1 lg:grid-cols-12", uiDensity === "dense" ? "gap-4" : "gap-6")}>
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
            <div className={cn("relative h-40 w-40", uiDensity === "dense" ? "mb-4 h-32 w-32" : "mb-6")}>
              <PieChart width={uiDensity === "dense" ? 128 : 160} height={uiDensity === "dense" ? 128 : 160}>
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
                <span className="text-3xl font-bold text-primary">
                  {metaProgress.toFixed(0)}%
                </span>
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
          <CardHeader className="pb-4">
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
           <CardContent className={cn("space-y-5", uiDensity === "dense" && "px-5 py-5 pt-0")}>
             <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Últimas saídas do mês
                </p>
                <div className="space-y-2">
                  {recentExpenses.length > 0 ? (
                    recentExpenses.slice(0, 4).map((transaction) => (
                      <button
                        key={transaction.transaction_id}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                        onClick={() =>
                          onOpenLedgerFiltered(
                            {
                              period: "month",
                              text: transaction.description ?? formatCategoryName(transaction.category_id),
                              type: "expense",
                            },
                            dashboard.month,
                          )
                        }
                        type="button"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {transaction.description ?? formatCategoryName(transaction.category_id)}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {formatDate(transaction.occurred_at)} • {formatCategoryName(transaction.category_id)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(transaction.amount)}</span>
                      </button>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm italic text-muted-foreground">Nenhuma saída recente.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Concentração por categoria
                </p>
                <div className="space-y-3">
                  {topCategories.length > 0 ? (
                    topCategories.map((category) => (
                      <button
                        key={category.category_id}
                        className="w-full space-y-1.5 text-left"
                        onClick={() =>
                          onOpenLedgerFiltered(
                            {
                              period: "month",
                              category: category.category_id,
                              type: "expense",
                            },
                            dashboard.month,
                          )
                        }
                        type="button"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            {formatCategoryName(category.category_id)}
                          </span>
                          <span className="font-bold">{formatCurrency(category.total)}</span>
                        </div>
                        <Progress
                          value={(category.total / totalExpense) * 100}
                          className="h-1.5 bg-slate-100"
                        />
                      </button>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm italic text-muted-foreground">Sem dados suficientes.</p>
                  )}
                </div>
              </div>
             </div>

             <div className={cn("grid gap-4 md:gap-6 md:grid-cols-[14rem_1fr] rounded-3xl border border-slate-100 bg-slate-50/50 p-4", uiDensity === "dense" && "gap-4 p-3")}>
              {categoryComposition.length > 0 ? (
                <>
                  <div className="flex items-center justify-center">
                    <PieChart width={uiDensity === "dense" ? 120 : 160} height={uiDensity === "dense" ? 120 : 160}>
                      <Pie
                        data={categoryComposition}
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={66}
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

                  <div className="grid gap-2 sm:grid-cols-2">
                    {categoryComposition.map((category, index) => {
                      const share = Math.round((category.total / compositionTotal) * 100);
                      return (
                        <button
                          key={category.category_id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm transition-colors hover:bg-slate-50"
                          onClick={() =>
                            onOpenLedgerFiltered(
                              {
                                period: "month",
                                category: category.category_id,
                                type: "expense",
                              },
                              dashboard.month,
                            )
                          }
                          type="button"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                            />
                            <span className="truncate text-[11px] font-bold text-slate-700">
                              {formatCategoryName(category.category_id)}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-slate-900">{formatCurrency(category.total)}</p>
                            <p className="text-[9px] font-bold text-muted-foreground">{share}%</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="col-span-2 flex items-center justify-center py-6">
                  <p className="text-sm italic text-muted-foreground">Sem dados suficientes este mês.</p>
                </div>
              )}
            </div>

            <div className="hidden">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Alertas e atenção
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {alertItems.length > 0 ? (
                  alertItems.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${alert.containerClassName}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className={`shrink-0 rounded-lg p-1.5 ${alert.iconWrapperClassName}`}>
                          <AlertCircle className={`h-3.5 w-3.5 ${alert.iconClassName}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-[11px] font-bold ${alert.titleClassName}`}>
                            {alert.title}
                          </p>
                          <p className={`truncate text-[10px] ${alert.detailClassName}`}>
                            {alert.detail}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={alert.onClick}
                        className={cn("h-7 rounded-lg px-2 text-[9px]", alert.buttonClassName)}
                      >
                        {alert.actionLabel}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-emerald-100/50 bg-emerald-50 p-3">
                    <div className="rounded-lg bg-emerald-100 p-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-900">
                      Nenhuma pendência encontrada. Parabéns!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type DashboardAlertItem = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  onClick: () => void;
  containerClassName: string;
  iconWrapperClassName: string;
  iconClassName: string;
  titleClassName: string;
  detailClassName: string;
  buttonClassName: string;
};

type DashboardCommitment = NonNullable<DashboardSummary["monthly_commitments"]>[number];

function buildDashboardAlerts({
  dashboardMonth,
  onOpenLedgerFiltered,
  overdueReimbursements,
  reviewQueue,
  upcomingInvoices,
}: {
  dashboardMonth: string;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  overdueReimbursements: DashboardSummary["pending_reimbursements"];
  reviewQueue: DashboardSummary["review_queue"];
  upcomingInvoices: InvoiceSummary[];
}): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = [];

  const uncategorizedTransaction = reviewQueue.find((transaction) => transaction.category_id === "other");
  if (uncategorizedTransaction) {
    alerts.push({
      id: `uncategorized:${uncategorizedTransaction.transaction_id}`,
      title: "Lancamentos nao categorizados",
      detail: uncategorizedTransaction.description ?? "Existe um gasto aguardando classificacao.",
      actionLabel: "Resolver",
      onClick: () =>
        onOpenLedgerFiltered(
          {
            period: "month",
            preset: "uncategorized",
            text:
              uncategorizedTransaction.description ??
              formatCategoryName(uncategorizedTransaction.category_id),
          },
          dashboardMonth,
        ),
      containerClassName: "border-amber-100/50 bg-amber-50",
      iconWrapperClassName: "bg-amber-100",
      iconClassName: "text-amber-600",
      titleClassName: "text-amber-900",
      detailClassName: "text-amber-700",
      buttonClassName: "text-amber-700 hover:bg-amber-100",
    });
  }

  const reviewTransaction = reviewQueue.find((transaction) => transaction.category_id !== "other");
  if (reviewTransaction) {
    alerts.push({
      id: `review:${reviewTransaction.transaction_id}`,
      title: "Transacoes pendentes de revisao",
      detail: reviewTransaction.description ?? "Existe um lancamento que precisa de revisao manual.",
      actionLabel: "Revisar",
      onClick: () =>
        onOpenLedgerFiltered(
          {
            period: "month",
            preset: "review",
            text:
              reviewTransaction.description ??
              formatCategoryName(reviewTransaction.category_id),
          },
          dashboardMonth,
        ),
      containerClassName: "border-amber-100/50 bg-amber-50",
      iconWrapperClassName: "bg-amber-100",
      iconClassName: "text-amber-600",
      titleClassName: "text-amber-900",
      detailClassName: "text-amber-700",
      buttonClassName: "text-amber-700 hover:bg-amber-100",
    });
  }

  const delayedReimbursement = overdueReimbursements?.[0];
  if (delayedReimbursement) {
    alerts.push({
      id: `reimbursement:${delayedReimbursement.transaction_id}`,
      title: "Reembolsos atrasados",
      detail: `${delayedReimbursement.person_id} ainda nao devolveu ${formatCurrency(delayedReimbursement.amount)}.`,
      actionLabel: "Cobrar no historico",
      onClick: () =>
        onOpenLedgerFiltered(
          {
            period: "month",
            preset: "reimbursements",
            person: delayedReimbursement.person_id,
          },
          dashboardMonth,
        ),
      containerClassName: "border-amber-100/50 bg-amber-50",
      iconWrapperClassName: "bg-amber-100",
      iconClassName: "text-amber-600",
      titleClassName: "text-amber-900",
      detailClassName: "text-amber-700",
      buttonClassName: "text-amber-700 hover:bg-amber-100",
    });
  }

  const dueInvoice = upcomingInvoices[0];
  if (dueInvoice) {
    alerts.push({
      id: `invoice:${dueInvoice.invoice_id}`,
      title: "Faturas proximas do vencimento",
      detail: `${dueInvoice.card_id} vence em ${formatDate(dueInvoice.due_date)} com ${formatCurrency(dueInvoice.remaining_amount)} em aberto.`,
      actionLabel: "Abrir cartao",
      onClick: () =>
        onOpenLedgerFiltered(
          {
            period: "month",
            preset: "cards",
            card: dueInvoice.card_id,
          },
          dashboardMonth,
        ),
      containerClassName: "border-indigo-100/50 bg-indigo-50",
      iconWrapperClassName: "bg-indigo-100",
      iconClassName: "text-indigo-600",
      titleClassName: "text-indigo-900",
      detailClassName: "text-indigo-700",
      buttonClassName: "text-indigo-700 hover:bg-indigo-100",
    });
  }

  return alerts;
}

function formatCommitmentTitle(
  commitment: DashboardCommitment,
  cardNameById: Map<string, string>,
): string {
  if (commitment.kind === "invoice") {
    const cardId = commitment.card_id ?? commitment.title;
    const cardName = cardNameById.get(cardId) ?? cardId;
    return `Fatura ${cardName}`;
  }

  return commitment.title;
}

function formatCommitmentCategory(categoryId: string | null): string {
  if (!categoryId) {
    return "Sem categoria";
  }

  return formatCategoryName(categoryId);
}

function formatCommitmentKind(kind: DashboardCommitment["kind"]): string {
  return kind === "invoice" ? "Fatura" : "Recorrente";
}

function formatCommitmentStatus(status: string): string {
  if (status === "confirmed" || status === "paid") {
    return "Pago";
  }
  if (status === "partial") {
    return "Parcial";
  }

  return "Pendente";
}

function formatPendingStatus(status: string): string {
  return status === "confirmed" ? "Pago" : "Pendente";
}

function isOlderThanDays(isoValue: string, days: number): boolean {
  const date = new Date(isoValue);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  return diff > days * 24 * 60 * 60 * 1000;
}

function KpiCard({
  title,
  value,
  icon,
  trend,
  color,
  bgColor,
  onClick,
  uiDensity,
}: {
  title: string;
  value: number;
  icon?: React.ReactNode;
  trend?: "up" | "down";
  color: string;
  bgColor: string;
  onClick?: () => void;
  uiDensity: UiDensity;
}) {
  return (
    <Card
      className={cn(
        "finance-card finance-card--strong overflow-hidden rounded-[2.2rem]",
        uiDensity === "dense" && "rounded-[1.6rem]",
      )}
    >
      <CardContent className="p-0">
        <button
          className={cn(
            "w-full text-left",
            uiDensity === "dense" ? "p-3.5" : uiDensity === "compact" ? "p-4" : "p-5",
          )}
          onClick={onClick}
          type="button"
        >
        <div className="mb-4 flex items-start justify-between">
          <div className={`rounded-2xl p-3 ${bgColor}`}>
            {icon ||
              (trend === "up" ? (
                <ArrowUpRight className={`h-5 w-5 ${color}`} />
              ) : (
                <ArrowDownRight className={`h-5 w-5 ${color}`} />
              ))}
          </div>
          {trend && false && (
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${bgColor} ${color}`}>
              {trend === "up" ? "+4%" : "-2%"}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <MoneyValue value={value} className={`text-2xl font-bold ${color}`} />
        </div>
        </button>
      </CardContent>
    </Card>
  );
}
