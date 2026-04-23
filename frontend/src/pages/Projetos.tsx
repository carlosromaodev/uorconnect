import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Star,
  ThumbsUp,
  MessageCircle,
  Send,
  Lock,
  Trophy,
  Award,
  Shield,
  Users,
  User,
  Loader2,
  Heart,
  Sparkles,
  Crown,
  Share2
} from "lucide-react";
import { ProjectQrDialog, type ProjectCardItem } from "@/components/projects/ProjectQrDialog";
import { ProjectShowcaseCard } from "@/components/projects/ProjectShowcaseCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import {
  api,
  type ProjectPublicComment,
  setToken,
  getToken
} from "@/lib/api";
import { canVoteSubmission, getSubmissionAreaLabel, getSubmissionAudienceCopy, normalizeSubmissionType } from "@/lib/submission-meta";

const areaColors: Record<string, string> = {
  IoT: "bg-[hsl(199,89%,48%)]/10 text-[hsl(199,89%,48%)]",
  Telecom: "bg-primary/10 text-primary",
  Segurança: "bg-destructive/10 text-destructive",
  Web: "bg-[hsl(200,92%,42%)]/10 text-[hsl(200,92%,42%)]",
  IA: "bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,45%)]",
  Negócio: "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]",
  Produto: "bg-[hsl(330,81%,60%)]/10 text-[hsl(330,81%,60%)]",
};

const areaTopBar: Record<string, string> = {
  IoT: "bg-[hsl(199,89%,48%)]",
  Telecom: "bg-primary",
  Segurança: "bg-destructive",
  Web: "bg-[hsl(200,92%,42%)]",
  IA: "bg-[hsl(142,71%,45%)]",
  Negócio: "bg-[hsl(38,92%,50%)]",
  Produto: "bg-[hsl(330,81%,60%)]",
};

const areaBorderAccent: Record<string, string> = {
  IoT: "border-[hsl(199,89%,48%)]/30 hover:border-[hsl(199,89%,48%)]/60",
  Telecom: "border-primary/30 hover:border-primary/60",
  Segurança: "border-destructive/30 hover:border-destructive/60",
  Web: "border-[hsl(200,92%,42%)]/30 hover:border-[hsl(200,92%,42%)]/60",
  IA: "border-[hsl(142,71%,45%)]/30 hover:border-[hsl(142,71%,45%)]/60",
  Negócio: "border-[hsl(38,92%,50%)]/30 hover:border-[hsl(38,92%,50%)]/60",
  Produto: "border-[hsl(330,81%,60%)]/30 hover:border-[hsl(330,81%,60%)]/60",
};

type Project = ProjectCardItem;

