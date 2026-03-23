import { useState } from "react";
import { Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, setToken, type StudentProfile } from "@/lib/api";

export function StudentLoginForm({
  onSuccess,
  submitLabel = "Entrar",
  compact = false,
}: {
  onSuccess?: (student?: StudentProfile | null) => void;
  submitLabel?: string;
  compact?: boolean;
}) {
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedNumber = studentNumber.replace(/\D/g, "").slice(0, 8);
    if (normalizedNumber.length !== 8) {
      toast.error("Número de estudante deve ter exatamente 8 dígitos.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.login(normalizedNumber, password);
      if (result.success && result.token) {
        setToken(result.token);
        toast.success("Sessão iniciada com sucesso.");
        onSuccess?.(result.student ?? null);
      } else {
        toast.error(result.error || "Credenciais inválidas.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar sessão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Validação segura</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Usa os teus dados de login da secretaria.uor.edu.ao. O acesso serve apenas para validar que és estudante da UOR e nenhum dado sensível da secretaria é guardado.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Número de estudante</label>
        <Input
          type="text"
          required
          autoComplete="username"
          inputMode="numeric"
          placeholder="Ex: 20243454"
          value={studentNumber}
          maxLength={8}
          onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, "").slice(0, 8))}
          className="h-11 rounded-lg border-border/80 bg-background/95 text-base md:text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Palavra-passe</label>
        <Input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Usa a tua palavra-passe habitual"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-lg border-border/80 bg-background/95 text-base md:text-sm"
        />
      </div>

      <Button type="submit" className="h-11 w-full rounded-lg font-semibold shadow-sm" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            A extrair dados...
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
