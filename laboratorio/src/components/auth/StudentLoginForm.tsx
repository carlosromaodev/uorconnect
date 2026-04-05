import { useState } from "react";
import { Lock, Shield } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, setToken, type StudentProfile } from "@/lib/api";
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
}: {
  onSuccess?: (student?: StudentProfile | null) => void;
  submitLabel?: string;
  compact?: boolean;
  mode?: "laboratorio";
}) {
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedNumber = studentNumber.replace(/\D/g, "").slice(0, 8);
    if (normalizedNumber.length !== 8) {
      toast.error("Número de estudante deve ter exatamente 8 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.contest.login(normalizedNumber, password);
      if (result.success && result.token) {
        setToken(result.token);
        toast.success("Sessão iniciada com sucesso.");
        onSuccess?.(result.student ?? null);
      } else {
        toast.error(result.error || "Credenciais inválidas.");
      }
    } catch (error) {
      toast.error(getFriendlyLoginError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-[24px] border border-[#7bd3c6]/16 bg-[linear-gradient(180deg,rgba(17,25,37,0.94),rgba(13,21,33,0.98))] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.24)]">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-[#7bd3c6]/16 bg-[#7bd3c6]/10 p-2 text-[#7bd3c6]">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7bd3c6]">Sessão académica</p>
            <p className="mt-1 text-sm leading-6 text-[#7b8ca3]">
              Usa a tua conta de estudante para entrar nos programas e experiências do Laboratório.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#8fa0b8]">Número de estudante</label>
        <Input
          type="text"
          required
          autoComplete="username"
          inputMode="numeric"
          placeholder="Ex: 20243454"
          value={studentNumber}
          maxLength={8}
          onChange={(event) => setStudentNumber(event.target.value.replace(/\D/g, "").slice(0, 8))}
          className={contestInputClassName}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#8fa0b8]">Palavra-passe</label>
        <Input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Usa a tua palavra-passe habitual"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={contestInputClassName}
        />
      </div>

      <Button
        type="submit"
        className={cn("h-11 w-full rounded-2xl font-semibold", contestButtonClassNames.primary)}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#041013]/30 border-t-[#041013]" />
            A validar sessão...
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
