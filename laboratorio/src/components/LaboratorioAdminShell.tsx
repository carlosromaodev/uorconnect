import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Radio,
  Shield,
  Trophy,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  api,
  type AdminAuthorizedStudent,
  type AdminSecurityOverview,
  getToken,
  isAuthError,
  isForbiddenError,
  setToken,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  contestButtonClassNames,
  contestTheme,
} from "@/components/challenges/contest-theme.tokens";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import type { ChallengeContestConfig } from "@/data/challenges";
import type { ArenaClockState } from "@app/lib/arena-state";
import { useLaboratorioHub } from "@app/lib/laboratorio-hub-state";

const adminItems = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/admin/programas", label: "Programas", icon: FolderKanban },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarRange },
  { to: "/admin/arena", label: "Arena", icon: Radio },
  { to: "/admin/security", label: "Segurança", icon: Shield },
  { to: "/admin/ranking", label: "Ranking Arena", icon: Trophy },
] as const;

export type LaboratorioAdminOutletContext = {
  securityOverview: AdminSecurityOverview;
  refreshSecurityOverview: () => Promise<void>;
  authorizeStudent: (studentNumber: string) => Promise<AdminAuthorizedStudent | null>;
  revokeStudent: (studentNumber: string) => Promise<boolean>;
  busyKey: string | null;
  contestConfig: ChallengeContestConfig;
  clock: ArenaClockState;
};

export function LaboratorioAdminShell({
  contestConfig,
  clock,
}: {
  contestConfig: ChallengeContestConfig;
  clock: ArenaClockState;
}) {
  const { agendaItems, modules } = useLaboratorioHub();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "unauthenticated" | "forbidden">("checking");
  const [securityOverview, setSecurityOverview] = useState<AdminSecurityOverview | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refreshSecurityOverview = async () => {
    if (!getToken()) {
      setAccessState("unauthenticated");
      return;
    }

    try {
      const overview = await api.contest.securityOverview();
      setSecurityOverview(overview);
      setAccessState("allowed");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        return;
      }

      if (isForbiddenError(error)) {
        setAccessState("forbidden");
        return;
      }

      toast.error(error instanceof Error ? error.message : "Falha ao carregar o painel do laboratório.");
      setAccessState("forbidden");
    }
  };

  useEffect(() => {
    void refreshSecurityOverview();
  }, []);

  const authorizeStudent = async (studentNumber: string) => {
    try {
      setBusyKey("authorize");
      const result = await api.contest.authorizeAdmin(studentNumber);
      await refreshSecurityOverview();
      toast.success("Conta autorizada no painel do laboratório.");
      return result;
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
      }

      toast.error(error instanceof Error ? error.message : "Falha ao autorizar estudante.");
      return null;
    } finally {
      setBusyKey(null);
    }
  };

  const revokeStudent = async (studentNumber: string) => {
    try {
      setBusyKey(`revoke-${studentNumber}`);
      await api.contest.revokeAdmin(studentNumber);
      await refreshSecurityOverview();
      toast.success("Autorização removida.");
      return true;
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
      }

      toast.error(error instanceof Error ? error.message : "Falha ao remover autorização.");
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const outletContext = useMemo<LaboratorioAdminOutletContext | null>(() => {
    if (!securityOverview) return null;
    return {
      securityOverview,
      refreshSecurityOverview,
      authorizeStudent,
      revokeStudent,
      busyKey,
      contestConfig,
      clock,
    };
  }, [busyKey, clock, contestConfig, securityOverview]);

  if (accessState === "checking") {
    return (
      <div className={cn("flex min-h-screen items-center justify-center", contestTheme.shell)}>
        <ContestCard className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#7bd3c6]" />
          A validar acesso ao admin do Laboratório...
        </ContestCard>
      </div>
    );
  }

  if (accessState !== "allowed" || !outletContext) {
    const isForbidden = accessState === "forbidden";
    return (
      <div className={cn("min-h-screen px-4 py-10", contestTheme.shell)}>
        <div className="mx-auto max-w-3xl">
          <ContestCard className="space-y-6">
            <ContestBadge tone={isForbidden ? "danger" : "warning"}>
              {isForbidden ? "acesso_negado" : "sessao_em_falta"}
            </ContestBadge>
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#7bd3c6]/16 bg-[#7bd3c6]/10 text-[#7bd3c6]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-semibold text-white">
                {isForbidden ? "A tua conta ainda não está autorizada." : "Faz login com uma conta autorizada."}
              </h1>
              <p className="text-sm leading-7 text-[#8ea1b8]">
                O painel administrativo do Laboratório depende de autenticação académica e autorização explícita para gerir programas, agenda, Arena e segurança.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
                <Link to="/login?redirect=%2Fadmin">Entrar no Laboratório</Link>
              </Button>
              <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
                <Link to="/">Voltar à home</Link>
              </Button>
            </div>
          </ContestCard>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen", contestTheme.shell)}>
      <div className="contest-graph-paper pointer-events-none fixed inset-0 opacity-55" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(123,211,198,0.14),transparent_24%),radial-gradient(circle_at_92%_10%,rgba(255,190,92,0.1),transparent_18%)]" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden w-[292px] border-r border-white/8 bg-[rgba(17,25,37,0.96)] px-5 py-6 lg:block">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.22em] text-[#7bd3c6]">laboratorio.admin</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Admin do Laboratório</h1>
          <p className="mt-3 text-sm leading-7 text-[#8ea1b8]">
            Gestão de programas, agenda, Arena e segurança com estrutura própria do Laboratório.
          </p>

          <nav className="mt-8 flex flex-col gap-2">
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl border px-4 text-sm transition-colors",
                  isActive
                    ? "border-[#7bd3c6]/24 bg-[#7bd3c6]/10 text-[#7bd3c6]"
                    : "border-white/8 bg-white/[0.03] text-[#94a6bb] hover:border-[#7bd3c6]/16 hover:text-white",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <ContestCard className="mt-8">
            <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">leitura.rapida</p>
            <p className="mt-2 text-xl font-semibold text-white">{modules.length} módulos · {agendaItems.length} eventos</p>
            <p className="mt-2 text-sm text-[#8ea1b8]">{clock.label}: {clock.display}</p>
          </ContestCard>
        </aside>

        <div className="flex-1 px-4 py-6 md:px-6">
          <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/8 bg-[rgba(16,24,36,0.86)] px-5 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">admin.runtime</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Operação do Laboratório</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className={cn("h-10 px-4", contestButtonClassNames.secondary)}>
                <Link to="/">Ver home</Link>
              </Button>
              <Button asChild className={cn("h-10 px-4", contestButtonClassNames.primary)}>
                <Link to="/agenda">Abrir agenda</Link>
              </Button>
            </div>
          </header>

          <nav className="mb-6 grid gap-2 sm:grid-cols-2 lg:hidden">
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex min-h-11 items-center gap-3 rounded-2xl border px-4 text-sm transition-colors",
                  isActive
                    ? "border-[#7bd3c6]/24 bg-[#7bd3c6]/10 text-[#7bd3c6]"
                    : "border-white/8 bg-white/[0.03] text-[#94a6bb] hover:border-[#7bd3c6]/16 hover:text-white",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}
