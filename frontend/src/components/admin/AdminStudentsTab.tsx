import { useState, useMemo } from "react";
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Facebook,
  FileText,
  Filter,
  Flag,
  Github,
  GraduationCap,
  Hash,
  Instagram,
  Layers,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  Radio,
  Phone,
  RefreshCw,
  Search,
  ThumbsUp,
  Trash2,
  User,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContextualSmsAction } from "@/components/admin/ContextualSmsAction";
import type { StudentPagedStats, StudentWithStats } from "@/lib/api";

type StudentSort = "interacoes" | "nome" | "numero" | "curso" | "universidade";

type AdminStudentsTabProps = {
  availableStudentCourses: string[];
  availableStudentUniversities: string[];
  groupStudentsByCourse: boolean;
  groupedStudents: Record<string, StudentWithStats[]>;
  loadingStudentsList: boolean;
  studentCourseFilter: string;
  studentUniversityFilter: string;
  studentAccessTypeFilter: "todos" | "OFFICIAL" | "TEMPORARY";
  studentListRows: StudentWithStats[];
  studentPage: number;
  studentPageSize: number;
  studentSearchTerm: string;
  studentSortBy: StudentSort;
  studentStatsSummary: StudentPagedStats | null;
  studentsTotal: number;
  studentsTotalPages: number;
  onGroupStudentsByCourseChange: (value: boolean) => void;
  onRemoveStudent: (student: StudentWithStats) => void;
  onStudentCourseFilterChange: (value: string) => void;
  onStudentUniversityFilterChange: (value: string) => void;
  onStudentAccessTypeFilterChange: (value: "todos" | "OFFICIAL" | "TEMPORARY") => void;
  onStudentPageChange: (value: number | ((current: number) => number)) => void;
  onStudentPageSizeChange: (value: number) => void;
  onStudentSearchTermChange: (value: string) => void;
  onStudentSortByChange: (value: StudentSort) => void;
};

