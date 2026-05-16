import { useState } from "react";
import { Award, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "@/components/ui/sonner";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

type CourseCertificateActionProps = {
  courseId: number;
  courseName: string;
  studentCount: number;
  onIssued?: () => void;
};

export function CourseCertificateAction({
  courseId,
  courseName,
  studentCount,
  onIssued,
}: CourseCertificateActionProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`Certificado de Participação - ${courseName}`);
  const [type, setType] = useState("COURSE_PARTICIPATION");
  const [notifyBySms, setNotifyBySms] = useState(true);
  const [notifyByWhatsApp, setNotifyByWhatsApp] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const handleIssue = async () => {
    if (!title.trim()) {
      toast.error("Informa o título do certificado.");
      return;
    }
    if (!type.trim()) {
      toast.error("Informa o tipo do certificado.");
      return;
    }

    setIssuing(true);
    try {
      const result = await api.certificates.issueBulk({
        mode: "COURSE_ENROLLMENT",
        courseId,
        title: title.trim(),
        type: type.trim().toUpperCase(),
      });

      if ((notifyBySms || notifyByWhatsApp) && result.issued > 0) {
        const deliveryResults: string[] = [];
        try {
          const audience = {
            type: "COURSE_ENROLLED" as const,
            courseIds: [courseId],
          };
          const message = `Olá, os certificados do curso ${courseName} já estão disponíveis no UOR Connect. Entra na tua área para consultar, baixar e validar o teu certificado.`;
          if (notifyBySms) {
            const smsResult = await api.sms.sendCampaign({
              title: `Certificados emitidos - ${courseName}`,
              sender: "UOR CONNECT",
              message,
              audience,
            });
            deliveryResults.push(`SMS ${smsResult.successCount}/${smsResult.totalRecipients}`);
          }
          if (notifyByWhatsApp) {
            const whatsappResult = await api.whatsapp.sendCampaign({
              title: `Certificados emitidos - ${courseName}`,
              message,
              audience,
            });
            deliveryResults.push(`WhatsApp ${whatsappResult.successCount}/${whatsappResult.totalRecipients}`);
          }
          toast.success(`${result.issued} certificado(s) emitido(s). Avisos: ${deliveryResults.join(" · ")}. ${result.skipped} já existiam.`);
        } catch (deliveryError) {
          toast.warning(deliveryError instanceof Error
            ? `${result.issued} certificado(s) emitido(s), mas o aviso falhou: ${deliveryError.message}`
            : `${result.issued} certificado(s) emitido(s), mas não foi possível enviar o aviso.`);
        }
      } else {
        toast.success(`${result.issued} certificado(s) emitido(s). ${result.skipped} já existiam.`);
      }

      setOpen(false);
      onIssued?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao emitir certificados do curso.");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={studentCount === 0}
          className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
        >
          <Award className="mr-1 h-3.5 w-3.5" />
          Emitir certificados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Emitir certificados do curso</DialogTitle>
          <DialogDescription>
            Gera certificados para os estudantes inscritos em {courseName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título do certificado" />
            <Input value={type} onChange={(event) => setType(event.target.value.toUpperCase())} placeholder="Tipo" />
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Avisar inscritos por SMS</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Envia uma mensagem ao grupo do curso depois da emissão.
              </p>
            </div>
            <Switch checked={notifyBySms} onCheckedChange={setNotifyBySms} />
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MessageCircle className="h-4 w-4 text-emerald-700" />
                Avisar inscritos por WhatsApp
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Usa o telefone padrão conectado pela Evolution API.
              </p>
            </div>
            <Switch checked={notifyByWhatsApp} onCheckedChange={setNotifyByWhatsApp} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={issuing}>
            Cancelar
          </Button>
          <Button onClick={() => void handleIssue()} disabled={issuing}>
            {issuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
