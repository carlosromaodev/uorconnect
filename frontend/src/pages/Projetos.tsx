import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
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
  Crown,
  QrCode,
  Share2,
  Search,
  X,
} from "lucide-react";
import { ProjectQrDialog, type ProjectCardItem } from "@/components/projects/ProjectQrDialog";
import { ProjectShowcaseCard } from "@/components/projects/ProjectShowcaseCard";
import { UserAvatar } from "@/components/social/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { StudentLoginForm } from "@/components/auth/StudentLoginForm";
import {
  api,
  type ProjectPublicComment,
  type ProjectFeedAudience,
  type ProjectFeedSort,
  setToken,
  getToken
} from "@/lib/api";
import { canVoteSubmission, getSubmissionAreaLabel, getSubmissionAudienceCopy } from "@/lib/submission-meta";
import { getProjectAreaClasses } from "@/lib/project-card-ui";
import { getProjectsPageFeedParams, getTopProjectsFeedParams } from "@/lib/project-feed-options";

type Project = ProjectCardItem;
type ProjectViewMode = "compact" | "showcase";

const projectSortOptions: Array<{ value: ProjectFeedSort; label: string; caption: string }> = [
  { value: "recent_desc", label: "Recentes", caption: "últimos aprovados" },
  { value: "votes_desc", label: "Mais votados", caption: "ranking real" },
  { value: "likes_desc", label: "Mais gostados", caption: "interações" },
  { value: "comments_desc", label: "Mais comentados", caption: "debate" },
];
const projectAudienceOptions: Array<{ value: ProjectFeedAudience; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "competition", label: "Projetos" },
  { value: "exhibitions", label: "Exposições" },
];

