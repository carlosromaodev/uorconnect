import { motion } from "framer-motion";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  GraduationCap,
  Heart,
  Instagram,
  Linkedin,
  Lock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Course } from "@/lib/api";
import { cn } from "@/lib/utils";

function withAlpha(color: string, alpha = "22") {
  return `${color}${alpha}`;
}

function ProgressRing({
  value,
  max,
  color,
  size = 42,
  strokeWidth = 3.5,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={withAlpha(color, "18")}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

interface FeaturedCourseCardProps {
  course: Course;
  liked: boolean;
  enrolled: boolean;
  enrollmentStatusLabel?: string | null;
  enrollmentDisabled?: boolean;
  className?: string;
  onEnroll: () => void;
  onCommunity: () => void;
  onLike: () => void;
  onOpenExternal: (url?: string | null, emptyMessage?: string) => void;
}

export function FeaturedCourseCard({
  course,
  liked,
  enrolled,
  enrollmentStatusLabel,
  enrollmentDisabled = false,
  className,
  onEnroll,
  onCommunity,
  onLike,
  onOpenExternal,
}: FeaturedCourseCardProps) {
  const enrollBlocked = enrollmentDisabled && !enrolled;
  const primaryLabel = enrolled
    ? "Ver inscrição"
    : enrollBlocked
      ? "Inscrições fechadas"
      : "Inscrever-me";
  const secondaryLabel = enrolled
    ? "Entrar na comunidade"
    : "Comunidade bloqueada";
  const helperMessage = enrollBlocked
    ? "As inscrições neste momento foram desativadas pela administração."
    : "A comunidade abre depois da inscrição.";

  const hasSocialLinks =
    course.companyWebsite || course.companyInstagram || course.companyLinkedin;

  return (
    <motion.article
      whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 24 } }}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300",
        className,
      )}
      style={{
        borderColor: withAlpha(course.courseColor, "25"),
        boxShadow: "var(--shadow-raised)",
      }}
    >
      {/* ── Hero header with gradient ── */}
      <div
        className="relative overflow-hidden px-5 pb-5 pt-6 sm:px-6 sm:pt-7"
        style={{
          background: `linear-gradient(145deg, ${withAlpha(course.courseColor, "14")} 0%, ${withAlpha(course.accentColor, "0c")} 50%, transparent 100%)`,
        }}
      >
        {/* Decorative dot grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `radial-gradient(${course.courseColor} 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }} />

        {/* Top accent bar */}
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${course.courseColor}, ${course.accentColor || course.courseColor})` }}
        />

        {/* Price badge + likes */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Company logo */}
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-14 sm:w-14"
              style={{
                borderColor: withAlpha(course.courseColor, "20"),
                backgroundColor: course.companyLogoUrl ? "#fff" : withAlpha(course.courseColor, "10"),
              }}
            >
              {course.companyLogoUrl ? (
                <img
                  src={course.companyLogoUrl}
                  alt={course.companyName}
                  className="h-10 w-10 rounded-lg object-cover sm:h-11 sm:w-11"
                />
              ) : (
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: course.courseColor }} />
              )}
            </div>
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px]"
                style={{
                  backgroundColor: withAlpha(course.courseColor, "14"),
                  color: course.courseColor,
                }}
              >
                {course.isPaid ? course.priceLabel || "Pago" : "Gratuito"}
              </span>
              <p className="mt-1 truncate text-xs font-medium text-foreground/70 sm:text-sm">
                {course.companyName}
              </p>
            </div>
          </div>

          {/* Likes counter */}
          <motion.button
            type="button"
            onClick={onLike}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              liked
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-border/50 bg-white/90 text-foreground/60 hover:border-red-200 hover:bg-red-50 hover:text-red-500",
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            {course.likesCount}
          </motion.button>
        </div>

        {/* Course name */}
        <h3 className="relative mt-4 line-clamp-2 font-heading text-lg font-bold leading-snug text-foreground sm:text-xl">
          {course.name}
        </h3>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-1 sm:px-6 sm:pb-6">
        {/* Description */}
        <p className="line-clamp-3 text-[13px] leading-relaxed text-foreground/75 sm:text-sm">
          {course.description}
        </p>
        {course.preview ? (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {course.preview}
          </p>
        ) : null}

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <ProgressRing
              value={course.studentCount}
              max={Math.max(course.studentCount * 1.4, 20)}
              color={course.courseColor}
            />
            <div>
              <p className="text-base font-bold leading-tight" style={{ color: course.courseColor }}>
                {course.studentCount}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                inscritos
              </p>
            </div>
          </div>

          {enrollmentStatusLabel ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:text-[11px]"
              style={{
                borderColor: withAlpha(course.courseColor, "25"),
                backgroundColor: withAlpha(course.courseColor, "0c"),
                color: course.courseColor,
              }}
            >
              <CheckCircle2 className="h-3 w-3" />
              {enrollmentStatusLabel}
            </span>
          ) : null}
        </div>

        {/* Company info card */}
        <div
          className="rounded-xl border p-3.5 transition-colors"
          style={{
            borderColor: withAlpha(course.courseColor, "18"),
            backgroundColor: withAlpha(course.courseColor, "06"),
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: withAlpha(course.courseColor, "18") }}
            >
              <Building2 className="h-4 w-4" style={{ color: course.courseColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{course.companyName}</p>
              <p className="truncate text-xs text-muted-foreground">{course.companyCategory}</p>
            </div>
          </div>

          {hasSocialLinks ? (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: withAlpha(course.courseColor, "14") }}>
              {course.companyWebsite ? (
                <button
                  type="button"
                  onClick={() => onOpenExternal(course.companyWebsite)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground/70 transition-colors hover:border-foreground/20 hover:text-foreground"
                >
                  <Globe className="h-3 w-3" />
                  Website
                </button>
              ) : null}
              {course.companyInstagram ? (
                <button
                  type="button"
                  onClick={() => onOpenExternal(course.companyInstagram)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground/70 transition-colors hover:border-[#E4405F]/30 hover:text-[#E4405F]"
                >
                  <Instagram className="h-3 w-3" />
                  Instagram
                </button>
              ) : null}
              {course.companyLinkedin ? (
                <button
                  type="button"
                  onClick={() => onOpenExternal(course.companyLinkedin)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground/70 transition-colors hover:border-[#0A66C2]/30 hover:text-[#0A66C2]"
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Action buttons */}
        <div className="mt-auto space-y-2 pt-1">
          {/* Primary CTA */}
          <Button
            className="h-11 w-full rounded-xl text-sm font-bold shadow-sm transition-all"
            onClick={onEnroll}
            disabled={enrollBlocked}
            style={
              !enrollBlocked
                ? {
                    backgroundColor: course.courseColor,
                    color: "#fff",
                    boxShadow: `0 4px 14px ${withAlpha(course.courseColor, "30")}`,
                  }
                : undefined
            }
          >
            {enrolled ? (
              <ExternalLink className="mr-2 h-4 w-4" />
            ) : enrollBlocked ? (
              <Lock className="mr-2 h-4 w-4" />
            ) : (
              <GraduationCap className="mr-2 h-4 w-4" />
            )}
            {primaryLabel}
          </Button>

          {/* Secondary row */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-full rounded-lg text-xs font-semibold"
              disabled={!enrolled}
              onClick={onCommunity}
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              <span className="truncate">{enrolled ? "Comunidade" : "Bloqueado"}</span>
            </Button>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                variant={liked ? "default" : "outline"}
                className={cn(
                  "h-9 w-full rounded-lg text-xs font-semibold",
                  liked && "bg-red-500 hover:bg-red-600",
                )}
                onClick={onLike}
              >
                <Heart className={cn("mr-1.5 h-3.5 w-3.5", liked && "fill-current")} />
                {liked ? "Curtido" : "Curtir"}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Helper message */}
        {!enrolled ? (
          <p className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            {helperMessage}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
