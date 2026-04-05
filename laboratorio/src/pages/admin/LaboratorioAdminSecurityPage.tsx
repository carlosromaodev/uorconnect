import { useMemo, useState } from "react";
import { ShieldCheck, UserPlus, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import type { LaboratorioAdminOutletContext } from "@app/components/LaboratorioAdminShell";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LaboratorioAdminSecurityPage() {
  const {
    authorizeStudent,
    busyKey,
    refreshSecurityOverview,
    revokeStudent,
    securityOverview,
  } = useOutletContext<LaboratorioAdminOutletContext>();
  const [studentNumber, setStudentNumber] = useState("");

  const authorizedStudents = useMemo(
    () => [...securityOverview.authorizedStudents].sort((left, right) => left.studentNumber.localeCompare(right.studentNumber)),
    [securityOverview.authorizedStudents],
  );

  const handleAuthorize = async () => {
    const normalized = studentNumber.replace(/\D/g, "").slice(0, 8);
    if (normalized.length !== 8) {
      return;
    }

    const created = await authorizeStudent(normalized);
    if (created) {
      setStudentNumber("");
    }
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <ContestCard className="shadow-none">
          <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">security.access</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Autorizações do painel</h3>
          <p className="mt-3 text-sm leading-7 text-[#8ea1b8]">
            Só números autorizados conseguem operar o admin do Laboratório. O backend continua responsável por validar a sessão académica.
          </p>

          <div className="mt-5 grid gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-white">Número de estudante</p>
              <Input
                value={studentNumber}
                maxLength={8}
                inputMode="numeric"
                onChange={(event) => setStudentNumber(event.target.value.replace(/\D/g, "").slice(0, 8))}
                className="border-white/8 bg-white/[0.03] text-white"
                placeholder="20240000"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className={cn("h-11 px-5", contestButtonClassNames.primary)}
                disabled={studentNumber.replace(/\D/g, "").length !== 8 || busyKey === "authorize"}
                onClick={() => void handleAuthorize()}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Autorizar
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn("h-11 px-5", contestButtonClassNames.secondary)}
                onClick={() => void refreshSecurityOverview()}
              >
                Atualizar leitura
              </Button>
            </div>
          </div>
        </ContestCard>

        <ContestCard tone="subtle" className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">security.summary</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Resumo</h3>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#00e5c8]" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SummaryCard
              label="Autorizados"
              value={String(authorizedStudents.length)}
              description="Contas com acesso administrativo."
            />
            <SummaryCard
              label="Logins recentes"
              value={String(securityOverview.recentLogins.length)}
              description="Últimos estudantes autenticados."
            />
          </div>
        </ContestCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <ContestCard className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#00e5c8]">security.authorized_list</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Contas autorizadas</h3>
            </div>
            <ContestBadge tone="neutral">{authorizedStudents.length}</ContestBadge>
          </div>

          <div className="mt-5 space-y-3">
            {authorizedStudents.length ? authorizedStudents.map((student) => (
              <div
                key={student.studentNumber}
                className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-white">{student.studentNumber}</p>
                  <p className="mt-1 text-sm text-[#8ea1b8]">Atualizado em {formatDateTime(student.updatedAt)}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-10 px-4", contestButtonClassNames.secondary)}
                  disabled={busyKey === `revoke-${student.studentNumber}`}
                  onClick={() => void revokeStudent(student.studentNumber)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              </div>
            )) : (
              <EmptyState copy="Ainda não existem contas autorizadas no painel do Laboratório." />
            )}
          </div>
        </ContestCard>

        <ContestCard tone="subtle" className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">security.recent_sessions</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Logins recentes</h3>
            </div>
            <ContestBadge tone="accent">{securityOverview.recentLogins.length}</ContestBadge>
          </div>

          <div className="mt-5 space-y-3">
            {securityOverview.recentLogins.length ? securityOverview.recentLogins.map((student) => (
              <div key={student.studentNumber} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <p className="text-base font-semibold text-white">{student.name}</p>
                <p className="mt-1 text-sm text-[#8ea1b8]">
                  {student.studentNumber} · {student.course || "Curso não informado"}
                </p>
              </div>
            )) : (
              <EmptyState copy="Sem sessões recentes para apresentar." />
            )}
          </div>
        </ContestCard>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7b8ca3]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-[#8ea1b8]">{description}</p>
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm leading-7 text-[#8ea1b8]">
      {copy}
    </div>
  );
}
