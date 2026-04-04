import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Database,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { api, type HomeContent, type StudentProfile } from "@/lib/api";
import { defaultHomeSocialConfig } from "@/lib/home-content";

const AGENDAR_EVENTO_URL = "https://agendar.uorconnect.space/";

const defaultHomeContent: HomeContent = {
  courses: [],
  panelTopics: [],
  socialConfig: defaultHomeSocialConfig,
};

export function PortalLoginPage({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate();
  const [homeContent, setHomeContent] = useState<HomeContent>(defaultHomeContent);
  const [loginStage, setLoginStage] = useState<"idle" | "processing" | "welcome">("idle");
  const [welcomeStudent, setWelcomeStudent] = useState<StudentProfile | null>(null);

  useEffect(() => {
    api.homeContent.list()
      .then(setHomeContent)
      .catch(() => setHomeContent(defaultHomeContent));
  }, []);

  useEffect(() => {
    if (loginStage !== "welcome") return;

    const timeout = window.setTimeout(() => navigate(redirectTo), 1600);
    return () => window.clearTimeout(timeout);
  }, [loginStage, navigate, redirectTo]);

  const communityCards = [
    {
      key: "instagram",
      label: "Instagram",
      url: homeContent.socialConfig.instagramUrl,
      icon: Instagram,
      className: "border-[#f97316]/20 bg-[linear-gradient(135deg,rgba(249,115,22,.12),rgba(236,72,153,.10))] text-[#f97316]",
      helper: "Abrir perfil oficial",
    },
    {
      key: "facebook",
      label: "Facebook",
      url: homeContent.socialConfig.facebookUrl,
      icon: Facebook,
      className: "border-[#2563eb]/20 bg-[linear-gradient(135deg,rgba(37,99,235,.12),rgba(59,130,246,.08))] text-[#2563eb]",
      helper: "Abrir perfil oficial",
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      url: homeContent.socialConfig.linkedinUrl,
      icon: Linkedin,
      className: "border-[#0a66c2]/20 bg-[linear-gradient(135deg,rgba(10,102,194,.12),rgba(6,182,212,.08))] text-[#0a66c2]",
      helper: "Abrir perfil oficial",
    },
    {
      key: "agendar",
      label: "Agendar para meu evento",
      url: AGENDAR_EVENTO_URL,
      icon: CalendarDays,
      className: "border-emerald-500/25 bg-[linear-gradient(135deg,rgba(5,150,105,.16),rgba(34,197,94,.10))] text-emerald-700",
      helper: "Abrir plataforma de agendamento",
    },
  ].filter((item) => item.url);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(2,132,199,0.14),transparent_28%),linear-gradient(180deg,rgba(255,250,245,1),rgba(255,255,255,1))] py-10 md:py-16">
      <div className="container mx-auto max-w-6xl px-4">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/70 bg-white shadow-sm">
              <img src="/logoworconnect.png" alt="UOR Connect" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Acesso académico</p>
              <h1 className="font-heading text-3xl font-bold md:text-4xl">Entrar no UOR Connect</h1>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            A autenticação valida a tua sessão académica para desbloquear votação, gostos, comentários e a tua área privada no portal.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }} className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,247,237,0.92))] p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1fr_100px_1fr] md:items-center">
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Origem</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-heading text-lg font-bold">secretaria.uor.edu.ao</p>
                      <p className="text-sm text-muted-foreground">Validação académica do estudante</p>
                    </div>
                  </div>
                </div>

                <div className="relative hidden h-20 md:block">
                  <div className="absolute left-2 right-2 top-1/2 border-t-2 border-dashed border-primary/35" />
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-primary px-2.5 py-2 text-primary-foreground shadow-lg"
                    animate={{ x: [0, 40, 0] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Send className="h-4 w-4 rotate-180" />
                  </motion.div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Destino</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/15 bg-white shadow-sm">
                      <img src="/logoworconnect.png" alt="UOR Connect" className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="font-heading text-lg font-bold">UOR Connect</p>
                      <p className="text-sm text-muted-foreground">Sessão segura no portal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-bold">Fluxo de validação</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      O backend valida a tua identidade académica e cria a sessão do portal sem guardar credenciais da secretaria.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[hsl(var(--area-web))]/10 p-2.5 text-[hsl(var(--area-web))]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-bold">Continuidade de sessão</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Depois do login regressas automaticamente para <span className="font-semibold text-foreground">{redirectTo}</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-xl backdrop-blur">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sessão</p>
                <h2 className="mt-2 font-heading text-2xl font-bold">Acesso de estudante</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Usa o teu número académico e a tua palavra-passe habitual.
                </p>
              </div>

              <StudentLoginForm
                mode="portal"
                submitLabel="Entrar no portal"
                onSuccess={(student) => {
                  setWelcomeStudent(student ?? null);
                  setLoginStage("processing");

                  window.setTimeout(() => {
                    setLoginStage("welcome");
                  }, 950);
                }}
              />

              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3.5 w-3.5" />
                Sessão académica reutilizada com segurança.
              </div>
            </div>
          </motion.div>
        </div>

        {communityCards.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Redes e acesso rápido</p>
              <div className="h-px flex-1 border-t border-dashed border-primary/25" />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {communityCards.map((item) => (
                <a
                  key={item.key}
                  href={item.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex h-full min-h-[112px] items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${item.className}`}
                >
                  <div className="rounded-xl bg-white/80 p-2.5 shadow-sm">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-heading font-bold leading-5">{item.label}</p>
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-foreground/70">{item.helper}</p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>

      {loginStage !== "idle" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(255,247,237,0.94))] shadow-2xl"
          >
            <div className="h-1.5 bg-[linear-gradient(90deg,#FD8305,#223D42)]" />
            <div className="p-7 md:p-8">
              {loginStage === "processing" ? (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Autenticação em processamento</p>
                    <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">A preparar a tua sessão</h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      A validar os teus dados académicos e a sincronizar o teu acesso ao UOR Connect.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Sessão validada</p>
                    <h2 className="mt-2 font-heading text-2xl font-bold text-foreground">
                      Bem-vindo ao UOR Connect, {welcomeStudent?.name || "Estudante"}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {welcomeStudent?.course || "Curso não informado"}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      A redirecionar para a tua área de navegação.
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
