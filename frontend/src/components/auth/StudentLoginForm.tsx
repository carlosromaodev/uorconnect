import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, setToken, type StudentProfile } from "@/lib/api";
import { getAuthOrigin } from "@/lib/contest-lab";
import { contestButtonClassNames, contestInputClassName } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";

function getFriendlyLoginError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Número de estudante ou palavra-passe inválidos.";
    }

    if (error.status >= 500) {
      return "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes.";
    }
  }

  if (error instanceof TypeError) {
    return "Não foi possível contactar o servidor. Verifica a tua ligação e tenta novamente.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Erro ao iniciar sessão.";
}

export function StudentLoginForm({
  onSuccess,
  submitLabel = "Entrar",
  compact = false,
  mode = "portal",
}: {
  onSuccess?: (student?: StudentProfile | null) => void;
  submitLabel?: string;
  compact?: boolean;
  mode?: "portal" | "laboratorio";
}) {
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ number?: string; password?: string }>({});
  const laboratorioMode = mode === "laboratorio";

  const validate = () => {
    const errors: typeof fieldErrors = {};
    const normalized = studentNumber.replace(/\D/g, "");
    if (!normalized) {
      errors.number = "Introduz o teu número de estudante.";
    } else if (normalized.length !== 8) {
      errors.number = "O número deve ter exatamente 8 dígitos.";
    }
    if (!password) {
      errors.password = "Introduz a tua palavra-passe.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    const normalizedNumber = studentNumber.replace(/\D/g, "").slice(0, 8);
    setLoading(true);
    try {
      const authOrigin = laboratorioMode ? "laboratorio" : getAuthOrigin();
      const result = authOrigin === "laboratorio"
        ? await api.contest.login(normalizedNumber, password)
        : await api.auth.login(normalizedNumber, password, authOrigin);
      if (result.success && result.token) {
        setToken(result.token);
        toast.success("Sessão iniciada com sucesso.");
        onSuccess?.(result.student ?? null);
      } else {
        setError(result.error || "Credenciais inválidas.");
      }
    } catch (err) {
      setError(getFriendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className={compact ? "space-y-4" : "space-y-5"}>
      <div
        className={cn(
          "p-4",
          laboratorioMode
            ? "rounded-[24px] border border-[#00e5c8]/16 bg-[linear-gradient(180deg,rgba(5,12,16,0.94),rgba(8,16,22,0.98))] shadow-[0_18px_42px_rgba(0,0,0,0.24)]"
            : "rounded-xl border border-primary/15 bg-primary/[0.04]",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "shrink-0 p-2",
              laboratorioMode
                ? "rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]"
                : "rounded-lg bg-primary/10 text-primary",
            )}
          >
            <Shield className="h-4 w-4" />
          </div>
          <p className={cn("text-[13px] leading-snug", laboratorioMode ? "text-[#7b8ca3]" : "text-muted-foreground")}>
            {laboratorioMode
              ? "Usa o teu acesso académico para iniciar sessão."
              : "Usa os dados de login da secretaria.uor.edu.ao para entrar."}
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
        <label className={cn("text-xs font-semibold", laboratorioMode ? "text-[#8fa0b8]" : "text-muted-foreground")}>Número de estudante</label>
        <Input
          type="text"
          required
          autoComplete="username"
          inputMode="numeric"
          placeholder="Ex: 20243454"
          value={studentNumber}
          maxLength={8}
          onChange={(e) => {
            setStudentNumber(e.target.value.replace(/\D/g, "").slice(0, 8));
            setFieldErrors((prev) => ({ ...prev, number: undefined }));
            setError(null);
          }}
          className={cn(
            laboratorioMode ? contestInputClassName : "h-11 rounded-lg border-border/80 bg-background/95 text-base md:text-sm",
            fieldErrors.number && "border-destructive/50 focus-visible:ring-destructive/30",
          )}
        />
        <AnimatePresence>
          {fieldErrors.number && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] text-destructive"
            >
              {fieldErrors.number}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-1.5">
        <label className={cn("text-xs font-semibold", laboratorioMode ? "text-[#8fa0b8]" : "text-muted-foreground")}>Palavra-passe</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Usa a tua palavra-passe habitual"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
              setError(null);
            }}
            className={cn(
              laboratorioMode ? contestInputClassName : "h-11 rounded-lg border-border/80 bg-background/95 pr-10 text-base md:text-sm",
              fieldErrors.password && "border-destructive/50 focus-visible:ring-destructive/30",
            )}
          />
          {!laboratorioMode && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        <AnimatePresence>
          {fieldErrors.password && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-[11px] text-destructive"
            >
              {fieldErrors.password}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <Button
        type="submit"
        className={cn(
          "h-11 w-full font-semibold",
          laboratorioMode ? `${contestButtonClassNames.primary} rounded-2xl` : "rounded-lg font-semibold shadow-sm",
        )}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "h-3.5 w-3.5 animate-spin rounded-full border-2",
                laboratorioMode ? "border-[#041013]/30 border-t-[#041013]" : "border-primary-foreground/30 border-t-primary-foreground",
              )}
            />
            {laboratorioMode ? "A validar sessão..." : "A extrair dados..."}
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