function getAreaClasses(area: string, type?: string) {
  const normalizedType = normalizeSubmissionType(type, area);

  if (normalizedType === "BUSINESS") {
    return {
      badge: areaColors.Negócio,
      topBar: areaTopBar.Negócio,
      border: areaBorderAccent.Negócio,
    };
  }

  if (normalizedType === "PRODUCT") {
    return {
      badge: areaColors.Produto,
      topBar: areaTopBar.Produto,
      border: areaBorderAccent.Produto,
    };
  }

  return {
    badge: areaColors[area] || "bg-secondary text-secondary-foreground",
    topBar: areaTopBar[area] || "bg-primary",
    border: areaBorderAccent[area] || "border-border hover:border-primary/40",
  };
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          style={{ width: size, height: size }}
          className={rating >= value ? "text-primary fill-primary" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function LoginModal({ open, onClose, onLogin }: { open: boolean; onClose: () => void; onLogin: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[94vw] max-w-[420px] overflow-hidden rounded-2xl border-border/70 p-0">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.14),transparent_30%),linear-gradient(180deg,rgba(2,132,199,0.08),transparent)] p-5 sm:p-6">
        <DialogHeader className="pb-0 text-left">
          <DialogTitle className="font-heading text-lg sm:text-xl flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Entrar
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Usa os teus dados académicos para votar, gostar e comentar.
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

function CommentRow({ comment }: { comment: ProjectPublicComment }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-primary">{comment.studentName}</p>
          <p className="mt-1 text-[11px] font-medium text-[hsl(var(--area-negocio))]">{comment.course || "Curso não informado"}</p>
        </div>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatRelativeDate(comment.createdAt)}</span>
      </div>
      <p className="text-sm leading-6 text-foreground/90">{comment.content}</p>
    </div>
  );
}

function ProjectDetailModal({
  project,
  open,
  onClose,
  loggedIn,
  currentStudent,
  onRequestLogin,
  onLike,
  onComment,
  onVote
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  loggedIn: boolean;
  currentStudent: { name?: string | null; course?: string | null } | null;
  onRequestLogin: () => void;
  onLike: (projectId: number) => Promise<void>;
  onComment: (projectId: number, content: string) => Promise<void>;
  onVote: (projectId: number) => Promise<void>;
}) {
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCommentText("");
    setSubmitting(false);
  }, [project?.id, open]);

  if (!project) return null;
  const areaUi = getAreaClasses(project.area, project.type);
  const displayArea = getSubmissionAreaLabel(project.area, project.type);
  const canVote = canVoteSubmission(project.type, project.area, project.canVote);

  const handleSubmitComment = async () => {
    if (!loggedIn) {
      onRequestLogin();
      return;
    }
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      await onComment(project.id, commentText.trim());
      setCommentText("");
    } catch {
      return;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-[92vh] w-[96vw] max-w-6xl overflow-hidden border-border/70 bg-card p-0">
        <div className="grid h-full lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.18),transparent_28%),linear-gradient(160deg,rgba(2,132,199,0.18),rgba(15,23,42,0.03))] border-r border-border/60">
            <div className={`absolute inset-x-0 top-0 h-1.5 ${areaUi.topBar}`} />
            <div className="p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {project.isWinner ? "Projeto vencedor" : canVote ? "Projeto em destaque" : "Exposição em destaque"}
              </div>
              <h2 className="mt-6 max-w-xl font-heading text-4xl font-bold leading-tight">{project.name}</h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{project.description}</p>

              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border/60 bg-background/75 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Likes</p>
                  <p className="mt-2 text-2xl font-bold">{project.likesCount}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/75 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Votos</p>
                  <p className="mt-2 text-2xl font-bold">{project.votesCount}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/75 p-3 sm:p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Comentários</p>
                  <p className="mt-2 text-2xl font-bold">{project.commentsCount}</p>
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-border/60 bg-background/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Equipa</p>
                <p className="mt-2 text-sm leading-relaxed">{project.members}</p>
              </div>
            </div>

            <div className="p-8 pt-0">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Gostos públicos</p>
              <div className="flex flex-wrap gap-2">
                {project.likes.slice(0, 8).map((like) => (
                  <div key={like.id} className="rounded-full border border-border/60 bg-background/85 px-3 py-1.5">
                    <p className="text-xs font-semibold">{like.studentName}</p>
                    <p className="text-[10px] text-muted-foreground">{like.course || "Curso não informado"}</p>
                  </div>
                ))}
                {project.likes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ainda sem likes públicos neste projeto.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className={`h-1.5 lg:hidden ${areaUi.topBar}`} />
            <div className="border-b border-border/60 px-4 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full px-3 py-1 text-[11px] font-bold ${areaUi.badge}`}>
                  {displayArea}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="font-heading text-lg leading-tight sm:text-2xl">
                      <span className="inline-flex items-center gap-2">
                        {project.isWinner && <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--warning))]" />}
                        {project.name}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed">{project.description}</DialogDescription>
                  </DialogHeader>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                {canVote ? (
                  <button
                    type="button"
                    title="Votar"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold transition-colors hover:bg-primary/5"
                    onClick={() => void onVote(project.id)}
                  >
                    <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                    <span>{project.votesCount}</span>
                  </button>
                ) : (
                  <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[hsl(var(--area-negocio))]/20 bg-[hsl(var(--area-negocio))]/10 px-3 text-xs font-semibold text-[hsl(var(--area-negocio))]">
                    <Shield className="h-3.5 w-3.5" />
                    Sem votação pública
                  </div>
                )}
                <button
                  type="button"
                  title="Curtir"
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
                    project.userHasLiked
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-primary/5"
                  }`}
                  onClick={() => void onLike(project.id)}
                >
                  <Heart className={`h-3.5 w-3.5 ${project.userHasLiked ? "fill-current" : ""}`} />
                  <span>{project.likesCount}</span>
                </button>
                <div title="Comentários" className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-semibold">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" />
                  {project.commentsCount}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3">
                <p className="text-xs leading-6 text-muted-foreground">{getSubmissionAudienceCopy(project.type, project.area)}</p>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-4 sm:px-6">
              <div className="space-y-5 py-5">
                <div className="lg:hidden rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Equipa</p>
                  <p className="mt-2 text-sm leading-relaxed">{project.members}</p>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-heading font-bold">Comentários públicos</h4>
                  <div className="space-y-3">
                    {project.comments.map((comment) => (
                      <CommentRow key={comment.id} comment={comment} />
                    ))}
                    {project.comments.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-6 text-center text-sm text-muted-foreground">
                        Ainda não há comentários. Sê o primeiro a iniciar a conversa.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-heading font-bold">Quem gostou</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.likes.map((like) => (
                      <div key={like.id} className="rounded-full border border-border bg-muted/30 px-3 py-2">
                        <p className="text-xs font-semibold leading-tight">{like.studentName}</p>
                        <p className="text-[10px] text-muted-foreground">{like.course || "Curso não informado"}</p>
                      </div>
                    ))}
                    {project.likes.length === 0 && (
                      <p className="text-sm text-muted-foreground">Ainda sem likes públicos neste projeto.</p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t border-border/60 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
              {!loggedIn ? (
                <button
                  onClick={onRequestLogin}
                  className="w-full rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-primary p-2 text-primary-foreground">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Inicia sessão para comentar e gostar</p>
                      <p className="text-xs text-muted-foreground">O teu nome completo e curso vão aparecer no comentário.</p>
                    </div>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                    <p className="text-xs font-semibold text-primary">{currentStudent?.name || "Estudante UOR"}</p>
                    <p className="text-[11px] font-medium text-[hsl(var(--area-negocio))]">{currentStudent?.course || "Curso não informado"}</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea
                      placeholder="Escreve um comentário público sobre este projeto..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={3}
                      className="min-h-[96px] flex-1 rounded-2xl border-border/70 bg-background/95 text-base md:text-sm"
                    />
                    <Button
                      size="icon"
                      className="h-12 w-12 rounded-2xl shrink-0"
                      onClick={() => void handleSubmitComment()}
                      disabled={submitting || !commentText.trim()}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Projetos() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{ name?: string | null; course?: string | null } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [qrProject, setQrProject] = useState<ProjectCardItem | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const handleAuthError = (error: unknown, fallbackMessage: string) => {
    const message = error instanceof Error ? error.message : fallbackMessage;
    if (/unauthorized|missing or invalid token|invalid token/i.test(message)) {
      setToken(null);
      setLoggedIn(false);
      setStudentProfile(null);
      setLoginOpen(true);
      return true;
    }
    toast.error(message);
    return false;
  };

  const loadProjects = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const feed = await api.interactions.projects();
      setProjects(feed.map((project) => ({
        ...project,
        userHasLiked: false,
        userHasVoted: false
      })));
    } catch (err) {
      setProjects([]);
      setLoadError("Não foi possível carregar os projetos agora.");
      handleAuthError(err, "Erro ao carregar projetos.");
    } finally {
      setLoading(false);
    }
  };

  const loadSessionProfile = async () => {
    const existing = getToken();
    if (!existing) return;

    setLoggedIn(true);
    try {
      const response = await api.interactions.me();
      setStudentProfile(response.student ?? null);
    } catch {
      setToken(null);
      setLoggedIn(false);
      setStudentProfile(null);
    }
  };

  useEffect(() => {
    void loadProjects();
    void loadSessionProfile();
  }, []);

  const handleLogout = () => {
    setToken(null);
    setLoggedIn(false);
    setStudentProfile(null);
    setProjects((prev) => prev.map((project) => ({ ...project, userHasLiked: false, userHasVoted: false })));
  };

  const handleShare = async (project: Project) => {
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
      toast.success("Link do projeto copiado para a área de transferência.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao partilhar projeto.");
    }
  };

  const handleVote = async (projectId: number) => {
    const project = projects.find((item) => item.id === projectId);

    if (project && !canVoteSubmission(project.type, project.area, project.canVote)) {
      toast.info("Esta candidatura está em exposição e não participa na votação pública.");
      return;
    }

    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }

    if (project?.userHasVoted) {
      toast.info("Já votaste neste projeto.");
      return;
    }

    try {
      const result = await api.interactions.vote(projectId);
      setProjects((prev) => prev.map((project) => (
        project.id === projectId
          ? { ...project, votesCount: result.votesCount, userHasVoted: true }
          : project
      )));
      toast.success("Voto registado!");
    } catch (err) {
      handleAuthError(err, "Erro ao registar voto.");
    }
  };

  const handleLike = async (projectId: number) => {
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }

    try {
      const result = await api.interactions.like(projectId);
      setProjects((prev) => prev.map((project) => {
        if (project.id !== projectId) return project;

        if (result.liked) {
          return {
            ...project,
            userHasLiked: true,
            likesCount: result.likesCount,
            likes: [
              {
                id: Date.now(),
                createdAt: new Date().toISOString(),
                studentName: studentProfile?.name || "Estudante UOR",
                course: studentProfile?.course || null
              },
              ...project.likes
            ]
          };
        }

        return {
          ...project,
          userHasLiked: false,
          likesCount: result.likesCount,
          likes: project.likes.filter((like) => like.studentName !== (studentProfile?.name || "Estudante UOR"))
        };
      }));
    } catch (err) {
      handleAuthError(err, "Erro ao registar like.");
    }
  };

  const handleComment = async (projectId: number, content: string) => {
    try {
      const created = await api.interactions.comment(projectId, content);
      const newComment: ProjectPublicComment = {
        id: created.id,
        content: created.content,
        createdAt: created.createdAt,
        studentName: created.studentName,
        course: created.course
      };

      setProjects((prev) => prev.map((project) => (
        project.id === projectId
          ? {
              ...project,
              commentsCount: project.commentsCount + 1,
              comments: [...project.comments, newComment]
            }
          : project
      )));

      toast.success("Comentário publicado!");
    } catch (err) {
      if (handleAuthError(err, "Erro ao comentar.")) {
        return;
      }
      throw err;
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    const leftCanVote = canVoteSubmission(a.type, a.area, a.canVote);
    const rightCanVote = canVoteSubmission(b.type, b.area, b.canVote);

    if (leftCanVote !== rightCanVote) return leftCanVote ? -1 : 1;
    return b.votesCount - a.votesCount;
  });

  return (
    <div className="min-h-screen py-10 md:py-16 xl:py-20">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Award className="h-3.5 w-3.5" />
            Galeria
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Projetos e Exposições</h1>
          <p className="text-muted-foreground text-sm mb-4">
            Vota nos projetos académicos e interage com negócios e produtos em exposição.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="border border-primary/20 rounded-xl bg-primary/5 p-3 sm:p-4 mb-8 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                {loggedIn && studentProfile ? (
                  <>
                    <p className="text-sm font-heading font-bold text-primary">Sessão ativa</p>
                    <p className="text-sm font-semibold">{studentProfile.name || "Estudante"}</p>
                    <p className="text-xs text-muted-foreground">{studentProfile.course || "Curso não informado"}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-heading font-bold">Modo visitante</p>
                    <p className="text-xs text-muted-foreground">Entra para votar, gostar e comentar.</p>
                  </>
                )}
              </div>
              {!loggedIn ? (
                <Button size="sm" variant="outline" className="ml-auto shrink-0 text-xs font-semibold rounded-lg" onClick={() => setLoginOpen(true)}>
                  <Lock className="w-3.5 h-3.5 mr-1" />
                  Entrar
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="ml-auto shrink-0 text-xs font-semibold rounded-lg" onClick={handleLogout}>
                  Logout
                </Button>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-8">
              <h2 className="text-sm font-heading font-bold text-primary mb-3 flex items-center gap-1.5">
                <Award className="w-4 h-4" /> Top Projetos
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedProjects.slice(0, 3).map((project, index) => (
                  <div key={project.id} className={`border rounded-xl p-4 flex items-center gap-3 ${index === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                    <span className={`text-lg font-heading font-bold ${index === 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {project.isWinner ? <Crown className="h-5 w-5 text-[hsl(var(--warning))]" /> : `#${index + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-sm truncate">{project.name}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {canVoteSubmission(project.type, project.area, project.canVote) ? (
                          <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {project.votesCount}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[hsl(var(--area-negocio))]"><Shield className="h-3 w-3" /> Exposição</span>
                        )}
                        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {project.likesCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {loadError ? (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center">
                <p className="text-sm font-semibold text-foreground">{loadError}</p>
                <p className="mt-2 text-sm text-muted-foreground">Verifica a tua conexão e tenta novamente.</p>
                <Button className="mt-4 rounded-xl" variant="outline" onClick={() => void loadProjects()}>
                  Recarregar projetos
                </Button>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center text-sm text-muted-foreground">
                Ainda não há projetos aprovados para mostrar.
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {projects.map((project, index) => (
                  <ProjectShowcaseCard
                    key={project.id}
                    project={project}
                    index={index}
                    onShare={handleShare}
                    onOpenQr={(item) => setQrProject(item)}
                    onPrimaryAction={(item) => (
                      canVoteSubmission(item.type, item.area, item.canVote)
                        ? handleVote(item.id)
                        : handleLike(item.id)
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={() => {
          setLoggedIn(true);
          void loadSessionProfile();
        }}
      />

      <ProjectDetailModal
        project={selectedProject}
        open={selectedProject !== null}
        onClose={() => setSelectedProjectId(null)}
        loggedIn={loggedIn}
        currentStudent={studentProfile}
        onRequestLogin={() => setLoginOpen(true)}
        onLike={handleLike}
        onComment={handleComment}
        onVote={handleVote}
      />

      <ProjectQrDialog
        project={qrProject}
        open={Boolean(qrProject)}
        onClose={() => setQrProject(null)}
      />
    </div>
  );
}
