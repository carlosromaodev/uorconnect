import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, Award, BadgeCheck, BookOpenCheck, BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight, Download, ExternalLink, FileText, GraduationCap, ImagePlus, Layers3, Loader2, QrCode, Rocket, ShieldCheck, Sparkles, Trash2, Trophy, User } from "lucide-react";
import { UserAvatar } from "@/components/social/UserAvatar";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api, type AttendanceMePayload, type CertificateItem, type StudentEnrollmentListItem, type StudentOwnedSubmissionListItem, getSessionStudent, isAuthError, setToken } from "@/lib/api";
import { getProjectBannerSource, readImageFileAsDataUrl } from "@/lib/project-media";
import { downloadBlobFile } from "@/lib/student-documents";

function itemDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function submissionTone(type: string) {
  if (type === "PROJECT") return "border-primary/25 bg-primary/5 text-primary";
  if (type === "BUSINESS") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  return "border-violet-500/25 bg-violet-500/10 text-violet-700";
}

function submissionIcon(type: string) {
  if (type === "PROJECT") return GraduationCap;
  if (type === "BUSINESS") return BriefcaseBusiness;
  return Layers3;
}

function statusTone(status: string) {
  if (status === "APPROVED" || status === "CONFIRMED") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "REJECTED") return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  if (status === "PENDING") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-slate-500/10 text-slate-700 border-slate-500/20";
}

function submissionHeroGradient(type: string) {
  if (type === "BUSINESS") return "linear-gradient(135deg, rgba(16,185,129,0.94), rgba(16,185,129,0.62), rgba(6,95,70,0.78))";
  if (type === "PRODUCT") return "linear-gradient(135deg, rgba(168,85,247,0.94), rgba(217,70,239,0.62), rgba(107,33,168,0.78))";
  return "linear-gradient(135deg, rgba(253,131,5,0.94), rgba(249,115,22,0.66), rgba(34,61,66,0.8))";
}

