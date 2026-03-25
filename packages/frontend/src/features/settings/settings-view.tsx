import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Moon,
  Palette,
  Sun,
  Download,
  Keyboard,
  Laptop,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Target,
  Wifi,
} from "lucide-react";
import { toString as toQrSvgString } from "qrcode";

import type {
  AuthorizedLanDevice,
  LanPairTokenSession,
  LanSecurityState,
  SecurityState,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Separator } from "../../components/ui/separator";
import {
  DEFAULT_INVESTMENT_GOAL_PERCENT,
  normalizeInvestmentGoalPercent,
} from "../../lib/investment-goal-settings";
import {
  normalizeThemeColor,
  THEME_PRESET_OPTIONS,
} from "../../lib/theme";

type SettingsViewProps = {
  isSubmitting: boolean;
  themeColor: string;
  darkMode: boolean;
  investmentGoalPercent: number;
  onExportBackup: () => void;
  onResetApplicationData: () => Promise<void>;
  onThemeColorChange: (color: string) => void;
  onDarkModeChange: (isDark: boolean) => void;
  onInvestmentGoalPercentChange: (percent: number) => void;
  securityState: SecurityState | null;
  desktopAutostartEnabled: boolean;
  desktopAutostartLoading: boolean;
  desktopUpdateSupported: boolean;
  desktopUpdateChecking: boolean;
  desktopUpdateVersion: string | null;
  desktopUpdateAvailableVersion: string | null;
  desktopUpdatePublishedAt: string | null;
  desktopUpdateNotes: string | null;
  desktopUpdateInstallState: "idle" | "downloading" | "installing";
  desktopUpdateProgressPercent: number | null;
  onSetDesktopAutostart: (enabled: boolean) => Promise<void>;
  onCheckDesktopUpdate: () => Promise<void>;
  onInstallDesktopUpdate: () => Promise<void>;
  onSetSecurityPassword: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onLock: () => Promise<void>;
  lanSecurityState: LanSecurityState | null;
  lanPairingSession: LanPairTokenSession | null;
  authorizedLanDevices: AuthorizedLanDevice[];
  onSetLanEnabled: (enabled: boolean) => Promise<void>;
  onGenerateLanPairToken: () => Promise<void>;
  onRevokeLanDevice: (deviceId: string) => Promise<void>;
};

const PRODUCTIVITY_SHORTCUTS = [
  { keys: "Ctrl+N", description: "Abre o modal de lancamento" },
  { keys: "Ctrl+K", description: "Abre a command palette" },
  { keys: "Tab / Shift+Tab", description: "Navega entre campos do modal" },
] as const;

