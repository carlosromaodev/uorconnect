import { useMemo, useState } from "react";
import { KeyRound, Lock, Smartphone } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ApiError, api, setSessionStudent, setToken, type JuryMember } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatPhoneForDisplay(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("244") && digits.length >= 12) {
    const local = digits.slice(3, 12);
    return `+244 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`.trim();
  }

  if (digits.length >= 9) {
    const local = digits.slice(-9);
    return `+244 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`.trim();
  }

  return value;
}

function getFriendlyJuryLoginError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Código inválido ou expirado. Solicita um novo envio ao administrador.";
    }

    if (error.status >= 500) {
      return "Não foi possível validar o código do júri agora. Tenta novamente em instantes.";
    }
  }

  if (error instanceof TypeError) {
    return "Não foi possível contactar o servidor. Verifica a tua ligação e tenta novamente.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Erro ao iniciar sessão do júri.";
}

export function JuryLoginForm({
  onSuccess,
  submitLabel = "Entrar como júri",
  compact = false,
}: {
  onSuccess?: (juryMember?: JuryMember | null) => void;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const phonePreview = useMemo(() => formatPhoneForDisplay(phone), [phone]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const digits = phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("244") ? `+${digits}` : `+244${digits.slice(-9)}`;

    if (digits.length < 9) {
      toast.error("Indica um número de telefone válido para o acesso de júri.");
      return;
    }

    if (code.length !== 6) {
      toast.error("Introduce o código único de 6 dígitos enviado por SMS.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.auth.juryLogin(normalizedPhone, code);

      if (!response.success || !response.token) {
        toast.error(response.error || "Não foi possível validar o código do júri.");
        return;
      }

      setSessionStudent(null);
      setToken(response.token);
      toast.success("Sessão de júri iniciada com sucesso.");
      onSuccess?.(response.juryMember ?? null);
    } catch (error) {
      toast.error(getFriendlyJuryLoginError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <p className="text-sm text-muted-foreground">
            Introduz o código de 6 dígitos enviado por SMS.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Telefone do júri</label>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            required
            autoComplete="tel"
            placeholder="+244 9XX XXX XXX"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-11 rounded-lg border-border/80 bg-background/95 pl-10 text-base md:text-sm"
          />
        </div>
        {phonePreview ? (
          <p className="text-xs text-muted-foreground">Número reconhecido: <span className="font-semibold text-foreground">{phonePreview}</span></p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Código único (6 dígitos)</label>
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          containerClassName="w-full justify-between"
        >
          <InputOTPGroup className="w-full justify-between">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className={cn(
                  "h-11 w-11 rounded-lg border text-base font-semibold shadow-sm",
                  "first:rounded-lg first:border-l last:rounded-lg",
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <Button type="submit" className="h-11 w-full rounded-lg font-semibold shadow-sm" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            A validar código...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {submitLabel}
          </span>
        )}
      </Button>
    </form>
  );
}
