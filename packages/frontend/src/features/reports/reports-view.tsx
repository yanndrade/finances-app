import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import type {
  AccountSummary,
  ReportSummary,
  TransactionFilters,
} from "../../lib/api";
import type { CategoryOption } from "../../lib/categories";
import { formatCategoryName, formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

type ReportsViewProps = {
  accounts: AccountSummary[];
  categories: CategoryOption[];
  filters: TransactionFilters;
  loading: boolean;
  summary: ReportSummary | null;
  onApplyFilters: (filters: TransactionFilters) => Promise<void>;
  onOpenLedgerFiltered: (
    filters: Partial<TransactionFilters>,
    month?: string,
  ) => void;
  uiDensity: UiDensity;
};

type RequiredReportFilters = TransactionFilters & {
  period: "day" | "week" | "month" | "custom";
  reference: string;
};

export function ReportsView({
  accounts,
  categories,
  filters,
  loading,
  summary,
  onApplyFilters,
  onOpenLedgerFiltered,
  uiDensity,
}: ReportsViewProps) {
  const [filterForm, setFilterForm] = useState<RequiredReportFilters>(() =>
    normalizeReportFilters(filters),
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    setFilterForm(normalizeReportFilters(filters));
  }, [filters]);

  const cashflowProjection = useMemo(() => {
    if (summary === null) {
      return null;
    }

    const projectedNetAfterCommitments =
      summary.totals.net_total - summary.future_commitments.future_installment_total;
    const commitmentLoad = summary.totals.expense_total + summary.future_commitments.future_installment_total;
    const coveragePercent =
      commitmentLoad > 0
        ? Math.round((summary.totals.income_total / commitmentLoad) * 100)
        : 100;

    return {
      projectedNetAfterCommitments,
      coveragePercent,
    };
  }, [summary]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApplyFilters(filterForm);
  }

  return (
    <section
      aria-label="Relatórios e filtros"
      className={cn(
        "reports-workbench panel-card",
        uiDensity === "compact" && "finance-density-section finance-density-section--compact",
        uiDensity === "dense" && "finance-density-section finance-density-section--dense",
      )}
    >
      <form className="reports-filter-rail filters-grid items-end" onSubmit={handleSubmit}>
        <label className="custom-select-wrapper">
          <span className="mb-1.5 block">Período</span>
          <select
            className="h-12"
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                period: event.target.value as RequiredReportFilters["period"],
              }))
            }
            value={filterForm.period}
          >
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
            <option value="custom">Customizado</option>
          </select>
        </label>

        <label className="custom-input-wrapper">
          <span className="mb-1.5 block">Buscar texto</span>
          <input
            className="h-12"
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                text: event.target.value,
              }))
            }
            placeholder="Ex: Mercado, Aluguel..."
            type="text"
            value={filterForm.text}
          />
        </label>

        <div className="flex items-end">
          <Button className="h-12 w-full rounded-2xl font-black" type="submit">
            Aplicar filtros
          </Button>
        </div>

        <div className="flex items-center">
          <button
            className="ghost-button h-12 w-full px-4 text-xs"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            type="button"
          >
            {showAdvancedFilters ? "Ocultar filtros avançados" : "Mostrar filtros avançados"}
          </button>
        </div>
      </form>

      {loading && summary === null ? (
        <div className="empty-state">Carregando relatórios...</div>
      ) : null}

      {!loading && summary === null ? (
        <div className="empty-state">Não foi possível carregar os relatórios.</div>
      ) : null}

      {summary !== null && cashflowProjection !== null ? (
        <div className="reports-tabs-panel mt-8">
          <Tabs defaultValue="overview" className="space-y-8">
            <TabsList className="bg-slate-100/50 p-1">
              <TabsTrigger value="overview">Resumo Geral</TabsTrigger>
              <TabsTrigger value="distribution">Análise de Mix</TabsTrigger>
              <TabsTrigger value="evolution">Evolução & Tendência</TabsTrigger>
              <TabsTrigger value="commitments">Compromissos</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <article className="stat-card">
                  <p className="stat-card__label">Entradas do período</p>
                  <p className="stat-card__value text-emerald-600">{formatCurrency(summary.totals.income_total)}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-card__label">Saídas do período</p>
                  <p className="stat-card__value text-rose-600">{formatCurrency(summary.totals.expense_total)}</p>
                </article>
                <article className="stat-card">
                  <p className="stat-card__label">Saldo líquido</p>
                  <p className={cn("stat-card__value", summary.totals.net_total >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatCurrency(summary.totals.net_total)}
                  </p>
                </article>
              </div>

              <section className="panel-card panel-card--nested">
                <div className="section-heading mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="section-title">Fluxo e projeção simples</h3>
                    <p className="text-sm text-slate-500">Impacto dos compromissos futuros no saldo atual.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Cobertura {cashflowProjection.coveragePercent}%
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <article className="stat-card">
                        <p className="stat-card__label">Compromissos futuros</p>
                        <p className="stat-card__value">{formatCurrency(summary.future_commitments.future_installment_total)}</p>
                      </article>
                      <article className="stat-card">
                        <p className="stat-card__label">Saldo após compromissos</p>
                        <p className="stat-card__value">{formatCurrency(cashflowProjection.projectedNetAfterCommitments)}</p>
                      </article>
                    </div>

                    <div className="dashboard-list">
                      <div className="dashboard-list__item">
                        <strong>Receitas confirmadas</strong>
                        <p>{formatCurrency(summary.totals.income_total)}</p>
                      </div>
                      <div className="dashboard-list__item">
                        <strong>Despesas do período</strong>
                        <p>{formatCurrency(summary.totals.expense_total)}</p>
                      </div>
                      <div className="dashboard-list__item">
                        <strong>Parcelas futuras</strong>
                        <p>{formatCurrency(summary.future_commitments.future_installment_total)}</p>
                      </div>
                    </div>
                  </div>

                  <article className="stat-card flex flex-col justify-center bg-indigo-50/30 border-indigo-100/50">
                    <p className="stat-card__label text-indigo-900 font-bold mb-2 text-center uppercase tracking-tight">Projeção Final Liquidada</p>
                    <p className="stat-card__value text-indigo-700 text-center text-3xl">{formatCurrency(cashflowProjection.projectedNetAfterCommitments)}</p>
                    <p className="text-xs text-indigo-500 mt-4 text-center">Este valor representa o que sobra após quitar TODOS os compromissos parcelados já conhecidos.</p>
                  </article>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="distribution" className="space-y-8">
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <section className="panel-card panel-card--nested">
                  <div className="section-heading mb-4">
                    <div>
                      <p className="eyebrow">Categorias</p>
                      <h3 className="section-title">Consumo por categoria</h3>
                    </div>
                    <button
                      className="ghost-button text-xs"
                      type="button"
                      onClick={() =>
                        onOpenLedgerFiltered(
                          {
                            period: "custom",
                            from: summary.period.from.slice(0, 10),
                            to: summary.period.to.slice(0, 10),
                          },
                          summary.period.from.slice(0, 7),
                        )
                      }
                    >
                      Ver todos
                    </button>
                  </div>
                  {summary.category_breakdown.length === 0 ? (
                    <p className="empty-state">Sem dados para os filtros aplicados.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {summary.category_breakdown.map((item) => (
                        <div className="dashboard-list__item" key={item.category_id}>
                          <div className="min-w-0">
                            <strong className="block truncate">{formatCategoryName(item.category_id)}</strong>
                            <p className="text-xs">{formatCurrency(item.total)}</p>
                          </div>
                          <button
                            className="ghost-button p-1 hover:bg-slate-200 rounded-lg"
                            type="button"
                            title="Abrir no histórico"
                            onClick={() => {
                              onOpenLedgerFiltered(
                                {
                                  period: "month",
                                  category: item.category_id,
                                  text: formatCategoryName(item.category_id),
                                },
                                summary.period.from.slice(0, 7),
                              );
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="space-y-8">
                  <section className="panel-card panel-card--nested">
                    <div className="section-heading mb-4">
                      <p className="eyebrow">Mix de Gastos</p>
                      <h3 className="section-title">Fixos vs Variáveis</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <article className="stat-card p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Fixos</p>
                        <p className="text-sm font-black">{formatCurrency(summary.expense_mix.fixed_total)}</p>
                      </article>
                      <article className="stat-card p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Variáveis</p>
                        <p className="text-sm font-black">{formatCurrency(summary.expense_mix.variable_total)}</p>
                      </article>
                      <article className="stat-card p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Parcelas</p>
                        <p className="text-sm font-black">{formatCurrency(summary.expense_mix.installment_total)}</p>
                      </article>
                    </div>
                  </section>

                  <section className="panel-card panel-card--nested">
                    <div className="section-heading mb-4">
                      <p className="eyebrow">Cartões</p>
                      <h3 className="section-title">Gastos por cartão</h3>
                    </div>
                    {summary.card_breakdown.length === 0 ? (
                      <p className="empty-state">Sem gastos em cartão.</p>
                    ) : (
                      <div className="space-y-2">
                        {summary.card_breakdown.map((item) => (
                          <div className="dashboard-list__item py-2" key={item.card_id}>
                            <strong className="text-sm">{item.card_id}</strong>
                            <p className="text-sm font-bold">{formatCurrency(item.total)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evolution" className="space-y-8">
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <section className="panel-card panel-card--nested">
                  <div className="section-heading mb-4">
                    <h3 className="section-title">Evolução Mensal</h3>
                  </div>
                  {summary.expense_evolution.length === 0 ? (
                    <p className="empty-state">Histórico insuficiente.</p>
                  ) : (
                    <div className="space-y-2">
                      {summary.expense_evolution.map((point) => (
                        <div className="dashboard-list__item" key={point.month}>
                          <strong>{point.month}</strong>
                          <p className="font-bold">{formatCurrency(point.expense_total)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="panel-card panel-card--nested">
                  <div className="section-heading mb-4">
                    <h3 className="section-title">Tendência Semanal</h3>
                  </div>
                  {summary.weekly_trend.length === 0 ? (
                    <p className="empty-state">Sem dados semanais.</p>
                  ) : (
                    <div className="table-shell">
                      <table className="data-table text-xs">
                        <thead>
                          <tr>
                            <th>Semana</th>
                            <th>Entradas</th>
                            <th>Saídas</th>
                            <th>Líquido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.weekly_trend.map((week) => (
                            <tr key={week.week}>
                              <td className="font-bold">{week.week}</td>
                              <td className="text-emerald-600">{formatCurrency(week.income_total)}</td>
                              <td className="text-rose-600">{formatCurrency(week.expense_total)}</td>
                              <td className="font-black">{formatCurrency(week.net_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="panel-card panel-card--nested xl:col-span-2">
                  <div className="section-heading mb-4">
                    <h3 className="section-title">Projeção de Saldo Mensal</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                    <article className="stat-card p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Saldo Atual</p>
                      <p className="text-sm font-bold">{formatCurrency(summary.month_projection.current_balance)}</p>
                    </article>
                    <article className="stat-card p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Projetado</p>
                      <p className="text-sm font-bold">{formatCurrency(summary.month_projection.projected_end_balance)}</p>
                    </article>
                    <article className="stat-card p-3 border-amber-100 bg-amber-50/20">
                      <p className="text-[10px] text-amber-700 uppercase">Fixos Pend.</p>
                      <p className="text-sm font-bold text-amber-800">{formatCurrency(summary.month_projection.pending_fixed_total)}</p>
                    </article>
                    <article className="stat-card p-3 border-amber-100 bg-amber-50/20">
                      <p className="text-[10px] text-amber-700 uppercase">Faturas</p>
                      <p className="text-sm font-bold text-amber-800">{formatCurrency(summary.month_projection.invoice_due_total)}</p>
                    </article>
                    <article className="stat-card p-3 border-amber-100 bg-amber-50/20">
                      <p className="text-[10px] text-amber-700 uppercase">Parcelas</p>
                      <p className="text-sm font-bold text-amber-800">{formatCurrency(summary.month_projection.installment_impact_total)}</p>
                    </article>
                    <article className="stat-card p-3 border-emerald-100 bg-emerald-50/20">
                      <p className="text-[10px] text-emerald-700 uppercase">Previsto</p>
                      <p className="text-sm font-bold text-emerald-800">{formatCurrency(summary.month_projection.planned_income_total)}</p>
                    </article>
                  </div>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="commitments" className="space-y-8">
              <section className="panel-card panel-card--nested">
                <div className="section-heading mb-6">
                  <div>
                    <h3 className="section-title">Cronograma de Parcelas Futuras</h3>
                    <p className="text-sm text-slate-500">Visualização de compromissos já assumidos para os próximos meses.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-[280px_1fr]">
                  <div className="space-y-4">
                    <article className="stat-card bg-slate-50 border-slate-200">
                      <p className="stat-card__label">Impacto no Período</p>
                      <p className="stat-card__value text-slate-900 leading-tight">
                        {formatCurrency(summary.future_commitments.period_installment_impact_total)}
                      </p>
                    </article>
                    <article className="stat-card bg-indigo-50 border-indigo-200">
                      <p className="stat-card__label text-indigo-700 font-bold">Total Acumulado</p>
                      <p className="stat-card__value text-indigo-900 leading-tight">
                        {formatCurrency(summary.future_commitments.future_installment_total)}
                      </p>
                    </article>
                  </div>

                  {summary.future_commitments.future_installment_months.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {summary.future_commitments.future_installment_months.map((item) => (
                        <div className="dashboard-list__item flex-col items-start gap-1 p-3" key={item.month}>
                          <p className="text-xs font-bold text-slate-500 uppercase">{item.month}</p>
                          <p className="text-lg font-black text-slate-900">{formatCurrency(item.total)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">Sem parcelas após o período selecionado.</p>
                  )}
                </div>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </section>
  );
}

function normalizeReportFilters(filters: TransactionFilters): RequiredReportFilters {
  const today = localDateToday();
  return {
    ...filters,
    period: filters.period ?? "month",
    reference: filters.reference ?? today,
  };
}

function localDateToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

