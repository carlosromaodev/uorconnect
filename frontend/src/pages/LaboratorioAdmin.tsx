import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Clock3,
  Loader2,
  Lock,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { AdminContestTab } from "@/components/admin/AdminContestTab";
import { ContestLayout } from "@/components/challenges/ContestLayout";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames, contestInputClassName, contestTextClassNames } from "@/components/challenges/contest-theme.tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  api,
  type AdminSecurityOverview,
  getToken,
  isAuthError,
  isForbiddenError,
  setToken,
} from "@/lib/api";
import { challengeContestConfig, challengeItems } from "@/data/challenges";
import { getContestLinkPath, getContestLoginHref, useContestClock } from "@/lib/contest-lab";
import { cn } from "@/lib/utils";

function normalizeStudentNumberInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function fetchContestSecurityOverview() {
  return api.contest.securityOverview();
}

export default function LaboratorioAdmin() {
  const clock = useContestClock();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "unauthenticated" | "forbidden">("checking");
  const [securityOverview, setSecurityOverview] = useState<AdminSecurityOverview | null>(null);
  const [authorizedStudentNumber, setAuthorizedStudentNumber] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSecurityOverview() {
      if (!getToken()) {
        if (active) {
          setAccessState("unauthenticated");
        }
        return;
      }

      try {
        const overview = await fetchContestSecurityOverview();
        if (!active) return;
        setSecurityOverview(overview);
        setAccessState("allowed");
      } catch (error) {
        if (!active) return;
        if (isAuthError(error)) {
          setToken(null);
          setAccessState("unauthenticated");
          return;
        }
        if (isForbiddenError(error)) {
          setAccessState("forbidden");
          return;
        }

        toast.error(error instanceof Error ? error.message : "Falha ao carregar a segurança do laboratório.");
        setAccessState("forbidden");
      }
    }

    void loadSecurityOverview();

    return () => {
      active = false;
    };
  }, []);

  const handleAuthorizeStudent = async () => {
    const studentNumber = normalizeStudentNumberInput(authorizedStudentNumber);
    if (studentNumber.length !== 8) {
      toast.warning("Informa um número de estudante com 8 dígitos.");
      return;
    }

    try {
      setBusyKey("authorize");
      await api.contest.authorizeAdmin(studentNumber);
      const overview = await fetchContestSecurityOverview();
      setSecurityOverview(overview);
      setAuthorizedStudentNumber("");
      toast.success("Acesso ao laboratório autorizado.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning("A sessão expirou. Faz login novamente.");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Não tens permissão para alterar o acesso do laboratório.");
      } else {
        toast.error(error instanceof Error ? error.message : "Falha ao autorizar estudante.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleRevokeStudent = async (studentNumber: string) => {
    try {
      setBusyKey(`revoke-${studentNumber}`);
      await api.contest.revokeAdmin(studentNumber);
      const overview = await fetchContestSecurityOverview();
      setSecurityOverview(overview);
      toast.success("Acesso ao laboratório removido.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning("A sessão expirou. Faz login novamente.");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Não tens permissão para alterar o acesso do laboratório.");
      } else {
        toast.error(error instanceof Error ? error.message : "Falha ao remover acesso.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" className={cn(contestButtonClassNames.secondary, "h-11 px-4")}>
        <Link to={getContestLinkPath("/")}>Ver landing</Link>
      </Button>
      <Button asChild className={cn(contestButtonClassNames.primary, "h-11 px-4")}>
        <Link to={getContestLinkPath("/arena")}>Abrir arena</Link>
      </Button>
      <Button asChild variant="outline" className={cn(contestButtonClassNames.secondary, "h-11 px-4")}>
        <Link to={getContestLinkPath("/ranking")}>Ver ranking</Link>
      </Button>
    </div>
  );

  const renderGateState = () => {
    if (accessState === "checking") {
      return (
        <ContestCard tone="terminal" padding="cozy" className="flex min-h-[260px] items-center justify-center">
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-[#00e5c8]" />
            A validar acesso ao laboratório...
          </div>
        </ContestCard>
      );
    }

    if (accessState === "unauthenticated" || accessState === "forbidden") {
      return (
        <ContestCard tone="terminal" padding="default" className="space-y-5">
          <div className="inline-flex items-center gap-2">
            <ContestBadge tone={accessState === "forbidden" ? "danger" : "warning"}>
              {accessState === "forbidden" ? "acesso_negado" : "sessao_em_falta"}
            </ContestBadge>
          </div>
          <div className="space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-[#00e5c8]">
              {accessState === "forbidden" ? <AlertTriangle className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <h2 className="text-2xl font-semibold text-white">
              {accessState === "forbidden" ? "A tua conta não está autorizada para este painel." : "Inicia sessão com uma conta autorizada."}
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[#7b8ca3]">
              Este painel é reservado à governação interna do laboratório. A autenticação acontece através do login do laboratório e as autorizações são geridas aqui.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className={cn(contestButtonClassNames.primary, "h-11 px-5")}>
              <Link to={getContestLoginHref("/admin")}>Entrar no laboratório</Link>
            </Button>
            <Button asChild variant="outline" className={cn(contestButtonClassNames.secondary, "h-11 px-5")}>
              <Link to={getContestLinkPath("/")}>Voltar ao laboratório</Link>
            </Button>
          </div>
        </ContestCard>
      );
    }

    return null;
  };

  const renderAllowedContent = () => {
    if (accessState !== "allowed" || !securityOverview) {
      return null;
    }

    const overview = securityOverview;

    return (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Autorizados"
            value={String(overview.authorizedStudents.length)}
            description="contas com acesso ao painel"
            icon={Users}
          />
          <MetricCard
            label="Logins recentes"
            value={String(overview.recentLogins.length)}
            description="auditoria visível no painel"
            icon={Clock3}
          />
          <MetricCard
            label="Desafios"
            value={String(challengeItems.length)}
            description="catálogo ativo do laboratório"
            icon={Trophy}
          />
          <MetricCard
            label="Contagem"
            value={clock.display}
            description={clock.label}
            icon={Sparkles}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <ContestCard tone="default" className="space-y-6">
            <div className="space-y-3">
              <p className={contestTextClassNames.accentLabel}>laboratorio.governance</p>
              <h2 className="text-2xl font-semibold text-white">Governação interna do laboratório</h2>
              <p className="max-w-3xl text-sm leading-7 text-[#7b8ca3]">
                O painel do laboratório não depende do painel do portal. Aqui concentras o acesso autorizado, a janela do concurso, o ranking e a operação das submissões.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {challengeContestConfig.generalRules.map((rule) => (
                <div key={rule} className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm leading-7 text-slate-300">
                  <span className="mr-2 font-tech-mono text-[#00e5c8]">{">"}</span>
                  {rule}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <ContestBadge tone="neutral">HOST :: laboratório</ContestBadge>
              <ContestBadge tone="neutral">CURSO :: {challengeContestConfig.course}</ContestBadge>
              <ContestBadge tone="neutral">JANELA :: {challengeContestConfig.durationMinutes} MIN</ContestBadge>
              <ContestBadge tone="neutral">VENUE :: {challengeContestConfig.venue}</ContestBadge>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className={cn(contestButtonClassNames.primary, "h-11 px-5")}>
                <Link to={getContestLinkPath("/")}>Abrir página pública</Link>
              </Button>
              <Button asChild variant="outline" className={cn(contestButtonClassNames.secondary, "h-11 px-5")}>
                <Link to={getContestLinkPath("/regras")}>Regras públicas</Link>
              </Button>
              <Button asChild variant="outline" className={cn(contestButtonClassNames.secondary, "h-11 px-5")}>
                <Link to={getContestLinkPath("/ranking")}>Ranking público</Link>
              </Button>
            </div>
          </ContestCard>

          <ContestCard tone="terminal" className="space-y-5">
            <div>
              <p className={contestTextClassNames.accentLabel}>laboratorio.access_control</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Acesso autorizado</h2>
              <p className="mt-3 text-sm leading-7 text-[#7b8ca3]">
                Autoriza ou revoga rapidamente contas com acesso ao painel do laboratório.
              </p>
            </div>

            <div className="space-y-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8ca3]">Número de estudante</span>
                <Input
                  value={authorizedStudentNumber}
                  onChange={(event) => setAuthorizedStudentNumber(normalizeStudentNumberInput(event.target.value))}
                  placeholder="20242099"
                  inputMode="numeric"
                  maxLength={8}
                  className={contestInputClassName}
                />
              </label>
              <Button
                type="button"
                onClick={handleAuthorizeStudent}
                disabled={busyKey === "authorize"}
                className={cn(contestButtonClassNames.primary, "h-11 w-full")}
              >
                {busyKey === "authorize" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A autorizar...
                  </span>
                ) : (
                  "Autorizar acesso"
                )}
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b8ca3]">Contas autorizadas</h3>
              {overview.authorizedStudents.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-[#7b8ca3]">
                  Ainda não existem contas autorizadas para o painel do laboratório.
                </div>
              ) : (
                overview.authorizedStudents.map((student) => (
                  <div key={student.studentNumber} className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{student.studentNumber}</p>
                      <p className="mt-1 text-xs text-[#7b8ca3]">Autorizado em {formatDateLabel(student.createdAt)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleRevokeStudent(student.studentNumber)}
                      disabled={busyKey === `revoke-${student.studentNumber}`}
                      className={cn(contestButtonClassNames.secondary, "h-10 px-4")}
                    >
                      {busyKey === `revoke-${student.studentNumber}` ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          A remover...
                        </span>
                      ) : (
                        "Revogar"
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7b8ca3]">Últimos logins</h3>
              {overview.recentLogins.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-[#7b8ca3]">
                  Ainda não existem logins recentes para apresentar.
                </div>
              ) : (
                overview.recentLogins.slice(0, 5).map((student) => (
                  <div key={`${student.studentNumber}-${student.updatedAt}`} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{student.name ?? student.studentNumber}</p>
                        <p className="mt-1 text-xs text-[#7b8ca3]">
                          {student.studentNumber} · {student.course ?? "Curso não informado"}
                        </p>
                      </div>
                      <ContestBadge tone="muted" size="compact">
                        {formatDateLabel(student.lastLoginAt)}
                      </ContestBadge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ContestCard>
        </section>
      </>
    );
  };

  return (
    <ContestLayout
      title="Administração do laboratório"
      subtitle="Painel interno separado do portal, com autenticação própria do laboratório, acesso autorizado e governação do concurso."
      headerActions={headerActions}
    >
      {renderGateState()}

      {accessState === "allowed" ? (
        <div className="mt-6 space-y-6">
          {renderAllowedContent()}
          <AdminContestTab />
        </div>
      ) : null}
    </ContestLayout>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <ContestCard tone="subtle" padding="compact" className="space-y-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#00e5c8]/18 bg-[#00e5c8]/10 text-[#00e5c8]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        <p className="mt-2 text-sm leading-6 text-[#7b8ca3]">{description}</p>
      </div>
    </ContestCard>
  );
}
