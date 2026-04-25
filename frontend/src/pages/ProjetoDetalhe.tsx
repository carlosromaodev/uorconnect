import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Crown,
  ExternalLink,
  Github,
  Globe,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  QrCode,
  Send,
  Share2,
  Shield,
  ThumbsUp,
  Users
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { api, type ProjectPublicComment, type ProjectPublicFeedItem, getToken, isAuthError, setToken } from "@/lib/api";
import { canVoteSubmission, getSubmissionAreaLabel, getSubmissionAudienceCopy } from "@/lib/submission-meta";
import { toast } from "@/components/ui/sonner";
import { createQrDataUrl } from "@/lib/qr";

function withAlpha(hexColor: string, alpha = "22") {
  return `${hexColor}${alpha}`;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function LoginModal({ open, onClose, onLogin }: { open: boolean; onClose: () => void; onLogin: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] max-w-[420px] overflow-hidden rounded-2xl border-border/70 p-0">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.14),transparent_30%),linear-gradient(180deg,rgba(2,132,199,0.08),transparent)] p-5 sm:p-6">
          <DialogHeader className="pb-0 text-left">
            <DialogTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
              <Lock className="h-4 w-4 text-primary" />
              Entrar
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Usa os teus dados académicos para interagir com o projeto.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <StudentLoginForm
              compact
              onSuccess={() => {
                onLogin();
                onClose();
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentCard({ comment }: { comment: ProjectPublicComment }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">{comment.studentName}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{comment.course || "Curso não informado"}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{formatRelativeDate(comment.createdAt)}</span>
      </div>
      <p className="text-sm leading-6 text-foreground/90">{comment.content}</p>
    </div>
  );
}

export default function ProjetoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectPublicFeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{ name?: string | null; course?: string | null } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [userHasVoted, setUserHasVoted] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [qrFailed, setQrFailed] = useState(false);

  const canVote = useMemo(() => (
    project ? canVoteSubmission(project.type, project.area, project.canVote) : false
  ), [project]);

  useEffect(() => {
    const existing = getToken();
    if (!existing) return;

    setLoggedIn(true);
    api.interactions.me()
      .then((response) => {
        setStudentProfile(response.student ?? null);
      })
      .catch(() => {
        setToken(null);
        setLoggedIn(false);
        setStudentProfile(null);
      });
  }, []);

  useEffect(() => {
    if (!slug) {
      setError("Projeto inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api.interactions.projectBySlug(slug)
      .then((data) => setProject(data))
      .catch((err) => {
        setProject(null);
        setError(err instanceof Error ? err.message : "Não foi possível carregar este projeto.");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!project || !studentProfile?.name) return;
    setUserHasLiked(project.likes.some((like) => like.studentName === studentProfile.name));
  }, [project, studentProfile?.name]);

  useEffect(() => {
    let isMounted = true;

    setQrImageUrl("");
    setQrFailed(false);

    if (!project?.qrCodeValue) return undefined;

    createQrDataUrl(project.qrCodeValue, 220)
      .then((dataUrl) => {
        if (isMounted) setQrImageUrl(dataUrl);
      })
      .catch(() => {
        if (isMounted) setQrFailed(true);
      });

    return () => {
      isMounted = false;
    };
  }, [project?.qrCodeValue]);

  const handleProtectedAction = () => {
    if (!loggedIn) {
      setLoginOpen(true);
      return false;
    }

    return true;
  };

  const handleAuthAwareError = (error: unknown, fallbackMessage: string) => {
    if (isAuthError(error)) {
      setToken(null);
      setLoggedIn(false);
      setStudentProfile(null);
      setLoginOpen(true);
      return true;
    }

    toast.error(error instanceof Error ? error.message : fallbackMessage);
    return false;
  };

  const handleShare = async () => {
    if (!project) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: project.name,
          text: project.summary,
          url: project.shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(project.shareUrl);
      toast.success("Link copiado para a área de transferência.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao partilhar projeto.");
    }
  };

  const handleLike = async () => {
    if (!project || !handleProtectedAction()) return;

    try {
      const result = await api.interactions.like(project.id);
      setUserHasLiked(result.liked);
      setProject((current) => {
        if (!current) return current;

        if (result.liked) {
          const alreadyListed = current.likes.some((like) => like.studentName === (studentProfile?.name || "Estudante UOR"));
          return {
            ...current,
            likesCount: result.likesCount,
            likes: alreadyListed
              ? current.likes
              : [
                  {
                    id: Date.now(),
                    createdAt: new Date().toISOString(),
                    studentName: studentProfile?.name || "Estudante UOR",
                    course: studentProfile?.course || null,
                  },
                  ...current.likes,
                ],
          };
        }

        return {
          ...current,
          likesCount: result.likesCount,
          likes: current.likes.filter((like) => like.studentName !== (studentProfile?.name || "Estudante UOR")),
        };
      });
    } catch (error) {
      handleAuthAwareError(error, "Erro ao registar like.");
    }
  };

  const handleVote = async () => {
    if (!project) return;
    if (!canVote) {
      toast.info("Esta candidatura está em exposição e não participa na votação pública.");
      return;
    }
    if (!handleProtectedAction()) return;
    if (userHasVoted) {
      toast.info("Já votaste neste projeto.");
      return;
    }

    try {
      const result = await api.interactions.vote(project.id);
      setUserHasVoted(true);
      setProject((current) => current ? { ...current, votesCount: result.votesCount } : current);
      toast.success("Voto registado com sucesso.");
    } catch (error) {
      handleAuthAwareError(error, "Erro ao registar voto.");
    }
  };

  const handleComment = async () => {
    if (!project || !commentText.trim()) return;
    if (!handleProtectedAction()) return;

    try {
      setSubmittingComment(true);
      const created = await api.interactions.comment(project.id, commentText.trim());
      setProject((current) => current ? {
        ...current,
        commentsCount: current.commentsCount + 1,
        comments: [
          ...current.comments,
          {
            id: created.id,
            content: created.content,
            createdAt: created.createdAt,
            studentName: created.studentName,
            course: created.course,
          }
        ]
      } : current);
      setCommentText("");
      toast.success("Comentário publicado.");
    } catch (error) {
      if (handleAuthAwareError(error, "Erro ao comentar.")) return;
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen py-16">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="rounded-3xl border border-border/60 bg-card p-8 text-center shadow-sm">
            <p className="text-lg font-semibold">Projeto não encontrado</p>
            <p className="mt-3 text-sm text-muted-foreground">{error || "O link pode ter expirado ou o projeto já não está publicado."}</p>
            <Button asChild className="mt-6 rounded-2xl">
              <Link to="/projetos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar aos projetos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const heroBackground = project.bannerUrl
    ? `linear-gradient(135deg, ${withAlpha(project.primaryColor, "cc")}, ${withAlpha(project.secondaryColor, "d4")}), url(${project.bannerUrl}) center/cover`
    : `linear-gradient(135deg, ${project.primaryColor}, ${project.secondaryColor})`;

  return (
    <div className="min-h-screen py-10 md:py-16">
      <div className="container mx-auto space-y-8 px-4">
        <Button asChild variant="ghost" className="rounded-full px-0 text-sm font-medium">
          <Link to="/projetos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos projetos
          </Link>
        </Button>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[20px] border border-border/60 shadow-xl"
        >
          <div className="relative min-h-[320px] px-6 py-8 text-white md:px-10 md:py-12" style={{ background: heroBackground }}>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.62))]" />
            <div className="relative z-10 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  {getSubmissionAreaLabel(project.area, project.type)}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  {project.typeLabel}
                </span>
                {project.isWinner && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    <Crown className="h-3.5 w-3.5" />
                    Vencedor
                  </span>
                )}
              </div>

              <h1 className="mt-6 max-w-3xl font-heading text-3xl font-bold leading-tight md:text-5xl">{project.name}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/88 md:text-base">{project.description}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="rounded-2xl bg-white text-slate-900 hover:bg-white/90" onClick={() => void handleShare()}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Partilhar projeto
                </Button>
                <Button variant="outline" className="rounded-2xl border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => void handleLike()}>
                  <Heart className={`mr-2 h-4 w-4 ${userHasLiked ? "fill-current" : ""}`} />
                  {project.likesCount} likes
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl border-white/40 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => void handleVote()}
                  disabled={!canVote}
                >
                  {canVote ? <ThumbsUp className="mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
                  {canVote ? `${project.votesCount} votos` : "Exposição"}
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Likes</p>
                <p className="mt-3 text-3xl font-bold">{project.likesCount}</p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Votos</p>
                <p className="mt-3 text-3xl font-bold">{project.votesCount}</p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Comentários</p>
                <p className="mt-3 text-3xl font-bold">{project.commentsCount}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">O que este projeto representa</p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{getSubmissionAudienceCopy(project.type, project.area)}</p>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Equipa</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {project.membersList.map((member, index) => (
                  <div key={`${member}-${index}`} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium">
                    {member}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Comentários</p>
                  <p className="text-xs text-muted-foreground">Comentários públicos com nome e curso.</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  {project.commentsCount}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {project.comments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-6 text-center text-sm text-muted-foreground">
                    Ainda não há comentários. Sê o primeiro a iniciar a conversa.
                  </div>
                ) : (
                  project.comments.map((comment) => <CommentCard key={comment.id} comment={comment} />)
                )}
              </div>

              <div className="mt-5 space-y-3">
                {!loggedIn ? (
                  <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    className="w-full rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-primary p-2 text-primary-foreground">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Inicia sessão para comentar</p>
                        <p className="text-xs text-muted-foreground">O teu comentário aparece com nome e curso.</p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                      <p className="text-xs font-semibold text-primary">{studentProfile?.name || "Estudante UOR"}</p>
                      <p className="text-[11px] text-muted-foreground">{studentProfile?.course || "Curso não informado"}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <Textarea
                        placeholder="Escreve um comentário público sobre este projeto..."
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        rows={4}
                        className="min-h-[108px] flex-1 rounded-2xl border-border/70 bg-background/95"
                      />
                      <Button
                        size="icon"
                        className="h-12 w-12 shrink-0 rounded-2xl"
                        onClick={() => void handleComment()}
                        disabled={submittingComment || !commentText.trim()}
                      >
                        {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.section>

          <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Partilha</p>
              <div className="mt-4 overflow-hidden rounded-3xl border border-border/60 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <QrCode className="h-4 w-4 text-primary" />
                  QR Code para a bancada
                </div>
                {qrImageUrl && !qrFailed ? (
                  <img
                    src={qrImageUrl}
                    alt={`QR do projeto ${project.name}`}
                    className="mx-auto aspect-square w-full max-w-[220px] rounded-2xl border border-border/60 object-contain"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <div className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl border border-dashed border-border/60 px-4 text-center text-sm text-muted-foreground">
                    {qrFailed ? "Não foi possível gerar o QR Code." : "A gerar QR Code..."}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <Input readOnly value={project.shareUrl} className="rounded-2xl" />
                <Button variant="outline" className="w-full rounded-2xl" onClick={() => void handleShare()}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Copiar ou partilhar link
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
              <p className="text-sm font-semibold">Detalhes rápidos</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curso</p>
                  <p className="mt-1 font-medium">{project.course || "Curso não informado"}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Equipa</p>
                  <p className="mt-1 font-medium">{project.teamSize} membro(s)</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Publicado em</p>
                  <p className="mt-1 font-medium">{formatRelativeDate(project.createdAt)}</p>
                </div>
              </div>
            </div>

            {(project.websiteUrl || project.repoUrl) && (
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
                <p className="text-sm font-semibold">Ligações do projeto</p>
                <div className="mt-4 grid gap-2">
                  {project.websiteUrl && (
                    <Button asChild variant="outline" className="justify-start rounded-2xl">
                      <a href={project.websiteUrl} target="_blank" rel="noreferrer">
                        <Globe className="mr-2 h-4 w-4" />
                        Visitar Website
                        <ExternalLink className="ml-auto h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {project.repoUrl && (
                    <Button asChild variant="outline" className="justify-start rounded-2xl">
                      <a href={project.repoUrl} target="_blank" rel="noreferrer">
                        <Github className="mr-2 h-4 w-4" />
                        Abrir repositório
                        <ExternalLink className="ml-auto h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      </div>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={() => {
          setLoggedIn(true);
          api.interactions.me()
            .then((response) => setStudentProfile(response.student ?? null))
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
