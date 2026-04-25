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
import { api, type SmsRecipientPreviewPayload } from "@/lib/api";

type SmsRecipient = {
  name?: string | null;
  phone?: string | null;
  studentNumber?: string | null;
  course?: string | null;
};

type ContextualSmsActionProps = {
  buttonLabel?: string;
  buttonVariant?: "default" | "outline" | "ghost";
  defaultMessage: string;
  recipient: SmsRecipient;
  title: string;
};

function compactList(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function personalize(message: string, recipient: SmsRecipient) {
  return message
    .replace(/{{\s*nome\s*}}/gi, recipient.name || "estudante")
    .replace(/{{\s*numero\s*}}/gi, recipient.studentNumber || "")
    .replace(/{{\s*curso\s*}}/gi, recipient.course || "");
}

export function ContextualSmsAction({
  buttonLabel = "Enviar SMS",
  buttonVariant = "outline",
  defaultMessage,
  recipient,
  title,
}: ContextualSmsActionProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [preview, setPreview] = useState<SmsRecipientPreviewPayload | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedStudentNumbers = useMemo(() => compactList([recipient.studentNumber]), [recipient.studentNumber]);
  const selectedPhones = useMemo(() => compactList([recipient.phone]), [recipient.phone]);
  const canResolveRecipient = selectedStudentNumbers.length > 0 || selectedPhones.length > 0;
  const previewText = useMemo(() => personalize(message, recipient), [message, recipient]);

  const audience = useMemo(() => ({
    type: "SELECTED_STUDENTS" as const,
    selectedStudentNumbers,
    selectedPhones,
  }), [selectedPhones, selectedStudentNumbers]);

  const handlePreview = async () => {
    if (!canResolveRecipient) {
      toast.error("Este registo não tem número de estudante nem telefone.");
      return;
    }

    setPreviewing(true);
    try {
      const payload = await api.sms.previewRecipients({ audience, limit: 20 });
      setPreview(payload);
      if (payload.totalRecipients === 0) {
        toast.warning("Nenhum contacto válido encontrado para este destinatário.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao validar destinatário SMS.");
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
        <Button size="sm" variant={buttonVariant} className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight">
          <Smartphone className="mr-1 h-3.5 w-3.5" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Envio contextual para {recipient.name || recipient.studentNumber || recipient.phone || "destinatário selecionado"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nome</p>
              <p className="mt-1 text-sm font-medium">{recipient.name || "Não informado"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Número</p>
              <p className="mt-1 text-sm font-medium">{recipient.studentNumber || "Não informado"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Telefone</p>
              <p className="mt-1 text-sm font-medium">{recipient.phone || "A resolver pela ficha"}</p>
            </div>
          </div>

          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-28" />

          <div className="rounded-xl border border-border/70 bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">Prévia personalizada</p>
            <p className="mt-2 text-sm leading-6">{previewText}</p>
          </div>

          {preview && (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{preview.totalRecipients} contacto(s) válido(s)</Badge>
                <Badge variant="outline">{preview.skippedCount} ignorado(s)</Badge>
              </div>
              {preview.recipients.slice(0, 4).map((item) => (
                <p key={`${item.phone}-${item.studentNumber ?? "manual"}`} className="mt-2 text-xs text-muted-foreground">
                  {item.name || item.studentNumber || item.phone} · {item.phone}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePreview} disabled={previewing || !canResolveRecipient}>
            {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Validar contacto
          </Button>
          <Button onClick={handleSend} disabled={sending || !canResolveRecipient}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
