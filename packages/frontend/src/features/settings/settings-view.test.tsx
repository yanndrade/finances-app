import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { SettingsView } from "./settings-view";

function renderSettingsView(overrides?: Partial<ComponentProps<typeof SettingsView>>) {
  return render(
    <SettingsView
      isSubmitting={false}
      themeColor="#831bb0"
      darkMode={false}
      investmentGoalPercent={10}
      onExportBackup={vi.fn()}
      onResetApplicationData={vi.fn(() => Promise.resolve())}
      onThemeColorChange={vi.fn()}
      onDarkModeChange={vi.fn()}
      onInvestmentGoalPercentChange={vi.fn()}
      securityState={{
        password_configured: true,
        is_locked: false,
        requires_lock_on_startup: true,
        inactivity_lock_seconds: null,
      }}
      desktopAutostartEnabled={false}
      desktopAutostartLoading={false}
      desktopUpdateSupported={true}
      desktopUpdateChecking={false}
      desktopUpdateVersion="0.1.0"
      desktopUpdateAvailableVersion={null}
      desktopUpdatePublishedAt={null}
      desktopUpdateNotes={null}
      desktopUpdateInstallState="idle"
      desktopUpdateProgressPercent={null}
      onSetDesktopAutostart={vi.fn(() => Promise.resolve())}
      onCheckDesktopUpdate={vi.fn(() => Promise.resolve())}
      onInstallDesktopUpdate={vi.fn(() => Promise.resolve())}
      onSetSecurityPassword={vi.fn(() => Promise.resolve())}
      onUnlock={vi.fn(() => Promise.resolve())}
      onLock={vi.fn(() => Promise.resolve())}
      lanSecurityState={{
        enabled: false,
        pair_token_ttl_seconds: 300,
        local_ip: "192.168.50.2",
        subnet_cidr: "192.168.50.0/24",
        public_url: "http://192.168.50.2:8000",
        public_scheme: "http",
      }}
      lanPairingSession={null}
      authorizedLanDevices={[]}
      onSetLanEnabled={vi.fn(() => Promise.resolve())}
      onGenerateLanPairToken={vi.fn(() => Promise.resolve())}
      onRevokeLanDevice={vi.fn(() => Promise.resolve())}
      {...overrides}
    />,
  );
}

describe("SettingsView", () => {
  it("renders data and backup section with export action", async () => {
    const onExportBackup = vi.fn();
    renderSettingsView({ onExportBackup });

    expect(screen.getByText(/dados e backup/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /exportar json/i }));
    expect(onExportBackup).toHaveBeenCalledTimes(1);
  });

  it("renders productivity shortcuts section", () => {
    renderSettingsView();
    expect(screen.getByText(/produtividade/i)).toBeInTheDocument();
    expect(screen.getByText(/ctrl\+n/i)).toBeInTheDocument();
    expect(screen.getByText(/ctrl\+k/i)).toBeInTheDocument();
  });

  it("allows changing the primary theme color", async () => {
    const onThemeColorChange = vi.fn();
    renderSettingsView({ onThemeColorChange });

    await userEvent.click(screen.getByRole("listitem", { name: /verde petr/i }));
    expect(onThemeColorChange).toHaveBeenCalledWith("#0f766e");
  });

  it("allows updating the investment goal percent", async () => {
    const onInvestmentGoalPercentChange = vi.fn();
    renderSettingsView({ onInvestmentGoalPercentChange });

    await userEvent.clear(screen.getByLabelText(/percentual da receita/i));
    await userEvent.type(screen.getByLabelText(/percentual da receita/i), "15");
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(onInvestmentGoalPercentChange).toHaveBeenCalledWith(15);
  });

  it("restores the default investment goal percent", async () => {
    const onInvestmentGoalPercentChange = vi.fn();
    renderSettingsView({
      investmentGoalPercent: 25,
      onInvestmentGoalPercentChange,
    });

    await userEvent.click(screen.getByRole("button", { name: /restaurar 10%/i }));

    expect(onInvestmentGoalPercentChange).toHaveBeenCalledWith(10);
    expect(screen.getByLabelText(/percentual da receita/i)).toHaveValue(10);
  });

  it("renders desktop section and toggles autostart", async () => {
    const onSetDesktopAutostart = vi.fn(() => Promise.resolve());
    renderSettingsView({ onSetDesktopAutostart, desktopAutostartEnabled: false });

    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^ativar$/i }));
    expect(onSetDesktopAutostart).toHaveBeenCalledWith(true);
  });

  it("renders lan section and toggles lan access", async () => {
    const onSetLanEnabled = vi.fn(() => Promise.resolve());
    renderSettingsView({ onSetLanEnabled });

    expect(screen.getByText(/acesso lan/i)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /ativar lan/i }),
    );
    expect(onSetLanEnabled).toHaveBeenCalledWith(true);
  });

  it("generates pair token when lan is enabled", async () => {
    const onGenerateLanPairToken = vi.fn(() => Promise.resolve());
    renderSettingsView({
      onGenerateLanPairToken,
      lanSecurityState: {
        enabled: true,
        pair_token_ttl_seconds: 300,
        local_ip: "192.168.50.2",
        subnet_cidr: "192.168.50.0/24",
        public_url: "http://192.168.50.2:8000",
        public_scheme: "http",
      },
    });

    await userEvent.click(screen.getByRole("button", { name: /gerar qr/i }));
    expect(onGenerateLanPairToken).toHaveBeenCalledTimes(1);
  });

  it("renders security section and sets password", async () => {
    const onSetSecurityPassword = vi.fn(() => Promise.resolve());
    renderSettingsView({ onSetSecurityPassword });

    await userEvent.type(screen.getByLabelText(/nova senha/i), "secret-123");
    await userEvent.click(screen.getByRole("button", { name: /definir senha/i }));
    expect(onSetSecurityPassword).toHaveBeenCalledWith("secret-123");
  });

  it("renders unlock controls when state is locked", async () => {
    const onUnlock = vi.fn(() => Promise.resolve());
    renderSettingsView({
      onUnlock,
      securityState: {
        password_configured: true,
        is_locked: true,
        requires_lock_on_startup: true,
        inactivity_lock_seconds: 300,
      },
    });

    await userEvent.type(
      screen.getByLabelText(/senha para desbloquear/i),
      "secret-123",
    );
    await userEvent.click(screen.getByRole("button", { name: /desbloquear/i }));
    expect(onUnlock).toHaveBeenCalledWith("secret-123");
  });

  it("renders danger zone with reset action", async () => {
    const onResetApplicationData = vi.fn(() => Promise.resolve());
    renderSettingsView({ onResetApplicationData });

    await userEvent.click(screen.getByRole("button", { name: /zerar tudo/i }));
    expect(onResetApplicationData).toHaveBeenCalledTimes(1);
  });

  it("disables destructive actions while submitting", () => {
    renderSettingsView({ isSubmitting: true });
    expect(screen.getByRole("button", { name: /zerar tudo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /exportar json/i })).toBeDisabled();
  });

  it("renders dark mode toggle and calls onDarkModeChange when clicked", async () => {
    const onDarkModeChange = vi.fn();
    renderSettingsView({ onDarkModeChange, darkMode: false });

    const toggleBtn = screen.getByRole("button", { name: /escuro/i });
    expect(toggleBtn).toBeInTheDocument();
    await userEvent.click(toggleBtn);
    expect(onDarkModeChange).toHaveBeenCalledWith(true);
  });
});
