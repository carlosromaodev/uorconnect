import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LaboratorioLoginPage({ redirectTo = "/" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!processing) return;
    const timeout = window.setTimeout(() => navigate(redirectTo), 900);
    return () => window.clearTimeout(timeout);
  }, [navigate, processing, redirectTo]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#101824] px-4 py-8 text-white">
      <div className="contest-graph-paper pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(123,211,198,0.14),transparent_24%),radial-gradient(circle_at_88%_10%,rgba(255,190,92,0.12),transparent_18%)]" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <ContestCard tone="accent" className="flex flex-col justify-between">
            <div>
              <img
                src="/logouorconnectLaboratorio.svg"
                alt="Laboratório UOR Connect"
                className="h-12 w-auto md:h-14"
              />
              <ContestBadge tone="accentStrong" className="mt-5">login.academico</ContestBadge>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white md:text-5xl">
                Entrar no Laboratório
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
                Usa a tua conta académica para entrar nos programas, agenda e experiências do Laboratório.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
                <Link to="/">
                  Voltar à home
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
                <Link to="/programas">Ver programas</Link>
              </Button>
            </div>
          </ContestCard>

          <ContestCard tone="terminal" className="relative">
            <div className="mb-6">
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">student.access</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Entrar no Laboratório</h2>
              <p className="mt-3 text-sm leading-7 text-[#8ea1b8]">
                Depois do login vais continuar em <span className="font-tech-mono text-[#7bd3c6]">{redirectTo}</span>.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-[rgba(255,255,255,0.03)] p-5">
              <StudentLoginForm
                mode="laboratorio"
                submitLabel="Entrar"
                onSuccess={() => {
                  setProcessing(true);
                }}
              />
            </div>

            {processing ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-[28px] bg-[rgba(3,8,12,0.82)] backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-2xl border border-[#7bd3c6]/18 bg-[#101824] px-5 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#7bd3c6]" />
                  A preparar a sessão do Laboratório...
                </div>
              </div>
            ) : null}
          </ContestCard>
        </div>
      </div>
    </div>
  );
}
