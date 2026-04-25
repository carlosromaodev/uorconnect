import { useEffect, useState } from "react";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getProjectShareUrl } from "@/lib/project-links";
import { createQrDataUrl } from "@/lib/qr";
import type { ProjectPublicFeedItem } from "@/lib/api";

type ProjectCardItem = ProjectPublicFeedItem & {
  userHasLiked?: boolean;
  userHasVoted?: boolean;
};

export function ProjectQrDialog({
  project,
  open,
  onClose,
}: {
  project: ProjectCardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const absoluteShareUrl = project ? getProjectShareUrl(project) : "";
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    setQrFailed(false);
    setQrImageUrl("");

    if (!open || !absoluteShareUrl) return undefined;

    createQrDataUrl(absoluteShareUrl, 220)
      .then((dataUrl) => {
        if (isMounted) setQrImageUrl(dataUrl);
      })
      .catch(() => {
        if (isMounted) setQrFailed(true);
      });

    return () => {
      isMounted = false;
    };
  }, [absoluteShareUrl, open]);

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] max-w-[420px] rounded-[20px] border-border/70 p-0">
        <div className="space-y-5 bg-[linear-gradient(180deg,rgba(232,247,243,0.92),rgba(255,255,255,0.96))] p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 font-heading text-lg">
              <QrCode className="h-4 w-4 text-primary" />
              QR e link do expositor
            </DialogTitle>
            <DialogDescription>{project.name}</DialogDescription>
          </DialogHeader>

          <div className="rounded-[18px] border border-border/60 bg-white p-4 shadow-sm">
            {qrImageUrl && !qrFailed ? (
              <img
                src={qrImageUrl}
                alt={`QR do expositor ${project.name}`}
                className="mx-auto aspect-square w-full max-w-[220px] rounded-2xl border border-border/60 object-contain"
                onError={() => setQrFailed(true)}
              />
            ) : (
              <div className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl border border-dashed border-border/60 px-4 text-center text-sm text-muted-foreground">
                {qrFailed ? "Não foi possível gerar o QR Code. O link continua disponível abaixo." : "A gerar QR Code..."}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Input readOnly value={absoluteShareUrl} className="rounded-2xl bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="rounded-2xl bg-white"
                onClick={async () => {
                  await navigator.clipboard.writeText(absoluteShareUrl);
                  toast.success("Link do expositor copiado.");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
              <Button variant="outline" className="rounded-2xl bg-white" asChild>
                <a href={absoluteShareUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ProjectCardItem };
