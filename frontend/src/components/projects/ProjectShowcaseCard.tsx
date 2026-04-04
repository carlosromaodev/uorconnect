import { motion } from "framer-motion";
import { Crown, ExternalLink, Heart, MessageCircle, QrCode, Shield, Share2, Sparkles, ThumbsUp, Trophy } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ProjectCardItem } from "@/components/projects/ProjectQrDialog";
import { getProjectBannerSource } from "@/lib/project-media";
import { getProjectDetailPath } from "@/lib/project-links";
import { getProjectAreaClasses, withAlpha } from "@/lib/project-card-ui";
import { getSubmissionAreaLabel, getSubmissionAudienceCopy, canVoteSubmission } from "@/lib/submission-meta";
import { cn } from "@/lib/utils";

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
  const heroIcons = canVote ? [Trophy, ThumbsUp, MessageCircle] : [Shield, Heart, MessageCircle];
  const heroGradient = `linear-gradient(135deg, ${withAlpha(project.primaryColor, "ea")} 0%, ${withAlpha(project.secondaryColor, "cf")} 100%)`;
  const primaryLabel = canVote
    ? project.userHasVoted ? "Votado" : "Votar"
    : project.userHasLiked ? "Gostei" : "Gostar";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-white/90 shadow-[0_16px_38px_rgba(15,23,42,0.09)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_54px_rgba(15,23,42,0.16)]",
        areaUi.border,
        className,
      )}
      style={{
        borderColor: withAlpha(project.primaryColor, "40"),
        background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${withAlpha(project.primaryColor, "08")} 40%, ${withAlpha(project.secondaryColor, "12")} 100%)`,
      }}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 ${areaUi.topBar}`} />

      {(project.isWinner || index < 3) && (
        <div
          className={cn(
            "absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-lg",
            project.isWinner
              ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"
              : index === 0
                ? "bg-primary text-primary-foreground"
                : index === 1
                  ? "bg-muted-foreground text-background"
                  : "bg-[hsl(var(--area-negocio))] text-primary-foreground",
          )}
        >
          {project.isWinner ? <Crown className="h-5 w-5" /> : index === 0 ? <Trophy className="h-5 w-5" /> : `#${index + 1}`}
        </div>
      )}

      <div className="relative h-[182px] overflow-hidden sm:h-[196px]">
        {bannerSource ? (
          <>
            <img
              src={bannerSource}
              alt={`Imagem de capa do projeto ${project.name}`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${withAlpha(project.primaryColor, "72")} 0%, ${withAlpha(project.secondaryColor, "98")} 100%)` }} />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.12)_0%,rgba(15,23,42,0.38)_100%)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: heroGradient }} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(255,255,255,0.30),transparent_42%)]" />
          </>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold shadow-sm ${areaUi.badge}`}>
              {displayArea}
            </span>
            <span className="rounded-full bg-white/88 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
              {project.typeLabel}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <MessageCircle className="h-3.5 w-3.5" />
            {project.commentsCount}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="rounded-2xl border border-white/25 bg-black/26 px-3.5 py-2.5 text-white shadow-sm backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/78">
              {canVote ? "Projeto em votação" : "Exposição aberta"}
            </p>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-white/94">
              {project.course || "Curso não informado"}
            </p>
          </div>
        </div>

        {heroIcons.map((Icon, iconIndex) => (
          <motion.div
            key={`${project.id}-hero-icon-${iconIndex}`}
            className="absolute rounded-full border border-white/34 bg-white/18 p-2 text-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.24)] backdrop-blur-sm"
            style={{
              right: `${12 + iconIndex * 14}%`,
              top: `${18 + iconIndex * 11}%`,
            }}
            animate={{
              y: [0, -6 - iconIndex * 2, 0, 4, 0],
              rotate: [0, iconIndex % 2 === 0 ? 8 : -8, 0],
            }}
            transition={{
              duration: 5.2 + iconIndex * 0.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Icon className="h-4 w-4" />
          </motion.div>
        ))}

        <div className="pointer-events-none absolute left-0 right-0 top-0 h-20 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.38),transparent_60%)]" />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="space-y-2">
          <h3 className="line-clamp-2 font-heading text-[1.22rem] font-bold leading-tight text-foreground sm:text-[1.35rem]">
            <span className="inline-flex items-center gap-2">
              {project.isWinner && <Crown className="h-4.5 w-4.5 text-[hsl(var(--warning))]" />}
              {project.name}
            </span>
          </h3>
          <p className="line-clamp-3 text-sm leading-6 text-foreground/78">
            {project.summary || project.description}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/60 bg-white/78 px-2.5 py-2 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Likes</p>
            <p className="mt-1 text-sm font-bold" style={{ color: project.primaryColor }}>{project.likesCount}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-white/78 px-2.5 py-2 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{canVote ? "Votos" : "Status"}</p>
            <p className="mt-1 text-sm font-bold" style={{ color: project.primaryColor }}>{canVote ? project.votesCount : "Aberto"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-white/78 px-2.5 py-2 text-center shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Chat</p>
            <p className="mt-1 text-sm font-bold" style={{ color: project.primaryColor }}>{project.commentsCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-white/74 p-3.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" style={{ color: project.primaryColor }} />
            Perfil do Expositor
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/80">{getSubmissionAudienceCopy(project.type, project.area)}</p>
        </div>

        <div className="mt-auto space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <Button
              size="sm"
              variant={!canVote && project.userHasLiked ? "default" : canVote && project.userHasVoted ? "default" : "outline"}
              className={cn(
                "h-10 w-full min-w-0 justify-center rounded-2xl px-2.5 text-xs font-semibold sm:h-11 sm:px-3 sm:text-sm",
                canVote && project.userHasVoted
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : canVote
                    ? "border-primary/30 text-primary hover:border-primary/60 hover:bg-primary/10"
                    : !canVote && project.userHasLiked
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border bg-white/80 text-foreground hover:bg-white",
              )}
              title={canVote ? "Votar no projeto" : "Gostar do expositor"}
              onClick={() => void onPrimaryAction(project)}
            >
              {canVote ? <Trophy className="mr-1.5 h-4 w-4" /> : <Heart className={cn("mr-1.5 h-4 w-4", project.userHasLiked && "fill-current")} />}
              <span className="truncate">{primaryLabel}</span>
            </Button>

            <Button
              asChild
              size="sm"
              className="h-10 w-full min-w-0 justify-center rounded-2xl px-2.5 text-xs font-semibold sm:h-11 sm:px-3 sm:text-sm"
              title="Abrir página individual do expositor"
            >
              <Link
                to={getProjectDetailPath(project.slug)}
                state={{ from: `${location.pathname}${location.search}${location.hash}` }}
                className="flex w-full min-w-0 items-center justify-center"
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                <span className="truncate">Ver mais</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-full rounded-2xl border-border/60 bg-white/74 sm:h-11 sm:w-11"
              title="Partilhar projeto"
              onClick={() => void onShare(project)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-full rounded-2xl border-border/60 bg-white/74 sm:h-11 sm:w-11"
              title="Ver QR e link do expositor"
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
