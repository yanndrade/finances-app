import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { CategoryRule } from "../../lib/category-rules";
import type { CategoryOption } from "../../lib/categories";
import { isDefaultCategory } from "../../lib/categories";
import type { CategoryBudgetSummary } from "../../lib/api";
import { formatCategoryName, formatCurrency } from "../../lib/format";
import { UI_DENSITY_OPTIONS, type UiDensity } from "../../lib/ui-density";
import { cn } from "../../lib/utils";

type SettingsViewProps = {
  accountsCount: number;
  budgetMonth: string;
  cardsCount: number;
  categories: CategoryOption[];
  categoryRules: CategoryRule[];
  categoryBudgets: CategoryBudgetSummary[];
  isSubmitting: boolean;
  onCreateCategory: (label: string) => boolean;
  onOpenAccounts: () => void;
  onOpenCards: () => void;
  onRemoveCategory: (categoryId: string) => void;
  onRemoveCategoryRule: (ruleId: string) => void;
  onUpsertCategoryBudget: (
    month: string,
    categoryId: string,
    limitInCents: number,
  ) => Promise<void>;
  onUpsertCategoryRule: (pattern: string, categoryId: string) => boolean;
  onExportBackup: () => void;
  onUiDensityChange: (density: UiDensity) => void;
  onResetApplicationData: () => Promise<void>;
  uiDensity: UiDensity;
};

const PRODUCTIVITY_SHORTCUTS = [
  "Ctrl+N abre + Lancar",
  "Ctrl+K abre command palette",
  "Tab/Shift+Tab navegam no modal",
] as const;

