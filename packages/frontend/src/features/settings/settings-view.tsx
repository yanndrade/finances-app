import { useState } from "react";
import {
  AlertTriangle,
  Download,
  Keyboard,
  Laptop,
  ShieldCheck,
} from "lucide-react";

import type { SecurityState } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";

type SettingsViewProps = {
  isSubmitting: boolean;
  onExportBackup: () => void;
  onResetApplicationData: () => Promise<void>;
  securityState: SecurityState | null;
  desktopAutostartEnabled: boolean;
  desktopAutostartLoading: boolean;
  onSetDesktopAutostart: (enabled: boolean) => Promise<void>;
  onSetSecurityPassword: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onLock: () => Promise<void>;
};

const PRODUCTIVITY_SHORTCUTS = [
  { keys: "Ctrl+N", description: "Abre o modal de lancamento" },
  { keys: "Ctrl+K", description: "Abre a command palette" },
  { keys: "Tab / Shift+Tab", description: "Navega entre campos do modal" },
] as const;

export function SettingsView({
  isSubmitting,
  onExportBackup,
  onResetApplicationData,
  securityState,
  desktopAutostartEnabled,
  desktopAutostartLoading,
  onSetDesktopAutostart,
  onSetSecurityPassword,
  onUnlock,
  onLock,
}: SettingsViewProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isUpdatingAutostart, setIsUpdatingAutostart] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    try {
      await onResetApplicationData();
    } finally {
      setIsResetting(false);
    }
  }

  async function handleToggleAutostart() {
    setIsUpdatingAutostart(true);
    try {
      await onSetDesktopAutostart(!desktopAutostartEnabled);
    } finally {
      setIsUpdatingAutostart(false);
    }
  }

  async function handleSetPassword() {
    if (!passwordInput.trim()) {
      return;
    }

    setIsSettingPassword(true);
    try {
      await onSetSecurityPassword(passwordInput.trim());
      setPasswordInput("");
    } finally {
      setIsSettingPassword(false);
    }
  }

  async function handleUnlock() {
    if (!unlockInput.trim()) {
      return;
    }

    setIsUnlocking(true);
    try {
      await onUnlock(unlockInput.trim());
      setUnlockInput("");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleLock() {
    setIsLocking(true);
    try {
      await onLock();
    } finally {
      setIsLocking(false);
    }
  }

  return (
    <div className="screen-stack settings-screen mx-auto max-w-[680px]">
      <div className="settings-panel-stack">
        <section className="settings-section" aria-labelledby="settings-data-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-data-heading" className="settings-section__title">
                Dados e backup
              </h3>
            </div>
            <p className="settings-section__description">
              Exporte um snapshot completo dos seus dados em formato JSON.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-action-row">
              <div className="settings-action-item">
                <div>
                  <p className="settings-action-item__label">Exportar backup</p>
                  <p className="settings-action-item__hint">
                    Inclui contas, cartoes, transacoes e faturas.
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

        <section className="settings-section" aria-labelledby="settings-shortcuts-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-shortcuts-heading" className="settings-section__title">
                Produtividade
              </h3>
            </div>
            <p className="settings-section__description">
              Atalhos de teclado disponiveis na aplicacao.
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

        <section className="settings-section" aria-labelledby="settings-desktop-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-desktop-heading" className="settings-section__title">
                Desktop
              </h3>
            </div>
            <p className="settings-section__description">
              Controle de inicializacao automatica no Windows.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-action-item">
              <div>
                <p className="settings-action-item__label">Iniciar com o Windows</p>
                <p className="settings-action-item__hint">
                  Status atual: {desktopAutostartEnabled ? "Ativado" : "Desativado"}
                </p>
              </div>
              <Button
                type="button"
                variant={desktopAutostartEnabled ? "outline" : "secondary"}
                size="sm"
                onClick={() => {
                  void handleToggleAutostart();
                }}
                disabled={desktopAutostartLoading || isUpdatingAutostart}
                className="shrink-0"
              >
                {desktopAutostartEnabled ? "Desativar" : "Ativar"}
              </Button>
            </div>
          </div>
        </section>

        <Separator />

        <section className="settings-section" aria-labelledby="settings-security-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-security-heading" className="settings-section__title">
                Seguranca
              </h3>
            </div>
            <p className="settings-section__description">
              Defina uma senha para bloquear e desbloquear a aplicacao.
            </p>
          </header>
          <div className="settings-section__body space-y-3">
            <div className="settings-action-item">
              <div>
                <p className="settings-action-item__label">Estado de bloqueio</p>
                <p className="settings-action-item__hint">
                  {securityState?.is_locked ? "Bloqueado" : "Desbloqueado"}
                  {" - "}
                  {securityState?.password_configured ? "Senha configurada" : "Sem senha"}
                </p>
              </div>
              {securityState?.password_configured ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleLock();
                  }}
                  disabled={isLocking}
                  className="shrink-0"
                >
                  Bloquear agora
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Nova senha"
                type="password"
                placeholder="Nova senha"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void handleSetPassword();
                }}
                disabled={isSettingPassword || !passwordInput.trim()}
              >
                Definir senha
              </Button>
            </div>

            {securityState?.is_locked ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label="Senha para desbloquear"
                  type="password"
                  placeholder="Senha para desbloquear"
                  value={unlockInput}
                  onChange={(event) => setUnlockInput(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => {
                    void handleUnlock();
                  }}
                  disabled={isUnlocking || !unlockInput.trim()}
                >
                  Desbloquear
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="settings-section settings-section--danger" aria-labelledby="settings-danger-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
              <h3 id="settings-danger-heading" className="settings-section__title settings-section__title--danger">
                Zona de perigo
              </h3>
            </div>
            <p className="settings-section__description">
              Acoes irreversiveis que afetam os dados da aplicacao.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-danger-action-card">
              <div className="settings-danger-action-card__content">
                <p className="settings-danger-action-card__label">Apagar todos os dados</p>
                <p className="settings-danger-action-card__hint">
                  Remove permanentemente transacoes, contas, cartoes e faturas do servidor.
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
