import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Binary, Cpu, Loader2, ShieldCheck, Sparkles, TerminalSquare, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { ContestBadge, ContestCard, ContestProgressBar } from "@/components/challenges/contest-theme";
import { contestButtonClassNames, contestTextClassNames, contestTheme } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { type StudentProfile } from "@/lib/api";
import { getContestBrandAsset, getPrimaryPortalHref, isContestLabHost } from "@/lib/contest-lab";
import { challengeContestConfig, challengeItems } from "@/data/challenges";
import { cn } from "@/lib/utils";

const featureCards = [
  {
    title: "Arena isolada",
    description: "Sessão, ranking, catálogo e operação técnica tratados como produto separado do portal principal.",
    icon: Cpu,
  },
  {
    title: "Runtime competitivo",
    description: "Experiência desenhada para prova, espera, entrada na arena e revisão de ranking sem linguagem do portal.",
    icon: TerminalSquare,
  },
  {
    title: "Governança própria",
    description: "Admin do Laboratório, autorização e auditoria mantidos fora do dashboard principal do UOR Connect.",
    icon: Trophy,
  },
] as const;

const bootLines = [
  "boot.identity :: ready",
  "boot.auth_backend :: laboratorio",
  "boot.runtime :: isolated",
];

export function LaboratorioLoginPage({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const contestLabHost = isContestLabHost(hostname);
  const brandAsset = getContestBrandAsset(hostname, "/desafios/login");
  const [loginStage, setLoginStage] = useState<"idle" | "processing" | "welcome">("idle");
  const [welcomeStudent, setWelcomeStudent] = useState<StudentProfile | null>(null);
  const [bootIndex, setBootIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBootIndex((current) => (current + 1) % bootLines.length);
    }, 900);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loginStage !== "welcome") return;

    const timeout = window.setTimeout(() => navigate(redirectTo), 1500);
    return () => window.clearTimeout(timeout);
  }, [loginStage, navigate, redirectTo]);

  return (
    <div className={cn("relative min-h-screen overflow-hidden", contestTheme.shell)}>
      <div className="contest-graph-paper pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,200,0.18),transparent_24%),radial-gradient(circle_at_85%_10%,rgba(124,58,237,0.14),transparent_18%),radial-gradient(circle_at_bottom_right,rgba(22,249,254,0.12),transparent_28%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-6 md:py-8">
        <header className={cn("mb-8 flex flex-col gap-4 rounded-[28px] border px-5 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between", contestTheme.border, contestTheme.surfaceSoft)}>
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#00e5c8]/18 bg-[rgba(255,255,255,0.04)]">
              <img src={brandAsset} alt="UOR Connect Laboratorio" className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0">
              <p className={contestTextClassNames.accentLabel}>laboratorio.auth</p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Entrada técnica do Laboratório</h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!contestLabHost ? (
              <Button asChild variant="outline" className={cn(contestButtonClassNames.secondary, "h-11 px-4")}>
                <a href={getPrimaryPortalHref("/")}>Portal principal</a>
              </Button>
            ) : null}
            <Button asChild className={cn(contestButtonClassNames.primary, "h-11 px-4")}>
              <Link to={contestLabHost ? "/" : "/desafios"}>
                Abrir landing do laboratório
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContestCard tone="accent" className="overflow-hidden">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <ContestBadge tone="accentStrong">auth.runtime</ContestBadge>
                  <h2 className="mt-5 max-w-[14ch] text-4xl font-semibold leading-none text-white md:text-6xl">
                    Sessão separada para o Laboratório
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                    Aqui não reaproveitamos a linguagem visual do portal. O Laboratório tem identidade técnica própria, navegação própria e fluxo de autenticação orientado à arena.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <ContestBadge tone="neutral">desafios :: {challengeItems.length}</ContestBadge>
                    <ContestBadge tone="neutral">janela :: {challengeContestConfig.durationMinutes} min</ContestBadge>
                    <ContestBadge tone="neutral">curso :: {challengeContestConfig.course}</ContestBadge>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#00e5c8]/14 bg-[linear-gradient(180deg,rgba(2,10,14,0.86),rgba(4,9,13,0.94))] p-5">
                  <p className={contestTextClassNames.mutedLabel}>boot.sequence</p>
                  <div className="mt-4 space-y-3">
                    {bootLines.map((line, index) => (
                      <div
                        key={line}
                        className={cn(
                          "rounded-2xl border px-4 py-3 font-tech-mono text-xs tracking-[0.16em] transition-colors",
                          index === bootIndex
                            ? "border-[#00e5c8]/26 bg-[#00e5c8]/10 text-[#00e5c8]"
                            : "border-white/8 bg-white/[0.03] text-[#7b8ca3]",
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                  <ContestProgressBar className="mt-5" value={loginStage === "idle" ? 36 : loginStage === "processing" ? 72 : 100} />
                  <p className="mt-4 text-sm leading-6 text-[#7b8ca3]">
                    O backend continua intacto. O que muda é a experiência: o Laboratório passa a comportar-se como sistema autónomo.
                  </p>
                </div>
              </div>
            </ContestCard>

            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map((item, index) => (
                <motion.div key={item.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * index }}>
                  <ContestCard tone="default" className="h-full">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-lg font-semibold text-white">{item.title}</p>
                    <p className="mt-3 text-sm leading-7 text-[#7b8ca3]">{item.description}</p>
                  </ContestCard>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <ContestCard tone="terminal" className="h-full">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={contestTextClassNames.accentLabel}>student.access</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Login do Laboratório</h2>
                  <p className="mt-3 text-sm leading-7 text-[#7b8ca3]">
                    Depois da autenticação vais continuar em <span className="font-tech-mono text-[#00e5c8]">{redirectTo}</span>.
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]">
                  <Binary className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 rounded-[28px] border border-[#1a2632] bg-[linear-gradient(180deg,rgba(10,16,22,0.98),rgba(7,12,17,0.96))] p-5">
                <StudentLoginForm
                  mode="laboratorio"
                  submitLabel="Entrar no Laboratório"
                  onSuccess={(student) => {
                    setWelcomeStudent(student ?? null);
                    setLoginStage("processing");

                    window.setTimeout(() => {
                      setLoginStage("welcome");
                    }, 900);
                  }}
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 p-2.5 text-[#00e5c8]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Backend preservado</p>
                    <p className="mt-2 text-sm leading-6 text-[#7b8ca3]">
                      A sessão continua a ser validada pelo backend já existente. Esta intervenção separa visual, fluxo e runtime do Laboratório sem quebrar o contrato de autenticação.
                    </p>
                  </div>
                </div>
              </div>
            </ContestCard>
          </motion.section>
        </div>
      </div>

      {loginStage !== "idle" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,10,0.76)] px-4 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-xl overflow-hidden rounded-[32px] border border-[#00e5c8]/16 bg-[linear-gradient(180deg,rgba(5,11,16,0.98),rgba(8,12,18,1))] shadow-[0_32px_90px_rgba(0,0,0,0.42)]"
          >
            <div className="h-1.5 bg-[linear-gradient(90deg,#00e5c8,#16F9FE,#7c3aed)]" />
            <div className="p-8">
              {loginStage === "processing" ? (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <div>
                    <p className={contestTextClassNames.accentLabel}>auth.processing</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">A preparar o runtime técnico</h2>
                    <p className="mt-3 text-sm leading-7 text-[#7b8ca3]">
                      A conta foi validada e a sessão do Laboratório está a ser carregada com o perfil competitivo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#00e5c8]/16 bg-[#00e5c8] text-[#041013]">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div>
                    <p className={contestTextClassNames.accentLabel}>session.validated</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      Bem-vindo ao Laboratório, {welcomeStudent?.name || "Estudante"}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[#7b8ca3]">
                      {welcomeStudent?.course || "Curso não informado"}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[#7b8ca3]">
                      A redirecionar para o teu ambiente técnico.
                    </p>
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
