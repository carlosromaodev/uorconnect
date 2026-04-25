import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, KeyRound, Lock, Smartphone } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ApiError, api, type JuryMember } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; code?: string }>({});

  const phonePreview = useMemo(() => formatPhoneForDisplay(phone), [phone]);

  const validate = () => {
    const errors: typeof fieldErrors = {};
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      errors.phone = "Introduz o número de telefone associado ao júri.";
    } else if (digits.length < 9) {
      errors.phone = "O número de telefone deve ter pelo menos 9 dígitos.";
    }
    if (!code) {
      errors.code = "Introduz o código de 6 dígitos recebido por SMS.";
    } else if (code.length !== 6) {
      errors.code = "O código deve ter exatamente 6 dígitos.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    const digits = phone.replace(/\D/g, "");
    const normalizedPhone = digits.startsWith("244") ? `+${digits}` : `+244${digits.slice(-9)}`;

    setLoading(true);
    try {
      const response = await api.auth.juryLogin(normalizedPhone, code);

      if (!response.success || !response.token) {
        setError(response.error || "Não foi possível validar o código do júri.");
        return;
      }

      toast.success("Sessão de júri iniciada com sucesso.");
      onSuccess?.(response.juryMember ?? null);
    } catch (err) {
      setError(getFriendlyJuryLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            Introduz o código de 6 dígitos enviado por SMS para o teu número de júri.
          </p>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-[13px] leading-snug text-destructive">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Telefone do júri</label>
        <div className="relative">
          <Smartphone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            type="tel"
            required
            autoComplete="tel"
            placeholder="+244 9XX XXX XXX"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setFieldErrors((prev) => ({ ...prev, phone: undefined }));
              setError(null);
            }}
            className={cn(
              "h-11 rounded-lg border-border/80 bg-background/95 pl-10 text-base md:text-sm",
              fieldErrors.phone && "border-destructive/50 focus-visible:ring-destructive/30",
            )}
          />
        </div>
        <AnimatePresence>
          {fieldErrors.phone ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] text-destructive"
            >
              {fieldErrors.phone}
            </motion.p>
          ) : phonePreview ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground"
            >
              Número reconhecido: <span className="font-semibold text-foreground">{phonePreview}</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Código único (6 dígitos)</label>
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => {
            setCode(value.replace(/\D/g, "").slice(0, 6));
            setFieldErrors((prev) => ({ ...prev, code: undefined }));
            setError(null);
          }}
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
                  fieldErrors.code && "border-destructive/50",
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <AnimatePresence>
          {fieldErrors.code && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] text-destructive"
            >
              {fieldErrors.code}
            </motion.p>
          )}
        </AnimatePresence>
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
