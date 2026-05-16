import { type FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Eye, EyeOff, GraduationCap, Lock } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, setToken, type StudentProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

const academicLoginThemes = {
  uor: {
    shortLabel: "UOR",
    label: "Estudante UOR",
    institution: "Universidade Oscar Ribas",
    title: "Conta académica UOR",
    helper: "Entra com o número de estudante e a senha da secretaria.uor.edu.ao.",
    portal: "Secretaria UOR",
    button: "Entrar com UOR",
  },
  isptec: {
    shortLabel: "ISPTEC",
    label: "Estudante ISPTEC",
    institution: "ISPTEC",
    title: "Portal Académico ISPTEC",
    helper: "Entra com o número de estudante e a senha do portal académico ISPTEC.",
    portal: "Portal ISPTEC",
    button: "Entrar com ISPTEC",
  },
} as const;

function getFriendlyLoginError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Número de estudante ou palavra-passe inválidos.";
    }

    if (error.status === 408) {
      return "A Secretaria demorou a responder. Mantém a ligação estável e tenta novamente em instantes.";
    }

    if (error.status >= 500) {
      return "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes.";
    }
  }

  if (error instanceof TypeError) {
    return "Não foi possível contactar o servidor. Verifica a tua ligação e tenta novamente.";
  }

  if (error instanceof Error && /timeout|abort/i.test(error.message)) {
    return "A validação académica demorou mais do que o esperado. Tenta novamente em instantes.";
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
  mode?: "portal";
  allowConventional?: boolean;
}) {
  const [loginMode, setLoginMode] = useState<"uor" | "isptec">("uor");
  const [identifierType, setIdentifierType] = useState<"studentNumber" | "username">("studentNumber");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ number?: string; password?: string }>({});

  const activeAcademicTheme = loginMode === "isptec" ? academicLoginThemes.isptec : academicLoginThemes.uor;
  const academicSubmitLabel = submitLabel === "Entrar" ? activeAcademicTheme.button : submitLabel;

  const validate = () => {
    const errors: typeof fieldErrors = {};
    const currentIdentifierType = loginMode === "isptec" ? "studentNumber" : identifierType;
    const normalizedNumber =
      currentIdentifierType === "username"
        ? studentNumber.trim()
        : studentNumber.replace(/\D/g, "");

    if (currentIdentifierType === "username") {
      if (normalizedNumber.length < 2 || normalizedNumber.length > 40) {
        errors.number = "Nome de utilizador deve ter entre 2 e 40 caracteres.";
      } else if (!/^[\p{L}\p{N}._@ -]+$/u.test(normalizedNumber)) {
        errors.number = "Nome de utilizador contém caracteres inválidos.";
      }
    } else if (normalizedNumber.length < 8 || normalizedNumber.length > 12) {
      errors.number = "O número deve ter entre 8 e 12 dígitos.";
    }

    if (!password.trim()) {
      errors.password = "Indica a tua palavra-passe.";
    }

    setFieldErrors(errors);
    return { valid: Object.keys(errors).length === 0, normalizedNumber, currentIdentifierType };
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const validation = validate();
    if (!validation.valid) return;

    setLoading(true);
    try {
      const result = await api.auth.login(
        validation.normalizedNumber,
        password,
        "uorconnect",
        loginMode === "isptec" ? "isptec" : "uor",
        validation.currentIdentifierType,
      );

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
      <div className="grid gap-2.5 sm:grid-cols-2">
        {(["uor", "isptec"] as const).map((provider) => {
          const theme = academicLoginThemes[provider];
          const active = loginMode === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => {
                setLoginMode(provider);
                setIdentifierType("studentNumber");
                setStudentNumber("");
                setFieldErrors({});
                setError(null);
              }}
              aria-pressed={active}
              className={cn(
                "group relative flex h-12 items-center justify-center rounded-xl border px-4 text-sm font-bold transition-all",
                active
                  ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                  : "border-slate-300 bg-white text-slate-950 hover:border-slate-950 hover:bg-slate-50",
              )}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span>{theme.label}</span>
                {active && <CheckCircle2 className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>OU</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

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

      <div className="space-y-2">
        {loginMode === "uor" ? (
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {([
              ["studentNumber", "Número"],
              ["username", "Nome"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setIdentifierType(value);
                  setStudentNumber("");
                  setFieldErrors((prev) => ({ ...prev, number: undefined }));
                  setError(null);
                }}
                className={cn(
                  "h-8 rounded-lg text-xs font-semibold transition-colors",
                  identifierType === value
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
                aria-pressed={identifierType === value}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <label className="text-xs font-semibold text-muted-foreground">
          {identifierType === "username" && loginMode === "uor" ? "Nome de utilizador" : "Número de estudante"}
        </label>
        <Input
          type="text"
          required
          autoComplete="username"
          inputMode={identifierType === "username" && loginMode === "uor" ? "text" : "numeric"}
          placeholder={
            identifierType === "username" && loginMode === "uor"
              ? "Ex: petrucadas"
              : loginMode === "isptec" ? "Ex: 20200227" : "Ex: 20243454"
          }
          value={studentNumber}
          maxLength={identifierType === "username" ? 40 : 12}
          onChange={(event) => {
            const nextValue = identifierType === "username" && loginMode === "uor"
              ? event.target.value.slice(0, 40)
              : event.target.value.replace(/\D/g, "").slice(0, 12);
            setStudentNumber(nextValue);
            setFieldErrors((prev) => ({ ...prev, number: undefined }));
            setError(null);
          }}
          className={cn(
            "h-11 rounded-lg border-border/80 bg-background/95 text-base md:text-sm",
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
        <label className="text-xs font-semibold text-muted-foreground">Palavra-passe</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Usa a tua palavra-passe habitual"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
              setError(null);
            }}
            className={cn(
              "h-11 rounded-lg border-border/80 bg-background/95 pr-10 text-base md:text-sm",
              fieldErrors.password && "border-destructive/50 focus-visible:ring-destructive/30",
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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
        className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-none transition-all hover:bg-primary/90"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            A extrair dados...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {academicSubmitLabel}
          </span>
        )}
      </Button>
    </form>
  );
}
