import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Crown,
  ExternalLink,
  Heart,
  MessageCircle,
  QrCode,
  Shield,
  ThumbsUp,
  Trophy,
  Users,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ProjectCardItem } from "@/components/projects/ProjectQrDialog";
import { ShareButtons } from "@/components/social/ShareButtons";
import { UserAvatar } from "@/components/social/UserAvatar";
import { getProjectBannerSource } from "@/lib/project-media";
import { getProjectDetailPath } from "@/lib/project-links";
import { getProjectAreaClasses, withAlpha } from "@/lib/project-card-ui";
import {
  getSubmissionAreaLabel,
  getSubmissionAudienceCopy,
  canVoteSubmission,
} from "@/lib/submission-meta";
import { cn } from "@/lib/utils";

function StatPill({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Heart;
  value: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border/40 bg-muted/30 px-2.5 py-2 text-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      <p className="text-sm font-bold leading-tight" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function ProjectShowcaseCard({
  project,
  index = 0,
  className,
  onShare,
  onOpenQr,
  onPrimaryAction,
}: {
  project: ProjectCardItem;
  index?: number;
  className?: string;
  onShare: (project: ProjectCardItem) => void | Promise<void>;
  onOpenQr: (project: ProjectCardItem) => void;
  onPrimaryAction: (project: ProjectCardItem) => void | Promise<void>;
}) {
  const areaUi = getProjectAreaClasses(project.area, project.type);
  const displayArea = getSubmissionAreaLabel(project.area, project.type);
  const canVote = canVoteSubmission(project.type, project.area, project.canVote);
  const bannerSource = getProjectBannerSource(project.bannerUrl);
  const location = useLocation();
  const heroGradient = `linear-gradient(145deg, ${withAlpha(project.primaryColor, "e8")} 0%, ${withAlpha(project.secondaryColor, "d0")} 60%, ${withAlpha(project.primaryColor, "b8")} 100%)`;
  const primaryLabel = canVote
    ? project.userHasVoted
      ? "Votado"
      : "Votar"
    : project.userHasLiked
      ? "Gostei"
      : "Gostar";
  const isPrimaryActive = canVote ? project.userHasVoted : project.userHasLiked;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 220, damping: 22 }}
      whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 24 } }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300",
        className,
      )}
      style={{
        borderColor: withAlpha(project.primaryColor, "25"),
        boxShadow: "var(--shadow-raised)",
      }}
    >
      {/* ── Hero image / gradient ── */}
      <div className="relative h-44 overflow-hidden sm:h-48">
        {bannerSource ? (
          <>
            <img
              src={bannerSource}
              alt={`Capa de ${project.name}`}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(project.primaryColor, "40")} 0%, ${withAlpha(project.secondaryColor, "80")} 100%)`,
              }}
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: heroGradient }} />
            {/* Subtle radial highlight */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          </>
        )}

        {/* Dark vignette at bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Top bar accent */}
        <div className={`absolute inset-x-0 top-0 h-1 ${areaUi.topBar}`} />

        {/* Rank badge */}
        {(project.isWinner || index < 3) && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + index * 0.05, type: "spring", stiffness: 400 }}
            className={cn(
              "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shadow-lg ring-2 ring-white/30 sm:h-10 sm:w-10 sm:text-sm",
              project.isWinner
                ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"
                : index === 0
                  ? "bg-primary text-primary-foreground"
                  : index === 1
                    ? "bg-slate-500 text-white"
                    : "bg-[hsl(var(--area-negocio))] text-white",
            )}
          >
            {project.isWinner ? (
              <Crown className="h-4 w-4" />
            ) : index === 0 ? (
              <Trophy className="h-4 w-4" />
            ) : (
              `#${index + 1}`
            )}
          </motion.div>
        )}

        {/* Badges overlay */}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5 sm:left-4 sm:top-4">
          <span
            className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm sm:text-[11px] ${areaUi.badge}`}
          >
            {displayArea}
          </span>
          <span className="rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-foreground/80 shadow-sm backdrop-blur-sm sm:text-[11px]">
            {project.typeLabel}
          </span>
        </div>

        {/* Bottom info on hero */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 sm:px-5 sm:pb-4">
          <div className="flex items-end justify-between gap-3">
            <p className="line-clamp-1 text-[11px] font-medium text-white/80 sm:text-xs">
              {canVote ? "Projeto em votação" : "Exposição aberta"}
              {project.course ? ` · ${project.course}` : ""}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
              <MessageCircle className="h-3 w-3" />
              {project.commentsCount}
            </span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
        {/* Title + avatar */}
        <div className="space-y-2">
          <h3 className="line-clamp-2 font-heading text-base font-bold leading-snug text-foreground sm:text-lg">
            {project.isWinner && (
              <Crown className="mr-1.5 inline h-4 w-4 align-text-bottom text-[hsl(var(--warning))]" />
            )}
            {project.name}
          </h3>
          {project.course && (
            <div className="flex items-center gap-2">
              <UserAvatar name={project.course} size="sm" />
              <span className="text-xs text-muted-foreground">{project.course}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-foreground/70">
          {project.summary || project.description}
        </p>

        {/* Team info */}
        {project.teamSize > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{project.teamSize} {project.teamSize === 1 ? "membro" : "membros"}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill
            icon={canVote ? ThumbsUp : Heart}
            value={canVote ? project.votesCount : project.likesCount}
            label={canVote ? "Votos" : "Likes"}
            color={project.primaryColor}
          />
          <StatPill
            icon={Heart}
            value={project.likesCount}
            label="Likes"
            color={project.primaryColor}
          />
          <StatPill
            icon={MessageCircle}
            value={project.commentsCount}
            label="Chat"
            color={project.primaryColor}
          />
        </div>

        {/* Audience copy */}
        <p className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {getSubmissionAudienceCopy(project.type, project.area)}
        </p>

        {/* Actions */}
        <div className="mt-auto space-y-2 pt-1">
          {/* Primary action + detail link */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={isPrimaryActive ? "default" : "outline"}
              className={cn(
                "h-10 w-full rounded-xl text-xs font-bold sm:h-11 sm:text-sm",
                isPrimaryActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 hover:bg-muted/50",
              )}
              onClick={() => void onPrimaryAction(project)}
            >
              {canVote ? (
                <Trophy className={cn("mr-1.5 h-4 w-4", isPrimaryActive && "text-primary-foreground")} />
              ) : (
                <Heart className={cn("mr-1.5 h-4 w-4", isPrimaryActive && "fill-current")} />
              )}
              <span className="truncate">{primaryLabel}</span>
            </Button>

            <Button
              asChild
              size="sm"
              className="h-10 w-full rounded-xl text-xs font-bold sm:h-11 sm:text-sm"
              style={{
                backgroundColor: project.primaryColor,
                color: "#fff",
              }}
            >
              <Link
                to={getProjectDetailPath(project.slug)}
                state={{ from: `${location.pathname}${location.search}${location.hash}` }}
              >
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                <span className="truncate">Ver mais</span>
              </Link>
            </Button>
          </div>

          {/* Utility row */}
          <div className="flex items-center gap-2">
            <ShareButtons
              url={getProjectDetailPath(project.slug)}
              title={project.name}
              description={project.summary || project.description}
              compact
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg border-border/50"
              title="QR Code"
              onClick={() => onOpenQr(project)}
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