function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function ProjectCompactCard({
  project,
  index,
  onOpen,
  onPrefetch,
  onShare,
  onOpenQr,
  onPrimaryAction,
  onLikeAction,
}: {
  project: Project;
  index: number;
  onOpen: (project: Project) => void | Promise<void>;
  onPrefetch: (project: Project) => void | Promise<void>;
  onShare: (project: Project) => void | Promise<void>;
  onOpenQr: (project: Project) => void;
  onPrimaryAction: (project: Project) => void | Promise<void>;
  onLikeAction: (project: Project) => void | Promise<void>;
}) {
  const areaUi = getProjectAreaClasses(project.area, project.type);
  const displayArea = getSubmissionAreaLabel(project.area, project.type);
  const canVote = canVoteSubmission(project.type, project.area, project.canVote);
  const primaryLabel = canVote ? (project.userHasVoted ? "Votado" : "Votar") : (project.userHasLiked ? "Gostei" : "Gostar");

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index, 10) * 0.025, type: "spring", stiffness: 260, damping: 24 }}
      className="project-compact-vote-card group relative flex min-h-[220px] flex-col overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: `${project.primaryColor}33` }}
      onMouseEnter={() => void onPrefetch(project)}
      onFocus={() => void onPrefetch(project)}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: project.primaryColor }}
      />

      <button
        type="button"
        className="flex flex-1 flex-col text-left"
        onClick={() => void onOpen(project)}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className={`max-w-[70%] truncate rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${areaUi.badge}`}>
            {displayArea}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-1 text-[10px] font-bold text-foreground">
            {canVote ? <ThumbsUp className="h-3 w-3 text-primary" /> : <Heart className="h-3 w-3 text-primary" />}
            {canVote ? project.votesCount : project.likesCount}
          </span>
        </div>

        <h3 className="line-clamp-2 min-h-[2.5rem] font-heading text-sm font-bold leading-tight text-foreground sm:text-[15px]">
          {project.isWinner && <Crown className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-[hsl(var(--warning))]" />}
          {project.name}
        </h3>

        <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
          {project.course || project.typeLabel}
        </p>

        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/65">
          {project.summary || project.description}
        </p>

        <div className="mt-auto grid grid-cols-3 gap-1.5 pt-3 text-[10px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1">
            <Heart className="h-3 w-3" />
            {project.likesCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1">
            <MessageCircle className="h-3 w-3" />
            {project.commentsCount}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1">
            <Users className="h-3 w-3" />
            {project.teamSize}
          </span>
        </div>
      </button>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.25rem] gap-1.5">
        <Button
          size="sm"
          variant={canVote ? (project.userHasVoted ? "default" : "outline") : (project.userHasLiked ? "default" : "outline")}
          className="h-9 min-w-0 rounded-lg px-2 text-[11px] font-bold"
          onClick={() => void onPrimaryAction(project)}
        >
          {canVote ? <Trophy className="h-3.5 w-3.5" /> : <Heart className={`h-3.5 w-3.5 ${project.userHasLiked ? "fill-current" : ""}`} />}
          <span className="truncate">{primaryLabel}</span>
        </Button>

        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-lg border-border/60"
          title="Gostar"
          onClick={() => void onLikeAction(project)}
        >
          <Heart className={`h-3.5 w-3.5 ${project.userHasLiked ? "fill-current text-primary" : ""}`} />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-lg border-border/60"
          title="QR Code"
          onClick={() => onOpenQr(project)}
        >
          <QrCode className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-lg border-border/60"
          title="Partilhar"
          onClick={() => void onShare(project)}
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <button
        type="button"
        className="mt-2 inline-flex h-8 items-center justify-center gap-1 rounded-lg text-[11px] font-bold text-primary transition-colors hover:bg-primary/5"
        onClick={() => void onOpen(project)}
      >
        Ver detalhe
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </motion.article>
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
        <div className="flex min-w-0 items-start gap-2.5">
          <UserAvatar name={comment.studentName} avatarUrl={comment.studentAvatarUrl} size="sm" className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-primary">{comment.studentName}</p>
            <p className="mt-1 text-[11px] font-medium text-[hsl(var(--area-negocio))]">{comment.course || "Curso não informado"}</p>
          </div>
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
  const areaUi = getProjectAreaClasses(project.area, project.type);
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
      <DialogContent className="project-detail-dialog max-h-[calc(100dvh-1rem)] w-[96vw] max-w-6xl gap-0 overflow-y-auto overscroll-contain border-border/70 bg-card p-0 lg:h-[92vh] lg:max-h-[92vh] lg:overflow-hidden">
        <div className="min-h-0 lg:grid lg:h-full lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.18),transparent_28%),linear-gradient(160deg,rgba(2,132,199,0.18),rgba(15,23,42,0.03))] border-r border-border/60">
            <div className={`absolute inset-x-0 top-0 h-1.5 ${areaUi.topBar}`} />
            <div className="p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {project.isWinner ? <Crown className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
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

          <div className="flex min-h-0 flex-col lg:h-full">
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

            <div className="px-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
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
            </div>

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
  const [topProjects, setTopProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [projectsPage, setProjectsPage] = useState(1);
  const [projectsTotalPages, setProjectsTotalPages] = useState(1);
  const [projectsTotal, setProjectsTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projectSort, setProjectSort] = useState<ProjectFeedSort>("recent_desc");
  const [audienceFilter, setAudienceFilter] = useState<ProjectFeedAudience>("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ProjectViewMode>("compact");
  const [loggedIn, setLoggedIn] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{ name?: string | null; course?: string | null } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [qrProject, setQrProject] = useState<ProjectCardItem | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const hydratingProjectIds = useRef(new Set<number>());

  const selectedProject = useMemo(
    () => [...projects, ...topProjects].find((project) => project.id === selectedProjectId) ?? null,
    [projects, topProjects, selectedProjectId]
  );
  const availableCourses = useMemo(() => {
    const seen = new Set<string>();
    return [...projects, ...topProjects]
      .map((project) => project.course?.trim())
      .filter((course): course is string => {
        if (!course || seen.has(course)) return false;
        seen.add(course);
        return true;
      })
      .slice(0, 8);
  }, [projects, topProjects]);
  const hasActiveFilters = Boolean(deferredSearchTerm.trim() || courseFilter || audienceFilter !== "all");

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

  const mapFeedProject = (project: Project): Project => ({
    ...project,
    userHasLiked: project.userHasLiked ?? false,
    userHasVoted: project.userHasVoted ?? false
  });

  const updateProjectEverywhere = (projectId: number, updater: (project: Project) => Project) => {
    setProjects((prev) => prev.map((project) => (project.id === projectId ? updater(project) : project)));
    setTopProjects((prev) => prev.map((project) => (project.id === projectId ? updater(project) : project)));
  };

  const loadTopProjects = async () => {
    try {
      const feed = await api.interactions.projects(getTopProjectsFeedParams());
      setTopProjects(feed.items.map((project) => mapFeedProject(project)));
    } catch {
      setTopProjects([]);
    }
  };

  const loadProjects = async (page = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setLoadError(null);
    try {
      const feed = await api.interactions.projects(getProjectsPageFeedParams({
        page,
        sort: projectSort,
        q: deferredSearchTerm,
        course: courseFilter,
        audience: audienceFilter,
      }));
      const mapped = feed.items.map((project) => mapFeedProject(project));
      setProjects((current) => (append ? [...current, ...mapped] : mapped));
      setProjectsPage(feed.page);
      setProjectsTotalPages(feed.totalPages);
      setProjectsTotal(feed.total);
    } catch (err) {
      if (!append) setProjects([]);
      setLoadError("Não foi possível carregar os projetos agora.");
      handleAuthError(err, "Erro ao carregar projetos.");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
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
  }, [projectSort, deferredSearchTerm, courseFilter, audienceFilter]);

  useEffect(() => {
    void loadTopProjects();
    void loadSessionProfile();
  }, []);

  const handleLogout = () => {
    setToken(null);
    setLoggedIn(false);
    setStudentProfile(null);
    setProjects((prev) => prev.map((project) => ({ ...project, userHasLiked: false, userHasVoted: false })));
    setTopProjects((prev) => prev.map((project) => ({ ...project, userHasLiked: false, userHasVoted: false })));
  };

  const hydrateProject = async (project: Project) => {
    if (project.comments.length >= project.commentsCount && project.likes.length >= Math.min(project.likesCount, 12)) {
      return project;
    }
    if (hydratingProjectIds.current.has(project.id)) {
      return project;
    }

    hydratingProjectIds.current.add(project.id);
    try {
      const detail = await api.interactions.projectBySlug(project.slug, { likesLimit: 12, commentsLimit: 50 });
      const hydrated: Project = {
        ...detail,
        userHasLiked: project.userHasLiked ?? false,
        userHasVoted: project.userHasVoted ?? false,
      };

      setProjects((prev) => prev.map((item) => (item.id === hydrated.id ? hydrated : item)));
      setTopProjects((prev) => prev.map((item) => (item.id === hydrated.id ? hydrated : item)));
      return hydrated;
    } catch (err) {
      handleAuthError(err, "Erro ao abrir detalhe do projeto.");
      return project;
    } finally {
      hydratingProjectIds.current.delete(project.id);
    }
  };

  const prefetchProject = async (project: Project) => {
    await hydrateProject(project);
  };

  const openProject = async (project: Project) => {
    setSelectedProjectId(project.id);
    await hydrateProject(project);
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
      updateProjectEverywhere(projectId, (project) => ({ ...project, votesCount: result.votesCount, userHasVoted: true }));
      void loadTopProjects();
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
      const updateLikedProject = (project: Project): Project => {
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
      };
      setProjects((prev) => prev.map(updateLikedProject));
      setTopProjects((prev) => prev.map(updateLikedProject));
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
        studentAvatarUrl: created.studentAvatarUrl ?? null,
        course: created.course
      };

      const updateCommentedProject = (project: Project): Project => (
        project.id === projectId
          ? {
              ...project,
              commentsCount: project.commentsCount + 1,
              comments: [...project.comments, newComment]
            }
          : project
      );
      setProjects((prev) => prev.map(updateCommentedProject));
      setTopProjects((prev) => prev.map(updateCommentedProject));

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
  const topProjectsDisplay = topProjects.length > 0 ? topProjects : sortedProjects.slice(0, 6);
  const activeSort = projectSortOptions.find((option) => option.value === projectSort) ?? projectSortOptions[0];

  return (
    <div className="min-h-screen py-10 md:py-16 xl:py-20">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Award className="h-3.5 w-3.5" />
            Galeria
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Boletim de projetos</h1>
          <p className="text-muted-foreground text-sm mb-4">
            Vota nos projetos académicos e acompanha as exposições com uma leitura mais clara da feira.
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
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 className="text-base font-heading font-bold text-foreground flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <Award className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Mais votados
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-xs font-semibold"
                  onClick={() => setProjectSort("votes_desc")}
                >
                  Ver ranking
                </Button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 xl:grid-cols-6">
                {topProjectsDisplay.map((project, index) => {
                  const isFirst = index === 0;
                  const primaryColor = project.primaryColor || "hsl(var(--primary))";
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.06, type: "spring", stiffness: 260, damping: 24 }}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                      className={`relative min-w-[220px] overflow-hidden rounded-xl border p-4 transition-shadow duration-200 md:min-w-0 ${isFirst ? "border-primary/25 bg-primary/[0.04] shadow-sm sm:row-span-1" : "border-border/70 bg-card hover:shadow-sm"}`}
                      style={isFirst ? { borderLeftWidth: 3, borderLeftColor: primaryColor } : undefined}
                      onClick={() => void openProject(project)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${isFirst ? "bg-primary text-primary-foreground shadow-sm" : index === 1 ? "bg-slate-200 text-slate-600" : "bg-orange-100 text-orange-600"}`}>
                          {project.isWinner ? <Crown className="h-4 w-4 text-[hsl(var(--warning))]" /> : `#${index + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-heading font-semibold text-sm leading-snug line-clamp-2">{project.name}</p>
                          {project.course && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{project.course}</p>
                          )}
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                            {canVoteSubmission(project.type, project.area, project.canVote) ? (
                              <span className="inline-flex items-center gap-1 font-medium"><ThumbsUp className="h-3 w-3" /> {project.votesCount}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-medium text-[hsl(var(--area-negocio))]"><Shield className="h-3 w-3" /> Exposição</span>
                            )}
                            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {project.likesCount}</span>
                            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {project.commentsCount}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
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
              <>
                <div className="sticky top-3 z-20 mb-5 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-bold">Explorar projetos</p>
                      <p className="text-xs text-muted-foreground">
                        {projectsTotal} aprovados · {activeSort.label.toLowerCase()} · página {projectsPage} de {projectsTotalPages}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 rounded-xl border border-border/70 bg-muted/25 p-1">
                      <Button
                        size="sm"
                        variant={viewMode === "compact" ? "default" : "ghost"}
                        className="h-8 rounded-lg text-xs font-bold"
                        onClick={() => setViewMode("compact")}
                      >
                        Compacto
                      </Button>
                      <Button
                        size="sm"
                        variant={viewMode === "showcase" ? "default" : "ghost"}
                        className="h-8 rounded-lg text-xs font-bold"
                        onClick={() => setViewMode("showcase")}
                      >
                        Detalhado
                      </Button>
                    </div>
                    </div>

                    <div className="grid gap-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Pesquisar por projeto, curso, área ou membro..."
                          className="h-10 rounded-xl border-border/70 bg-background pl-9 pr-9 text-sm"
                        />
                        {searchTerm ? (
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => setSearchTerm("")}
                            aria-label="Limpar pesquisa"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {projectAudienceOptions.map((option) => (
                          <Button
                            key={option.value}
                            size="sm"
                            variant={audienceFilter === option.value ? "default" : "outline"}
                            className="h-10 rounded-xl px-3 text-xs font-bold"
                            onClick={() => setAudienceFilter(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                        {hasActiveFilters ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 rounded-xl px-3 text-xs font-bold"
                            onClick={() => {
                              setSearchTerm("");
                              setCourseFilter("");
                              setAudienceFilter("all");
                            }}
                          >
                            Limpar
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {availableCourses.map((course) => (
                          <Button
                            key={course}
                            size="sm"
                            variant={courseFilter === course ? "default" : "outline"}
                            className="h-8 max-w-[220px] rounded-lg px-2.5 text-[11px] font-semibold"
                            title={course}
                            onClick={() => setCourseFilter((current) => current === course ? "" : course)}
                          >
                            <span className="truncate">{course}</span>
                          </Button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {projectSortOptions.map((option) => (
                          <Button
                            key={option.value}
                            size="sm"
                            variant={projectSort === option.value ? "default" : "outline"}
                            className="h-9 rounded-lg px-3 text-xs font-bold"
                            onClick={() => setProjectSort(option.value)}
                          >
                            <span>{option.label}</span>
                            <span className="hidden text-[10px] font-medium opacity-70 xl:inline">{option.caption}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={viewMode === "compact"
                  ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  : "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
                }>
                  {projects.map((project, index) => (
                    viewMode === "compact" ? (
                      <ProjectCompactCard
                        key={project.id}
                        project={project}
                        index={index}
                        onOpen={openProject}
                        onPrefetch={prefetchProject}
                        onShare={handleShare}
                        onOpenQr={(item) => setQrProject(item)}
                        onPrimaryAction={(item) => (
                          canVoteSubmission(item.type, item.area, item.canVote)
                            ? handleVote(item.id)
                            : handleLike(item.id)
                        )}
                        onLikeAction={(item) => handleLike(item.id)}
                      />
                    ) : (
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
                        onLikeAction={(item) => handleLike(item.id)}
                      />
                    )
                  ))}
                </div>
                {projectsPage < projectsTotalPages ? (
                  <div className="mt-6 flex justify-center">
                    <Button className="rounded-xl" variant="outline" disabled={loadingMore} onClick={() => void loadProjects(projectsPage + 1, true)}>
                      {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Carregar mais
                    </Button>
                  </div>
                ) : null}
              </>
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
