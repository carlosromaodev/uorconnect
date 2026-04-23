import { useState } from "react";
import { Shield, Lock } from "lucide-react";
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
  const laboratorioMode = mode === "laboratorio";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedNumber = studentNumber.replace(/\D/g, "").slice(0, 8);
    if (normalizedNumber.length !== 8) {
      toast.error("Número de estudante deve ter exatamente 8 dígitos.");
      return;
    }

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
        toast.error(result.error || "Credenciais inválidas.");
      }
    } catch (err) {
      toast.error(getFriendlyLoginError(err));
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
            : "rounded-xl border border-primary/20 bg-primary/5",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2",
              laboratorioMode
                ? "rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]"
                : "rounded-lg bg-primary/10 text-primary",
            )}
          >
            <Shield className="h-4 w-4" />
          </div>
          <p className={cn("text-sm", laboratorioMode ? "text-[#7b8ca3]" : "text-muted-foreground")}>
            {laboratorioMode
              ? "Usa o teu acesso académico para iniciar sessão."
              : "Usa os dados de login da secretaria.uor.edu.ao."}
          </p>
        </div>
      </div>

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
          onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className={laboratorioMode ? contestInputClassName : "h-11 rounded-lg border-border/80 bg-background/95 text-base md:text-sm"}
        />
      </div>

      <div className="space-y-1.5">
        <label className={cn("text-xs font-semibold", laboratorioMode ? "text-[#8fa0b8]" : "text-muted-foreground")}>Palavra-passe</label>
        <Input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Usa a tua palavra-passe habitual"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={laboratorioMode ? contestInputClassName : "h-11 rounded-lg border-border/80 bg-background/95 text-base md:text-sm"}
        />
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
