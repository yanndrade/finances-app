import {
  getAutostartEnabled,
  isTauriEnvironment,
  listenDesktopEvent,
  setAutostartEnabled,
} from "./desktop";

const invokeMock = vi.fn();
const listenMock = vi.fn();
const unlistenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(...args),
}));

describe("desktop bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    unlistenMock.mockReset();
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

  it("registers and unregisters desktop events in tauri runtime", async () => {
    (window as { __TAURI__?: unknown }).__TAURI__ = {};
    listenMock.mockResolvedValue(unlistenMock);
    const handler = vi.fn();

    const unsubscribe = await listenDesktopEvent("desktop://lock", handler);
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(listenMock.mock.calls[0]?.[0]).toBe("desktop://lock");

    const callback = listenMock.mock.calls[0]?.[1] as (() => void) | undefined;
    callback?.();
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });
});
