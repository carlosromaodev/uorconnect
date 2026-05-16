import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, BadgeCheck, CheckCircle2, ExternalLink, Loader2, LockKeyhole, UsersRound } from "lucide-react";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { api, getSessionStudent, isAuthError, setToken, type StudentProfile, type SubmissionTeamPayload } from "@/lib/api";

function statusText(status: string) {
  if (status === "APPROVED") return "Aprovado";
  if (status === "REJECTED") return "Recusado";
  return "Em análise";
}

function normalizeStudentNumber(value?: string | null) {
  return (value ?? "").replace(/\D/g, "").trim();
}

function resolvePreferredMemberId(
  payload: SubmissionTeamPayload,
  currentStudent?: StudentProfile | null,
) {
  const studentNumber = normalizeStudentNumber(currentStudent?.studentNumber);
  if (studentNumber) {
    const matchingExpectedMember = payload.members.find((member) => (
      !member.confirmed
      && normalizeStudentNumber(member.expectedStudentNumber) === studentNumber
    ));
    if (matchingExpectedMember) return matchingExpectedMember.id;
  }

  return payload.members.find((member) => !member.confirmed)?.id
    ?? payload.members[0]?.id
    ?? null;
}

export default function TeamInvitation() {
  const { token = "" } = useParams();
  const [team, setTeam] = useState<SubmissionTeamPayload | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(() => getSessionStudent());
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Confirmar equipa | UOR Connect";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.submissions.teamInvitation(token)
      .then((payload) => {
        if (!active) return;
        setTeam(payload);
        setSelectedMemberId((current) => (
          current ?? resolvePreferredMemberId(payload, student)
        ));
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Convite de equipa não encontrado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const selectedMember = useMemo(
    () => team?.members.find((member) => member.id === selectedMemberId) ?? null,
    [selectedMemberId, team?.members],
  );
  const hasSecretariaSession = Boolean(student?.academicSyncedAt);

  const handleConfirm = async (
    nextStudent = student,
    memberId = selectedMemberId,
  ) => {
    if (!memberId || !nextStudent) {
      toast.info("Seleciona o teu nome e inicia sessão para confirmar.");
      return;
    }

    if (!nextStudent.academicSyncedAt) {
      toast.error("Para confirmar presença, entra pela Secretaria com o teu número de estudante e palavra-passe.");
      return;
    }

    const memberToConfirm = team?.members.find((member) => member.id === memberId) ?? null;
    const expectedStudentNumber = normalizeStudentNumber(memberToConfirm?.expectedStudentNumber);
    const sessionStudentNumber = normalizeStudentNumber(nextStudent.studentNumber);
    if (expectedStudentNumber && expectedStudentNumber !== sessionStudentNumber) {
      toast.error(`Este lugar está reservado para o número ${expectedStudentNumber}. Entra com essa conta ou pede ao responsável para corrigir.`);
      return;
    }

    setConfirming(true);
    try {
      const payload = await api.submissions.confirmTeamMember(token, memberId);
      setTeam(payload.team);
      setSelectedMemberId(payload.member.id);
      toast.success("Presença no grupo confirmada. O projeto foi ligado à tua conta.");
    } catch (err) {
      if (isAuthError(err)) {
        setToken(null);
        setStudent(null);
        toast.error("Inicia sessão novamente para confirmar.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Não foi possível confirmar este membro.");
    } finally {
      setConfirming(false);
    }
  };

  const handleLoginSuccess = (loggedStudent?: StudentProfile | null) => {
    const nextStudent = loggedStudent ?? getSessionStudent();
    setStudent(nextStudent);
    const memberId = team && nextStudent
      ? resolvePreferredMemberId(team, nextStudent)
      : selectedMemberId;
    if (memberId) setSelectedMemberId(memberId);
    if (nextStudent) void handleConfirm(nextStudent, memberId);
  };

  if (loading) {
    return (
      <div className="page-section">
        <div className="page-shell flex min-h-[52vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="page-section">
        <div className="page-shell">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="mt-3 text-xl font-semibold">Convite indisponível</h1>
            <p className="mt-2 text-sm">{error ?? "Este link já não está disponível."}</p>
            <Button asChild className="mt-5 rounded-xl">
              <Link to="/">Voltar ao UOR Connect</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-shell space-y-6">
        <section className="rounded-3xl border border-border/60 bg-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
                <UsersRound className="h-4 w-4" />
                Confirmação de equipa
              </span>
              <h1 className="mt-4 max-w-3xl font-heading text-3xl font-bold leading-tight sm:text-4xl">
                {team.submission.name}
              </h1>
              <p className="mt-2 text-sm text-white/65">
                {team.submission.referenceCode} · {team.submission.typeLabel} · {statusText(team.submission.status)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-2xl font-bold">{team.confirmedMembers}/{team.totalMembers}</p>
              <p className="text-xs text-white/60">membros confirmados</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Seleciona o teu nome</h2>
                <p className="mt-1 text-sm text-muted-foreground">A confirmação liga a tua conta académica a este projeto.</p>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${team.allConfirmed ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                {team.journeyLabel}
              </span>
            </div>

            <div className="mt-5 space-y-2">
              {team.members.map((member) => {
                const selected = selectedMemberId === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
                    className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      selected
                        ? "border-primary/35 bg-primary/[0.06] shadow-sm"
                        : "border-border/60 bg-muted/10 hover:border-border"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{member.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {member.confirmed
                          ? `${member.roleLabel} · ${member.studentName || "Conta confirmada"}${member.studentNumber ? ` · ${member.studentNumber}` : ""}`
                          : `${member.roleLabel} · ${
                              member.expectedStudentNumber
                                ? `Nº ${member.expectedStudentNumber}`
                                : "Aguardando confirmação"
                            }`}
                      </span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      member.confirmed
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-600"
                    }`}>
                      {member.confirmed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
                      {member.confirmed ? "Confirmado" : "Pendente"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="rounded-3xl border border-border/60 bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Confirmar presença no grupo</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Depois da confirmação, a organização consegue reconhecer-te como membro do projeto e incluir-te na emissão de certificados.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-border/60 bg-muted/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nome selecionado</p>
              <p className="mt-2 text-base font-semibold">{selectedMember?.name ?? "Seleciona um membro"}</p>
              {selectedMember?.expectedStudentNumber && !selectedMember.confirmed ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Número indicado: {selectedMember.expectedStudentNumber}
                </p>
              ) : null}
              {student ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sessão ativa: {student.name || "Estudante"} · {student.studentNumber}
                </p>
              ) : null}
            </div>

            {hasSecretariaSession ? (
              <Button
                className="mt-5 h-11 w-full rounded-xl"
                disabled={!selectedMember || selectedMember.confirmed || confirming}
                onClick={() => void handleConfirm()}
              >
                {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {selectedMember?.confirmed ? "Nome já confirmado" : "Confirmar com esta conta"}
              </Button>
            ) : (
              <div className="mt-5">
                {student ? (
                  <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium leading-5 text-amber-800">
                    Esta confirmação só aceita login pela Secretaria. Entra com a conta académica para usar os dados oficiais.
                  </p>
                ) : null}
                <StudentLoginForm
                  onSuccess={handleLoginSuccess}
                  submitLabel="Entrar pela Secretaria"
                  compact
                  allowConventional={false}
                />
              </div>
            )}

            <Button asChild variant="outline" className="mt-3 h-11 w-full rounded-xl">
              <Link to={team.submission.detailPath}>
                Ver página do projeto
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
