import { useMemo, useState } from "react";
import { Loader2, Send, Smartphone } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, type SmsAudienceInput, type SmsRecipientPreviewPayload } from "@/lib/api";

type AdminBulkSmsActionProps = {
  audience: SmsAudienceInput;
  buttonLabel: string;
  defaultMessage: string;
  description: string;
  disabled?: boolean;
  title: string;
};

export function AdminBulkSmsAction({
  audience,
  buttonLabel,
  defaultMessage,
  description,
  disabled = false,
  title,
}: AdminBulkSmsActionProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [preview, setPreview] = useState<SmsRecipientPreviewPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const previewLabel = useMemo(() => {
    if (!preview) return "Valida os destinatários antes de enviar.";
    if (preview.totalRecipients === 0) return "Nenhum contacto válido encontrado.";
    return `${preview.totalRecipients} contacto(s) válido(s) para envio.`;
  }, [preview]);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const payload = await api.sms.previewRecipients({ audience, limit: 30 });
      setPreview(payload);
      if (payload.totalRecipients === 0) {
        toast.warning("Nenhum contacto válido encontrado para este envio.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao validar destinatários SMS.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Escreve o texto da SMS antes de enviar.");
      return;
    }

    setSending(true);
    try {
      const payload = await api.sms.sendCampaign({
        title,
        sender: "UOR CONNECT",
        message,
        audience,
      });
      setPreview(null);
      setOpen(false);
      toast.success(`SMS processada: ${payload.successCount} enviada(s), ${payload.failedCount} falhada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar SMS.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight">
          <Smartphone className="mr-1 h-3.5 w-3.5" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-32" />

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{previewLabel}</Badge>
              {preview ? <Badge variant="outline">{preview.skippedCount} ignorado(s)</Badge> : null}
            </div>
            {preview?.recipients.slice(0, 6).map((item) => (
              <p key={`${item.phone}-${item.studentNumber ?? item.name ?? "contact"}`} className="mt-2 text-xs text-muted-foreground">
                {item.name || item.studentNumber || item.phone} · {item.phone}
              </p>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePreview} disabled={previewing}>
            {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validar destinatários
          </Button>
          <Button onClick={handleSend} disabled={sending || preview?.totalRecipients === 0}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
