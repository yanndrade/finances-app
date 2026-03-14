export type DesktopEventName = "desktop://quick-add" | "desktop://lock";

export type DesktopUpdateInfo = {
  currentVersion: string;
  availableVersion: string | null;
  publishedAt: string | null;
  notes: string | null;
};

export type DesktopUpdateCheckResult = {
  supported: boolean;
  update: DesktopUpdateInfo;
  isAvailable: boolean;
};

export type DesktopUpdateProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  stage: "starting" | "downloading" | "installing";
};

type CachedUpdater = {
  close: () => Promise<void>;
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall: (
    onEvent?: (event: {
      event: "Started" | "Progress" | "Finished";
      data?: { contentLength?: number; chunkLength?: number };
    }) => void,
  ) => Promise<void>;
};

let cachedUpdater: CachedUpdater | null = null;

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

export async function checkForAppUpdate(): Promise<DesktopUpdateCheckResult> {
  if (!isTauriEnvironment()) {
    return {
      supported: false,
      isAvailable: false,
      update: {
        currentVersion: "",
        availableVersion: null,
        publishedAt: null,
        notes: null,
      },
    };
  }

  const [{ getVersion }, { check }] = await Promise.all([
    import("@tauri-apps/api/app"),
    import("@tauri-apps/plugin-updater"),
  ]);
  const [currentVersion, update] = await Promise.all([getVersion(), check()]);

  if (!update) {
    await clearCachedUpdater();
    return {
      supported: true,
      isAvailable: false,
      update: {
        currentVersion,
        availableVersion: null,
        publishedAt: null,
        notes: null,
      },
    };
  }

  await clearCachedUpdater();
  cachedUpdater = update;

  return {
    supported: true,
    isAvailable: true,
    update: {
      currentVersion,
      availableVersion: update.version,
      publishedAt: update.date ?? null,
      notes: update.body ?? null,
    },
  };
}

export async function installAppUpdate(
  onProgress?: (progress: DesktopUpdateProgress) => void,
): Promise<void> {
  if (!isTauriEnvironment()) {
    return;
  }

  const updater = cachedUpdater ?? (await import("@tauri-apps/plugin-updater")).check();
  const resolvedUpdater = await updater;
  if (!resolvedUpdater) {
    await clearCachedUpdater();
    return;
  }

  cachedUpdater = resolvedUpdater;

  let downloadedBytes = 0;
  let totalBytes: number | null = null;

  await resolvedUpdater.downloadAndInstall((event) => {
    if (event.event === "Started") {
      totalBytes = event.data?.contentLength ?? null;
      downloadedBytes = 0;
      onProgress?.({
        downloadedBytes,
        totalBytes,
        percent: totalBytes ? 0 : null,
        stage: "starting",
      });
      return;
    }

    if (event.event === "Progress") {
      downloadedBytes += event.data?.chunkLength ?? 0;
      onProgress?.({
        downloadedBytes,
        totalBytes,
        percent:
          totalBytes && totalBytes > 0
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : null,
        stage: "downloading",
      });
      return;
    }

    onProgress?.({
      downloadedBytes,
      totalBytes,
      percent: 100,
      stage: "installing",
    });
  });

  await clearCachedUpdater();
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

async function clearCachedUpdater(): Promise<void> {
  if (!cachedUpdater) {
    return;
  }

  const updater = cachedUpdater;
  cachedUpdater = null;
  await updater.close().catch(() => {});
}
