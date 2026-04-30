import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  FolderOpen,
  Mic,
  CalendarDays,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { JuryLoginForm } from "@/components/auth/JuryLoginForm";
import { type JuryMember, type StudentProfile } from "@/lib/api";
import { UOR_EVENT_TITLE_HIGHLIGHT, UOR_EVENT_TITLE_PREFIX } from "@/lib/home-content";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

type AuthMode = "student" | "jury";
type LoginStage = "idle" | "processing" | "welcome";

function ModeSelector({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  const options: Array<{ key: AuthMode; label: string; icon: typeof GraduationCap }> = [
    { key: "student", label: "Estudante", icon: GraduationCap },
    { key: "jury", label: "Júri", icon: KeyRound },
  ];

  return (
    <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
      {options.map(({ key, label, icon: Icon }) => {
        const active = mode === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            {active ? (
              <motion.div
                layoutId="uor-login-mode"
                className="absolute inset-0 rounded-lg bg-white shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            ) : null}
            <span className={`relative flex items-center gap-2 ${active ? "text-foreground" : "text-muted-foreground"}`}>
              <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground/60"}`} />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const features = [
  { icon: FolderOpen, text: "Votar e submeter projetos" },
  { icon: Mic, text: "Ver palestrantes e painéis" },
  { icon: CalendarDays, text: "Acompanhar a agenda ao vivo" },
];

export function PortalLoginPage({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("student");
  const [loginStage, setLoginStage] = useState<LoginStage>("idle");
  const [welcomeData, setWelcomeData] = useState<{
    title: string;
    subtitle: string;
    role: string;
  }>({ title: "Sessão validada", subtitle: "A redirecionar...", role: "estudante" });

  useEffect(() => {
    if (loginStage !== "welcome") return;

    const timeout = window.setTimeout(() => navigate(redirectTo), 1800);
    return () => window.clearTimeout(timeout);
  }, [loginStage, navigate, redirectTo]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_14%_14%,rgba(249,115,22,0.08),transparent_50%),radial-gradient(ellipse_at_86%_80%,rgba(37,99,235,0.06),transparent_50%),linear-gradient(180deg,#fefefe,#fafaf8)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.03] blur-[100px]" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease }}
          className="mb-8 flex flex-col items-center gap-4 text-center"
        >
          <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-16 w-auto max-w-[210px] object-contain" />
          <div>
            <p className="text-sm font-medium leading-5 text-muted-foreground">{UOR_EVENT_TITLE_PREFIX} {UOR_EVENT_TITLE_HIGHLIGHT}</p>
          </div>
        </motion.div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease }}
          className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-xl shadow-black/[0.06]"
        >
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

          <div className="p-6 md:p-7">
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold">Iniciar sessão</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">Escolhe o teu tipo de acesso para continuar.</p>
              </div>

              <ModeSelector mode={authMode} onChange={setAuthMode} />

              <AnimatePresence mode="wait">
                {authMode === "student" ? (
                  <motion.div
                    key="student"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22, ease }}
                  >
                    <StudentLoginForm
                      mode="portal"
                      submitLabel="Entrar"
                      onSuccess={(student) => {
                        const name = student?.name?.split(" ").slice(0, 2).join(" ") || "";
                        setWelcomeData({
                          title: name ? `Bem-vindo, ${name}` : "Sessão validada",
                          subtitle: student?.course || "A redirecionar para a plataforma...",
                          role: "estudante",
                        });
                        setLoginStage("processing");
                        window.setTimeout(() => setLoginStage("welcome"), 900);
                      }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="jury"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22, ease }}
                  >
                    <JuryLoginForm
                      submitLabel="Entrar como júri"
                      onSuccess={(juryMember) => {
                        const name = juryMember?.name?.split(" ").slice(0, 2).join(" ") || "";
                        setWelcomeData({
                          title: name ? `Bem-vindo, ${name}` : "Acesso de júri validado",
                          subtitle: "Painel de avaliação disponível",
                          role: "júri",
                        });
                        setLoginStage("processing");
                        window.setTimeout(() => setLoginStage("welcome"), 700);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border/40 bg-muted/20 px-6 py-3.5">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Sessão segura · NEIC · Universidade Óscar Ribas</span>
            </div>
          </div>
        </motion.div>

        {/* Feature hints below card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 flex flex-col items-center gap-2"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Ao entrar podes</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {features.map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary/50" />
                {text}
              </span>
            ))}
          </div>
          <Link to="/" className="mt-2 text-xs font-medium text-primary hover:underline">
            Voltar à página inicial
          </Link>
        </motion.div>
      </div>

      {/* ─── Welcome / Processing overlay ─── */}
      <AnimatePresence>
        {loginStage !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl"
            >
              {/* Top gradient bar */}
              <div className="h-1.5 bg-gradient-to-r from-primary via-[#223D42] to-primary/40" />

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {loginStage === "processing" ? (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-5 text-center"
                    >
                      <div className="relative">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                          <Loader2 className="h-7 w-7 animate-spin text-primary" />
                        </div>
                        <motion.div
                          className="absolute -inset-2 rounded-3xl border-2 border-primary/20"
                          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.2, 0.5] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      </div>
                      <div>
                        <h2 className="font-heading text-xl font-bold text-foreground">A validar sessão</h2>
                        <p className="mt-1 text-sm text-muted-foreground">A verificar as tuas credenciais...</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="welcome"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="flex flex-col items-center gap-5 text-center"
                    >
                      {/* Success icon with animation */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
                          <CheckCircle2 className="h-7 w-7" />
                        </div>
                      </motion.div>

                      <div>
                        <motion.h2
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="font-heading text-xl font-bold text-foreground"
                        >
                          {welcomeData.title}
                        </motion.h2>
                        <motion.p
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          className="mt-1 text-sm text-muted-foreground"
                        >
                          {welcomeData.subtitle}
                        </motion.p>
                      </div>

                      {/* Role badge */}
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1"
                      >
                        {welcomeData.role === "júri" ? (
                          <KeyRound className="h-3 w-3 text-primary" />
                        ) : (
                          <GraduationCap className="h-3 w-3 text-primary" />
                        )}
                        <span className="text-[11px] font-semibold capitalize text-primary">{welcomeData.role}</span>
                      </motion.div>

                      {/* Redirect indicator */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                      >
                        <span>A redirecionar</span>
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