export function SettingsView({
  isSubmitting,
  themeColor,
  darkMode,
  investmentGoalPercent,
  onExportBackup,
  onResetApplicationData,
  onThemeColorChange,
  onDarkModeChange,
  onInvestmentGoalPercentChange,
  securityState,
  desktopAutostartEnabled,
  desktopAutostartLoading,
  desktopUpdateSupported,
  desktopUpdateChecking,
  desktopUpdateVersion,
  desktopUpdateAvailableVersion,
  desktopUpdatePublishedAt,
  desktopUpdateNotes,
  desktopUpdateInstallState,
  desktopUpdateProgressPercent,
  onSetDesktopAutostart,
  onCheckDesktopUpdate,
  onInstallDesktopUpdate,
  onSetSecurityPassword,
  onUnlock,
  onLock,
  lanSecurityState,
  lanPairingSession,
  authorizedLanDevices,
  onSetLanEnabled,
  onGenerateLanPairToken,
  onRevokeLanDevice,
}: SettingsViewProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockInput, setUnlockInput] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isUpdatingAutostart, setIsUpdatingAutostart] = useState(false);
  const [isTriggeringUpdateCheck, setIsTriggeringUpdateCheck] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isUpdatingLan, setIsUpdatingLan] = useState(false);
  const [isGeneratingPairToken, setIsGeneratingPairToken] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [pairingQrDataUrl, setPairingQrDataUrl] = useState<string | null>(null);
  const [investmentGoalPercentInput, setInvestmentGoalPercentInput] = useState(
    String(investmentGoalPercent),
  );
  const normalizedThemeColor = normalizeThemeColor(themeColor);
  const isDesktopUpdateBusy =
    desktopUpdateChecking ||
    isTriggeringUpdateCheck ||
    isInstallingUpdate ||
    desktopUpdateInstallState !== "idle";
  const desktopUpdateSummary = !desktopUpdateSupported
    ? "Disponivel apenas no app desktop instalado."
    : desktopUpdateInstallState === "downloading"
      ? desktopUpdateProgressPercent === null
        ? "Baixando atualizacao..."
        : `Baixando atualizacao... ${desktopUpdateProgressPercent}%`
      : desktopUpdateInstallState === "installing"
        ? "Instalando atualizacao..."
        : desktopUpdateAvailableVersion
          ? `Versao ${desktopUpdateAvailableVersion} disponivel. Atual: ${desktopUpdateVersion ?? "-"}`
          : desktopUpdateVersion
            ? `Versao atual: ${desktopUpdateVersion}`
            : "Verifique se existe uma nova versao disponivel.";

  useEffect(() => {
    setInvestmentGoalPercentInput(String(investmentGoalPercent));
  }, [investmentGoalPercent]);

  useEffect(() => {
    let active = true;
    if (!lanPairingSession) {
      setPairingQrDataUrl(null);
      return () => {
        active = false;
      };
    }

    void toQrSvgString(lanPairingSession.pairing_url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((svgMarkup) => {
        if (!active) {
          return;
        }
        const dataUrl =
          "data:image/svg+xml;utf8," + encodeURIComponent(svgMarkup);
        setPairingQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) {
          setPairingQrDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [lanPairingSession]);

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

  async function handleCheckDesktopUpdate() {
    setIsTriggeringUpdateCheck(true);
    try {
      await onCheckDesktopUpdate();
    } finally {
      setIsTriggeringUpdateCheck(false);
    }
  }

  async function handleInstallDesktopUpdate() {
    setIsInstallingUpdate(true);
    try {
      await onInstallDesktopUpdate();
    } finally {
      setIsInstallingUpdate(false);
    }
  }

  async function handleToggleLan() {
    if (!lanSecurityState) {
      return;
    }
    setIsUpdatingLan(true);
    try {
      await onSetLanEnabled(!lanSecurityState.enabled);
    } finally {
      setIsUpdatingLan(false);
    }
  }

  async function handleGeneratePairToken() {
    setIsGeneratingPairToken(true);
    try {
      await onGenerateLanPairToken();
    } finally {
      setIsGeneratingPairToken(false);
    }
  }

  async function handleRevokeDevice(deviceId: string) {
    setRevokingDeviceId(deviceId);
    try {
      await onRevokeLanDevice(deviceId);
    } finally {
      setRevokingDeviceId(null);
    }
  }

  async function handleSetPassword() {
    if (passwordInput.trim().length < 4) {
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

  function handleSaveInvestmentGoalPercent() {
    const normalizedPercent = normalizeInvestmentGoalPercent(
      investmentGoalPercentInput,
    );
    setInvestmentGoalPercentInput(String(normalizedPercent));
    onInvestmentGoalPercentChange(normalizedPercent);
  }

  function handleResetInvestmentGoalPercent() {
    setInvestmentGoalPercentInput(String(DEFAULT_INVESTMENT_GOAL_PERCENT));
    onInvestmentGoalPercentChange(DEFAULT_INVESTMENT_GOAL_PERCENT);
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

        <section className="settings-section" aria-labelledby="settings-theme-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-theme-heading" className="settings-section__title">
                Aparencia
              </h3>
            </div>
            <p className="settings-section__description">
              Escolha a cor principal da aplicacao e salve a preferencia neste dispositivo.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-action-item">
              <div>
                <p className="settings-action-item__label">Modo escuro</p>
                <p className="settings-action-item__hint">
                  Alterna entre tema claro e escuro.
                </p>
              </div>
              <Button
                type="button"
                variant={darkMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => onDarkModeChange(!darkMode)}
                aria-pressed={darkMode}
              >
                {darkMode ? (
                  <Sun className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Moon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                )}
                {darkMode ? "Claro" : "Escuro"}
              </Button>
            </div>

            <div className="settings-theme-presets" role="list" aria-label="Paleta de cores">
              {THEME_PRESET_OPTIONS.map((option) => {
                const isActive = normalizedThemeColor === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="listitem"
                    aria-label={option.label}
                    className={`settings-theme-option${isActive ? " is-active" : ""}`}
                    onClick={() => onThemeColorChange(option.value)}
                  >
                    <span
                      aria-hidden="true"
                      className="settings-theme-option__swatch"
                      style={{ backgroundColor: option.value }}
                    />
                    <span className="settings-theme-option__content">
                      <span className="settings-theme-option__label">{option.label}</span>
                      <span className="settings-theme-option__hint">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="settings-action-item settings-action-item--stacked">
              <div>
                <p className="settings-action-item__label">Cor personalizada</p>
                <p className="settings-action-item__hint">
                  Use o seletor para definir qualquer cor principal.
                </p>
              </div>
              <div className="settings-theme-customizer">
                <label className="settings-color-picker" htmlFor="theme-color-picker">
                  <span
                    aria-hidden="true"
                    className="settings-color-picker__preview"
                    style={{ backgroundColor: normalizedThemeColor }}
                  />
                  <input
                    id="theme-color-picker"
                    aria-label="Selecionar cor principal"
                    type="color"
                    value={normalizedThemeColor}
                    onChange={(event) => onThemeColorChange(event.target.value)}
                  />
                </label>
                <Input
                  aria-label="Hex da cor principal"
                  value={normalizedThemeColor}
                  onChange={(event) => onThemeColorChange(event.target.value)}
                  placeholder="#831bb0"
                />
              </div>
            </div>
          </div>
        </section>

        <Separator />

        <section className="settings-section" aria-labelledby="settings-investment-goal-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3
                id="settings-investment-goal-heading"
                className="settings-section__title"
              >
                Meta de investimento
              </h3>
            </div>
            <p className="settings-section__description">
              Define o percentual da receita mensal usado na meta da Visao geral.
            </p>
          </header>
          <div className="settings-section__body">
            <div className="settings-action-item settings-action-item--stacked">
              <div>
                <p className="settings-action-item__label">Percentual da meta mensal</p>
                <p className="settings-action-item__hint">
                  Valor local deste dispositivo. Padrao: {DEFAULT_INVESTMENT_GOAL_PERCENT}%.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                    htmlFor="investment-goal-percent"
                  >
                    Percentual da receita
                  </label>
                  <Input
                    id="investment-goal-percent"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={investmentGoalPercentInput}
                    onChange={(event) => setInvestmentGoalPercentInput(event.target.value)}
                    onBlur={handleSaveInvestmentGoalPercent}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveInvestmentGoalPercent}
                    disabled={isSubmitting}
                  >
                    Salvar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetInvestmentGoalPercent}
                    disabled={isSubmitting}
                  >
                    Restaurar 10%
                  </Button>
                </div>
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
              Controle de inicializacao automatica e atualizacoes do app.
            </p>
          </header>
          <div className="settings-section__body space-y-3">
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

            <div className="settings-action-item">
              <div>
                <p className="settings-action-item__label">Atualizacoes do aplicativo</p>
                <p className="settings-action-item__hint">{desktopUpdateSummary}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleCheckDesktopUpdate();
                  }}
                  disabled={!desktopUpdateSupported || isDesktopUpdateBusy}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Verificar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void handleInstallDesktopUpdate();
                  }}
                  disabled={
                    !desktopUpdateSupported ||
                    !desktopUpdateAvailableVersion ||
                    isDesktopUpdateBusy
                  }
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {desktopUpdateInstallState === "idle"
                    ? "Baixar e instalar"
                    : "Instalando"}
                </Button>
              </div>
            </div>

            {desktopUpdateAvailableVersion ? (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Atualizacao pronta
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Nova versao: {desktopUpdateAvailableVersion}
                </p>
                <p className="text-xs text-muted-foreground">
                  {desktopUpdatePublishedAt
                    ? `Publicada em ${new Date(desktopUpdatePublishedAt).toLocaleString()}`
                    : "Data de publicacao indisponivel"}
                </p>
                {desktopUpdateNotes ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {desktopUpdateNotes}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <Separator />

        <section className="settings-section" aria-labelledby="settings-lan-heading">
          <header className="settings-section__header">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="settings-lan-heading" className="settings-section__title">
                Acesso LAN
              </h3>
            </div>
            <p className="settings-section__description">
              Permite acesso mobile na mesma rede com pareamento por QR e token.
            </p>
          </header>
          <div className="settings-section__body space-y-3">
            <div className="settings-action-item">
              <div>
                <p className="settings-action-item__label">Estado da rede local</p>
                <p className="settings-action-item__hint">
                  {lanSecurityState?.enabled ? "Ativo" : "Desativado"}
                  {" - "}
                  {lanSecurityState?.local_ip ?? "IP local indisponível"}
                  {lanSecurityState?.subnet_cidr
                    ? ` (${lanSecurityState.subnet_cidr})`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant={lanSecurityState?.enabled ? "outline" : "secondary"}
                size="sm"
                onClick={() => {
                  void handleToggleLan();
                }}
                disabled={isUpdatingLan || !lanSecurityState}
                className="shrink-0"
              >
                {lanSecurityState?.enabled ? "Desativar LAN" : "Ativar LAN"}
              </Button>
            </div>

            <div className="settings-action-item">
              <div>
                <p className="settings-action-item__label">Pareamento por QR</p>
                <p className="settings-action-item__hint">
                  Gere um token temporário e escaneie no celular para autorizar.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  void handleGeneratePairToken();
                }}
                disabled={
                  isGeneratingPairToken || !lanSecurityState?.enabled
                }
                className="shrink-0"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Gerar QR
              </Button>
            </div>

            {lanPairingSession ? (
              <div className="rounded-xl border border-border/60 p-3">
                <div className="flex flex-col gap-3 md:flex-row">
                  {pairingQrDataUrl ? (
                    <img
                      src={pairingQrDataUrl}
                      alt="QR para pareamento LAN"
                      className="h-36 w-36 rounded-md border border-border/60 bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-md border border-border/60 bg-muted text-[11px] text-muted-foreground">
                      QR indisponível
                    </div>
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      URL de pareamento
                    </p>
                    <p className="break-all text-xs text-foreground/90">
                      {lanPairingSession.pairing_url}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expira em: {new Date(lanPairingSession.expires_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="settings-action-item__label">Dispositivos autorizados</p>
              {authorizedLanDevices.length === 0 ? (
                <p className="settings-action-item__hint">
                  Nenhum dispositivo pareado.
                </p>
              ) : (
                <div className="space-y-2">
                  {authorizedLanDevices.map((device) => (
                    <div
                      key={device.device_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {device.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Último acesso:{" "}
                          {device.last_seen_at
                            ? new Date(device.last_seen_at).toLocaleString()
                            : "nunca"}
                          {device.last_seen_ip ? ` - ${device.last_seen_ip}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void handleRevokeDevice(device.device_id);
                        }}
                        disabled={revokingDeviceId === device.device_id}
                        className="shrink-0"
                      >
                        <Smartphone className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                        Revogar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
                minLength={4}
                maxLength={128}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void handleSetPassword();
                }}
                disabled={isSettingPassword || passwordInput.trim().length < 4}
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
                  maxLength={128}
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
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
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
