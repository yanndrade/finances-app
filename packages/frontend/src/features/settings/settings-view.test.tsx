import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { SettingsView } from "./settings-view";

function renderSettingsView(overrides?: Partial<ComponentProps<typeof SettingsView>>) {
  return render(
    <SettingsView
      isSubmitting={false}
      onExportBackup={vi.fn()}
      onResetApplicationData={vi.fn(() => Promise.resolve())}
      securityState={{
        password_configured: true,
        is_locked: false,
        requires_lock_on_startup: true,
        inactivity_lock_seconds: null,
      }}
      desktopAutostartEnabled={false}
      desktopAutostartLoading={false}
      onSetDesktopAutostart={vi.fn(() => Promise.resolve())}
      onSetSecurityPassword={vi.fn(() => Promise.resolve())}
      onUnlock={vi.fn(() => Promise.resolve())}
      onLock={vi.fn(() => Promise.resolve())}
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

  it("renders desktop section and toggles autostart", async () => {
    const onSetDesktopAutostart = vi.fn(() => Promise.resolve());
    renderSettingsView({ onSetDesktopAutostart, desktopAutostartEnabled: false });

    expect(screen.getByText(/desktop/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /ativar/i }));
    expect(onSetDesktopAutostart).toHaveBeenCalledWith(true);
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
});
