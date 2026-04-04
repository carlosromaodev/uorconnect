import { useMemo, useState } from "react";
import { Download, RefreshCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const INSTALL_DISMISS_KEY = "uor_pwa_install_dismissed";
const UPDATE_DISMISS_KEY = "uor_pwa_update_dismissed";

function readDismissedState(key: string) {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(key) === "1";
}

function persistDismissedState(key: string, value: boolean) {
  if (typeof sessionStorage === "undefined") return;
  if (!value) {
    sessionStorage.removeItem(key);
    return;
  }

  sessionStorage.setItem(key, "1");
}

export function PwaSystemBanner() {
  const {
    isSupported,
    isInstallable,
    updateAvailable,
    offlineReady,
    registrationError,
    installPwa,
    applyUpdate,
    dismissInstallPrompt,
  } = usePwaInstall();

  const [installDismissed, setInstallDismissed] = useState(() => readDismissedState(INSTALL_DISMISS_KEY));
  const [updateDismissed, setUpdateDismissed] = useState(() => readDismissedState(UPDATE_DISMISS_KEY));
  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);

  const showInstallBanner = isSupported && isInstallable && !installDismissed;
  const showUpdateBanner = isSupported && updateAvailable && !updateDismissed;
  const showReadyBanner = import.meta.env.DEV && isSupported && offlineReady && !updateAvailable && !registrationError;

  const bannerPositionClassName = useMemo(() => (
    "fixed bottom-4 left-4 right-4 z-[80] flex flex-col gap-3 md:left-auto md:right-4 md:max-w-sm"
  ), []);

  const handleDismissInstall = () => {
    setInstallDismissed(true);
    persistDismissedState(INSTALL_DISMISS_KEY, true);
    dismissInstallPrompt();
  };

  const handleDismissUpdate = () => {
    setUpdateDismissed(true);
    persistDismissedState(UPDATE_DISMISS_KEY, true);
  };

  const handleInstall = async () => {
    try {
      setInstalling(true);
      const accepted = await installPwa();

      if (accepted) {
        toast.success("Instalação iniciada com sucesso.");
        setInstallDismissed(true);
        persistDismissedState(INSTALL_DISMISS_KEY, true);
      } else {
        toast.info("A instalação foi cancelada.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar instalação do app.");
    } finally {
      setInstalling(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      const started = await applyUpdate();

      if (!started) {
        toast.info("Sem atualização pendente no momento.");
        return;
      }

      toast.success("Aplicando nova versão do app...");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao aplicar atualização.");
    } finally {
      setUpdating(false);
    }
  };

  if (!showInstallBanner && !showUpdateBanner && !showReadyBanner && !registrationError) {
    return null;
  }

  return (
    <div className={bannerPositionClassName}>
      {showUpdateBanner ? (
        <div className="rounded-2xl border border-[#0A3D62]/35 bg-[linear-gradient(135deg,rgba(10,61,98,0.96),rgba(0,184,148,0.82))] p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Atualização disponível</p>
              <p className="mt-1 text-xs leading-5 text-white/90">
                Existe uma nova versão do UOR Connect com melhorias de estabilidade e experiência offline.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissUpdate}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Dispensar aviso de atualização"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl bg-white text-[#0A3D62] hover:bg-white/90"
              onClick={() => void handleUpdate()}
              disabled={updating}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${updating ? "animate-spin" : ""}`} />
              Atualizar agora
            </Button>
          </div>
        </div>
      ) : null}

      {showInstallBanner ? (
        <div className="rounded-2xl border border-primary/40 bg-[linear-gradient(135deg,rgba(253,131,5,0.95),rgba(249,115,22,0.86),rgba(10,61,98,0.82))] p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Instala o UOR Connect</p>
              <p className="mt-1 text-xs leading-5 text-white/90">
                Atalho no ecrã inicial, carregamento mais rápido e experiência otimizada para uso recorrente.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismissInstall}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/12 text-white/80 transition-colors hover:bg-white/22 hover:text-white"
              aria-label="Dispensar aviso de instalação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl bg-white text-primary hover:bg-white/90"
              onClick={() => void handleInstall()}
              disabled={installing}
            >
              <Download className={`mr-2 h-4 w-4 ${installing ? "animate-pulse" : ""}`} />
              Instalar app
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-white/45 bg-white/10 text-white hover:bg-white/20"
              onClick={handleDismissInstall}
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {showReadyBanner ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-[linear-gradient(135deg,rgba(5,46,22,0.92),rgba(16,185,129,0.82))] p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">PWA operacional</p>
              <p className="mt-1 text-xs leading-5 text-white/90">
                O service worker já foi carregado. A aplicação local está pronta para cache, atualização e instalação quando o browser permitir.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {registrationError ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          PWA indisponível neste ambiente: {registrationError}
        </div>
      ) : null}
    </div>
  );
}
