import { useState, type FormEvent } from "react";

import type { CategoryOption } from "../../lib/categories";

type SettingsViewProps = {
  accountsCount: number;
  cardsCount: number;
  categories: CategoryOption[];
  isSubmitting: boolean;
  onCreateCategory: (label: string) => boolean;
  onOpenAccounts: () => void;
  onOpenCards: () => void;
  onRemoveCategory: (categoryId: string) => void;
  onExportBackup: () => void;
  onResetApplicationData: () => Promise<void>;
  uiDensity: import("../../lib/ui-density").UiDensity;
  onUiDensityChange: (density: import("../../lib/ui-density").UiDensity) => void;
};

const PRODUCTIVITY_SHORTCUTS = [
  "Ctrl+N abre + Lançar",
  "Ctrl+K abre command palette",
  "Tab/Shift+Tab navegam no modal",
] as const;

export function SettingsView({
  accountsCount,
  cardsCount,
  categories,
  isSubmitting,
  onCreateCategory,
  onOpenAccounts,
  onOpenCards,
  onRemoveCategory,
  onExportBackup,
  onResetApplicationData,
  uiDensity,
  onUiDensityChange,
}: SettingsViewProps) {
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false);

  function handleCreateCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const wasCreated = onCreateCategory(newCategoryLabel);
    if (!wasCreated) {
      setCategoryFeedback("Use um nome único para criar uma nova categoria.");
      return;
    }

    setNewCategoryLabel("");
    setCategoryFeedback("Categoria adicionada com sucesso.");
  }

  return (
    <div className="screen-stack max-w-6xl mx-auto">
      <section className="panel-card settings-panel" aria-label="Preferências do sistema">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Interface</p>
            <h3 className="section-title">Preferências visuais</h3>
            <p className="section-copy">
              Ajuste a densidade da interface para melhor se adaptar à sua tela e preferência
              de leitura.
            </p>
          </div>
        </div>

        <div className="settings-hub-list">
          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Densidade da interface</strong>
              <span className="status-badge status-badge--active">{uiDensity === "dense" ? "Compactíssimo" : uiDensity === "compact" ? "Equilibrado" : "Espaçado"}</span>
            </header>
            <p>
              O modo <strong>Denso</strong> é ideal para telas 1080p, garantindo que o máximo de
              informação apareça sem necessidade de rolagem.
            </p>
            <div className="settings-action-row flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
              {(["comfort", "compact", "dense"] as const).map((density) => (
                <button
                  key={density}
                  className={uiDensity === density ? "primary-button" : "secondary-button"}
                  onClick={() => onUiDensityChange(density)}
                  type="button"
                  style={{ textTransform: "capitalize" }}
                >
                  {density === "comfort" ? "Confortável" : density === "compact" ? "Compacto" : "Denso"}
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="panel-card settings-panel" aria-label="Configurações do sistema">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Core</p>
            <h3 className="section-title">Configurações do sistema</h3>
            <p className="section-copy">
              Use esta tela para manter a base da aplicação simples: contas, cartões,
              categorias e backup.
            </p>
          </div>
        </div>

        <div className="settings-hub-list">
          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Contas, cartões e estrutura base</strong>
              <span className="status-badge status-badge--active">Core</span>
            </header>
            <p>
              Se a aplicação estiver vazia, comece aqui: crie ao menos uma conta e depois vincule
              seus cartões ao workspace certo.
            </p>
            <div className="settings-chip-list" aria-label="Resumo da estrutura base">
              <span className="settings-chip">{accountsCount} conta(s)</span>
              <span className="settings-chip">{cardsCount} cartão(ões)</span>
            </div>
            <div className="settings-action-row flex-wrap gap-2">
              <button className="secondary-button" onClick={onOpenAccounts} type="button">
                Gerenciar contas
              </button>
              <button className="secondary-button" onClick={onOpenCards} type="button">
                Gerenciar cartões
              </button>
              <span className="settings-muted-copy">
                Contas alimentam caixa, cartões, faturas e pagamentos.
              </span>
            </div>
          </article>

          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Categorias</strong>
              <span className="status-badge status-badge--active">Editável</span>
            </header>
            <p>
              Cadastre somente as categorias que você realmente usa no lançamento rápido, no
              histórico e no planejamento mensal.
            </p>
            <form className="settings-inline-form flex flex-col sm:flex-row gap-2 sm:gap-3" onSubmit={handleCreateCategorySubmit}>
              <label className="settings-inline-form__field flex-1 min-w-0">
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
              <button className="primary-button whitespace-nowrap" type="submit">
                Adicionar categoria
              </button>
            </form>
            {categoryFeedback ? <p className="settings-feedback">{categoryFeedback}</p> : null}
            {categories.length > 0 ? (
              <div className="settings-token-grid" aria-label="Lista de categorias">
                {categories.map((category) => (
                  <div key={category.value} className="settings-token-card">
                    <div>
                      <strong>{category.label}</strong>
                      <p>{category.value}</p>
                    </div>
                    <div className="settings-token-card__actions">
                      <button
                        className="ghost-button"
                        onClick={() => onRemoveCategory(category.value)}
                        type="button"
                      >
                        Excluir categoria
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Nenhuma categoria cadastrada ainda.</p>
            )}
          </article>

          <article className="settings-hub-item">
            <header className="settings-hub-item__header">
              <strong>Preferências e backup</strong>
              <span className="status-badge status-badge--active">Ativo</span>
            </header>
            <p>Exporte um backup quando quiser congelar o estado atual da base.</p>
            <div className="settings-action-row flex-wrap gap-2">
              <button className="secondary-button" onClick={onExportBackup} type="button">
                Exportar backup JSON
              </button>
              <span className="settings-muted-copy">
                O arquivo inclui contas, cartões, faturas, transações e investimentos.
              </span>
            </div>
            <ul className="settings-inline-list" aria-label="Atalhos de produtividade">
              {PRODUCTIVITY_SHORTCUTS.map((shortcut) => (
                <li key={shortcut}>{shortcut}</li>
              ))}
            </ul>
          </article>
        </div>
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
              <h3 className="section-title">Zerar aplicação</h3>
              <p className="section-copy">
                Limpa compras, transferências, contas e cartões para voltar ao estado de primeira
                abertura da aplicação.
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
