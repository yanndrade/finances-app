import { useEffect, useMemo, useState, type FormEvent } from "react";

import { CATEGORY_OPTIONS } from "../../lib/categories";
import type { CategoryBudgetSummary } from "../../lib/api";
import { formatCategoryName, formatCurrency } from "../../lib/format";
import { UI_DENSITY_OPTIONS, type UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type SettingsViewProps = {
  budgetMonth: string;
  categoryBudgets: CategoryBudgetSummary[];
  isSubmitting: boolean;
  onOpenAccounts: () => void;
  onUpsertCategoryBudget: (
    month: string,
    categoryId: string,
    limitInCents: number,
  ) => Promise<void>;
  onExportBackup: () => void;
  onUiDensityChange: (density: UiDensity) => void;
  onResetApplicationData: () => Promise<void>;
  uiDensity: UiDensity;
};

const SETTINGS_HUB_ITEMS = [
  {
    id: "categories",
    title: "Categorias e hierarquia",
    description:
      "Organize categorias para manter relatorios e regras consistentes em todas as telas.",
    statusLabel: "Ativo",
    statusClass: "status-badge status-badge--active",
  },
  {
    id: "accounts",
    title: "Contas e cartoes",
    description:
      "Cadastre contas/cartoes padrao e concentre ajustes estruturais fora do dashboard.",
    statusLabel: "Ativo",
    statusClass: "status-badge status-badge--active",
  },
  {
    id: "rules",
    title: "Regras de auto-categorizacao",
    description:
      "Defina regras por contrapartes para preencher categoria automaticamente no ledger.",
    statusLabel: "Em revisao",
    statusClass: "status-badge status-badge--pending",
  },
  {
    id: "backup",
    title: "Importacao, exportacao e backup",
    description:
      "Exporte snapshot para auditoria e restauracao manual em cenarios de contingencia.",
    statusLabel: "Ativo",
    statusClass: "status-badge status-badge--active",
  },
  {
    id: "preferences",
    title: "Preferencias de densidade e atalhos",
    description:
      "Padronize produtividade desktop com atalhos e niveis de densidade no historico.",
    statusLabel: "Ativo",
    statusClass: "status-badge status-badge--active",
  },
] as const;

const RULE_EXAMPLES = [
  "uber -> Transporte",
  "mercado local -> Alimentacao",
  "ifood -> Alimentacao",
] as const;

const PRODUCTIVITY_SHORTCUTS = [
  "Ctrl+N abre + Lancar",
  "Ctrl+K abre command palette",
  "Tab/Shift+Tab navegam no modal",
] as const;

export function SettingsView({
  budgetMonth,
  categoryBudgets,
  isSubmitting,
  onOpenAccounts,
  onUpsertCategoryBudget,
  onExportBackup,
  onUiDensityChange,
  onResetApplicationData,
  uiDensity,
}: SettingsViewProps) {
  const defaultBudgetCategory = useMemo(() => {
    if (categoryBudgets.length > 0) {
      return categoryBudgets[0].category_id;
    }

    return CATEGORY_OPTIONS[0]?.value ?? "";
  }, [categoryBudgets]);

  const [budgetCategoryId, setBudgetCategoryId] = useState(defaultBudgetCategory);
  const [budgetLimitRaw, setBudgetLimitRaw] = useState("");
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);

  useEffect(() => {
    if (!budgetCategoryId && defaultBudgetCategory) {
      setBudgetCategoryId(defaultBudgetCategory);
    }
  }, [budgetCategoryId, defaultBudgetCategory]);

  async function handleBudgetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCategory = budgetCategoryId.trim();
    const limitInCents = parseBudgetLimitToCents(budgetLimitRaw);
    if (!normalizedCategory || limitInCents <= 0) {
      return;
    }

    await onUpsertCategoryBudget(budgetMonth, normalizedCategory, limitInCents);
    setBudgetLimitRaw("");
  }

  return (
    <div className="screen-stack">
      <section className="panel-card settings-panel" aria-label="Configuracoes do sistema">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Hub</p>
            <h3 className="section-title">Configuracoes do sistema</h3>
            <p className="section-copy">
              Parametrizacoes infrequentes ficam centralizadas aqui para manter o dashboard focado em acao.
            </p>
          </div>
        </div>

        <div className="settings-hub-list">
          {SETTINGS_HUB_ITEMS.map((section) => (
            <article key={section.id} className="settings-hub-item">
              <header className="settings-hub-item__header">
                <strong>{section.title}</strong>
                <span className={section.statusClass}>{section.statusLabel}</span>
              </header>
              <p>{section.description}</p>

              {section.id === "categories" ? (
                <div className="settings-chip-list" aria-label="Categorias principais">
                  {CATEGORY_OPTIONS.slice(0, 6).map((category) => (
                    <span key={category.value} className="settings-chip">
                      {category.label}
                    </span>
                  ))}
                </div>
              ) : null}

              {section.id === "accounts" ? (
                <div className="settings-action-row">
                  <button
                    className="secondary-button"
                    onClick={onOpenAccounts}
                    type="button"
                  >
                    Gerenciar contas
                  </button>
                  <span className="settings-muted-copy">
                    Abra o workspace de contas para criar a primeira conta ou editar saldos existentes.
                  </span>
                </div>
              ) : null}

              {section.id === "rules" ? (
                <ul className="settings-inline-list" aria-label="Exemplos de regra">
                  {RULE_EXAMPLES.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : null}

              {section.id === "backup" ? (
                <div className="settings-action-row">
                  <button
                    className="secondary-button"
                    onClick={onExportBackup}
                    type="button"
                  >
                    Exportar backup JSON
                  </button>
                  <span className="settings-muted-copy">
                    Importacao assistida permanece em rollout controlado.
                  </span>
                </div>
              ) : null}

              {section.id === "preferences" ? (
                <div className="space-y-4">
                  <ul className="settings-inline-list" aria-label="Atalhos e densidade">
                    {PRODUCTIVITY_SHORTCUTS.map((shortcut) => (
                      <li key={shortcut}>{shortcut}</li>
                    ))}
                    <li>Densidade propagada para Dashboard, Cartoes, Investimentos e Relatorios.</li>
                  </ul>
                  <div
                    aria-label="Preferencia global de densidade"
                    className="settings-density-picker"
                    role="radiogroup"
                  >
                    {UI_DENSITY_OPTIONS.map((option) => {
                      const isActive = option.value === uiDensity;

                      return (
                        <button
                          key={option.value}
                          aria-checked={isActive}
                          className={cn(
                            "settings-density-option",
                            isActive && "is-active",
                          )}
                          onClick={() => onUiDensityChange(option.value)}
                          role="radio"
                          type="button"
                        >
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="panel-card settings-panel" aria-label="Orcamentos e regras">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Planejamento</p>
            <h3 className="section-title">Orcamentos e regras</h3>
            <p className="section-copy">
              Defina limites mensais aqui. A Visao Geral exibe somente status e alertas.
            </p>
          </div>
        </div>

        <form
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]"
          onSubmit={(event) => {
            void handleBudgetSubmit(event);
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Categoria
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={budgetCategoryId}
              onChange={(event) => setBudgetCategoryId(event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Limite mensal
            <input
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              inputMode="numeric"
              onChange={(event) => setBudgetLimitRaw(event.target.value)}
              placeholder="Ex: 12000"
              value={budgetLimitRaw}
            />
          </label>

          <button
            className="primary-button h-10 self-end px-5"
            disabled={isSubmitting}
            type="submit"
          >
            Salvar limite
          </button>
        </form>

        {categoryBudgets.length > 0 ? (
          <div className="dashboard-list">
            {categoryBudgets.map((budget) => (
              <div key={`${budget.month}:${budget.category_id}`} className="dashboard-list__item">
                <div>
                  <strong>{formatCategoryName(budget.category_id)}</strong>
                  <p>
                    {formatCurrency(budget.spent)} de {formatCurrency(budget.limit)} ({budget.usage_percent}%)
                  </p>
                </div>
                <span className={budgetStatusClass(budget.status)}>
                  {budgetStatusCopy(budget.status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Nenhum limite cadastrado para {budgetMonth}.</p>
        )}
      </section>

      <section className="panel-card settings-panel" aria-label="Zona de perigo">
        <button
          aria-controls="settings-danger-zone"
          aria-expanded={isDangerZoneOpen}
          className="settings-danger-summary"
          onClick={() => setIsDangerZoneOpen((current) => !current)}
          type="button"
        >
          Zona de perigo
        </button>

        {isDangerZoneOpen ? (
          <div id="settings-danger-zone" className="settings-danger-card">
            <div>
              <p className="eyebrow">Ambiente</p>
              <h3 className="section-title">Zerar aplicacao</h3>
              <p className="section-copy">
                Limpa compras, transferencias e contas para voltar ao estado de primeira abertura
                da aplicacao.
              </p>
            </div>

            <button
              className="ghost-button ghost-button--danger settings-danger-button"
              disabled={isSubmitting}
              onClick={() => {
                void onResetApplicationData();
              }}
              type="button"
            >
              Apagar todos os dados
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function parseBudgetLimitToCents(rawValue: string): number {
  const digitsOnly = rawValue.replace(/\D/g, "");
  if (!digitsOnly) {
    return 0;
  }

  return parseInt(digitsOnly, 10);
}

function budgetStatusCopy(status: string): string {
  if (status === "exceeded") {
    return "Excedido";
  }
  if (status === "warning") {
    return "Em alerta";
  }
  return "Saudavel";
}

function budgetStatusClass(status: string): string {
  if (status === "exceeded") {
    return "status-badge status-badge--voided";
  }
  if (status === "warning") {
    return "status-badge status-badge--pending";
  }
  return "status-badge status-badge--active";
}
