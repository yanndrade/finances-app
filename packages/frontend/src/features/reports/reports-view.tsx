import { useEffect, useState, type FormEvent } from "react";

import type { AccountSummary, ReportSummary, TransactionFilters } from "../../lib/api";
import { formatCategoryName, formatCurrency } from "../../lib/format";

type ReportsViewProps = {
  accounts: AccountSummary[];
  filters: TransactionFilters;
  loading: boolean;
  isSubmitting: boolean;
  summary: ReportSummary | null;
  onApplyFilters: (filters: TransactionFilters) => Promise<void>;
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
}: ReportsViewProps) {
  const [filterForm, setFilterForm] = useState<RequiredReportFilters>(() =>
    normalizeReportFilters(filters),
  );

  useEffect(() => {
    setFilterForm(normalizeReportFilters(filters));
  }, [filters]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApplyFilters(filterForm);
  }

  return (
    <section aria-label="Relatorios e filtros" className="panel-card">
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
            <option value="month">Mês</option>
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
              {"Até"}
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
            Referência
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
          Método
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
        <div className="empty-state">Carregando relatórios...</div>
      ) : null}

      {!loading && summary === null ? (
        <div className="empty-state">Não foi possível carregar os relatórios.</div>
      ) : null}

      {summary !== null ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="stat-card">
              <p className="stat-card__label">Entradas do período</p>
              <p className="stat-card__value">{formatCurrency(summary.totals.income_total)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-card__label">Saídas do período</p>
              <p className="stat-card__value">{formatCurrency(summary.totals.expense_total)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-card__label">Saldo líquido</p>
              <p className="stat-card__value">{formatCurrency(summary.totals.net_total)}</p>
            </article>
          </div>

          <section className="panel-card panel-card--nested">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Categorias</p>
                <h3 className="section-title">Consumo por categoria</h3>
              </div>
            </div>
            {summary.category_breakdown.length === 0 ? (
              <p className="empty-state">Sem dados para os filtros aplicados.</p>
            ) : (
              <div className="dashboard-list">
                {summary.category_breakdown.map((item) => (
                  <div className="dashboard-list__item" key={item.category_id}>
                    <strong>{formatCategoryName(item.category_id)}</strong>
                    <p>{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel-card panel-card--nested">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Semanal</p>
                <h3 className="section-title">Tendência por semana</h3>
              </div>
            </div>
            {summary.weekly_trend.length === 0 ? (
              <p className="empty-state">Sem semanas no período selecionado.</p>
            ) : (
              <div className="table-shell">
                <table className="data-table">
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
                <p className="stat-card__label">Impacto no período</p>
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
              <p className="empty-state">Sem parcelas após o período selecionado.</p>
            )}
          </section>
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
