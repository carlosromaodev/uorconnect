import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ArrowUpRight, LogIn, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionStudent, getToken } from "@/lib/api";
import { getPrimaryPortalHref } from "@/lib/contest-lab";
import { cn } from "@/lib/utils";
import {
  ContestBadge,
  ContestCard,
} from "@/components/challenges/contest-theme";
import {
  contestButtonClassNames,
  contestTheme,
} from "@/components/challenges/contest-theme.tokens";
import type { ChallengeContestConfig } from "@/data/challenges";
import type { ArenaClockState } from "@app/lib/arena-state";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/programas", label: "Programas" },
  { to: "/agenda", label: "Agenda" },
  { to: "/funcionamento", label: "Funcionamento" },
  { to: "/recursos", label: "Recursos" },
  { to: "/admin", label: "Admin" },
] as const;

export function LaboratorioPublicLayout({
  title,
  subtitle,
  contestConfig,
  clock,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  contestConfig: ChallengeContestConfig;
  clock: ArenaClockState;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const student = getSessionStudent();
  const hasSession = Boolean(getToken());

  return (
    <div className={cn("min-h-screen", contestTheme.shell)}>
      <div className="contest-graph-paper pointer-events-none fixed inset-0 opacity-50" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(123,211,198,0.14),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(255,190,92,0.1),transparent_20%)]" />

      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(15,22,35,0.86)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <img
                    src="/logouorconnectLaboratorio.svg"
                    alt="Laboratório UOR Connect"
                    className="h-11 w-auto shrink-0 md:h-12"
                  />
                  <div className="min-w-0">
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.22em] text-[#7bd3c6]">
                      laboratorio.uorconnect
                    </p>
                    <h1 className="mt-1 text-xl font-semibold text-white md:text-2xl">
                      Laboratório UOR Connect
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-[#98a7ba]">
                      Ecossistema prático para todos os cursos, com aprendizagem aplicada, inovação, mentoria e Arena técnica.
                    </p>
                    {clock.runtimePhase !== "scheduled" ? (
                      <div className="mt-3">
                        <RuntimePhaseBadge runtimePhase={clock.runtimePhase} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasSession ? (
                  <ContestCard padding="compact" className="px-3 py-2 shadow-none">
                    <p className="text-sm text-slate-200">
                      {student?.name?.split(" ").slice(0, 2).join(" ") || "Sessão ativa"}
                    </p>
                    <p className="text-xs text-[#7b8ca3]">{student?.course || "Estudante UOR"}</p>
                  </ContestCard>
                ) : (
                  <Button asChild className={cn("h-10 px-4", contestButtonClassNames.primary)}>
                    <NavLink to="/login">
                      Entrar
                      <LogIn className="ml-2 h-4 w-4" />
                    </NavLink>
                  </Button>
                )}

                <Button asChild variant="outline" className={cn("h-10 px-4", contestButtonClassNames.secondary)}>
                  <a href={getPrimaryPortalHref("/")}>
                    UOR Connect
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cn(
                    "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors",
                    isActive
                      ? "border-[#7bd3c6]/28 bg-[#7bd3c6]/10 text-[#7bd3c6]"
                      : "border-white/8 bg-white/[0.03] text-[#9fb0c3] hover:border-[#7bd3c6]/18 hover:text-white",
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <section className="mb-8 flex flex-col gap-4 border-b border-white/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <h2 className="text-3xl font-semibold text-white md:text-5xl">{title}</h2>
              {subtitle ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#8ea1b8] md:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}

export function LaboratorioPageSection({
  kicker,
  title,
  children,
  className,
}: {
  kicker?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <ContestCard>
        {kicker ? <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">{kicker}</p> : null}
        {title ? <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3> : null}
        <div className={cn((kicker || title) && "mt-5")}>{children}</div>
      </ContestCard>
    </section>
  );
}

export function RuntimePhaseBadge({ runtimePhase }: { runtimePhase: ArenaClockState["runtimePhase"] }) {
  if (runtimePhase === "running") {
    return (
      <ContestBadge tone="success">
        <ShieldCheck className="h-3.5 w-3.5" />
        Arena ativa
      </ContestBadge>
    );
  }

  if (runtimePhase === "finished") {
    return (
      <ContestBadge tone="neutral">
        <Trophy className="h-3.5 w-3.5" />
        Encerrado
      </ContestBadge>
    );
  }

  return <ContestBadge tone="warning">A aguardar início</ContestBadge>;
}
