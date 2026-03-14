import {
  checkForAppUpdate,
  getAutostartEnabled,
  installAppUpdate,
  isTauriEnvironment,
  listenDesktopEvent,
  setAutostartEnabled,
} from "./desktop";

const invokeMock = vi.fn();
const listenMock = vi.fn();
const unlistenMock = vi.fn();
const getCurrentWindowMock = vi.fn();
const getVersionMock = vi.fn();
const checkMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: () => getVersionMock(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => getCurrentWindowMock(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => checkMock(),
}));

describe("desktop bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    unlistenMock.mockReset();
    getCurrentWindowMock.mockReset();
    getVersionMock.mockReset();
    checkMock.mockReset();
    delete (window as { __TAURI__?: unknown }).__TAURI__;
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("detects tauri runtime only when markers exist", () => {
    expect(isTauriEnvironment()).toBe(false);
    (window as { __TAURI__?: unknown }).__TAURI__ = {};
    expect(isTauriEnvironment()).toBe(true);
  });

  it("does not call tauri invoke outside tauri runtime", async () => {
    await expect(getAutostartEnabled()).resolves.toBe(false);
    await expect(setAutostartEnabled(true)).resolves.toBeUndefined();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("skips updater checks outside tauri runtime", async () => {
    await expect(checkForAppUpdate()).resolves.toEqual({
      supported: false,
      isAvailable: false,
      update: {
        currentVersion: "",
        availableVersion: null,
        publishedAt: null,
        notes: null,
      },
    });

    await expect(installAppUpdate()).resolves.toBeUndefined();
    expect(checkMock).not.toHaveBeenCalled();
  });

  it("uses invoke for autostart commands in tauri runtime", async () => {
    (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValueOnce(true).mockResolvedValueOnce(undefined);

    await expect(getAutostartEnabled()).resolves.toBe(true);
    await expect(setAutostartEnabled(false)).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "get_autostart_enabled");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "set_autostart_enabled", {
      enabled: false,
    });
  });

  it("returns updater metadata when a desktop update is available", async () => {
    (window as { __TAURI__?: unknown }).__TAURI__ = {};
    getVersionMock.mockResolvedValue("0.1.0");
    const closeMock = vi.fn().mockResolvedValue(undefined);
    checkMock.mockResolvedValue({
      currentVersion: "0.1.0",
      version: "0.2.0",
      date: "2026-03-14T12:00:00Z",
      body: "Melhorias gerais",
      close: closeMock,
      downloadAndInstall: vi.fn(),
    });

    await expect(checkForAppUpdate()).resolves.toEqual({
      supported: true,
      isAvailable: true,
      update: {
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
        publishedAt: "2026-03-14T12:00:00Z",
        notes: "Melhorias gerais",
      },
    });
  });

  it("downloads and installs the cached update while reporting progress", async () => {
    (window as { __TAURI__?: unknown }).__TAURI__ = {};
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const downloadAndInstallMock = vi
      .fn()
      .mockImplementation(
        async (
          onEvent?: (event: {
            event: "Started" | "Progress" | "Finished";
            data?: { contentLength?: number; chunkLength?: number };
          }) => void,
        ) => {
          onEvent?.({ event: "Started", data: { contentLength: 100 } });
          onEvent?.({ event: "Progress", data: { chunkLength: 40 } });
          onEvent?.({ event: "Progress", data: { chunkLength: 60 } });
          onEvent?.({ event: "Finished" });
        },
      );

    getVersionMock.mockResolvedValue("0.1.0");
    checkMock.mockResolvedValue({
      currentVersion: "0.1.0",
      version: "0.2.0",
      close: closeMock,
      downloadAndInstall: downloadAndInstallMock,
    });

    await checkForAppUpdate();

    const progressHandler = vi.fn();
    await installAppUpdate(progressHandler);

    expect(downloadAndInstallMock).toHaveBeenCalledTimes(1);
    expect(progressHandler).toHaveBeenNthCalledWith(1, {
      downloadedBytes: 0,
      totalBytes: 100,
      percent: 0,
      stage: "starting",
    });
    expect(progressHandler).toHaveBeenNthCalledWith(2, {
      downloadedBytes: 40,
      totalBytes: 100,
      percent: 40,
      stage: "downloading",
    });
    expect(progressHandler).toHaveBeenNthCalledWith(3, {
      downloadedBytes: 100,
      totalBytes: 100,
      percent: 100,
      stage: "downloading",
    });
    expect(progressHandler).toHaveBeenNthCalledWith(4, {
      downloadedBytes: 100,
      totalBytes: 100,
      percent: 100,
      stage: "installing",
    });
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("registers and unregisters desktop events in tauri runtime", async () => {
    (window as { __TAURI__?: unknown }).__TAURI__ = {};
    listenMock.mockResolvedValue(unlistenMock);
    getCurrentWindowMock.mockReturnValue({
      listen: (...args: unknown[]) => listenMock(...args),
    });
    const handler = vi.fn();

    const unsubscribe = await listenDesktopEvent("desktop://lock", handler);
    expect(getCurrentWindowMock).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock.mock.calls[0]?.[0]).toBe("desktop://lock");

    const callback = listenMock.mock.calls[0]?.[1] as (() => void) | undefined;
    callback?.();
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });
});
