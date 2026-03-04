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

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import type { AccountSummary, DashboardSummary } from "../../lib/api";
import { formatCategoryName, formatCurrency } from "../../lib/format";

type DashboardBentoProps = {
  dashboard: DashboardSummary;
  accounts: AccountSummary[];
  isSubmitting: boolean;
  onMarkReimbursementReceived: (transactionId: string) => Promise<void>;
  onNavigate: (view: "transactions") => void;
  onOpenQuickAdd: () => void;
};

export function DashboardBento({
  dashboard,
  accounts: _accounts,
  isSubmitting,
  onMarkReimbursementReceived,
  onNavigate,
  onOpenQuickAdd,
}: DashboardBentoProps) {
  const categoryComposition = dashboard.spending_by_category.slice(0, 5);
  const investmentMeta = dashboard.total_income * 0.1;
  const realizedInvestment =
    dashboard.spending_by_category.find(
      (category) =>
        category.category_id === "investment" || category.category_id === "investimentos",
    )?.total ?? 0;
  const metaProgress =
    investmentMeta > 0 ? Math.min((realizedInvestment / investmentMeta) * 100, 100) : 0;
  const topCategories = dashboard.spending_by_category.slice(0, 3);
  const totalExpense = dashboard.total_expense || 1;
  const compositionTotal =
    categoryComposition.reduce((sum, category) => sum + category.total, 0) || 1;
  const categoryColors = [
    "hsl(var(--primary))",
    "hsl(24 95% 53%)",
    "hsl(173 58% 39%)",
    "hsl(221 83% 53%)",
    "hsl(348 83% 47%)",
  ];
  const pendingReimbursements = dashboard.pending_reimbursements ?? [];
  const pendingReimbursementsTotal = dashboard.pending_reimbursements_total ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <KpiCard
          title={"Entradas do m\u00EAs"}
          value={dashboard.total_income}
          trend="up"
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <KpiCard
          title={"Sa\u00EDdas do m\u00EAs"}
          value={dashboard.total_expense}
          trend="down"
          color="text-rose-600"
          bgColor="bg-rose-50"
        />
        <KpiCard
          title="Saldo consolidado"
          value={dashboard.current_balance}
          icon={<Wallet className="h-5 w-5 text-primary" />}
          color="text-slate-900"
          bgColor="bg-primary/5"
        />
      </div>

      <Card className="rounded-[2rem] border-none bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-amber-100 p-2">
                <HandCoins className="h-5 w-5 text-amber-700" />
              </div>
              <CardTitle className="text-lg font-semibold">Reembolsos pendentes</CardTitle>
            </div>
            <span className="text-sm font-bold text-amber-700">
              {formatCurrency(pendingReimbursementsTotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-sm lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-2">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Meta investimento 10%</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 text-center">
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
                <span className="text-3xl font-bold text-primary">{metaProgress.toFixed(0)}%</span>
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
              onClick={onOpenQuickAdd}
              className="h-auto w-full rounded-2xl bg-primary py-6 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Registrar aporte agora
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none bg-white shadow-sm lg:col-span-8">
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
                          onClick={() => onNavigate("transactions")}
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
}: {
  title: string;
  value: number;
  icon?: React.ReactNode;
  trend?: "up" | "down";
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="overflow-hidden rounded-[2.2rem] border-none bg-white shadow-sm">
      <CardContent className="p-7">
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
          <p className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
