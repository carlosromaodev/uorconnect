import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { ApiError, api, setToken, getToken, type StudentProfile } from "@/lib/api";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

function getFriendlyLoginError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Credenciais inválidas. Verifica o número e a palavra-passe.";
    if (error.status === 403) return "Esta conta não tem permissões administrativas.";
    if (error.status >= 500) return "Serviço temporariamente indisponível. Tenta novamente.";
  }
  if (error instanceof TypeError) return "Sem ligação ao servidor. Verifica a tua rede.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Erro ao iniciar sessão.";
}

type LoginStage = "idle" | "authenticating" | "verified";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<LoginStage>("idle");

  useEffect(() => {
    if (getToken()) navigate("/admin", { replace: true });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = studentNumber.replace(/\D/g, "").slice(0, 12);
    if (!normalized || normalized.length < 8) {
      setError("Introduz um número de estudante válido (8-12 dígitos).");
      return;
    }
    if (!password) {
      setError("Introduz a tua palavra-passe.");
      return;
    }

    setStage("authenticating");
    try {
      const result = await api.auth.login(normalized, password, "uorconnect");
      if (result.success && result.token) {
        setToken(result.token);
        setStage("verified");
        toast.success("Acesso administrativo confirmado.");
        setTimeout(() => navigate("/admin", { replace: true }), 1200);
      } else {
        setError(result.error || "Credenciais inválidas.");
        setStage("idle");
      }
    } catch (err) {
      setError(getFriendlyLoginError(err));
      setStage("idle");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(15,23,42,0.03),transparent_50%)]" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg shadow-slate-900/15">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Consola Administrativa
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            NEIC · Universidade Óscar Ribas
          </p>
        </motion.div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          {/* Security accent */}
          <div className="h-1 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400" />

          <div className="p-6 sm:p-7">
            {/* Security notice */}
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Fingerprint className="h-4 w-4" />
              </div>
              <p className="text-xs leading-snug text-slate-600">
                Acesso restrito a membros autorizados do núcleo. A sessão é verificada com o sistema académico.
              </p>
            </div>

            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <p className="text-xs leading-snug text-red-700">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Student number */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Número de estudante
                </label>
                <Input
                  type="text"
                  required
                  autoComplete="username"
                  inputMode="numeric"
                  placeholder="Ex: 20243454"
                  value={studentNumber}
                  maxLength={12}
                  disabled={stage !== "idle"}
                  onChange={(e) => {
                    setStudentNumber(e.target.value.replace(/\D/g, "").slice(0, 12));
                    setError(null);
                  }}
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm transition-colors focus:bg-white"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Palavra-passe
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Palavra-passe académica"
                    value={password}
                    disabled={stage !== "idle"}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 pr-10 text-sm transition-colors focus:bg-white"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-slate-900 font-semibold text-white shadow-sm shadow-slate-900/20 hover:bg-slate-800"
                disabled={stage !== "idle"}
              >
                {stage === "authenticating" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A verificar identidade...
                  </span>
                ) : stage === "verified" ? (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Acesso confirmado
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Autenticar
                  </span>
                )}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="h-3 w-3" />
              <span>Sessão cifrada · Acesso auditado</span>
            </div>
          </div>
        </motion.div>

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <a href="/" className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700">
            Voltar ao portal público
          </a>
        </motion.div>
      </div>

      {/* Verified overlay */}
      <AnimatePresence>
        {stage === "verified" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Identidade verificada</h2>
                <p className="mt-0.5 text-sm text-slate-500">A preparar a consola...</p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
              >
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
