import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Copy,
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
  User,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import { UserAvatar } from "@/components/social/UserAvatar";
import { api, type ProjectPublicComment, type ProjectPublicFeedItem, getToken, isAuthError, setToken } from "@/lib/api";
import { getProjectBannerSource } from "@/lib/project-media";
import { canVoteSubmission, getSubmissionAreaLabel, getSubmissionAudienceCopy } from "@/lib/submission-meta";
import { toast } from "@/components/ui/sonner";
import { createQrDataUrl } from "@/lib/qr";

const EXHIBITOR_QR_SOURCE = "exhibitor_qr";
const EXHIBITOR_QR_VOTE_QUERY = "vote=1";
const EXHIBITOR_QR_SOURCE_QUERY = "source=exhibitor_qr";

type VoteCelebration = {
  title: string;
  message: string;
  points: number;
  tone: "success" | "warning";
  effect: "victory" | "loss" | "ready";
  actionLabel: string;
};

const scanCelebrationToneClass: Record<VoteCelebration["tone"], string> = {
  success: "scan-celebration-card--success",
  warning: "scan-celebration-card--warning",
};

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function playScanConfirmationTone(
  tone: VoteCelebration["tone"],
  effect: VoteCelebration["effect"] = "ready",
) {
  if (typeof window === "undefined") return;
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audio = new AudioContextCtor();
    const now = audio.currentTime;
    const isLoss = effect === "loss";
    const notes = effect === "victory"
      ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
      : isLoss
        ? [349.23, 293.66, 246.94, 196]
        : tone === "warning"
          ? [440, 349.23, 440]
          : [523.25, 659.25, 783.99];
    const waveform: OscillatorType = isLoss ? "sawtooth" : "sine";
    const stepDuration = isLoss ? 0.14 : 0.09;
    const noteDuration = isLoss ? 0.34 : 0.24;

    notes.forEach((frequency, index) => {
      const start = now + index * stepDuration;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = waveform;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(isLoss ? 0.045 : 0.065, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + noteDuration + 0.02);
    });

    window.setTimeout(() => void audio.close().catch(() => undefined), 1000);
  } catch {
    // O som é uma camada progressiva; o voto continua normal se o browser bloquear áudio.
  }
}

function shouldShowVotePoints(points: number) {
  return Number.isFinite(points) && points !== 0;
}

function buildExhibitorVoteUrl(project: Pick<ProjectPublicFeedItem, "shareUrl">) {
  const fallback = `${project.shareUrl}${project.shareUrl.includes("?") ? "&" : "?"}${EXHIBITOR_QR_VOTE_QUERY}&${EXHIBITOR_QR_SOURCE_QUERY}`;
  if (typeof window === "undefined") return fallback;
  try {
    const url = new URL(project.shareUrl, window.location.origin);
    url.searchParams.set("vote", "1");
    url.searchParams.set("source", EXHIBITOR_QR_SOURCE);
    return url.toString();
  } catch {
    return fallback;
  }
}

function formatFullDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function LoginModal({ open, onClose, onLogin }: { open: boolean; onClose: () => void; onLogin: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] max-w-[420px] overflow-hidden rounded-2xl border-border/70 p-0">
        <div className="bg-[linear-gradient(135deg,rgba(255,250,244,0.98),rgba(255,255,255,0.96)),linear-gradient(90deg,rgba(255,122,26,0.10),rgba(5,5,5,0.04))] p-5 sm:p-6">
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
    <div className="project-luxury-comment group relative">
      <div className="flex gap-3">
        <UserAvatar name={comment.studentName} avatarUrl={comment.studentAvatarUrl} size="md" className="shrink-0 ring-1 ring-primary/10" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">{comment.studentName}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground/70">{formatRelativeDate(comment.createdAt)}</span>
          </div>
          {comment.course && (
            <p className="break-words text-[11px] text-muted-foreground/60">{comment.course}</p>
          )}
          <p className="mt-1.5 break-words text-[13px] leading-relaxed text-foreground/80">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Heart }) {
  return (
    <div className="project-luxury-stat min-w-0">
      <div className="project-luxury-stat__icon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p>{value}</p>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function ProjetoDetalhe() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [voteConfirmationOpen, setVoteConfirmationOpen] = useState(false);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteCelebration, setVoteCelebration] = useState<VoteCelebration | null>(null);

  const canVote = useMemo(() => (
    project ? canVoteSubmission(project.type, project.area, project.canVote) : false
  ), [project]);
  const projectVoteQrUrl = useMemo(
    () => project ? buildExhibitorVoteUrl(project) : "",
    [project],
  );
  const projectPublicLinks = useMemo(() => {
    if (!project) return [];

    return [
      { label: "Website", url: project.websiteUrl, Icon: Globe },
      { label: "Repositório", url: project.repoUrl, Icon: Github },
      { label: "Instagram", url: project.instagramUrl, Icon: ExternalLink },
      { label: "Facebook", url: project.facebookUrl, Icon: ExternalLink },
      { label: "LinkedIn", url: project.linkedinUrl, Icon: ExternalLink },
      { label: "GitHub", url: project.githubUrl, Icon: Github },
    ].filter((item): item is { label: string; url: string; Icon: typeof Globe } =>
      Boolean(item.url),
    );
  }, [project]);

  useEffect(() => {
    const existing = getToken();
    if (!existing) return;
    setLoggedIn(true);
    api.interactions.me()
      .then((response) => setStudentProfile(response.student ?? null))
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
    const qrValue = projectVoteQrUrl || project?.qrCodeValue;
    if (!qrValue) return undefined;
    createQrDataUrl(qrValue, 220)
      .then((dataUrl) => { if (isMounted) setQrImageUrl(dataUrl); })
      .catch(() => { if (isMounted) setQrFailed(true); });
    return () => { isMounted = false; };
  }, [project?.qrCodeValue, projectVoteQrUrl]);

  useEffect(() => {
    if (!project || !canVote || userHasVoted) return;
    const isQrVoteIntent =
      searchParams.get("vote") === "1" &&
      searchParams.get("source") === EXHIBITOR_QR_SOURCE;
    if (!isQrVoteIntent) return;
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    setVoteConfirmationOpen(true);
  }, [canVote, loggedIn, project, searchParams, userHasVoted]);

  const handleProtectedAction = () => {
    if (!loggedIn) { setLoginOpen(true); return false; }
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
        await navigator.share({ title: project.name, text: project.summary, url: project.shareUrl });
        return;
      }
      await navigator.clipboard.writeText(project.shareUrl);
      toast.success("Link copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao partilhar projeto.");
    }
  };

  const handleCopyLink = async () => {
    if (!project) return;
    try {
      await navigator.clipboard.writeText(projectVoteQrUrl || project.shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar link.");
    }
  };

  const clearVoteIntentQuery = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("vote");
    nextParams.delete("source");
    setSearchParams(nextParams, { replace: true });
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
              : [{ id: Date.now(), createdAt: new Date().toISOString(), studentName: studentProfile?.name || "Estudante UOR", course: studentProfile?.course || null }, ...current.likes],
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
    if (!canVote) { toast.info("Esta candidatura está em exposição e não participa na votação pública."); return; }
    if (!handleProtectedAction()) return;
    if (userHasVoted) { toast.info("Já votaste neste projeto."); return; }
    setVoteConfirmationOpen(true);
  };

  const handleConfirmVote = async () => {
    if (!project) return;
    if (!canVote) { toast.info("Esta candidatura está em exposição e não participa na votação pública."); return; }
    if (!handleProtectedAction()) return;
    if (userHasVoted) { toast.info("Já votaste neste projeto."); return; }
    try {
      setVoteSubmitting(true);
      const result = await api.interactions.vote(project.id);
      setUserHasVoted(true);
      setProject((current) => current ? { ...current, votesCount: result.votesCount } : current);
      setVoteConfirmationOpen(false);
      clearVoteIntentQuery();
      const gained = result.scoreDelta > 0;
      const bonusSummary = result.scoringEvents
        .filter((event) => event.action !== "STUDENT_VOTE")
        .map((event) => event.reason || event.action)
        .slice(0, 3)
        .join(" · ");
      const celebration: VoteCelebration = {
        title: gained ? "Voto convertido" : "Voto registado",
        message: bonusSummary
          ? `${result.message} Bónus aplicados: ${bonusSummary}.`
          : result.message,
        points: result.scoreDelta,
        tone: gained ? "success" : "warning",
        effect: gained ? "victory" : "ready",
        actionLabel: "Votação do Expositor",
      };
      setVoteCelebration(celebration);
      playScanConfirmationTone(celebration.tone, celebration.effect);
      toast.success("Voto registado com sucesso.");
    } catch (error) {
      handleAuthAwareError(error, "Erro ao registar voto.");
    } finally {
      setVoteSubmitting(false);
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
        comments: [...current.comments, { id: created.id, content: created.content, createdAt: created.createdAt, studentName: created.studentName, studentAvatarUrl: created.studentAvatarUrl ?? null, course: created.course }],
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen py-20">
        <div className="container mx-auto max-w-lg px-4 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="font-heading text-xl font-bold">Projeto não encontrado</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error || "O link pode ter expirado ou o projeto já não está publicado."}</p>
          <Button asChild variant="outline" className="mt-6 rounded-full">
            <Link to="/projetos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar aos projetos
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const areaLabel = getSubmissionAreaLabel(project.area, project.type);
  const audienceCopy = getSubmissionAudienceCopy(project.type, project.area);
  const projectLuxuryStyle = {
    "--project-primary": project.primaryColor || "#ff7a1a",
    "--project-secondary": project.secondaryColor || "#050505",
  } as CSSProperties;
  const bannerSource = getProjectBannerSource(project.bannerUrl);

  return (
    <div className="project-luxury-page min-h-screen overflow-x-clip" style={projectLuxuryStyle}>
      {/* Breadcrumb */}
      <div className="project-luxury-breadcrumb">
        <div className="container mx-auto flex min-w-0 items-center gap-1.5 px-4 py-3 text-[13px]">
          <Link to="/projetos" className="shrink-0 transition-colors hover:text-slate-950">Projetos</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate font-semibold text-slate-950">{project.name}</span>
        </div>
      </div>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="project-luxury-hero"
      >
        <div className="container relative mx-auto min-w-0 px-4 py-8 md:py-12">
          <div className="project-luxury-hero__frame">
            <div className="project-luxury-hero__copy">
              <div className="project-luxury-tags">
                <span>{areaLabel}</span>
                <span>{project.typeLabel}</span>
                {project.isWinner && (
                  <span className="is-winner">
                    <Crown className="h-3 w-3" />
                    Vencedor
                  </span>
                )}
              </div>

              <h1>{project.name}</h1>

              {project.course && (
                <p className="project-luxury-course">{project.course}</p>
              )}

              <p className="project-luxury-description">
                {project.description}
              </p>

              <div className="project-luxury-actions">
                <button
                  type="button"
                  onClick={() => void handleLike()}
                  className={userHasLiked ? "is-active" : ""}
                >
                  <Heart className={`h-4 w-4 ${userHasLiked ? "fill-current" : ""}`} />
                  {project.likesCount}
                </button>

                {canVote ? (
                  <button
                    type="button"
                    onClick={() => void handleVote()}
                    className={userHasVoted ? "is-active" : ""}
                  >
                    <ThumbsUp className={`h-4 w-4 ${userHasVoted ? "fill-current" : ""}`} />
                    {project.votesCount} votos
                  </button>
                ) : (
                  <span>
                    <Shield className="h-4 w-4" />
                    Exposição
                  </span>
                )}

                <button type="button" onClick={() => void handleShare()}>
                  <Share2 className="h-4 w-4" />
                  Partilhar
                </button>
              </div>
            </div>

            <div className="project-luxury-hero__visual">
              {bannerSource ? (
                <img src={bannerSource} alt={`Imagem do projeto ${project.name}`} />
              ) : (
                <div className="project-luxury-visual-fallback">
                  <span>{project.name.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <div className="project-luxury-hero__seal">
                <QrCode className="h-4 w-4" />
                QR público
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Content */}
      <div className="container mx-auto min-w-0 px-4 py-8 md:py-12">
        <div className="project-luxury-content-grid grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-12">
          {/* Main */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="min-w-0 space-y-8"
          >
            {/* Stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatItem icon={Heart} label="Likes" value={project.likesCount} />
              <StatItem icon={ThumbsUp} label="Votos" value={project.votesCount} />
              <StatItem icon={MessageCircle} label="Comentários" value={project.commentsCount} />
            </div>

            {/* About */}
            <div className="project-luxury-panel">
              <h2>Sobre a proposta</h2>
              <p className="mt-3 break-words text-[15px] leading-7 text-slate-700">
                {audienceCopy}
              </p>
            </div>

            {/* Team */}
            <div className="project-luxury-panel">
              <h2 className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Equipa ({project.teamSize})
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {project.membersList.map((member, index) => (
                  <div key={`${member}-${index}`} className="project-luxury-member">
                    <div>
                      {member.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </div>
                    <span className="truncate text-sm font-medium">{member}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div className="project-luxury-panel">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Comentários ({project.commentsCount})
                </h2>
              </div>

              <div className="mt-5 space-y-5">
                {project.comments.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground/60">
                    Ainda sem comentários. Sê o primeiro.
                  </p>
                )}
                {project.comments.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} />
                ))}
              </div>

              {/* Comment form */}
              <div className="mt-6">
                {!loggedIn ? (
                  <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    className="project-luxury-login-prompt"
                  >
                    <div>
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Inicia sessão para comentar</p>
                      <p className="break-words text-[12px] text-muted-foreground">O teu comentário aparece com nome e curso.</p>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8 text-[10px] font-bold text-primary ring-1 ring-primary/10">
                        {(studentProfile?.name || "U")
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{studentProfile?.name || "Estudante UOR"}</p>
                        <p className="break-words text-[11px] text-muted-foreground">{studentProfile?.course || ""}</p>
                      </div>
                    </div>
                    <div className="flex min-w-0 gap-2">
                      <Textarea
                        placeholder="Escreve um comentário..."
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        rows={3}
                        className="min-h-[80px] min-w-0 flex-1 resize-none rounded-xl border-border/50 bg-muted/20 text-sm focus-visible:ring-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="mt-auto h-10 w-10 shrink-0 rounded-xl"
                        onClick={() => void handleComment()}
                        disabled={submittingComment || !commentText.trim()}
                      >
                        {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="project-luxury-sidebar min-w-0 space-y-6"
          >
            {/* QR + Share */}
            <div className="project-luxury-qr-card">
              <div className="flex items-center gap-2 text-[13px] font-black text-slate-950">
                <QrCode className="h-4 w-4 text-orange-700" />
                QR da bancada
              </div>
              <div className="mt-4 flex justify-center">
                {qrImageUrl && !qrFailed ? (
                  <img
                    src={qrImageUrl}
                    alt={`QR do projeto ${project.name}`}
                    className="aspect-square w-full max-w-[180px] rounded-xl"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <div className="flex aspect-square w-full max-w-[180px] items-center justify-center rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground">
                    {qrFailed ? "Indisponível" : "A gerar..."}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="project-luxury-copy-link"
              >
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{projectVoteQrUrl || project.shareUrl}</span>
                <Copy className={`h-4 w-4 shrink-0 transition-colors ${linkCopied ? "text-green-500" : "text-muted-foreground"}`} />
              </button>
            </div>

            {/* Details */}
            <div className="project-luxury-side-card">
              <h3>Detalhes</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Curso</p>
                    <p className="break-words font-medium">{project.course || "Não informado"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Equipa</p>
                    <p className="font-medium">{project.teamSize} membro{project.teamSize !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">Publicado</p>
                    <p className="font-medium">{formatFullDate(project.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Links */}
            {projectPublicLinks.length > 0 && (
              <div className="project-luxury-side-card">
                <h3>Ligações</h3>
                <div className="mt-3 space-y-2">
                  {projectPublicLinks.map(({ label, url, Icon }) => (
                    <a
                      key={`${label}-${url}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-border/40 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 truncate">{label}</span>
                      <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      </div>

      <Dialog
        open={voteConfirmationOpen}
        onOpenChange={(open) => {
          setVoteConfirmationOpen(open);
          if (!open) clearVoteIntentQuery();
        }}
      >
        <DialogContent className="w-[94vw] max-w-[440px] overflow-hidden rounded-2xl border-border/70 p-0">
          <div className="bg-[linear-gradient(135deg,rgba(255,250,244,0.98),rgba(255,255,255,0.96)),linear-gradient(90deg,rgba(255,122,26,0.10),rgba(5,5,5,0.04))] p-5 sm:p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
                <ThumbsUp className="h-4 w-4 text-primary" />
                Vais votar no projeto
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Confirma antes de gravar o voto em {project.name}. O voto pode pontuar o projeto; bónus só entram depois da conversão validada pelo sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-2xl border border-orange-100 bg-white/80 p-4">
              <p className="text-sm font-black text-slate-950">{project.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Cada estudante vota uma vez por projeto. Se o teu curso ou universidade desbloquear bónus, o sistema mostra a pontuação na Minha Área do expositor.
              </p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl bg-white"
                onClick={() => {
                  setVoteConfirmationOpen(false);
                  clearVoteIntentQuery();
                }}
                disabled={voteSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl bg-slate-950 font-bold text-white hover:bg-slate-800"
                onClick={() => void handleConfirmVote()}
                disabled={voteSubmitting}
              >
                {voteSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="mr-2 h-4 w-4" />
                )}
                Confirmar voto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      <AnimatePresence>
        {voteCelebration ? (
          <motion.div
            className="scan-celebration-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={`scan-celebration-card ${scanCelebrationToneClass[voteCelebration.tone]} scan-celebration-card--effect-${voteCelebration.effect}`}
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              style={{ padding: "0 0 1.5rem 0" }}
            >
              <div className="scan-celebration-card__shine" aria-hidden="true" />
              <button
                type="button"
                className="scan-celebration-card__close"
                onClick={() => setVoteCelebration(null)}
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="scan-celebration-card__medal">
                {voteCelebration.tone === "warning" ? (
                  <AlertTriangle className="h-7 w-7" />
                ) : (
                  <CheckCircle2 className="h-7 w-7" />
                )}
              </div>
              <div style={{ padding: "0 1.25rem" }}>
                <p className="scan-celebration-card__kicker">
                  {voteCelebration.actionLabel}
                </p>
                <h2>{voteCelebration.title}</h2>
                <p>{voteCelebration.message}</p>
                {shouldShowVotePoints(voteCelebration.points) ? (
                  <strong className={voteCelebration.points < 0 ? "is-negative" : ""}>
                    {voteCelebration.points > 0 ? `+${voteCelebration.points}` : voteCelebration.points} pts
                  </strong>
                ) : null}
                <p style={{
                  marginTop: "0.75rem",
                  fontFamily: "monospace",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "rgb(148 163 184 / 0.5)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}>
                  UOR Connect · Votação do Expositor · {new Date().toLocaleDateString("pt-AO")}
                </p>
                <Button
                  type="button"
                  className="mt-4 h-11 w-full rounded-xl bg-slate-950 px-5 font-bold text-white hover:bg-slate-800"
                  onClick={() => setVoteCelebration(null)}
                >
                  Continuar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
