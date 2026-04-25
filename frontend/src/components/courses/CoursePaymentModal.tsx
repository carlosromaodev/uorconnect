import { useEffect, useState } from "react";
import { Loader2, MessageSquareMore, Paperclip, ShieldCheck, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Course } from "@/lib/api";

const PHONE_PREFIX = "+244 ";

function normalizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("244")) {
    return digits.slice(3, 12);
  }

  return digits.slice(0, 9);
}

function formatPhoneValue(digits: string) {
  return `${PHONE_PREFIX}${digits}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o ficheiro selecionado."));
    reader.readAsDataURL(file);
  });
}

export function CoursePaymentModal({
  course,
  open,
  loading,
  onClose,
  onSubmit,
}: {
  course: Course | null;
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: { paymentProof: string; paymentPhone: string }) => Promise<void>;
}) {
  const [paymentPhone, setPaymentPhone] = useState("");
  const [paymentProof, setPaymentProof] = useState("");
  const [paymentProofName, setPaymentProofName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPaymentPhone("");
      setPaymentProof("");
      setPaymentProofName("");
      setError(null);
    }
  }, [open]);

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="w-[94vw] max-w-[560px] overflow-hidden rounded-[18px] border-border/70 p-0">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_24%),linear-gradient(180deg,rgba(2,132,199,0.08),transparent)] p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 font-heading text-xl">
              <Wallet className="h-5 w-5 text-primary" />
              Confirmar pagamento do curso
            </DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Carrega o comprovativo, confirma o teu contacto com prefixo angolano e segue para o WhatsApp com a inscrição pronta para validação.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Curso</p>
              <p className="mt-2 text-lg font-semibold">{course.name}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-muted/30 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor</p>
                  <p className="mt-1 text-sm font-medium">{course.priceLabel || "Pago"}</p>
                </div>
                <div className="rounded-2xl bg-muted/30 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Parceiro</p>
                  <p className="mt-1 text-sm font-medium">{course.companyName}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Confirmação premium</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Depois do envio, abrimos o WhatsApp com a mensagem de inscrição e o link do comprovativo para acelerares a validação do curso.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Contacto para validação</label>
              <Input
                value={formatPhoneValue(paymentPhone)}
                onChange={(event) => setPaymentPhone(normalizePhoneDigits(event.target.value))}
                placeholder="+244 923456789"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Comprovativo de pagamento</label>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/30 bg-background/90 px-4 py-4 transition-colors hover:border-primary/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{paymentProofName || "Selecionar PDF ou imagem do comprovativo"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, PNG, JPG ou WEBP</p>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Paperclip className="h-4 w-4" />
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await readFileAsDataUrl(file);
                    setPaymentProof(dataUrl);
                    setPaymentProofName(file.name);
                    setError(null);
                  }}
                />
              </label>
            </div>

            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" className="h-11 rounded-xl" onClick={onClose} disabled={loading}>
                Fechar
              </Button>
              <Button
                className="h-11 rounded-xl"
                disabled={loading}
                onClick={async () => {
                  if (paymentPhone.length !== 9) {
                    setError("Informa um número válido com prefixo +244.");
                    return;
                  }

                  if (!paymentProof) {
                    setError("Anexa o comprovativo do pagamento antes de continuar.");
                    return;
                  }

                  setError(null);
                  await onSubmit({
                    paymentPhone: `${PHONE_PREFIX}${paymentPhone}`,
                    paymentProof,
                  });
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A validar comprovativo...
                  </>
                ) : (
                  <>
                    <MessageSquareMore className="mr-2 h-4 w-4" />
                    Continuar no WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
