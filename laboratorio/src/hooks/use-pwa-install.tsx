import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "@/lib/pwa-register";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    platforms: string[];
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
    prompt(): Promise<void>;
  }
}

function getPlatformState() {
  if (typeof window === "undefined") {
    return { isIos: false, isSafari: false };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios|opr\//.test(userAgent);

  return { isIos, isSafari };
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;

  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplayMode());
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const { isIos, isSafari } = useMemo(() => getPlatformState(), []);
  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator;
  const isInstallable = Boolean(deferredPrompt) && !isInstalled;
  const showIosInstallGuide = isSupported && isIos && !isInstalled && !deferredPrompt;
  const {
    needRefresh: [updateAvailable, setUpdateAvailable],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW() {
      setRegistrationError(null);
    },
    onRegisterError(error) {
      setRegistrationError(error instanceof Error ? error.message : "Falha ao registar o PWA.");
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setRegistrationError("O PWA precisa de HTTPS ou localhost para registar o service worker.");
    }
  }, [isSupported]);

  const installPwa = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      const accepted = result.outcome === "accepted";

      if (accepted) {
        setDeferredPrompt(null);
        setIsInstalled(true);
      }

      return accepted;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  const applyUpdate = useCallback(async () => {
    if (!isSupported || !updateAvailable) {
      return false;
    }

    await updateServiceWorker(true);
    setUpdateAvailable(false);
    setOfflineReady(false);
    return true;
  }, [isSupported, setOfflineReady, setUpdateAvailable, updateAvailable, updateServiceWorker]);

  const dismissInstallPrompt = useCallback(() => {
    setDeferredPrompt(null);
  }, []);

  return useMemo(() => ({
    isSupported,
    isInstalled,
    isInstallable,
    isIos,
    isSafari,
    showIosInstallGuide,
    updateAvailable,
    offlineReady,
    registrationError,
    installPwa,
    applyUpdate,
    dismissInstallPrompt,
  }), [
    applyUpdate,
    dismissInstallPrompt,
    installPwa,
    isInstallable,
    isInstalled,
    isIos,
    isSafari,
    isSupported,
    offlineReady,
    registrationError,
    showIosInstallGuide,
    updateAvailable,
  ]);
}
