import { useState } from "react";
import { Download, Keyboard, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";

type SettingsViewProps = {
  isSubmitting: boolean;
  onExportBackup: () => void;
  onResetApplicationData: () => Promise<void>;
};

const PRODUCTIVITY_SHORTCUTS = [
  { keys: "Ctrl+N", description: "Abre o modal de lançamento" },
  { keys: "Ctrl+K", description: "Abre a command palette" },
  { keys: "Tab / Shift+Tab", description: "Navega entre campos do modal" },
] as const;

export function SettingsView({
  isSubmitting,
  onExportBackup,
  onResetApplicationData,
}: SettingsViewProps) {
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    try {
      await onResetApplicationData();
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="screen-stack settings-screen mx-auto max-w-[680px]">
      <div className="settings-panel-stack">

        {/* ── Dados e backup ── */}
        <section className="settings-section" aria-labelledby="settings-data-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-data-heading" className="settings-section__title">
                Dados e backup
              </h3>
            </div>
            <p className="settings-section__description">
              Exporte um snapshot completo dos seus dados em formato JSON. Útil como cópia de segurança antes de qualquer alteração.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-action-row">
              <div className="settings-action-item">
                <div>
                  <p className="settings-action-item__label">Exportar backup</p>
                  <p className="settings-action-item__hint">
                    Inclui contas, cartões, transações e faturas.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onExportBackup}
                  disabled={isSubmitting}
                  className="shrink-0"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Exportar JSON
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        {/* ── Produtividade ── */}
        <section className="settings-section" aria-labelledby="settings-shortcuts-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-shortcuts-heading" className="settings-section__title">
                Produtividade
              </h3>
            </div>
            <p className="settings-section__description">
              Atalhos de teclado disponíveis na aplicação.
            </p>
          </header>
          <div className="settings-section__body">
            <ul className="settings-shortcuts-list" aria-label="Atalhos de teclado">
              {PRODUCTIVITY_SHORTCUTS.map((shortcut) => (
                <li key={shortcut.keys} className="settings-shortcut-item">
                  <kbd className="settings-shortcut-kbd">{shortcut.keys}</kbd>
                  <span className="settings-shortcut-description">{shortcut.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Separator />

        {/* ── Zona de perigo ── */}
        <section className="settings-section settings-section--danger" aria-labelledby="settings-danger-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
              <h3 id="settings-danger-heading" className="settings-section__title settings-section__title--danger">
                Zona de perigo
              </h3>
            </div>
            <p className="settings-section__description">
              Ações irreversíveis que afetam os dados da aplicação.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-danger-action-card">
              <div className="settings-danger-action-card__content">
                <p className="settings-danger-action-card__label">Apagar todos os dados</p>
                <p className="settings-danger-action-card__hint">
                  Remove permanentemente todas as transações, contas, cartões e faturas do servidor.
                  Categorias personalizadas são preservadas (armazenadas localmente).
                  Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="settings-danger-action-card__actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onExportBackup}
                  disabled={isSubmitting || isResetting}
                  className="shrink-0 text-xs"
                >
                  Exportar antes
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isSubmitting || isResetting}
                  onClick={() => {
                    void handleReset();
                  }}
                  className="shrink-0"
                >
                  Zerar tudo
                </Button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
