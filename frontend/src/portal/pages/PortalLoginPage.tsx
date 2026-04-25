import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { JuryLoginForm } from "@/components/auth/JuryLoginForm";
import { type JuryMember, type StudentProfile } from "@/lib/api";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

type AuthMode = "student" | "jury";
type LoginStage = "idle" | "processing" | "welcome";

function ModeSelector({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  const options: Array<{ key: AuthMode; label: string; icon: typeof GraduationCap }> = [
    { key: "student", label: "Estudante", icon: GraduationCap },
    { key: "jury", label: "Júri", icon: KeyRound },
  ];

  return (
    <div className="flex gap-1 rounded-2xl border border-border/70 bg-muted/35 p-1.5">
      {options.map(({ key, label, icon: Icon }) => {
        const active = mode === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
          >
            {active ? (
              <motion.div
                layoutId="uor-login-mode"
                className="absolute inset-0 rounded-xl bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]"
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
              />
            ) : null}
            <span className="relative flex items-center gap-2 text-foreground">
              <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function getWelcomeStudentText(student: StudentProfile | null) {
  if (student?.name) {
    return `Bem-vindo, ${student.name}`;
  }

  return "Sessão validada";
}

function getWelcomeJuryText(jury: JuryMember | null) {
  if (jury?.name) {
    return `Bem-vindo, ${jury.name}`;
  }

  return "Acesso de júri validado";
}

export function PortalLoginPage({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("student");
  const [loginStage, setLoginStage] = useState<LoginStage>("idle");
  const [welcomeTitle, setWelcomeTitle] = useState("Sessão validada");
  const [welcomeSubtitle, setWelcomeSubtitle] = useState("A redirecionar...");

  useEffect(() => {
    if (loginStage !== "welcome") return;

    const timeout = window.setTimeout(() => navigate(redirectTo), 1500);
    return () => window.clearTimeout(timeout);
  }, [loginStage, navigate, redirectTo]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_14%_14%,rgba(249,115,22,0.12),transparent_25%),radial-gradient(circle_at_86%_12%,rgba(37,99,235,0.10),transparent_26%),linear-gradient(180deg,#fffdf9,#ffffff)] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="w-full max-w-md"
      >
        {/* Brand header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-white shadow-sm">
            <img src="/logoworconnect.png" alt="UOR Connect" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">UOR Connect</h1>
            <p className="mt-1 text-sm text-muted-foreground">Inicia sessão para continuar</p>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-[18px] border border-border/70 bg-card/95 p-6 shadow-2xl md:p-8">
          <div className="space-y-5">
            <ModeSelector mode={authMode} onChange={setAuthMode} />

            <AnimatePresence mode="wait">
              {authMode === "student" ? (
                <motion.div
                  key="student"
                  initial={{ opacity: 0, x: 20, filter: "blur(5px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -20, filter: "blur(5px)" }}
                  transition={{ duration: 0.28, ease }}
                >
                  <StudentLoginForm
                    mode="portal"
                    submitLabel="Entrar"
                    onSuccess={(student) => {
                      setWelcomeTitle(getWelcomeStudentText(student ?? null));
                      setWelcomeSubtitle(student?.course || "A redirecionar...");
                      setLoginStage("processing");
                      window.setTimeout(() => setLoginStage("welcome"), 950);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="jury"
                  initial={{ opacity: 0, x: 20, filter: "blur(5px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -20, filter: "blur(5px)" }}
                  transition={{ duration: 0.28, ease }}
                >
                  <JuryLoginForm
                    submitLabel="Entrar como júri"
                    onSuccess={(juryMember) => {
                      setWelcomeTitle(getWelcomeJuryText(juryMember ?? null));
                      setWelcomeSubtitle("A redirecionar...");
                      setLoginStage("processing");
                      window.setTimeout(() => setLoginStage("welcome"), 700);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Sessão segura
            </div>
          </div>
        </div>
      </motion.div>

      {loginStage !== "idle" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg overflow-hidden rounded-[18px] border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,247,237,0.94))] shadow-2xl"
          >
            <div className="h-1.5 bg-[linear-gradient(90deg,#FD8305,#223D42)]" />
            <div className="p-7 md:p-8">
              {loginStage === "processing" ? (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <div>
                    <h2 className="font-heading text-2xl font-bold text-foreground">A validar sessão...</h2>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">{welcomeTitle}</h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{welcomeSubtitle}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
