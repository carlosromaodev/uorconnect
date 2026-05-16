import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { JuryLoginForm } from "@/components/auth/JuryLoginForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type DigitalPassportReferralInvite,
  type JuryMember,
  type StudentProfile,
} from "@/lib/api";
import { UOR_EVENT_TITLE_HIGHLIGHT, UOR_EVENT_TITLE_PREFIX } from "@/lib/home-content";
import {
  buildPassportReferralAcceptedPath,
  buildPassportReferralDeclinedPath,
  clearPassportReferralAccepted,
  hasPassportReferralAccepted,
  markPassportReferralAccepted,
} from "@/lib/passport-referral-flow";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

type AuthMode = "student" | "jury";
type LoginStage = "idle" | "processing" | "welcome" | "choice";
type InviteDecision = "pending" | "accepted" | "declined";

type PortalLoginPageProps = {
  redirectTo: string;
  referralCode?: string | null;
  referralInvite?: DigitalPassportReferralInvite | null;
  referralLoading?: boolean;
};

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

function shouldShowStudentDestinationChoice(redirect: string) {
  const normalized = redirect.trim();
  return (
    normalized === "/" ||
    normalized === "/projetos" ||
    normalized === "/minha-area" ||
    normalized === "/minha-area?tab=inicio"
  );
}