export function SettingsView({
  accountsCount,
  budgetMonth,
  cardsCount,
  categories,
  categoryRules,
  categoryBudgets,
  isSubmitting,
  onCreateCategory,
  onOpenAccounts,
  onOpenCards,
  onRemoveCategory,
  onRemoveCategoryRule,
  onUpsertCategoryBudget,
  onUpsertCategoryRule,
  onExportBackup,
  onUiDensityChange,
  onResetApplicationData,
  uiDensity,
}: SettingsViewProps) {
  const defaultBudgetCategory = useMemo(() => {
    if (categoryBudgets.length > 0) {
      return categoryBudgets[0].category_id;
    }

    return categories[0]?.value ?? "";
  }, [categories, categoryBudgets]);

  const [budgetCategoryId, setBudgetCategoryId] = useState(defaultBudgetCategory);
  const [budgetLimitRaw, setBudgetLimitRaw] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [rulePattern, setRulePattern] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState(defaultBudgetCategory);
  const [ruleFeedback, setRuleFeedback] = useState<string | null>(null);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);

  useEffect(() => {
    if (!budgetCategoryId || !categories.some((category) => category.value === budgetCategoryId)) {
      setBudgetCategoryId(defaultBudgetCategory);
    }
  }, [budgetCategoryId, categories, defaultBudgetCategory]);

  useEffect(() => {
    if (!ruleCategoryId || !categories.some((category) => category.value === ruleCategoryId)) {
      setRuleCategoryId(defaultBudgetCategory);
    }
  }, [categories, defaultBudgetCategory, ruleCategoryId]);

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

  function handleCreateCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const wasCreated = onCreateCategory(newCategoryLabel);
    if (!wasCreated) {
      setCategoryFeedback("Use um nome unico para criar uma nova categoria.");
      return;
    }

    setNewCategoryLabel("");
    setCategoryFeedback("Categoria adicionada e liberada para lancamentos e orcamentos.");
  }

  function handleRuleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const wasSaved = onUpsertCategoryRule(rulePattern, ruleCategoryId);
    if (!wasSaved) {
      setRuleFeedback("Informe um padrao e uma categoria para salvar a regra.");
      return;
    }

    setRulePattern("");
    setRuleFeedback("Regra salva. O Historico passa a reutilizar esse mapeamento.");
  }

  return (
    <div className="screen-stack">
      <section className="panel-card settings-panel" aria-label="Configuracoes do sistema">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Core</p>
            <h3 className="section-title">Configuracoes do sistema</h3>
            <p className="section-copy">
              Use esta tela para destravar a base da aplicacao: contas, cartoes, categorias,
              regras e preferencias.
            </p>
          </div>
        </div>

        <div className="settings-hub-list">
          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Contas, cartoes e estrutura base</strong>
              <span className="status-badge status-badge--active">Core</span>
            </header>
            <p>
              Se a aplicacao estiver vazia, comece aqui: crie ao menos uma conta e depois vincule
              seus cartoes ao workspace certo.
            </p>
            <div className="settings-chip-list" aria-label="Resumo da estrutura base">
              <span className="settings-chip">{accountsCount} conta(s)</span>
              <span className="settings-chip">{cardsCount} cartao(oes)</span>
            </div>
            <div className="settings-action-row">
              <button className="secondary-button" onClick={onOpenAccounts} type="button">
                Gerenciar contas
              </button>
              <button className="secondary-button" onClick={onOpenCards} type="button">
                Gerenciar cartoes
              </button>
              <span className="settings-muted-copy">
                Contas alimentam caixa, cartoes, faturas e pagamentos.
              </span>
            </div>
          </article>

          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Categorias</strong>
              <span className="status-badge status-badge--active">Editavel</span>
            </header>
            <p>
              Adicione e remova categorias customizadas para refletir o seu uso real no
              lancamento rapido, no historico e no planejamento mensal.
            </p>
            <form className="settings-inline-form" onSubmit={handleCreateCategorySubmit}>
              <label className="settings-inline-form__field">
                Nova categoria
                <input
                  aria-label="Nova categoria"
                  onChange={(event) => {
                    setNewCategoryLabel(event.target.value);
                    setCategoryFeedback(null);
                  }}
                  placeholder="Ex: Pets, Assinaturas, Viagens"
                  value={newCategoryLabel}
                />
              </label>
              <button className="primary-button" type="submit">
                Adicionar categoria
              </button>
            </form>
            {categoryFeedback ? <p className="settings-feedback">{categoryFeedback}</p> : null}
            <div className="settings-token-grid" aria-label="Lista de categorias">
              {categories.map((category) => (
                <div key={category.value} className="settings-token-card">
                  <div>
                    <strong>{category.label}</strong>
                    <p>{category.value}</p>
                  </div>
                  <div className="settings-token-card__actions">
                    <span
                      className={cn(
                        "status-badge",
                        isDefaultCategory(category.value)
                          ? "status-badge--active"
                          : "status-badge--pending",
                      )}
                    >
                      {isDefaultCategory(category.value) ? "Padrao" : "Custom"}
                    </span>
                    {!isDefaultCategory(category.value) ? (
                      <button
                        className="ghost-button"
                        onClick={() => onRemoveCategory(category.value)}
                        type="button"
                      >
                        Excluir categoria
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <p className="settings-muted-copy">
              Categorias padrao permanecem protegidas para evitar quebrar fluxos essenciais.
            </p>
          </article>

          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Regras de auto-categorizacao</strong>
              <span className="status-badge status-badge--pending">Persistente</span>
            </header>
            <p>
              Regras salvas aqui reaparecem no Historico para acelerar a classificacao de
              transacoes recorrentes.
            </p>
            <form className="settings-rule-grid" onSubmit={handleRuleSubmit}>
              <label className="settings-inline-form__field">
                Padrao da regra
                <input
                  aria-label="Padrao da regra"
                  onChange={(event) => {
                    setRulePattern(event.target.value);
                    setRuleFeedback(null);
                  }}
                  placeholder="Ex: uber, ifood, mercado local"
                  value={rulePattern}
                />
              </label>
              <label className="settings-inline-form__field custom-select-wrapper">
                Categoria da regra
                <select
                  aria-label="Categoria da regra"
                  onChange={(event) => {
                    setRuleCategoryId(event.target.value);
                    setRuleFeedback(null);
                  }}
                  value={ruleCategoryId}
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button settings-rule-grid__submit" type="submit">
                Salvar regra
              </button>
            </form>
            {ruleFeedback ? <p className="settings-feedback">{ruleFeedback}</p> : null}
            {categoryRules.length > 0 ? (
              <div className="settings-rule-list">
                {categoryRules.map((rule) => (
                  <div key={rule.id} className="settings-token-card">
                    <div>
                      <strong>{rule.pattern}</strong>
                      <p>{formatCategoryName(rule.categoryId)}</p>
                    </div>
                    <button
                      className="ghost-button"
                      onClick={() => onRemoveCategoryRule(rule.id)}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Nenhuma regra salva ainda. Crie a primeira para padronizar descricoes recorrentes.
              </p>
            )}
          </article>

          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Preferencias e backup</strong>
              <span className="status-badge status-badge--active">Ativo</span>
            </header>
            <p>
              Ajuste densidade para o desktop e exporte um backup quando quiser congelar o estado
              atual da base.
            </p>
            <div className="settings-action-row">
              <button className="secondary-button" onClick={onExportBackup} type="button">
                Exportar backup JSON
              </button>
              <span className="settings-muted-copy">
                O arquivo inclui contas, cartoes, faturas, transacoes e investimentos.
              </span>
            </div>
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
                    className={cn("settings-density-option", isActive && "is-active")}
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
          </article>
        </div>
      </section>

      <section className="panel-card settings-panel" aria-label="Orcamentos e regras">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Planejamento</p>
            <h3 className="section-title">Orcamentos mensais</h3>
            <p className="section-copy">
              Defina limites por categoria sem sair das configuracoes. As categorias customizadas
              tambem entram aqui.
            </p>
          </div>
        </div>

        <form className="settings-budget-form" onSubmit={(event) => void handleBudgetSubmit(event)}>
          <label className="settings-inline-form__field custom-select-wrapper">
            Categoria
            <select
              aria-label="Categoria"
              value={budgetCategoryId}
              onChange={(event) => setBudgetCategoryId(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-inline-form__field">
            Limite mensal
            <input
              aria-label="Limite mensal"
              inputMode="numeric"
              onChange={(event) => setBudgetLimitRaw(event.target.value)}
              placeholder="Ex: 12000"
              value={budgetLimitRaw}
            />
          </label>

          <button
            className="primary-button settings-budget-form__submit"
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
                    {formatCurrency(budget.spent)} de {formatCurrency(budget.limit)} (
                    {budget.usage_percent}%)
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
                Limpa compras, transferencias, contas e cartoes para voltar ao estado de primeira
                abertura da aplicacao.
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
