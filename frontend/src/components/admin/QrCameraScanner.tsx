import { useEffect, useRef, useState } from "react";
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, Loader2, RefreshCcw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type QrCameraScannerProps = {
  open: boolean;
  onClose: () => void;
  onRead: (value: string) => void;
};

function isCameraSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function buildScannerReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 400,
    tryPlayVideoTimeout: 8_000,
  });
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (!window.isSecureContext) {
    return "A câmara só funciona em HTTPS ou localhost. Abre o portal pelo domínio seguro.";
  }
  if (!isCameraSupported()) {
    return "Este navegador não disponibiliza acesso à câmara. Tenta Chrome, Edge ou Safari atualizado.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Permissão da câmara recusada. Autoriza a câmara nas definições do navegador e tenta novamente.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nenhuma câmara foi encontrada neste dispositivo.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "A câmara parece estar ocupada por outra aplicação. Fecha outras apps que usam a câmara e tenta novamente.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "A câmara selecionada não aceitou as definições pedidas. Tenta trocar de câmara.";
  }

  return message || "Não foi possível iniciar a câmara. Cola o token manualmente.";
}

export function QrCameraScanner({ open, onClose, onRead }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);

  const stopScanner = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  };

  const loadDevices = async () => {
    try {
      const videoDevices = await BrowserCodeReader.listVideoInputDevices();
      setDevices(videoDevices);
      return videoDevices;
    } catch {
      setDevices([]);
      return [];
    }
  };

  const restartScanner = () => {
    stopScanner();
    scannedRef.current = false;
    setRestartKey((current) => current + 1);
  };

  useEffect(() => {
    if (!open) {
      stopScanner();
      scannedRef.current = false;
      return undefined;
    }

    if (!window.isSecureContext || !isCameraSupported()) {
      setStatus("error");
      setError(cameraErrorMessage(new Error("Camera unavailable")));
      return undefined;
    }

    let cancelled = false;
    const reader = buildScannerReader();

    setStatus("starting");
    setError("");
    scannedRef.current = false;

    const handleResult = (result: { getText: () => string } | null | undefined) => {
      if (!result || cancelled || scannedRef.current) return;
        const text = result.getText();
        if (!text) return;

      scannedRef.current = true;
      stopScanner();
        onRead(text);
        onClose();
    };

    const start = async () => {
      await loadDevices();

      if (selectedDeviceId) {
        return reader.decodeFromVideoDevice(selectedDeviceId, videoRef.current ?? undefined, (result) => handleResult(result));
      }

      try {
        return await reader.decodeFromConstraints({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }, videoRef.current ?? undefined, (result) => handleResult(result));
      } catch {
        return reader.decodeFromConstraints({
          audio: false,
          video: true,
        }, videoRef.current ?? undefined, (result) => handleResult(result));
      }
    };

    start()
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("ready");
        void loadDevices();
      })
      .catch((scanError) => {
        if (cancelled) return;
        setStatus("error");
        setError(cameraErrorMessage(scanError));
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [onClose, onRead, open, restartKey, selectedDeviceId]);

  const handleSwitchCamera = () => {
    if (devices.length <= 1) {
      restartScanner();
      return;
    }

    const currentIndex = Math.max(0, devices.findIndex((device) => device.deviceId === selectedDeviceId));
    const nextDevice = devices[(currentIndex + 1) % devices.length];
    setSelectedDeviceId(nextDevice.deviceId);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <DialogContent className="w-[94vw] max-w-[520px] rounded-[20px] p-0">
        <div className="space-y-4 p-5">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Ler QR pela câmara
            </DialogTitle>
            <DialogDescription>
              Aponta a câmara para o QR do estudante. A leitura é feita no navegador.
            </DialogDescription>
          </DialogHeader>

          <div className="relative overflow-hidden rounded-[16px] border border-border bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline autoPlay />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-40 rounded-[28px] border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.20)]" />
            </div>
          </div>

          {status === "starting" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A iniciar câmara...
            </p>
          ) : null}

          {status === "error" ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error || "Não foi possível usar a câmara. Cola o token manualmente."}
            </p>
          ) : null}

          {devices.length > 1 ? (
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Câmara</span>
              <select
                value={selectedDeviceId ?? ""}
                onChange={(event) => setSelectedDeviceId(event.target.value || null)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Automática / traseira</option>
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Câmara ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              Fechar
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl sm:flex-none" onClick={restartScanner}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Tentar de novo
              </Button>
              <Button type="button" className="flex-1 rounded-xl sm:flex-none" onClick={handleSwitchCamera}>
                <SwitchCamera className="mr-2 h-4 w-4" />
                Trocar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