export function PortalLoginPage({
  redirectTo,
  referralCode = null,
  referralInvite = null,
  referralLoading = false,
}: PortalLoginPageProps) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>("student");
  const [loginStage, setLoginStage] = useState<LoginStage>("idle");
  const [effectiveRedirect, setEffectiveRedirect] = useState(redirectTo);
  const [inviteDecision, setInviteDecision] = useState<InviteDecision>(() =>
    referralCode && hasPassportReferralAccepted(referralCode)
      ? "accepted"
      : "pending",
  );
  const [welcomeData, setWelcomeData] = useState<{
    title: string;
    subtitle: string;
    role: string;
  }>({ title: "Sessão validada", subtitle: "A redirecionar...", role: "estudante" });

  useEffect(() => {
    if (!referralCode) {
      setInviteDecision("pending");
      return;
    }

    setInviteDecision(
      hasPassportReferralAccepted(referralCode) ? "accepted" : "pending",
    );
  }, [referralCode]);

  useEffect(() => {
    if (referralCode && inviteDecision === "accepted") {
      setEffectiveRedirect(
        buildPassportReferralAcceptedPath(redirectTo, referralCode),
      );
      return;
    }

    if (referralCode && inviteDecision === "declined") {
      setEffectiveRedirect(buildPassportReferralDeclinedPath(redirectTo));
      return;
    }

    setEffectiveRedirect(redirectTo);
  }, [inviteDecision, redirectTo, referralCode]);

  useEffect(() => {
    if (
      referralCode &&
      !referralLoading &&
      !referralInvite &&
      inviteDecision === "pending"
    ) {
      clearPassportReferralAccepted();
      setInviteDecision("declined");
      setEffectiveRedirect(buildPassportReferralDeclinedPath(redirectTo));
    }
  }, [
    inviteDecision,
    redirectTo,
    referralCode,
    referralInvite,
    referralLoading,
  ]);

  useEffect(() => {
    if (loginStage !== "welcome") return;

    const timeout = window.setTimeout(() => navigate(effectiveRedirect), 1800);
    return () => window.clearTimeout(timeout);
  }, [loginStage, navigate, effectiveRedirect]);

  const handleAcceptPassportInvite = () => {
    if (!referralCode) return;

    markPassportReferralAccepted(referralCode);
    setInviteDecision("accepted");
    setEffectiveRedirect(
      buildPassportReferralAcceptedPath(redirectTo, referralCode),
    );
  };

  const handleDeclinePassportInvite = () => {
    clearPassportReferralAccepted();
    setInviteDecision("declined");
    setEffectiveRedirect(buildPassportReferralDeclinedPath(redirectTo));
  };

  const getStudentRedirect = () => {
    if (referralCode && hasPassportReferralAccepted(referralCode)) {
      return buildPassportReferralAcceptedPath(redirectTo, referralCode);
    }

    if (referralCode && inviteDecision === "declined") {
      return buildPassportReferralDeclinedPath(redirectTo);
    }

    return effectiveRedirect;
  };

  const openPassportChallenge = () => {
    navigate("/minha-area?tab=desafio");
  };

  const openProjects = () => {
    navigate("/projetos");
  };

  const showReferralDialog = Boolean(
    referralCode &&
      inviteDecision === "pending" &&
      (referralLoading || referralInvite),
  );
  const passportReferralLoginOnly = Boolean(
    referralCode && inviteDecision === "accepted",
  );
  const referralInviterName =
    referralInvite?.inviterName?.trim() || "um estudante";

  useEffect(() => {
    if (passportReferralLoginOnly) setAuthMode("student");
  }, [passportReferralLoginOnly]);

  return (
    <div className="relative min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[420px] flex-col justify-center">
        <section className="w-full">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="mb-5 flex flex-col items-center gap-3 text-center"
          >
            <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-16 w-auto max-w-[190px] object-contain" />
            <p className="max-w-sm text-sm font-semibold leading-6 text-slate-600">
              {UOR_EVENT_TITLE_PREFIX} {UOR_EVENT_TITLE_HIGHLIGHT}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease }}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="h-1 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400" />

            <div className="p-5 md:p-6">
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    UOR Connect
                  </p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">Iniciar sessão</h2>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    {passportReferralLoginOnly
                      ? "Este convite é exclusivo para estudantes UOR com sessão académica validada."
                      : "Escolhe o teu tipo de acesso para continuar."}
                  </p>
                </div>

                {referralCode && inviteDecision === "accepted" ? (
                  <div className="border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-sm font-black text-emerald-950">
                          Convite aceite
                        </p>
                        <p className="mt-0.5 text-xs font-medium leading-5 text-emerald-800">
                          Inicia sessão para ativar o Passaporte Digital e abrir
                          a aba Desafios.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!passportReferralLoginOnly ? (
                  <ModeSelector mode={authMode} onChange={setAuthMode} />
                ) : null}

                <AnimatePresence mode="wait">
                  {passportReferralLoginOnly || authMode === "student" ? (
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
                        allowConventional={!passportReferralLoginOnly}
                        onSuccess={(student) => {
                          const name = student?.name?.split(" ").slice(0, 2).join(" ") || "";
                          const nextRedirect = getStudentRedirect();
                          const needsProfileCompletion = !student?.profileCompletedAt;
                          if (!student?.profileCompletedAt) {
                            setEffectiveRedirect(`/completar-perfil?redirect=${encodeURIComponent(nextRedirect)}`);
                          } else {
                            setEffectiveRedirect(nextRedirect);
                          }
                          setWelcomeData({
                            title: name ? `Bem-vindo, ${name}` : "Sessão validada",
                            subtitle: student?.course || "A redirecionar para a plataforma...",
                            role: "estudante",
                          });
                          setLoginStage("processing");
                          window.setTimeout(() => {
                            setLoginStage(
                              !needsProfileCompletion &&
                                shouldShowStudentDestinationChoice(nextRedirect)
                                ? "choice"
                                : "welcome",
                            );
                          }, 900);
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

            <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Lock className="h-3 w-3" />
                <span>Sessão segura · NEIC · Universidade Óscar Ribas</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-5 flex justify-center"
          >
            <Link to="/" className="text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline">
              Voltar à página inicial
            </Link>
          </motion.div>
        </section>
      </main>

      <Dialog
        open={showReferralDialog}
        onOpenChange={(open) => {
          if (!open && showReferralDialog) handleDeclinePassportInvite();
        }}
      >
        <DialogContent className="challenge-answer-modal overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl sm:max-w-lg">
          <div className="challenge-answer-modal__grid" aria-hidden="true" />
          <div className="challenge-answer-modal__header px-5 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black">
                <UsersRound className="h-5 w-5 text-emerald-300" />
                Foste convidado para o Desafio UOR Connect
              </DialogTitle>
              <DialogDescription className="text-sm text-white/70">
                O desafio vai decorrer durante a atividade. {referralInviterName} convidou-te
                para entrar, cumprir etapas por QR e competir no ranking dos estudantes.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="relative space-y-4 p-5">
            {referralLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                A validar o convite...
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Convite recebido
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {referralInviterName}
                </p>
                {referralInvite?.inviterCourse ? (
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    {referralInvite.inviterCourse}
                  </p>
                ) : null}
              </div>
            )}

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">
                    Prémio oficial
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-700">
                    O prémio inclui ChatGPT Pro, pagamento de 1 recurso para
                    estudante elegível, perfis de 1 mês de{" "}
                    <span className="font-black" style={{ color: "#00A8E1" }}>Prime Video</span>,{" "}
                    <span className="font-black" style={{ color: "#7B2CBF" }}>HBO Max</span> e{" "}
                    <span className="font-black" style={{ color: "#58CC02" }}>Duolingo Super</span>.
                    Certificado Top 3 para os melhores classificados.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="h-12 rounded-2xl bg-indigo-600 font-black text-white hover:bg-indigo-700"
                onClick={handleDeclinePassportInvite}
              >
                <X className="mr-2 h-4 w-4" />
                Não, prefiro votar
              </Button>
              <Button
                type="button"
                className="h-12 rounded-2xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                disabled={referralLoading}
                onClick={handleAcceptPassportInvite}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aceitar convite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Welcome / Processing overlay ─── */}
      <AnimatePresence>
        {loginStage !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              {/* Top gradient bar */}
              <div className="h-1 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-400" />

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
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                          <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
                        </div>
                        <motion.div
                          className="absolute -inset-2 rounded-3xl border-2 border-slate-200"
                          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.2, 0.5] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      </div>
                      <div>
                        <h2 className="font-heading text-xl font-bold text-foreground">A validar sessão</h2>
                        <p className="mt-1 text-sm text-muted-foreground">A verificar as tuas credenciais...</p>
                      </div>
                    </motion.div>
                  ) : loginStage === "choice" ? (
                    <motion.div
                      key="choice"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.25, ease }}
                      className="space-y-5 text-center"
                    >
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                          {welcomeData.title}
                        </p>
                        <h2 className="font-heading text-xl font-black text-foreground">
                          Escolhe por onde queres começar
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          O teu login já foi validado. Podes abrir o desafio
                          disponível ou ir direto aos projetos para votar e
                          explorar.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Button
                          type="button"
                          className="h-12 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                          onClick={openPassportChallenge}
                        >
                          <Trophy className="mr-2 h-4 w-4" />
                          Ver desafio disponível
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-xl border-slate-300 font-black"
                          onClick={openProjects}
                        >
                          <UsersRound className="mr-2 h-4 w-4" />
                          Ver projetos
                        </Button>
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
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                      >
                        {welcomeData.role === "júri" ? (
                          <KeyRound className="h-3 w-3 text-slate-600" />
                        ) : (
                          <GraduationCap className="h-3 w-3 text-slate-600" />
                        )}
                        <span className="text-[11px] font-semibold capitalize text-slate-700">{welcomeData.role}</span>
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
