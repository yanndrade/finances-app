export type DesktopEventName = "desktop://quick-add" | "desktop://lock";

export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return (
    typeof tauriWindow.__TAURI__ !== "undefined" ||
    typeof tauriWindow.__TAURI_INTERNALS__ !== "undefined"
  );
}

export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("get_autostart_enabled");
}

export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_autostart_enabled", { enabled });
}

export async function listenDesktopEvent(
  eventName: DesktopEventName,
  handler: () => void,
): Promise<() => void> {
  if (!isTauriEnvironment()) {
    return () => {};
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const currentWindow = getCurrentWindow();
  const unlisten = await currentWindow.listen(eventName, () => {
    handler();
  });
  return () => {
    unlisten();
  };
}
