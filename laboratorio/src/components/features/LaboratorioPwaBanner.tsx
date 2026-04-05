import { useMemo, useState } from "react";
import { Download, RefreshCcw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const INSTALL_DISMISS_KEY = "lab_pwa_install_dismissed";
const UPDATE_DISMISS_KEY = "lab_pwa_update_dismissed";

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

export function LaboratorioPwaBanner() {
  const {
    isSupported,
    isInstallable,
    isIos,
    isSafari,
    showIosInstallGuide,
    updateAvailable,
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
  const showIosBanner = showIosInstallGuide && !installDismissed;
  const showUpdateBanner = isSupported && updateAvailable && !updateDismissed;

  const bannerPositionClassName = useMemo(() => (
    "fixed bottom-4 left-4 right-4 z-[90] flex flex-col gap-3 md:left-auto md:right-4 md:max-w-sm"
  ), []);

  const dismissInstall = () => {
    setInstallDismissed(true);
    persistDismissedState(INSTALL_DISMISS_KEY, true);
    dismissInstallPrompt();
  };

  const dismissUpdate = () => {
    setUpdateDismissed(true);
    persistDismissedState(UPDATE_DISMISS_KEY, true);
  };

  const handleInstall = async () => {
    try {
      setInstalling(true);
      const accepted = await installPwa();

      if (accepted) {
        toast.success("Instalação do Laboratório iniciada.");
        dismissInstall();
      } else {
        toast.info("A instalação foi cancelada.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar a instalação.");
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

      toast.success("Aplicando nova versão do Laboratório...");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao aplicar atualização.");
    } finally {
      setUpdating(false);
    }
  };

  if (!showInstallBanner && !showIosBanner && !showUpdateBanner && !registrationError) {
    return null;
  }

  return (
    <div className={bannerPositionClassName}>
      {showUpdateBanner ? (
        <div className="rounded-2xl border border-[#7bd3c6]/24 bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(123,211,198,0.16))] p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Atualização disponível</p>
              <p className="mt-1 text-xs leading-5 text-white/85">
                Existe uma nova versão do Laboratório pronta para recarregar.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissUpdate}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Dispensar aviso de atualização"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl bg-[#7bd3c6] text-[#0f1720] hover:bg-[#95dfd4]"
              onClick={() => void handleUpdate()}
              disabled={updating}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${updating ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      ) : null}

      {showInstallBanner ? (
        <div className="rounded-2xl border border-[#7bd3c6]/24 bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(18,35,47,0.96),rgba(123,211,198,0.18))] p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Instala o Laboratório</p>
              <p className="mt-1 text-xs leading-5 text-white/90">
                Adiciona o Laboratório ao ecrã inicial para acesso direto, atualização rápida e navegação contínua.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissInstall}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/12 text-white/80 transition-colors hover:bg-white/22 hover:text-white"
              aria-label="Dispensar aviso de instalação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl bg-[#7bd3c6] text-[#0f1720] hover:bg-[#95dfd4]"
              onClick={() => void handleInstall()}
              disabled={installing}
            >
              <Download className={`mr-2 h-4 w-4 ${installing ? "animate-pulse" : ""}`} />
              Instalar app
            </Button>
          </div>
        </div>
      ) : null}

      {showIosBanner ? (
        <div className="rounded-2xl border border-[#7bd3c6]/24 bg-[linear-gradient(135deg,rgba(16,24,36,0.98),rgba(18,30,42,0.98))] p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Adicionar ao ecrã principal</p>
              <p className="mt-1 text-xs leading-5 text-white/85">
                {isIos && isSafari
                  ? "No iPhone, abre Partilhar e escolhe “Adicionar ao ecrã principal”."
                  : "No iPhone, abre este endereço no Safari para poderes instalar o Laboratório como app."}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissInstall}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Dispensar instruções de instalação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[#7bd3c6]">
            <Smartphone className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-[0.18em]">iPhone / iPad</span>
          </div>
        </div>
      ) : null}

      {registrationError ? (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {registrationError}
        </div>
      ) : null}
    </div>
  );
}
