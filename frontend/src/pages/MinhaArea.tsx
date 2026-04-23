import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpenCheck, BriefcaseBusiness, CalendarClock, ExternalLink, FileText, GraduationCap, ImagePlus, Layers3, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api, type StudentEnrollmentListItem, type StudentOwnedSubmissionListItem, getSessionStudent, isAuthError, setToken } from "@/lib/api";
import { getProjectBannerSource, readImageFileAsDataUrl } from "@/lib/project-media";

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
  const [student, setStudent] = useState(() => getSessionStudent());
  const [submissionBannerDrafts, setSubmissionBannerDrafts] = useState<Record<number, string | null | undefined>>({});
  const [savingBannerId, setSavingBannerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"submissoes" | "inscricoes">(
    searchParams.get("tab") === "inscricoes" ? "inscricoes" : "submissoes"
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
    ])
      .then(([submissionItems, enrollmentItems]) => {
        if (!active) return;
        setSubmissions(submissionItems);
        setSubmissionBannerDrafts(
          submissionItems.reduce<Record<number, string | null>>((acc, item) => {
            acc[item.id] = item.bannerUrl ?? null;
            return acc;
          }, {})
        );
        setEnrollments(enrollmentItems);
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
    const requestedTab = searchParams.get("tab") === "inscricoes" ? "inscricoes" : "submissoes";
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
    const normalized = next === "inscricoes" ? "inscricoes" : "submissoes";
    setActiveTab(normalized);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", normalized);
    setSearchParams(nextParams);
  };

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
                <Sparkles className="h-3.5 w-3.5" />
                Área do estudante
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold sm:text-4xl">Minha Área</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Acompanha o estado dos teus projetos e inscrições.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sessão ativa</p>
              <p className="mt-2 text-base font-semibold">{student?.name || "Estudante UOR"}</p>
              <p className="text-sm text-muted-foreground">{student?.studentNumber || "Número não disponível"}</p>
            </div>
          </div>
        </motion.section>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/40 p-2">
            <TabsTrigger value="submissoes" className="h-11 rounded-xl px-4 text-sm md:text-sm">Meus Projetos</TabsTrigger>
            <TabsTrigger value="inscricoes" className="h-11 rounded-xl px-4 text-sm md:text-sm">Minhas Inscrições</TabsTrigger>
          </TabsList>

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
                              className="max-w-[230px] rounded-xl border border-input bg-background px-3 py-2 text-xs"
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
