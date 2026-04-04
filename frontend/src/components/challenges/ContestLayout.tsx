import { type ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, User } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api, getSessionStudent, getToken, type StudentProfile } from "@/lib/api";
import {
  type ContestRuntimePhase,
  getContestBrandAsset,
  isContestContext,
  getPrimaryPortalHref,
  isContestLabHost,
  useContestClock,
} from "@/lib/contest-lab";
import { cn } from "@/lib/utils";
import {
  ContestBadge,
  ContestCard,
  ContestProgressBar,
} from "./contest-theme";
import { contestButtonClassNames, contestTextClassNames, contestTheme } from "./contest-theme.tokens";

function ContestBackdrop() {
  return (
    <div className="contest-graph-paper pointer-events-none absolute inset-0" />
  );
}

function getDisplayName(student?: StudentProfile | null) {
  const name = student?.name?.trim();
  if (!name) return "Estudante UOR";
  return name.split(/\s+/).slice(0, 2).join(" ");
}

function getDisplayCourse(student?: StudentProfile | null) {
  const course = student?.course?.trim();
  return course || "Curso não informado";
}

function shouldShowContestBootIntro(search: string) {
  return new URLSearchParams(search).get("boot") === "intro";
}

function ContestTimerChip({ mode }: { mode?: ContestRuntimePhase }) {
  const clock = useContestClock(mode);

  return (
    <ContestCard padding="compact" className="hidden min-[901px]:block">
      <p className={contestTextClassNames.mutedLabel}>{clock.label}</p>
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-[#00e5c8]/14 bg-[radial-gradient(circle_at_center,rgba(0,229,200,0.16),rgba(0,229,200,0.03))] px-4 py-3">
          <span className="font-tech-mono text-lg font-semibold tracking-[0.24em] text-[#00e5c8]">{clock.display}</span>
        </div>
        <ContestProgressBar value={clock.runtimePhase === "finished" ? 100 : 72} />
      </div>
    </ContestCard>
  );
}

export function ContestPanel({
  kicker,
  title,
  children,
  className,
  tone = "default",
  padding = "default",
}: {
  kicker?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "accent" | "subtle" | "muted" | "terminal" | "transparent";
  padding?: "default" | "compact" | "cozy" | "flush";
}) {
  return (
    <section>
      <ContestCard tone={tone} padding={padding} className={className}>
        {kicker ? <p className={contestTextClassNames.accentLabel}>{kicker}</p> : null}
        {title ? <h2 className="mt-3 text-[1.65rem] font-semibold text-white md:text-[1.85rem]">{title}</h2> : null}
        <div className={cn((kicker || title) && "mt-5")}>{children}</div>
      </ContestCard>
    </section>
  );
}

export function ContestLayout({
  title,
  subtitle,
  timerMode,
  headerActions,
  showTimerChip = true,
  children,
}: {
  pageLabel?: string;
  title?: string;
  subtitle?: string;
  timerMode?: ContestRuntimePhase;
  headerActions?: ReactNode;
  showTimerChip?: boolean;
  children: ReactNode;
}) {
  const location = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const contestLabHost = typeof window !== "undefined" && isContestLabHost(hostname);
  const contestContext = typeof window !== "undefined" && isContestContext(location.pathname, hostname);
  const brandAsset = getContestBrandAsset(hostname, location.pathname);
  const [student, setStudent] = useState<StudentProfile | null>(() => getSessionStudent());
  const hasSession = Boolean(getToken());
  const introRequested = contestLabHost && shouldShowContestBootIntro(location.search);
  const [studentReady, setStudentReady] = useState(() => !hasSession);
  const [introDelayDone, setIntroDelayDone] = useState(() => !introRequested);
  const [showBootIntro, setShowBootIntro] = useState(() => introRequested);

  useEffect(() => {
    if (!hasSession) {
      setStudent(null);
      setStudentReady(true);
      return;
    }

    setStudentReady(false);
    const fetchStudent = contestContext ? api.contest.me : api.auth.me;

    fetchStudent()
      .then(setStudent)
      .catch(() => setStudent(getSessionStudent()))
      .finally(() => setStudentReady(true));
  }, [contestContext, hasSession]);

  useEffect(() => {
    if (!introRequested) {
      setShowBootIntro(false);
      setIntroDelayDone(true);
      return;
    }

    setShowBootIntro(true);
    setIntroDelayDone(false);

    const timeout = window.setTimeout(() => {
      setIntroDelayDone(true);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [introRequested]);

  useEffect(() => {
    if (!showBootIntro || !introDelayDone || !studentReady) return;

    const timeout = window.setTimeout(() => {
      setShowBootIntro(false);

      if (typeof window === "undefined") {
        return;
      }

      const url = new URL(window.location.href);
      if (url.searchParams.get("boot") !== "intro") {
        return;
      }

      url.searchParams.delete("boot");
      const nextPath = `${url.pathname}${url.search}${url.hash}` || "/";
      window.history.replaceState({}, "", nextPath);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [introDelayDone, showBootIntro, studentReady]);

  return (
    <div className={cn("contest-shell relative min-h-screen overflow-hidden", contestTheme.shell)}>
      <ContestBackdrop />

      <div className="relative z-10">
        <header className={cn("sticky top-0 z-40 border-b bg-[rgba(10,13,17,0.94)] backdrop-blur-xl", contestTheme.border)}>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
            <div className="flex min-w-0 items-center">
              <img src={brandAsset} alt="UOR Connect Laboratório" className="h-14 w-auto max-w-[220px]" />
            </div>

            <div className="flex items-center justify-end gap-2">
              <ContestCard padding="compact" className="px-3 py-2 shadow-none">
                <div className="inline-flex items-center gap-2 text-sm text-[#e2e8f0]">
                  <User className="h-4 w-4 text-[#00e5c8]" />
                  <span className="max-w-[124px] truncate">{getDisplayName(student)}</span>
                </div>
              </ContestCard>
              {showTimerChip ? <ContestTimerChip mode={timerMode} /> : null}
              {!contestLabHost ? (
                <Button
                  asChild
                  variant="ghost"
                  className={cn("hidden h-10 px-4 min-[901px]:inline-flex", contestButtonClassNames.secondary)}
                >
                  <a href={getPrimaryPortalHref("/")}>
                    Portal principal
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          {(title || subtitle || headerActions) ? (
            <section className={cn("mb-8 flex flex-col gap-5 border-b pb-7 md:mb-10 md:flex-row md:items-end md:justify-between", contestTheme.border)}>
              <div className="max-w-4xl">
                {title ? <h1 className="text-3xl font-semibold text-white md:text-5xl">{title}</h1> : null}
                {subtitle ? <p className="mt-3 max-w-3xl text-[15px] leading-[1.6] text-[#7b8ca3]">{subtitle}</p> : null}
              </div>
              {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
            </section>
          ) : null}

          {children}
        </main>
      </div>

      {showBootIntro ? (
        <ContestBootIntro
          brandAsset={brandAsset}
          student={student}
          processing={!introDelayDone || !studentReady}
        />
      ) : null}
    </div>
  );
}

function ContestBootIntro({
  brandAsset,
  student,
  processing,
}: {
  brandAsset: string;
  student: StudentProfile | null;
  processing: boolean;
}) {
  const bootLines = [
    "sync.brand :: ok",
    `sync.profile :: ${processing ? "loading" : "ready"}`,
    `runtime.ui :: ${processing ? "preparing" : "released"}`,
  ];
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [progressValue, setProgressValue] = useState(processing ? 18 : 100);

  useEffect(() => {
    if (!processing) {
      setActiveLineIndex(bootLines.length - 1);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveLineIndex((current) => (current + 1) % bootLines.length);
    }, 520);

    return () => window.clearInterval(timer);
  }, [bootLines.length, processing]);

  useEffect(() => {
    if (!processing) {
      setProgressValue(100);
      return;
    }

    setProgressValue(18);

    const timer = window.setInterval(() => {
      setProgressValue((current) => (current >= 86 ? 86 : current + 8));
    }, 180);

    return () => window.clearInterval(timer);
  }, [processing]);

  return (
    <div
      data-testid="contest-boot-intro"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(3,8,12,0.78)] px-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <ContestCard tone="accent" padding="compact" className="overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(22,249,254,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,229,200,0.08),transparent_32%)]" />

          <div className="relative">
            <div className="grid gap-4 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-center">
              <div className="rounded-[24px] border border-[#00e5c8]/12 bg-[rgba(3,11,16,0.64)] p-4">
                <div className="flex h-full min-h-[112px] items-center justify-center rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(7,16,21,0.96),rgba(4,9,12,0.96))]">
                  <img src={brandAsset} alt="UOR Connect Laboratório" className="h-12 w-auto max-w-[116px] object-contain" />
                </div>
              </div>

              <div>
                <ContestBadge size="compact">session.boot</ContestBadge>
                <h2 className="mt-3 text-2xl font-semibold text-white md:text-[2rem]">
                  Bem-vindo, {getDisplayName(student)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#7b8ca3]">{getDisplayCourse(student)}</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className={contestTextClassNames.mutedLabel}>loading.runtime</span>
                <span className="font-tech-mono text-[11px] uppercase tracking-[0.18em] text-[#00e5c8]">
                  {progressValue}%
                </span>
              </div>
              <ContestProgressBar data-testid="contest-boot-progress" value={progressValue} />
            </div>

            <div className="mt-4 grid gap-2">
              {bootLines.map((line, index) => (
                <div
                  key={line}
                  data-testid="contest-boot-line"
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-2.5 font-tech-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-300",
                    index === activeLineIndex
                      ? "border-[#00e5c8]/20 bg-[#00e5c8]/10 text-[#00e5c8]"
                      : "border-white/8 bg-[rgba(255,255,255,0.03)] text-[#7b8ca3]",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index === activeLineIndex ? "contest-dot-pulse bg-[#00e5c8]" : "bg-[#344454]",
                    )}
                  />
                  <span>{line}</span>
                  {index === activeLineIndex ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" /> : null}
                </div>
              ))}
            </div>
          </div>
        </ContestCard>
      </motion.div>
    </div>
  );
}
