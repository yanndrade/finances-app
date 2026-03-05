import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { AccountSummary, ReportSummary, TransactionFilters } from "../../lib/api";
import { formatCategoryName, formatCurrency } from "../../lib/format";
import type { UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type ReportsViewProps = {
  accounts: AccountSummary[];
  filters: TransactionFilters;
  loading: boolean;
  isSubmitting: boolean;
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
  filters,
  loading,
  isSubmitting,
  summary,
  onApplyFilters,
  onOpenLedgerFiltered,
  uiDensity,
}: ReportsViewProps) {
  const [filterForm, setFilterForm] = useState<RequiredReportFilters>(() =>
    normalizeReportFilters(filters),
  );

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApplyFilters(filterForm);
  }

  return (
    <section
      aria-label="Relatorios e filtros"
      className={cn(
        "panel-card",
        uiDensity === "compact" && "finance-density-section finance-density-section--compact",
        uiDensity === "dense" && "finance-density-section finance-density-section--dense",
      )}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Templates</p>
          <h2 className="section-title">Analises e relatorios</h2>
          <p className="section-copy">
            Leitura pronta para decisao com drill-down para o ledger quando algo sai do trilho.
          </p>
        </div>
      </div>

      <form className="filters-grid" onSubmit={handleSubmit}>
        <label>
          Periodo
          <select
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
            <option value="month">Mes</option>
            <option value="custom">Customizado</option>
          </select>
        </label>

        {filterForm.period === "custom" ? (
          <>
            <label>
              De
              <input
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                type="date"
                value={filterForm.from}
              />
            </label>
            <label>
              Ate
              <input
                onChange={(event) =>
                  setFilterForm((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                type="date"
                value={filterForm.to}
              />
            </label>
          </>
        ) : (
          <label>
            Referencia
            <input
              onChange={(event) =>
                setFilterForm((current) => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
              type="date"
              value={filterForm.reference}
            />
          </label>
        )}

        <label>
          Conta
          <select
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                account: event.target.value,
              }))
            }
            value={filterForm.account}
          >
            <option value="">Todas</option>
            {accounts.map((account) => (
              <option key={account.account_id} value={account.account_id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Metodo
          <select
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                method: event.target.value as RequiredReportFilters["method"],
              }))
            }
            value={filterForm.method}
          >
            <option value="">Todos</option>
            <option value="PIX">PIX</option>
            <option value="CASH">Dinheiro</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>

        <label>
          Categoria
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            value={filterForm.category}
          />
        </label>

        <label>
          Pessoa
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                person: event.target.value,
              }))
            }
            value={filterForm.person}
          />
        </label>

        <label>
          Buscar texto
          <input
            onChange={(event) =>
              setFilterForm((current) => ({
                ...current,
                text: event.target.value,
              }))
            }
            value={filterForm.text}
          />
        </label>

        <div className="inline-actions">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>

      {loading && summary === null ? (
        <div className="empty-state">Carregando relatorios...</div>
      ) : null}

      {!loading && summary === null ? (
        <div className="empty-state">Nao foi possivel carregar os relatorios.</div>
      ) : null}

      {summary !== null && cashflowProjection !== null ? (
        <div className={cn("space-y-6", uiDensity === "compact" && "space-y-5", uiDensity === "dense" && "space-y-4")}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="stat-card">
              <p className="stat-card__label">Entradas do periodo</p>
              <p className="stat-card__value">{formatCurrency(summary.totals.income_total)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-card__label">Saidas do periodo</p>
              <p className="stat-card__value">{formatCurrency(summary.totals.expense_total)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-card__label">Saldo liquido</p>
              <p className="stat-card__value">{formatCurrency(summary.totals.net_total)}</p>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <section className="panel-card panel-card--nested">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Categorias</p>
                  <h3 className="section-title">Consumo por categoria</h3>
                </div>
                <button
                  className="ghost-button"
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
                  Ver recorte do periodo
                </button>
              </div>
              {summary.category_breakdown.length === 0 ? (
                <p className="empty-state">Sem dados para os filtros aplicados.</p>
              ) : (
                <div className="dashboard-list">
                  {summary.category_breakdown.map((item) => (
                    <div className="dashboard-list__item" key={item.category_id}>
                      <div>
                        <strong>{formatCategoryName(item.category_id)}</strong>
                        <p>{formatCurrency(item.total)}</p>
                      </div>
                      <button
                        className="ghost-button"
                        type="button"
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
                        Abrir {formatCategoryName(item.category_id)} no historico
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel-card panel-card--nested">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Cashflow</p>
                  <h3 className="section-title">Fluxo e projecao simples</h3>
                </div>
                <span className="status-badge status-badge--active">
                  Cobertura {cashflowProjection.coveragePercent}%
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <article className="stat-card">
                  <p className="stat-card__label">Compromissos futuros</p>
                  <p className="stat-card__value">
                    {formatCurrency(summary.future_commitments.future_installment_total)}
                  </p>
                </article>
                <article className="stat-card">
                  <p className="stat-card__label">Saldo apos compromissos</p>
                  <p className="stat-card__value">
                    {formatCurrency(cashflowProjection.projectedNetAfterCommitments)}
                  </p>
                </article>
              </div>

              <div className="dashboard-list">
                <div className="dashboard-list__item">
                  <strong>Receitas confirmadas</strong>
                  <p>{formatCurrency(summary.totals.income_total)}</p>
                </div>
                <div className="dashboard-list__item">
                  <strong>Despesas do periodo</strong>
                  <p>{formatCurrency(summary.totals.expense_total)}</p>
                </div>
                <div className="dashboard-list__item">
                  <strong>Parcelas futuras</strong>
                  <p>{formatCurrency(summary.future_commitments.future_installment_total)}</p>
                </div>
                <div className="dashboard-list__item">
                  <strong>Projecao final</strong>
                  <p>{formatCurrency(cashflowProjection.projectedNetAfterCommitments)}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <section className="panel-card panel-card--nested">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Semanal</p>
                  <h3 className="section-title">Tendencia por semana</h3>
                </div>
              </div>
              {summary.weekly_trend.length === 0 ? (
                <p className="empty-state">Sem semanas no periodo selecionado.</p>
              ) : (
                <div className={`table-shell table-shell--${uiDensity}`}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Semana</th>
                        <th>Entradas</th>
                        <th>Saidas</th>
                        <th>Liquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.weekly_trend.map((week) => (
                        <tr key={week.week}>
                          <td>{week.week}</td>
                          <td>{formatCurrency(week.income_total)}</td>
                          <td>{formatCurrency(week.expense_total)}</td>
                          <td>{formatCurrency(week.net_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel-card panel-card--nested">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Compromissos</p>
                  <h3 className="section-title">Parcelas futuras</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <article className="stat-card">
                  <p className="stat-card__label">Impacto no periodo</p>
                  <p className="stat-card__value">
                    {formatCurrency(summary.future_commitments.period_installment_impact_total)}
                  </p>
                </article>
                <article className="stat-card">
                  <p className="stat-card__label">Compromisso futuro</p>
                  <p className="stat-card__value">
                    {formatCurrency(summary.future_commitments.future_installment_total)}
                  </p>
                </article>
              </div>

              {summary.future_commitments.future_installment_months.length > 0 ? (
                <div className="dashboard-list">
                  {summary.future_commitments.future_installment_months.map((item) => (
                    <div className="dashboard-list__item" key={item.month}>
                      <strong>{item.month}</strong>
                      <p>{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Sem parcelas apos o periodo selecionado.</p>
              )}
            </section>
          </div>
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