function totalInteractions(student: StudentWithStats) {
  const c = student._count;
  return (
    (c?.likes ?? 0) +
    (c?.votes ?? 0) +
    (c?.comments ?? 0) +
    (c?.courseEnrollments ?? 0) +
    (c?.certificates ?? 0) +
    (c?.attendanceCheckIns ?? 0) +
    (c?.submissions ?? 0) +
    (c?.submissionMemberships ?? 0) +
    (c?.liveChatMessages ?? 0) +
    (c?.passportScans ?? 0) +
    (c?.passportPointLedger ?? 0) +
    (c?.passportChallengeAnswers ?? 0) +
    (c?.passportSurpriseEffects ?? 0) +
    (c?.exhibitorVoteScoreEvents ?? 0) +
    (c?.exhibitorActorScoreEvents ?? 0)
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border/40 bg-muted/30 p-5"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-muted/60" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted/60" />
              <div className="h-3 w-1/2 rounded bg-muted/50" />
            </div>
            <div className="hidden gap-2 sm:flex">
              <div className="h-6 w-14 rounded-full bg-muted/50" />
              <div className="h-6 w-14 rounded-full bg-muted/50" />
              <div className="h-6 w-14 rounded-full bg-muted/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat badge (small inline stat)                                     */
/* ------------------------------------------------------------------ */

function StatBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${color}`}
      title={label}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span>{value}</span>
    </div>
  );
}

function studentInstitutionLabel(student: StudentWithStats) {
  if (student.institutionFlag === "ISPTEC") return "ISPTEC";
  if (student.institutionFlag === "UOR") return "UOR";
  if (student.registrationSource === "ISPTEC_OFFICIAL") return "ISPTEC";
  if (student.registrationSource === "SECRETARIA") return "UOR";
  return "Sem bandeira";
}

function studentInstitutionBadgeClass(student: StudentWithStats) {
  if (studentInstitutionLabel(student) === "ISPTEC") {
    return "shrink-0 border-yellow-500/30 bg-yellow-500/10 text-[10px] text-yellow-700 dark:text-yellow-300";
  }
  if (studentInstitutionLabel(student) === "UOR") {
    return "shrink-0 border-orange-500/30 bg-orange-500/10 text-[10px] text-orange-700 dark:text-orange-300";
  }
  return "shrink-0 border-slate-500/30 bg-slate-500/10 text-[10px] text-slate-600 dark:text-slate-300";
}

function studentInstitutionEvidenceLabel(student: StudentWithStats) {
  const labels: Record<NonNullable<StudentWithStats["institutionEvidence"]>, string> = {
    REGISTRATION_SOURCE: "origem oficial",
    STUDENT_NUMBER_PREFIX: "prefixo institucional",
    INSTITUTIONAL_EMAIL: "email institucional",
    UNIVERSITY: "universidade declarada",
    BOOLEAN_FLAG: "flag interna",
    CONTACT_PROFILE: "telefone + email proprio",
    UNKNOWN: "sem evidencia suficiente",
  };
  return labels[student.institutionEvidence ?? "UNKNOWN"];
}

/* ------------------------------------------------------------------ */
/*  Student card                                                       */
/* ------------------------------------------------------------------ */

function StudentCard({
  student,
  expanded,
  onToggle,
  onRemove,
}: {
  student: StudentWithStats;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (student: StudentWithStats) => void;
}) {
  const interactions = totalInteractions(student);
  const hasEmail = !!student.email;
  const hasPhone = !!student.phone;
  const isSynced = !!student.academicSyncedAt;
  const isIncomplete = !!student.isIncomplete;
  const isProfileComplete = !!student.profileCompletedAt;
  const hasProfilePhoto = !!student.avatarUrl;
  const isOfficialAccess = student.accessType === "OFFICIAL";
  const activity = student.activitySummary;
  const projectActivityTotal = (activity?.projects.length ?? 0)
    + (activity?.businesses.length ?? 0)
    + (activity?.products.length ?? 0);
  const challengeActivityTotal = (activity?.challenges.digitalPassportEvents ?? 0)
    + (activity?.challenges.exhibitorEvents ?? 0);
  const profileLinks = [
    { label: "Instagram", url: student.instagramUrl, icon: Instagram },
    { label: "Facebook", url: student.facebookUrl, icon: Facebook },
    { label: "LinkedIn", url: student.linkedinUrl, icon: Linkedin },
    { label: "GitHub", url: student.githubUrl, icon: Github },
    { label: "Site", url: student.websiteUrl, icon: ExternalLink },
  ].filter((item) => item.url);
  const initials = student.name
    ? student.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "#";

  return (
    <Card
      className={`group overflow-hidden border-border/50 transition-all duration-200 hover:border-emerald-500/30 hover:shadow-md ${
        expanded ? "border-emerald-500/40 shadow-md" : ""
      }`}
    >
      {/* Main row - always visible */}
      <div
        className="flex cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-center"
        onClick={onToggle}
      >
        {/* Avatar / number */}
        <div className="flex items-center gap-3 sm:min-w-0 sm:flex-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground shadow-sm">
            {hasProfilePhoto ? (
              <img src={student.avatarUrl ?? ""} alt={student.name || student.studentNumber} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">
                {student.name || `Estudante ${student.studentNumber}`}
              </p>
              {isIncomplete && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                >
                  <UserX className="mr-0.5 h-2.5 w-2.5" />
                  Incompleto
                </Badge>
              )}
              {isProfileComplete && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-600 dark:text-sky-400"
                >
                  <UserCheck className="mr-0.5 h-2.5 w-2.5" />
                  Perfil completo
                </Badge>
              )}
              {isSynced && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  <RefreshCw className="mr-0.5 h-2.5 w-2.5" />
                  Sincronizado
                </Badge>
              )}
              <Badge
                variant="outline"
                className={
                  isOfficialAccess
                    ? "shrink-0 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                    : "shrink-0 border-slate-500/30 bg-slate-500/10 text-[10px] text-slate-600 dark:text-slate-300"
                }
              >
                {isOfficialAccess ? "Oficial" : "Temporário"}
              </Badge>
              <Badge
                variant="outline"
                className={studentInstitutionBadgeClass(student)}
                title={`Bandeira institucional: ${studentInstitutionEvidenceLabel(student)}`}
              >
                <Building2 className="mr-0.5 h-2.5 w-2.5" />
                {studentInstitutionLabel(student)}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <Hash className="h-3 w-3" />
                {student.studentNumber}
              </span>
              {student.course && (
                <span className="flex items-center gap-1 truncate">
                  <GraduationCap className="h-3 w-3 shrink-0" />
                  <span className="truncate">{student.course}</span>
                </span>
              )}
              {student.university && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{student.university}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Interaction stats - compact */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatBadge
            icon={ThumbsUp}
            label="Likes"
            value={student._count?.likes ?? 0}
            color="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatBadge
            icon={Flag}
            label="Votos"
            value={student._count?.votes ?? 0}
            color="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <StatBadge
            icon={MessageSquare}
            label="Comentários"
            value={student._count?.comments ?? 0}
            color="border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
          />
          <StatBadge
            icon={Award}
            label="Certificados"
            value={student._count?.certificates ?? 0}
            color="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <Badge className="border-primary/20 bg-primary/10 text-[11px] font-semibold text-primary">
            {interactions} total
          </Badge>
        </div>

        {/* Expand indicator */}
        <div className="hidden sm:block">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/20">
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Contact info */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Perfil público
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <UserCheck className={`h-3.5 w-3.5 ${isProfileComplete ? "text-sky-500" : "text-muted-foreground/40"}`} />
                  <span className={isProfileComplete ? "" : "text-muted-foreground"}>
                    {isProfileComplete ? `Concluído em ${formatDate(student.profileCompletedAt)}` : "Ainda não concluído"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className={`h-3.5 w-3.5 ${hasEmail ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                  <span className={hasEmail ? "" : "text-muted-foreground"}>
                    {student.email || "Sem email"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className={`h-3.5 w-3.5 ${hasPhone ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                  <span className={hasPhone ? "" : "text-muted-foreground"}>
                    {student.phone || "Sem telefone"}
                  </span>
                </div>
                {student.bio && (
                  <p className="rounded-lg border border-border/50 bg-background/70 p-2 text-xs leading-5 text-muted-foreground">
                    {student.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Academic info */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <GraduationCap className="h-3.5 w-3.5" />
                Académico
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{student.course || "Curso não definido"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{student.university || "Universidade não definida"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    Turma: {student.classCode || "—"}
                    {student.curricularYear
                      ? ` · ${student.curricularYear}º ano`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    {student.academicYear || "—"}
                    {student.academicPeriod
                      ? ` · ${student.academicPeriod}`
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Personal info */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Flag className="h-3.5 w-3.5" />
                Pessoal
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{student.nationality || "Nacionalidade não definida"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Nascimento: {formatDate(student.birthDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    {isOfficialAccess
                      ? `Login oficial ${studentInstitutionLabel(student)}`
                      : "Acesso temporário sem login oficial"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {profileLinks.length > 0 && (
            <div className="border-t border-border/30 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Ligações do perfil
              </p>
              <div className="flex flex-wrap gap-2">
                {profileLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.label}
                      href={link.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* All 7 stats */}
          <div className="border-t border-border/30 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Atividade completa
            </p>
            <div className="flex flex-wrap gap-2">
              <StatBadge
                icon={ThumbsUp}
                label="Likes"
                value={student._count?.likes ?? 0}
                color="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
              />
              <StatBadge
                icon={Flag}
                label="Votos"
                value={student._count?.votes ?? 0}
                color="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
              <StatBadge
                icon={MessageSquare}
                label="Comentários"
                value={student._count?.comments ?? 0}
                color="border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400"
              />
              <StatBadge
                icon={BookOpen}
                label="Inscrições"
                value={student._count?.courseEnrollments ?? 0}
                color="border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
              />
              <StatBadge
                icon={Award}
                label="Certificados"
                value={student._count?.certificates ?? 0}
                color="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
              <StatBadge
                icon={UserCheck}
                label="Check-ins"
                value={student._count?.attendanceCheckIns ?? 0}
                color="border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400"
              />
              <StatBadge
                icon={FileText}
                label="Submissões"
                value={student._count?.submissions ?? 0}
                color="border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
              />
              <StatBadge
                icon={Users}
                label="Membro de projetos"
                value={student._count?.submissionMemberships ?? 0}
                color="border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400"
              />
              <StatBadge
                icon={Radio}
                label="Atividade no Ao Vivo"
                value={student._count?.liveChatMessages ?? 0}
                color="border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-400"
              />
              <StatBadge
                icon={Award}
                label="Passaporte digital"
                value={(student._count?.passportPointLedger ?? 0) + (student._count?.passportScans ?? 0)}
                color="border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400"
              />
            </div>
          </div>

          {activity && (
            <div className="border-t border-border/30 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mapa de atividade no sistema
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projetos</p>
                  <p className="mt-1 text-lg font-semibold">{projectActivityTotal}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.projects.length} projeto(s), {activity.businesses.length} negócio(s), {activity.products.length} produto(s)
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cursos e formação</p>
                  <p className="mt-1 text-lg font-semibold">{activity.courses.length}</p>
                  <p className="text-xs text-muted-foreground">Inscrições associadas ao estudante</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Desafios</p>
                  <p className="mt-1 text-lg font-semibold">{challengeActivityTotal}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.challenges.digitalPassportEvents} passaporte · {activity.challenges.exhibitorEvents} expositor
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selos</p>
                  <p className="mt-1 text-lg font-semibold">{activity.challenges.badges}</p>
                  <p className="text-xs text-muted-foreground">Conquistas desbloqueadas</p>
                </div>
              </div>

              {(activity.projects.length > 0 || activity.businesses.length > 0 || activity.products.length > 0) && (
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {[...activity.projects, ...activity.businesses, ...activity.products].slice(0, 4).map((project) => (
                    <div key={`${project.role}-${project.id}`} className="rounded-lg border border-border/50 bg-background/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{project.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {project.type} · {project.role === "RESPONSAVEL" ? "Responsável" : "Membro"}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {project.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Histórico recente
                </p>
                {activity.recentEvents.length > 0 ? (
                  <div className="space-y-2">
                    {activity.recentEvents.slice(0, 6).map((event) => (
                      <div key={event.id} className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {event.description || event.type}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                          {typeof event.points === "number" && (
                            <Badge variant={event.points >= 0 ? "default" : "destructive"} className="text-[10px]">
                              {event.points > 0 ? "+" : ""}{event.points} pts
                            </Badge>
                          )}
                          <span>{formatDateTime(event.happenedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                    Ainda não há atividade registada para este estudante.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timestamps & actions */}
          <div className="flex flex-col gap-3 border-t border-border/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Último login: {formatDateTime(student.lastLoginAt)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Criado: {formatDate(student.createdAt)}
              </span>
              {student.academicSyncedAt && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Sincronizado: {formatDateTime(student.academicSyncedAt)}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <ContextualSmsAction
                title="Enviar comunicação ao estudante"
                recipient={{
                  name: student.name,
                  studentNumber: student.studentNumber,
                  phone: student.phone,
                  course: student.course,
                }}
                defaultMessage="Olá {{nome}}, temos uma atualização importante para ti no UOR Connect. Entra na plataforma para acompanhar os detalhes."
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(student);
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remover
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminStudentsTab({
  availableStudentCourses,
  availableStudentUniversities,
  groupStudentsByCourse,
  groupedStudents,
  loadingStudentsList,
  studentCourseFilter,
  studentUniversityFilter,
  studentAccessTypeFilter,
  studentListRows,
  studentPage,
  studentPageSize,
  studentSearchTerm,
  studentSortBy,
  studentStatsSummary,
  studentsTotal,
  studentsTotalPages,
  onGroupStudentsByCourseChange,
  onRemoveStudent,
  onStudentCourseFilterChange,
  onStudentUniversityFilterChange,
  onStudentAccessTypeFilterChange,
  onStudentPageChange,
  onStudentPageSizeChange,
  onStudentSearchTermChange,
  onStudentSortByChange,
}: AdminStudentsTabProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  /* ---- Computed stats ---- */
  const pageStats = useMemo(() => {
    const rows = studentListRows;
    let withEmail = 0;
    let withPhone = 0;
    let profileComplete = 0;
    let synced = 0;
    let official = 0;
    let temporary = 0;
    let interactions = 0;
    const universities = new Set<string>();
    for (const s of rows) {
      if (s.email) withEmail++;
      if (s.phone) withPhone++;
      if (s.profileCompletedAt) profileComplete++;
      if (s.academicSyncedAt) synced++;
      if (s.accessType === "OFFICIAL") official++;
      if (s.accessType === "TEMPORARY") temporary++;
      if (s.university?.trim()) universities.add(s.university.trim());
      interactions += totalInteractions(s);
    }
    return {
      withEmail,
      withPhone,
      profileComplete,
      synced,
      official,
      temporary,
      interactions,
      universities: universities.size,
    };
  }, [studentListRows]);
  const stats = studentStatsSummary ?? pageStats;

  const sortLabels: Record<StudentSort, string> = {
    interacoes: "Mais interações",
    nome: "Nome A-Z",
    numero: "Número do estudante",
    curso: "Curso",
    universidade: "Universidade",
  };

  /* ---- Pagination helpers ---- */
  const startItem = studentsTotal === 0 ? 0 : (studentPage - 1) * studentPageSize + 1;
  const endItem = Math.min(studentPage * studentPageSize, studentsTotal);

  /* ---- Page number buttons ---- */
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, studentPage - Math.floor(maxVisible / 2));
    const end = Math.min(studentsTotalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [studentPage, studentsTotalPages]);

  return (
    <div className="space-y-5">
      {/* ============================================================ */}
      {/*  STATS HEADER                                                 */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Card className="border-border/50 bg-gradient-to-br from-emerald-500/5 to-emerald-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentsTotal}</p>
              <p className="text-xs text-muted-foreground">Total de estudantes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-green-500/5 to-green-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/15 text-green-600 dark:text-green-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.official}</p>
              <p className="text-xs text-muted-foreground">Oficiais</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-slate-500/5 to-slate-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/15 text-slate-600 dark:text-slate-300">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.temporary}</p>
              <p className="text-xs text-muted-foreground">Temporários</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-indigo-500/5 to-indigo-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.universities}</p>
              <p className="text-xs text-muted-foreground">universidades no resultado</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-teal-500/5 to-teal-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.synced}</p>
              <p className="text-xs text-muted-foreground">Sincronizados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-amber-500/5 to-amber-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.profileComplete}</p>
              <p className="text-xs text-muted-foreground">Perfis completos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-blue-500/5 to-blue-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withEmail}</p>
              <p className="text-xs text-muted-foreground">Com email</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-gradient-to-br from-purple-500/5 to-purple-600/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withPhone}</p>
              <p className="text-xs text-muted-foreground">Com telefone</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ============================================================ */}
      {/*  FILTERS BAR                                                  */}
      {/* ============================================================ */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 pb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Filtros e ordenação
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.45fr_1fr_1fr_1fr_1fr_0.7fr_auto]">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, número, telefone, universidade, curso ou turma..."
                value={studentSearchTerm}
                onChange={(e) => onStudentSearchTermChange(e.target.value)}
              />
            </div>

            {/* Course filter */}
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={studentCourseFilter}
              onChange={(e) => onStudentCourseFilterChange(e.target.value)}
            >
              <option value="todos">Todos os cursos</option>
              {availableStudentCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>

            {/* University filter */}
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={studentUniversityFilter}
              onChange={(e) => onStudentUniversityFilterChange(e.target.value)}
            >
              <option value="todos">Todas as universidades</option>
              {availableStudentUniversities.map((university) => (
                <option key={university} value={university}>
                  {university}
                </option>
              ))}
            </select>

            {/* Access type filter */}
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={studentAccessTypeFilter}
              onChange={(e) =>
                onStudentAccessTypeFilterChange(
                  e.target.value as "todos" | "OFFICIAL" | "TEMPORARY",
                )
              }
            >
              <option value="todos">Todos os acessos</option>
              <option value="OFFICIAL">Oficiais</option>
              <option value="TEMPORARY">Temporários</option>
            </select>

            {/* Sort */}
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={studentSortBy}
              onChange={(e) =>
                onStudentSortByChange(e.target.value as StudentSort)
              }
            >
              <option value="interacoes">Mais interações</option>
              <option value="nome">Nome A-Z</option>
              <option value="numero">Número do estudante</option>
              <option value="curso">Curso</option>
              <option value="universidade">Universidade</option>
            </select>

            {/* Page size */}
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={studentPageSize}
              onChange={(e) => onStudentPageSizeChange(Number(e.target.value))}
            >
              <option value={10}>10 / pág.</option>
              <option value={20}>20 / pág.</option>
              <option value={50}>50 / pág.</option>
            </select>

            {/* Group toggle */}
            <Button
              variant={groupStudentsByCourse ? "default" : "outline"}
              className={
                groupStudentsByCourse
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : ""
              }
              onClick={() =>
                onGroupStudentsByCourseChange(!groupStudentsByCourse)
              }
            >
              <Layers className="mr-1.5 h-4 w-4" />
              {groupStudentsByCourse ? "Agrupado" : "Sem grupo"}
            </Button>
          </div>

          {/* Active filters summary */}
          {(studentSearchTerm ||
            studentCourseFilter !== "todos" ||
            studentUniversityFilter !== "todos" ||
            studentAccessTypeFilter !== "todos" ||
            studentSortBy !== "interacoes") && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/30 pt-3">
              <span className="text-xs text-muted-foreground">Ativo:</span>
              {studentSearchTerm && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  Busca: &ldquo;{studentSearchTerm}&rdquo;
                </Badge>
              )}
              {studentCourseFilter !== "todos" && (
                <Badge variant="secondary" className="text-xs">
                  Curso: {studentCourseFilter}
                </Badge>
              )}
              {studentUniversityFilter !== "todos" && (
                <Badge variant="secondary" className="text-xs">
                  Universidade: {studentUniversityFilter}
                </Badge>
              )}
              {studentAccessTypeFilter !== "todos" && (
                <Badge variant="secondary" className="text-xs">
                  Acesso: {studentAccessTypeFilter === "OFFICIAL" ? "Oficiais" : "Temporários"}
                </Badge>
              )}
              {studentSortBy !== "interacoes" && (
                <Badge variant="secondary" className="text-xs">
                  Ordenação: {sortLabels[studentSortBy]}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/*  RESULTS COUNT                                                */}
      {/* ============================================================ */}
      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          {loadingStudentsList
            ? "A carregar estudantes..."
            : studentsTotal === 0
              ? "Nenhum estudante encontrado."
              : `A mostrar ${startItem}–${endItem} de ${studentsTotal} estudante(s)`}
        </span>
        {!loadingStudentsList && studentsTotal > 0 && (
          <span className="hidden text-xs text-muted-foreground/60 sm:block">
            Clique num estudante para expandir os detalhes
          </span>
        )}
      </div>

      {/* ============================================================ */}
      {/*  STUDENT LIST                                                 */}
      {/* ============================================================ */}
      {loadingStudentsList ? (
        <SkeletonCards />
      ) : studentListRows.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-muted-foreground">
              Nenhum estudante encontrado
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
              Tente ajustar os filtros de busca, universidade, curso ou ordenação para
              encontrar os estudantes que procura.
            </p>
          </CardContent>
        </Card>
      ) : groupStudentsByCourse ? (
        /* Grouped view */
        <div className="space-y-6">
          {Object.entries(groupedStudents).map(([course, courseStudents]) => (
            <div key={course} className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent px-4 py-3">
                <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-semibold">{course}</p>
                  <p className="text-xs text-muted-foreground">
                    {courseStudents.length} estudante(s) nesta página
                  </p>
                </div>
              </div>
              {courseStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  expanded={expandedId === student.id}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === student.id ? null : student.id
                    )
                  }
                  onRemove={onRemoveStudent}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* Flat list */
        <div className="space-y-3">
          {studentListRows.map((student) => (
            <StudentCard
              key={student.id}
              student={student}
              expanded={expandedId === student.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === student.id ? null : student.id
                )
              }
              onRemove={onRemoveStudent}
            />
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/*  PAGINATION                                                   */}
      {/* ============================================================ */}
      {studentsTotal > 0 && (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-between gap-3 p-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Página <span className="font-medium text-foreground">{studentPage}</span> de{" "}
              <span className="font-medium text-foreground">{studentsTotalPages}</span>
              <span className="ml-2 hidden text-xs text-muted-foreground/60 lg:inline">
                ({startItem}–{endItem} de {studentsTotal})
              </span>
            </p>

            <div className="flex items-center gap-1">
              {/* Previous */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() =>
                  onStudentPageChange((current) => Math.max(1, current - 1))
                }
                disabled={loadingStudentsList || studentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page numbers */}
              <div className="hidden gap-1 sm:flex">
                {pageNumbers[0] > 1 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => onStudentPageChange(1)}
                    >
                      1
                    </Button>
                    {pageNumbers[0] > 2 && (
                      <span className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground">
                        ...
                      </span>
                    )}
                  </>
                )}
                {pageNumbers.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={p === studentPage ? "default" : "outline"}
                    className={`h-8 w-8 p-0 text-xs ${
                      p === studentPage
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : ""
                    }`}
                    onClick={() => onStudentPageChange(p)}
                    disabled={loadingStudentsList}
                  >
                    {p}
                  </Button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < studentsTotalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] <
                      studentsTotalPages - 1 && (
                      <span className="flex h-8 w-6 items-center justify-center text-xs text-muted-foreground">
                        ...
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => onStudentPageChange(studentsTotalPages)}
                    >
                      {studentsTotalPages}
                    </Button>
                  </>
                )}
              </div>

              {/* Next */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() =>
                  onStudentPageChange((current) =>
                    Math.min(studentsTotalPages, current + 1)
                  )
                }
                disabled={
                  loadingStudentsList || studentPage >= studentsTotalPages
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
