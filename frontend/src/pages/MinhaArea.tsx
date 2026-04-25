import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, BookOpenCheck, BriefcaseBusiness, CalendarClock, CheckCircle2, Download, ExternalLink, FileText, GraduationCap, ImagePlus, Layers3, Loader2, QrCode, ShieldCheck, Trash2, User } from "lucide-react";
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
    },
    {
      label: "Credencial QR criada",
      description: attendance?.credential ? "Pronta para validação no evento." : "A credencial será criada automaticamente.",
      done: Boolean(attendance?.credential),
    },
    {
      label: "Inscrição em curso",
      description: enrollments.length > 0 ? `${enrollments.length} inscrição(ões) registada(s).` : "Escolhe um curso oficial para participar.",
      done: enrollments.length > 0,
    },
    {
      label: "Pagamento confirmado",
      description: hasConfirmedEnrollment ? "Tens pelo menos uma inscrição confirmada." : "A confirmação aparece depois da validação administrativa.",
      done: hasConfirmedEnrollment,
    },
    {
      label: "Projeto aprovado",
      description: hasApprovedSubmission ? "Tens exposição aprovada para a vitrine pública." : "Submete ou aguarda a análise da organização.",
      done: hasApprovedSubmission,
    },
    {
      label: "Presença confirmada",
      description: attendance?.checkedIn ? "Check-in registado pela organização." : "Mostra o QR na entrada do evento.",
      done: Boolean(attendance?.checkedIn),
    },
    {
      label: "Certificado disponível",
      description: certificates.length > 0 ? `${certificates.length} certificado(s) emitido(s).` : "Será liberado quando a organização emitir.",
      done: certificates.length > 0,
    },
  ];
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

  return (
    <div className="page-section">
      <div className="page-shell space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="surface-card relative overflow-hidden border-border/70 bg-[linear-gradient(145deg,rgba(253,131,5,0.12),rgba(255,255,255,0.98),rgba(34,61,66,0.08))] p-6 sm:p-8"
        >
          <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                <User className="h-3.5 w-3.5" />
                Área do estudante
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold sm:text-4xl">Minha Área</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Acompanha o estado dos teus projetos e inscrições.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-sm">
              <UserAvatar name={student?.name || student?.studentNumber || "U"} size="lg" />
              <div>
                <p className="text-base font-semibold">{student?.name || "Estudante UOR"}</p>
                <p className="text-sm text-muted-foreground">{student?.studentNumber || "Número não disponível"}</p>
              </div>
            </div>
          </div>
        </motion.section>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/40 p-2">
            <TabsTrigger value="jornada" className="h-11 rounded-xl px-4 text-sm md:text-sm">Jornada</TabsTrigger>
            <TabsTrigger value="submissoes" className="h-11 rounded-xl px-4 text-sm md:text-sm">Meus Projetos</TabsTrigger>
            <TabsTrigger value="inscricoes" className="h-11 rounded-xl px-4 text-sm md:text-sm">Minhas Inscrições</TabsTrigger>
          </TabsList>

          <TabsContent value="jornada" className="space-y-6">
            {loading ? (
              <div className="surface-card flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {journeyAlerts.length > 0 ? (
                  <section className="grid gap-3 md:grid-cols-3">
                    {journeyAlerts.map((alert) => (
                      <article key={alert.title} className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.description}</p>
                            {"href" in alert ? (
                              <Button asChild size="sm" variant="outline" className="mt-3 rounded-xl bg-white/70">
                                <Link to={alert.href}>{alert.action}</Link>
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="mt-3 rounded-xl bg-white/70" onClick={() => handleTabChange(alert.tab)}>
                                {alert.action}
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </section>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <section className="surface-card border-border/70 bg-card/95 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Credencial de presença</p>
                        <h2 className="mt-2 text-2xl font-semibold">QR oficial do estudante</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                          Apresenta este QR no check-in. A organização valida a presença e a tua jornada fica pronta para certificados.
                        </p>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                        attendance?.checkedIn ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-amber-500/20 bg-amber-500/10 text-amber-700"
                      }`}>
                        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                        {attendance?.checkedIn ? "Presença confirmada" : "Aguardando check-in"}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-5 sm:grid-cols-[220px_1fr]">
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-center">
                        {attendance?.credential ? (
                          <img src={attendance.credential.qrImageUrl} alt="QR de check-in" className="mx-auto h-44 w-44 rounded-xl border border-border bg-white p-2" />
                        ) : (
                          <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl border border-dashed border-border bg-white">
                            <QrCode className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                        <p className="mt-3 break-words text-xs leading-5 text-muted-foreground">
                          {attendance?.credential?.validationUrl ?? "Credencial indisponível"}
                        </p>
                      </div>

                      <div className="grid content-start gap-3">
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estudante</p>
                          <p className="mt-1 text-sm font-semibold">{attendance?.credential.studentName || student?.name || "Nome não informado"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{attendance?.credential.studentNumber || student?.studentNumber}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Última presença</p>
                          <p className="mt-1 text-sm font-semibold">
                            {attendance?.lastCheckIn ? itemDateLabel(attendance.lastCheckIn.checkedInAt) : "Ainda sem check-in"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{attendance?.lastCheckIn?.eventLabel ?? "Evento principal UOR Connect"}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="surface-card border-border/70 bg-card/95 p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Progresso</p>
                    <h2 className="mt-2 text-2xl font-semibold">Minha Jornada</h2>
                    <div className="mt-5 space-y-3">
                      {journeySteps.map((step) => (
                        <div key={step.label} className="flex gap-3 rounded-2xl border border-border/70 bg-muted/15 p-3">
                          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                            step.done ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-muted-foreground/20 bg-white text-muted-foreground"
                          }`}>
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold">{step.label}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="surface-card border-border/70 bg-card/95 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Certificados</p>
                      <h2 className="mt-2 text-2xl font-semibold">Documentos emitidos</h2>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                      <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                      {certificates.length} disponível(eis)
                    </span>
                  </div>

                  {certificates.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm leading-6 text-muted-foreground">
                      Os certificados aparecerão aqui depois da emissão pela organização.
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {certificates.map((certificate) => (
                        <article key={certificate.id} className="rounded-2xl border border-border/70 bg-muted/15 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{certificate.type}</p>
                              <h3 className="mt-1 text-base font-semibold">{certificate.title}</h3>
                              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{certificate.code}</p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              certificate.status === "ISSUED" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                            }`}>
                              {certificate.status}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void handleDownloadCertificate(certificate)} disabled={downloadingCertificateId === certificate.id}>
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
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </TabsContent>

          <TabsContent value="submissoes" className="space-y-5">
            {loading ? (
              <div className="surface-card flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="surface-card space-y-4 p-6 text-center sm:p-8">
                <FileText className="mx-auto h-10 w-10 text-primary" />
                <div>
                  <p className="text-lg font-semibold">Ainda não tens projetos submetidos.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">A tua primeira candidatura vai aparecer aqui.</p>
                </div>
                <Button asChild className="rounded-xl">
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
                      whileHover={{ y: -6, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)" }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="surface-card group border-border/70 bg-card/95 p-5"
                    >
                      <div className="relative mb-4 h-[182px] overflow-hidden rounded-2xl border border-border/70">
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
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.36)_100%)]" />
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/36 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                          <ImagePlus className="h-3.5 w-3.5" />
                          Hero do card
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${submissionTone(item.type)}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="mt-5 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.typeLabel}</p>
                        <h2 className="text-xl font-semibold leading-tight text-foreground">{item.name}</h2>
                        <p className="text-sm text-muted-foreground">{item.referenceCode}</p>
                      </div>

                      <div className="mt-4 rounded-xl border border-border/70 bg-muted/15 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Foto de capa do expositor
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {canManageBanner
                            ? "Projeto aprovado: podes escolher a imagem que aparece no topo do card."
                            : "Disponível apenas quando o projeto for aprovado."}
                        </p>
                        {canManageBanner ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full max-w-[230px] rounded-xl border border-input bg-background px-3 py-2 text-xs"
                              disabled={savingCurrentBanner}
                              onChange={(event) => {
                                void handleSubmissionBannerFile(item, event.target.files?.[0] ?? null);
                                event.currentTarget.value = "";
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingCurrentBanner}
                              onClick={() => void handleSaveOwnBanner(item)}
                            >
                              {savingCurrentBanner ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                              Guardar foto
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingCurrentBanner || !resolveSubmissionBannerPreview(item)}
                              onClick={() => void handleRemoveOwnBanner(item)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Remover foto
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          {itemDateLabel(item.createdAt)}
                        </span>
                        <Button asChild variant="outline" className="rounded-xl">
                          <Link to={item.receiptPath}>
                            Abrir recibo
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="inscricoes" className="space-y-5">
            {loading ? (
              <div className="surface-card flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="surface-card space-y-4 p-6 text-center sm:p-8">
                <BookOpenCheck className="mx-auto h-10 w-10 text-primary" />
                <div>
                  <p className="text-lg font-semibold">Ainda não tens inscrições em cursos.</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">As tuas inscrições em cursos vão aparecer aqui.</p>
                </div>
                <Button asChild className="rounded-xl">
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
                    whileHover={{ y: -6, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)" }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="surface-card border-border/70 bg-card/95 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/5 text-primary">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(item.paymentStatus)}`}>
                        {item.statusLabel}
                      </span>
                    </div>
                    <div className="mt-5 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.companyName}</p>
                      <h2 className="text-xl font-semibold leading-tight text-foreground">{item.courseName}</h2>
                      <p className="text-sm text-muted-foreground">{item.referenceCode}</p>
                    </div>
                    <div className="mt-6 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        {itemDateLabel(item.enrolledAt)}
                      </span>
                      <Button asChild variant="outline" className="rounded-xl">
                        <Link to={item.receiptPath}>
                          Ver inscrição
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
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
