import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type QrCameraScannerProps = {
  open: boolean;
  onClose: () => void;
  onRead: (value: string) => void;
};

export function QrCameraScanner({ open, onClose, onRead }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return undefined;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    setStatus("starting");
    setError("");

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result || cancelled) return;
        const text = result.getText();
        if (!text) return;

        controlsRef.current?.stop();
        controlsRef.current = null;
        onRead(text);
        onClose();
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("ready");
      })
      .catch((scanError) => {
        if (cancelled) return;
        setStatus("error");
        setError(scanError instanceof Error ? scanError.message : "Não foi possível iniciar a câmara.");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onClose, onRead, open]);

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

          <div className="overflow-hidden rounded-[16px] border border-border bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
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

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
