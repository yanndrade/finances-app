import { useState, type FormEvent } from "react";
import { cn } from "../../lib/utils";

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
    <div className="screen-stack settings-screen mx-auto max-w-[1280px]">
      <div className="settings-bento-grid">
        <article className="settings-bento-card settings-bento-card--large">
          <header className="settings-bento-card__header">
            <h3 className="section-title">Estrutura base</h3>
            <span className="status-badge status-badge--active">Ativo</span>
          </header>
          <div className="settings-bento-card__content">
            <div className="settings-chip-list mb-4" aria-label="Resumo da estrutura base">
              <span className="settings-chip">{accountsCount} conta(s)</span>
              <span className="settings-chip">{cardsCount} cartão(ões)</span>
            </div>
            <div className="settings-action-row flex-wrap gap-2">
              <button className="secondary-button" onClick={onOpenAccounts} type="button">
                Contas
              </button>
              <button className="secondary-button" onClick={onOpenCards} type="button">
                Cartões
              </button>
            </div>
          </div>
        </article>

        <article className="settings-bento-card settings-bento-card--medium">
          <header className="settings-bento-card__header">
            <h3 className="section-title">Categorias</h3>
            <span className="status-badge status-badge--active">Editável</span>
          </header>
          <div className="settings-bento-card__content">
            <form className="settings-inline-form flex gap-2 mb-3" onSubmit={handleCreateCategorySubmit}>
              <input
                aria-label="Nova categoria"
                className="flex-1"
                onChange={(event) => {
                  setNewCategoryLabel(event.target.value);
                  setCategoryFeedback(null);
                }}
                placeholder="Adicionar categoria..."
                value={newCategoryLabel}
              />
              <button className="primary-button p-2" type="submit" title="Adicionar">
                <span>+</span>
              </button>
            </form>
            
            <div className="settings-scroll-area max-h-[160px] overflow-y-auto pr-1">
              {categories.length > 0 ? (
                <div className="settings-token-grid" aria-label="Lista de categorias">
                  {categories.map((category) => (
                    <div key={category.value} className="settings-token-card py-1 px-2 text-xs">
                      <strong className="truncate">{category.label}</strong>
                      <button
                        className="ghost-button p-1 ml-1"
                        onClick={() => onRemoveCategory(category.value)}
                        type="button"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </article>

        <article className="settings-bento-card settings-bento-card--small">
          <header className="settings-bento-card__header text-xs">
            <h3 className="section-title">Utilitários</h3>
          </header>
          <div className="settings-bento-card__content">
            <div className="mb-4">
              <button className="secondary-button w-full text-xs py-2" onClick={onExportBackup} type="button">
                Backup JSON
              </button>
            </div>

            <ul className="settings-inline-list space-y-1">
              {PRODUCTIVITY_SHORTCUTS.map((shortcut) => (
                <li key={shortcut} className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                  {shortcut}
                </li>
              ))}
            </ul>
          </div>
        </article>

        <section className="settings-danger-zone-wrapper">
          <button
            aria-controls="settings-danger-zone"
            aria-expanded={isDangerZoneOpen}
            className="settings-danger-toggle flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
            onClick={() => setIsDangerZoneOpen((current) => !current)}
            type="button"
          >
            Zona de perigo
          </button>

          {isDangerZoneOpen ? (
            <div id="settings-danger-zone" className="settings-danger-card mt-2 p-3 border-red-100 bg-red-50/30">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-red-900/60">
                  Apagar permanentemente todos os dados locais.
                </p>
                <button
                  className="ghost-button ghost-button--danger py-1 px-3 text-xs"
                  disabled={isSubmitting}
                  onClick={() => {
                    void onResetApplicationData();
                  }}
                  type="button"
                >
                  Zerar tudo
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