export default function MinhaArea() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollmentListItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMePayload | null>(null);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [student, setStudent] = useState(() => getSessionStudent());
  const [submissionBannerDrafts, setSubmissionBannerDrafts] = useState<Record<number, string | null | undefined>>({});
  const [savingBannerId, setSavingBannerId] = useState<number | null>(null);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"jornada" | "submissoes" | "inscricoes">(
    searchParams.get("tab") === "submissoes" || searchParams.get("tab") === "inscricoes"
      ? searchParams.get("tab") as "submissoes" | "inscricoes"
      : "jornada"
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "UOR Connect | Minha Área";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.submissions.mine(),
      api.courses.enrollmentsMine(),
      api.attendance.me(),
      api.certificates.mine(),
    ])
      .then(([submissionItems, enrollmentItems, attendancePayload, certificateItems]) => {
        if (!active) return;
        setSubmissions(submissionItems);
        setSubmissionBannerDrafts(
          submissionItems.reduce<Record<number, string | null>>((acc, item) => {
            acc[item.id] = item.bannerUrl ?? null;
            return acc;
          }, {})
        );
        setEnrollments(enrollmentItems);
        setAttendance(attendancePayload);
        setCertificates(certificateItems);
      })
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
          setStudent(null);
          return;
        }

        toast.error(error instanceof Error ? error.message : "Não foi possível carregar a tua área.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const requestedTab = tabParam === "submissoes" || tabParam === "inscricoes" ? tabParam : "jornada";
    setActiveTab(requestedTab);
  }, [searchParams]);

  const resolveSubmissionBannerPreview = (submission: StudentOwnedSubmissionListItem) => {
    const draft = submissionBannerDrafts[submission.id];
    return draft !== undefined ? draft : submission.bannerUrl;
  };

  const handleSubmissionBannerFile = async (submission: StudentOwnedSubmissionListItem, file: File | null) => {
    if (!file) return;

    if (submission.status !== "APPROVED") {
      toast.info("A foto da capa só fica disponível depois da aprovação.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona um ficheiro de imagem válido.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setSubmissionBannerDrafts((current) => ({ ...current, [submission.id]: dataUrl }));
      toast.success("Imagem carregada. Clica em \"Guardar foto\" para publicar no card.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao processar imagem.");
    }
  };

  const handleSaveOwnBanner = async (submission: StudentOwnedSubmissionListItem) => {
    if (submission.status !== "APPROVED") {
      toast.info("A foto da capa só fica disponível depois da aprovação.");
      return;
    }

    const nextBannerUrl = resolveSubmissionBannerPreview(submission) ?? null;

    try {
      setSavingBannerId(submission.id);
      const updated = await api.submissions.updateOwnPresentation(submission.id, { bannerUrl: nextBannerUrl });
      setSubmissions((current) => current.map((item) => (
        item.id === submission.id
          ? {
            ...item,
            bannerUrl: updated.bannerUrl ?? null,
            detailPath: updated.detailPath,
          }
          : item
      )));
      setSubmissionBannerDrafts((current) => ({ ...current, [submission.id]: updated.bannerUrl ?? null }));
      toast.success("Foto da capa atualizada.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }

      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a capa.");
    } finally {
      setSavingBannerId(null);
    }
  };

  const handleRemoveOwnBanner = async (submission: StudentOwnedSubmissionListItem) => {
    if (submission.status !== "APPROVED") {
      toast.info("A foto da capa só fica disponível depois da aprovação.");
      return;
    }

    try {
      setSavingBannerId(submission.id);
      const updated = await api.submissions.updateOwnPresentation(submission.id, { bannerUrl: null });
      setSubmissions((current) => current.map((item) => (
        item.id === submission.id
          ? {
            ...item,
            bannerUrl: null,
            detailPath: updated.detailPath,
          }
          : item
      )));
      setSubmissionBannerDrafts((current) => ({ ...current, [submission.id]: null }));
      toast.success("Foto da capa removida.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }

      toast.error(error instanceof Error ? error.message : "Não foi possível remover a capa.");
    } finally {
      setSavingBannerId(null);
    }
  };

  const handleTabChange = (next: string) => {
    const normalized = next === "submissoes" || next === "inscricoes" ? next : "jornada";
    setActiveTab(normalized);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", normalized);
    setSearchParams(nextParams);
  };

  const handleDownloadCertificate = async (certificate: CertificateItem) => {
    try {
      setDownloadingCertificateId(certificate.id);
      const blob = await api.certificates.pdf(certificate.id);
      downloadBlobFile(blob, `${certificate.code.toLowerCase()}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o certificado.");
    } finally {
      setDownloadingCertificateId(null);
    }
  };

  const hasConfirmedEnrollment = enrollments.some((item) => item.paymentStatus === "CONFIRMED");
  const hasApprovedSubmission = submissions.some((item) => item.status === "APPROVED");
  const journeySteps = [
    {
      label: "Sessão ativa",
      description: student?.studentNumber ? `Número ${student.studentNumber}` : "Inicia sessão para acompanhar a jornada.",
      done: Boolean(student?.studentNumber),
      icon: User,
    },
    {
      label: "Credencial QR criada",
      description: attendance?.credential ? "Pronta para validação no evento." : "A credencial será criada automaticamente.",
      done: Boolean(attendance?.credential),
      icon: QrCode,
    },
    {
      label: "Inscrição em curso",
      description: enrollments.length > 0 ? `${enrollments.length} inscrição(ões) registada(s).` : "Escolhe um curso oficial para participar.",
      done: enrollments.length > 0,
      icon: BookOpenCheck,
    },
    {
      label: "Pagamento confirmado",
      description: hasConfirmedEnrollment ? "Tens pelo menos uma inscrição confirmada." : "A confirmação aparece depois da validação administrativa.",
      done: hasConfirmedEnrollment,
      icon: BadgeCheck,
    },
    {
      label: "Projeto aprovado",
      description: hasApprovedSubmission ? "Tens exposição aprovada para a vitrine pública." : "Submete ou aguarda a análise da organização.",
      done: hasApprovedSubmission,
      icon: Rocket,
    },
    {
      label: "Presença confirmada",
      description: attendance?.checkedIn ? "Check-in registado pela organização." : "Mostra o QR na entrada do evento.",
      done: Boolean(attendance?.checkedIn),
      icon: ShieldCheck,
    },
    {
      label: "Certificado disponível",
      description: certificates.length > 0 ? `${certificates.length} certificado(s) emitido(s).` : "Será liberado quando a organização emitir.",
      done: certificates.length > 0,
      icon: Trophy,
    },
  ];

  const completedSteps = journeySteps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedSteps / journeySteps.length) * 100);

  const journeyAlerts = [
    ...(!attendance?.checkedIn
      ? [{
        title: "Falta confirmar presença",
        description: "Mostra o teu QR no check-in para a organização validar a tua participação.",
        action: "Ver QR",
        tab: "jornada" as const,
      }]
      : []),
    ...(enrollments.length === 0
      ? [{
        title: "Ainda não tens inscrição em cursos",
        description: "Explora os cursos oficiais e guarda o comprovativo na tua área.",
        action: "Ver cursos",
        href: "/cursos",
      }]
      : []),
    ...(submissions.length === 0
      ? [{
        title: "Nenhum projeto submetido",
        description: "Submete um projeto, negócio ou produto para aparecer na vitrine pública.",
        action: "Submeter",
        href: "/submeter",
      }]
      : []),
    ...(certificates.length === 0 && attendance?.checkedIn
      ? [{
        title: "Certificado ainda não emitido",
        description: "A tua presença já está registada. O certificado aparecerá aqui quando for emitido.",
        action: "Acompanhar",
        tab: "jornada" as const,
      }]
      : []),
  ].slice(0, 3);

  const quickStats = [
    { label: "Inscrições", value: enrollments.length, icon: BookOpenCheck, color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
    { label: "Projetos", value: submissions.length, icon: FileText, color: "text-primary bg-primary/10 border-primary/20" },
    { label: "Certificados", value: certificates.length, icon: Award, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Jornada", value: `${progressPercent}%`, icon: Sparkles, color: "text-violet-600 bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className="page-section">
      <div className="page-shell space-y-6">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-violet-500/15 blur-[60px]" />
            <div className="absolute right-1/4 top-1/3 h-32 w-32 rounded-full bg-emerald-500/10 blur-[50px]" />
          </div>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary via-amber-400 to-primary opacity-75 blur-sm" />
                <div className="relative rounded-full border-2 border-white/20 bg-slate-800 p-1">
                  <UserAvatar name={student?.name || student?.studentNumber || "U"} size="lg" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">Minha Área</p>
                <h1 className="mt-1 font-heading text-2xl font-bold text-white sm:text-3xl">
                  {student?.name || "Estudante UOR"}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {student?.studentNumber ? `N.º ${student.studentNumber}` : "Número não disponível"}
                  {student?.course ? ` · ${student.course}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <div className="relative h-10 w-10">
                  <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${progressPercent} ${100 - progressPercent}`} strokeLinecap="round" className="text-primary transition-all duration-700" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">{progressPercent}%</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{completedSteps}/{journeySteps.length}</p>
                  <p className="text-[10px] text-slate-400">etapas</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold ${
                attendance?.checkedIn
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/15 text-amber-400"
              }`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {attendance?.checkedIn ? "Presente" : "Aguardando"}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border ${stat.color}`}>
                    <stat.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-white">{stat.value}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Alerts */}
        {!loading && journeyAlerts.length > 0 ? (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {journeyAlerts.map((alert) => (
              <article key={alert.title} className="group rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <AlertTriangle className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.description}</p>
                    {"href" in alert ? (
                      <Link to={alert.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800">
                        {alert.action}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <button type="button" onClick={() => handleTabChange(alert.tab)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800">
                        {alert.action}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </motion.section>
        ) : null}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1.5">
            <TabsTrigger value="jornada" className="h-10 gap-2 rounded-xl px-4 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Sparkles className="h-4 w-4" />
              Jornada
            </TabsTrigger>
            <TabsTrigger value="submissoes" className="h-10 gap-2 rounded-xl px-4 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Meus Projetos
            </TabsTrigger>
            <TabsTrigger value="inscricoes" className="h-10 gap-2 rounded-xl px-4 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <BookOpenCheck className="h-4 w-4" />
              Inscrições
            </TabsTrigger>
          </TabsList>

          {/* === JORNADA TAB === */}
          <TabsContent value="jornada" className="space-y-6">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                  {/* QR Credential */}
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                  >
                    <div className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <QrCode className="h-5 w-5" />
                          </span>
                          <div>
                            <h2 className="text-base font-semibold">Credencial QR</h2>
                            <p className="text-xs text-muted-foreground">Apresenta no check-in do evento</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
                          attendance?.checkedIn ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-amber-500/20 bg-amber-500/10 text-amber-700"
                        }`}>
                          <ShieldCheck className="h-3 w-3" />
                          {attendance?.checkedIn ? "Presente" : "Aguardando"}
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
                        <div className="flex flex-col items-center rounded-2xl border border-border/50 bg-gradient-to-b from-muted/20 to-muted/5 p-4">
                          {attendance?.credential ? (
                            <img src={attendance.credential.qrImageUrl} alt="QR de check-in" className="h-40 w-40 rounded-xl border border-border/60 bg-white p-2 shadow-sm" />
                          ) : (
                            <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-dashed border-border/60 bg-white shadow-inner">
                              <QrCode className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                          )}
                          <p className="mt-3 max-w-[180px] break-words text-center text-[10px] leading-4 text-muted-foreground">
                            {attendance?.credential?.validationUrl ?? "Credencial indisponível"}
                          </p>
                        </div>

                        <div className="grid content-start gap-3">
                          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estudante</p>
                            <p className="mt-1.5 text-sm font-semibold">{attendance?.credential?.studentName || student?.name || "Nome não informado"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{attendance?.credential?.studentNumber || student?.studentNumber}</p>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Última presença</p>
                            <p className="mt-1.5 text-sm font-semibold">
                              {attendance?.lastCheckIn ? itemDateLabel(attendance.lastCheckIn.checkedInAt) : "Ainda sem check-in"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{attendance?.lastCheckIn?.eventLabel ?? "Evento principal UOR Connect"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.section>

                  {/* Journey Steps */}
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                  >
                    <div className="border-b border-border/50 bg-gradient-to-r from-violet-500/5 to-transparent px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                            <Sparkles className="h-5 w-5" />
                          </span>
                          <div>
                            <h2 className="text-base font-semibold">Minha Jornada</h2>
                            <p className="text-xs text-muted-foreground">{completedSteps} de {journeySteps.length} etapas concluídas</p>
                          </div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/30">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="relative space-y-1">
                        {journeySteps.map((step, idx) => {
                          const StepIcon = step.icon;
                          return (
                            <div key={step.label} className="flex items-start gap-3">
                              {/* Vertical connector */}
                              <div className="flex flex-col items-center">
                                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-all ${
                                  step.done
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 shadow-sm shadow-emerald-500/10"
                                    : "border-muted-foreground/15 bg-muted/20 text-muted-foreground/50"
                                }`}>
                                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-3.5 w-3.5" />}
                                </span>
                                {idx < journeySteps.length - 1 ? (
                                  <div className={`h-5 w-px ${step.done ? "bg-emerald-500/30" : "bg-border/60"}`} />
                                ) : null}
                              </div>
                              <div className="min-w-0 pb-1 pt-1">
                                <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground/80">{step.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.section>
                </div>

                {/* Certificates Section */}
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                >
                  <div className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 to-transparent px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                          <Award className="h-5 w-5" />
                        </span>
                        <div>
                          <h2 className="text-base font-semibold">Certificados</h2>
                          <p className="text-xs text-muted-foreground">Documentos emitidos pela organização</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                        <BadgeCheck className="h-3 w-3" />
                        {certificates.length} disponível(eis)
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    {certificates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 py-10 text-center">
                        <Award className="h-10 w-10 text-muted-foreground/30" />
                        <p className="mt-3 text-sm font-medium text-muted-foreground">Nenhum certificado emitido</p>
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">Os certificados aparecerão aqui depois da emissão pela organização.</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {certificates.map((certificate) => (
                          <article key={certificate.id} className="group overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-emerald-500/[0.02] to-transparent transition-shadow hover:shadow-md">
                            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-primary" />
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">{certificate.type}</p>
                                  <h3 className="mt-1.5 truncate text-base font-semibold">{certificate.title}</h3>
                                  <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">{certificate.code}</p>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                  certificate.status === "ISSUED" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                                }`}>
                                  {certificate.status === "ISSUED" ? "Emitido" : certificate.status}
                                </span>
                              </div>
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button size="sm" className="rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700" onClick={() => void handleDownloadCertificate(certificate)} disabled={downloadingCertificateId === certificate.id}>
                                  {downloadingCertificateId === certificate.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                                  Baixar PDF
                                </Button>
                                <Button asChild size="sm" variant="outline" className="rounded-xl">
                                  <a href={certificate.validationUrl} target="_blank" rel="noreferrer">
                                    Validar
                                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.section>
              </>
            )}
          </TabsContent>

          {/* === PROJETOS TAB === */}
          <TabsContent value="submissoes" className="space-y-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-card py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-semibold">Ainda não tens projetos</p>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">A tua primeira candidatura vai aparecer aqui.</p>
                <Button asChild className="mt-5 rounded-xl">
                  <Link to="/submeter">Submeter agora</Link>
                </Button>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: 0.08 }
                  }
                }}
                className="responsive-grid"
              >
                {submissions.map((item) => {
                  const Icon = submissionIcon(item.type);
                  const canManageBanner = item.status === "APPROVED";
                  const bannerPreview = getProjectBannerSource(resolveSubmissionBannerPreview(item));
                  const savingCurrentBanner = savingBannerId === item.id;

                  return (
                    <motion.article
                      key={item.id}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        show: { opacity: 1, y: 0 }
                      }}
                      whileHover={{ y: -4, boxShadow: "0 20px 50px rgba(15, 23, 42, 0.1)" }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                    >
                      <div className="relative h-[180px] overflow-hidden">
                        {bannerPreview ? (
                          <img
                            src={bannerPreview}
                            alt={`Capa do projeto ${item.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full" style={{ background: submissionHeroGradient(item.type) }} />
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                          <ImagePlus className="h-3 w-3" />
                          Hero
                        </div>
                        <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${statusTone(item.status)}`}>
                          {item.statusLabel}
                        </span>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${submissionTone(item.type)}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.typeLabel}</p>
                            <h2 className="mt-0.5 truncate text-lg font-semibold leading-tight text-foreground">{item.name}</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.referenceCode}</p>
                          </div>
                        </div>

                        {canManageBanner ? (
                          <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Foto de capa
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                className="w-full max-w-[200px] rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                                disabled={savingCurrentBanner}
                                onChange={(event) => {
                                  void handleSubmissionBannerFile(item, event.target.files?.[0] ?? null);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs"
                                disabled={savingCurrentBanner}
                                onClick={() => void handleSaveOwnBanner(item)}
                              >
                                {savingCurrentBanner ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                Guardar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs"
                                disabled={savingCurrentBanner || !resolveSubmissionBannerPreview(item)}
                                onClick={() => void handleRemoveOwnBanner(item)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {itemDateLabel(item.createdAt)}
                          </span>
                          <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                            <Link to={item.receiptPath}>
                              Recibo
                              <ExternalLink className="ml-1.5 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </TabsContent>

          {/* === INSCRICOES TAB === */}
          <TabsContent value="inscricoes" className="space-y-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-card py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <BookOpenCheck className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-semibold">Ainda não tens inscrições</p>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">As tuas inscrições em cursos vão aparecer aqui.</p>
                <Button asChild className="mt-5 rounded-xl">
                  <Link to="/cursos">Ver cursos</Link>
                </Button>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: 0.08 }
                  }
                }}
                className="responsive-grid"
              >
                {enrollments.map((item) => (
                  <motion.article
                    key={item.id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0 }
                    }}
                    whileHover={{ y: -4, boxShadow: "0 20px 50px rgba(15, 23, 42, 0.1)" }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 to-primary" />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone(item.paymentStatus)}`}>
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.companyName}</p>
                        <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">{item.courseName}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">{item.referenceCode}</p>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {itemDateLabel(item.enrolledAt)}
                        </span>
                        <Button asChild variant="outline" size="sm" className="rounded-xl text-xs">
                          <Link to={item.receiptPath}>
                            Ver inscrição
                            <ExternalLink className="ml-1.5 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
