import { useMemo, useState } from "react";
import { Loader2, MessageCircle, Send, Smartphone } from "lucide-react";
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
  const [channel, setChannel] = useState<"SMS" | "WHATSAPP" | "BOTH">("SMS");
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
      const payload = channel === "WHATSAPP"
        ? await api.whatsapp.previewRecipients({ audience, limit: 30 })
        : await api.sms.previewRecipients({ audience, limit: 30 });
      setPreview(payload);
      if (payload.totalRecipients === 0) {
        toast.warning("Nenhum contacto válido encontrado para este envio.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao validar destinatários.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Escreve o texto da mensagem antes de enviar.");
      return;
    }

    setSending(true);
    try {
      const results: string[] = [];
      if (channel === "SMS" || channel === "BOTH") {
        const payload = await api.sms.sendCampaign({
          title,
          sender: "UOR CONNECT",
          message,
          audience,
        });
        results.push(`SMS: ${payload.successCount}/${payload.totalRecipients}`);
      }
      if (channel === "WHATSAPP" || channel === "BOTH") {
        const payload = await api.whatsapp.sendCampaign({
          title,
          message,
          audience,
        });
        results.push(`WhatsApp: ${payload.successCount}/${payload.totalRecipients}`);
      }
      setPreview(null);
      setOpen(false);
      toast.success(`Envio processado. ${results.join(" · ")}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar comunicação.");
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

          <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-3">
            {([
              { id: "SMS", label: "SMS", icon: Smartphone },
              { id: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
              { id: "BOTH", label: "Ambos", icon: Send },
            ] as const).map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={channel === item.id ? "default" : "outline"}
                  className="justify-start rounded-xl"
                  onClick={() => {
                    setChannel(item.id);
                    setPreview(null);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

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
            {channel === "BOTH" ? "Enviar ambos" : channel === "WHATSAPP" ? "Enviar WhatsApp" : "Enviar SMS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
