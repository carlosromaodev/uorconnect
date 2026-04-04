import { BookOpen, Building2, Globe, Heart, Instagram, Linkedin, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Course } from "@/lib/api";
import { cn } from "@/lib/utils";

function withAlpha(color: string, alpha = "22") {
  return `${color}${alpha}`;
}

function IconPattern({ density = 6 }: { density?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
      {Array.from({ length: density }).map((_, index) => (
        <div
          key={index}
          className="absolute rounded-full border border-white/45 bg-white/10"
          style={{
            width: `${36 + index * 14}px`,
            height: `${36 + index * 14}px`,
            right: `${-12 + index * 18}px`,
            top: `${12 + index * 22}px`,
          }}
        />
      ))}
    </div>
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
  const primaryLabel = enrolled ? "Ver inscrição" : enrollBlocked ? "Inscrições fechadas" : "Inscrever";
  const secondaryLabel = enrolled ? "Entrar na comunidade" : "Comunidade bloqueada";
  const helperMessage = enrollBlocked
    ? "As inscrições neste momento foram desativadas pela administração."
    : "A comunidade abre depois da inscrição.";

  return (
    <article
      className={cn(
        "relative h-full overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl md:p-6",
        className
      )}
      style={{
        borderColor: withAlpha(course.courseColor, "44"),
        background: `linear-gradient(140deg, ${withAlpha(course.accentColor)}, ${withAlpha(course.accentColorSecondary)})`
      }}
    >
      <IconPattern density={6} />
      <div className="relative z-10 flex h-full min-w-0 flex-col">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-white/60">
              {course.companyLogoUrl ? (
                <img src={course.companyLogoUrl} alt={course.companyName} className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <BookOpen className="h-6 w-6" style={{ color: course.courseColor }} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: course.courseColor }}>
                {course.isPaid ? course.priceLabel || "Pago" : "Gratuito"}
              </p>
              <h3 className="font-heading text-lg font-bold leading-tight md:text-[1.42rem]">{course.name}</h3>
              <p className="mt-1 truncate text-sm font-medium text-foreground/80">{course.companyName}</p>
            </div>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold shadow-sm"
            style={{ color: course.courseColor }}
          >
            <Heart className="h-3.5 w-3.5 fill-current" />
            {course.likesCount}
          </span>
        </div>

        <p className="mb-4 break-words text-[15px] leading-6 text-foreground/85">{course.description}</p>
        {course.preview ? (
          <p className="mb-4 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{course.preview}</p>
        ) : null}

        <div className="mb-4 rounded-xl border border-white/60 bg-white/72 p-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: withAlpha(course.courseColor, "22") }}
            >
              <Building2 className="h-4.5 w-4.5" style={{ color: course.courseColor }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{course.companyName}</p>
              <p className="truncate text-xs font-medium text-muted-foreground">{course.companyCategory}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
            {course.companyWebsite ? (
              <button
                type="button"
                onClick={() => onOpenExternal(course.companyWebsite)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </button>
            ) : null}
            {course.companyInstagram ? (
              <button
                type="button"
                onClick={() => onOpenExternal(course.companyInstagram)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Instagram className="h-3.5 w-3.5" />
                Instagram
              </button>
            ) : null}
            {course.companyLinkedin ? (
              <button
                type="button"
                onClick={() => onOpenExternal(course.companyLinkedin)}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
              >
                <Linkedin className="h-3.5 w-3.5" />
                LinkedIn
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold" style={{ color: course.courseColor }}>
            {course.studentCount} inscritos
          </p>
          {enrollmentStatusLabel ? (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: withAlpha(course.courseColor, "1c"), color: course.courseColor }}
            >
              {enrollmentStatusLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-auto grid gap-2 sm:grid-cols-2">
          <Button
            size="sm"
            className="h-auto min-h-10 w-full min-w-0 rounded-xl px-3 py-2 text-center text-sm font-semibold leading-tight shadow-sm whitespace-normal"
            onClick={onEnroll}
            disabled={enrollBlocked}
          >
            {primaryLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-auto min-h-10 w-full min-w-0 rounded-xl bg-white/70 px-3 py-2 text-center text-sm font-semibold leading-tight whitespace-normal"
            disabled={!enrolled}
            onClick={onCommunity}
          >
            {secondaryLabel}
          </Button>
          <Button
            size="sm"
            variant={liked ? "default" : "outline"}
            className="h-auto min-h-10 rounded-xl px-3 py-2 text-sm font-semibold leading-tight sm:col-span-2"
            onClick={onLike}
          >
            <Heart className="mr-1.5 h-4 w-4" />
            {liked ? "Curtido" : "Curtir"}
          </Button>
        </div>

        {!enrolled ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {helperMessage}
          </p>
        ) : null}
      </div>
    </article>
  );
}
