import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePwaInstall } from "./use-pwa-install";

let mockNeedRefresh = false;
let mockOfflineReady = false;
const mockSetNeedRefresh = vi.fn();
const mockSetOfflineReady = vi.fn();
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/pwa-register", () => ({
  useRegisterSW: vi.fn(() => ({
    needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
    offlineReady: [mockOfflineReady, mockSetOfflineReady],
    updateServiceWorker: mockUpdateServiceWorker,
  })),
}));

function createInstallPromptEvent(
  outcome: "accepted" | "dismissed" = "accepted",
) {
  return Object.assign(new Event("beforeinstallprompt"), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" } as const),
  }) as BeforeInstallPromptEvent;
}

describe("usePwaInstall", () => {
  const originalServiceWorker = (navigator as Navigator & { serviceWorker?: unknown }).serviceWorker;

  beforeEach(() => {
    mockNeedRefresh = false;
    mockOfflineReady = false;
    mockSetNeedRefresh.mockReset();
    mockSetOfflineReady.mockReset();
    mockUpdateServiceWorker.mockReset().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalServiceWorker === undefined) {
      Reflect.deleteProperty(navigator, "serviceWorker");
      return;
    }

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalServiceWorker,
    });
  });

  it("arranca sem prompt de instalação", () => {
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.updateAvailable).toBe(false);
  });

  it("ativa o estado instalável após beforeinstallprompt", () => {
    const event = createInstallPromptEvent("accepted");
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.isInstallable).toBe(true);
  });

  it("instala com sucesso quando o utilizador aceita", async () => {
    const event = createInstallPromptEvent("accepted");
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.installPwa();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(true);
  });

  it("mantém o prompt disponível quando o utilizador rejeita", async () => {
    const event = createInstallPromptEvent("dismissed");
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.installPwa();
    });

    expect(event.prompt).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(true);
    expect(result.current.isInstalled).toBe(false);
  });

  it("dispensa o prompt manualmente", () => {
    const event = createInstallPromptEvent("accepted");
    const { result } = renderHook(() => usePwaInstall());

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.isInstallable).toBe(true);

    act(() => {
      result.current.dismissInstallPrompt();
    });

    expect(result.current.isInstallable).toBe(false);
  });

  it("aplica atualização pendente via vite-plugin-pwa", async () => {
    mockNeedRefresh = true;
    const { result } = renderHook(() => usePwaInstall());

    await act(async () => {
      const applied = await result.current.applyUpdate();
      expect(applied).toBe(true);
    });

    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
    expect(mockSetOfflineReady).toHaveBeenCalledWith(false);
  });
});
