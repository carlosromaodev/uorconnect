import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Send, Users, FolderOpen, Mic, ArrowRight,
  Radio, Globe,
  MessageSquare, Clock, MapPin, User, Presentation, BookOpen,
  Target, Award, TrendingUp, HelpCircle, ChevronRight,
  Sparkles, ThumbsUp, Star, ChevronLeft, Briefcase, Package, GraduationCap,
  Settings, Vote, Rocket, Play, Heart, Loader2,
  Building2, Instagram, Lock
} from "lucide-react";
import { ProjectQrDialog, type ProjectCardItem } from "@/components/projects/ProjectQrDialog";
import { ProjectShowcaseCard } from "@/components/projects/ProjectShowcaseCard";
import { FeaturedCourseCard } from "@/components/courses/FeaturedCourseCard";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/components/ui/sonner";
import { api, type ActivityFeedItem, type AgendaItem, type AgendaLiveState, type CoursesContent, type FaqItem, type HomeContent, type LiveChatMessage, type ProjectPublicFeedItem, type Speaker, type Stats, type StudentEnrollmentListItem, getToken, isAuthError, setToken } from "@/lib/api";
import { getContestAbsoluteUrl } from "@/lib/contest-lab";
import { defaultHeroSponsors, defaultHomeSocialConfig } from "@/lib/home-content";
import { getHeroIconByName } from "@/lib/phosphor-icons";
import { canVoteSubmission, getSubmissionAreaLabel, getSubmissionAudienceCopy, normalizeSubmissionType } from "@/lib/submission-meta";

function withAlpha(color?: string | null, alpha = "22") {
  return color ? `${color}${alpha}` : `rgba(249,115,22,0.12)`;
}

function openExternal(url?: string | null, emptyMessage = "Link não disponível.") {
  if (!url) {
    toast.error(emptyMessage);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

const liveTypeColors: Record<string, string> = {
  Painel: "bg-primary/10 text-primary",
  Workshop: "bg-accent text-accent-foreground",
  Apresentação: "bg-secondary text-secondary-foreground",
  Cerimónia: "bg-primary text-primary-foreground",
  Intervalo: "bg-muted text-muted-foreground",
};

const areaColorMap: Record<string, string> = {
  IoT: "bg-[hsl(var(--area-iot))]/10 text-[hsl(var(--area-iot))] border-[hsl(var(--area-iot))]/20",
  Telecom: "bg-primary/10 text-primary border-primary/20",
  Segurança: "bg-destructive/10 text-destructive border-destructive/20",
  Web: "bg-[hsl(var(--area-web))]/10 text-[hsl(var(--area-web))] border-[hsl(var(--area-web))]/20",
  IA: "bg-[hsl(var(--area-ia))]/10 text-[hsl(var(--area-ia))] border-[hsl(var(--area-ia))]/20",
  Negócio: "bg-[hsl(var(--area-negocio))]/10 text-[hsl(var(--area-negocio))] border-[hsl(var(--area-negocio))]/20",
  Produto: "bg-[hsl(var(--area-produto))]/10 text-[hsl(var(--area-produto))] border-[hsl(var(--area-produto))]/20",
};

const areaBorderAccent: Record<string, string> = {
  IoT: "border-[hsl(var(--area-iot))]/30 hover:border-[hsl(var(--area-iot))]/60",
  Telecom: "border-primary/30 hover:border-primary/60",
  Segurança: "border-destructive/30 hover:border-destructive/60",
  Web: "border-[hsl(var(--area-web))]/30 hover:border-[hsl(var(--area-web))]/60",
  IA: "border-[hsl(var(--area-ia))]/30 hover:border-[hsl(var(--area-ia))]/60",
  Negócio: "border-[hsl(var(--area-negocio))]/30 hover:border-[hsl(var(--area-negocio))]/60",
  Produto: "border-[hsl(var(--area-produto))]/30 hover:border-[hsl(var(--area-produto))]/60",
};

const areaTopBar: Record<string, string> = {
  IoT: "bg-[hsl(var(--area-iot))]",
  Telecom: "bg-primary",
  Segurança: "bg-destructive",
  Web: "bg-[hsl(var(--area-web))]",
  IA: "bg-[hsl(var(--area-ia))]",
  Negócio: "bg-[hsl(var(--area-negocio))]",
  Produto: "bg-[hsl(var(--area-produto))]",
};

function getAreaClasses(area: string, type?: string) {
  const normalizedType = normalizeSubmissionType(type, area);

  if (normalizedType === "BUSINESS") {
    return {
      badge: areaColorMap.Negócio,
      border: areaBorderAccent.Negócio,
      topBar: areaTopBar.Negócio,
    };
  }

  if (normalizedType === "PRODUCT") {
    return {
      badge: areaColorMap.Produto,
      border: areaBorderAccent.Produto,
      topBar: areaTopBar.Produto,
    };
  }

  return {
    badge: areaColorMap[area] || "bg-secondary text-secondary-foreground",
    border: areaBorderAccent[area] || "border-border hover:border-primary/40",
    topBar: areaTopBar[area] || "bg-primary",
  };
}

const projectTypes = [
  {
    key: "projeto",
    label: "Projetos Académicos",
    icon: GraduationCap,
    color: "bg-primary text-primary-foreground hover:bg-primary/90",
    surface: "from-primary/15 via-primary/5 to-transparent",
    desc: "Trabalhos de estudantes avaliados por júri",
  },
  {
    key: "negocio",
    label: "Expor Negócio",
    icon: Briefcase,
    color: "bg-[hsl(var(--area-negocio))] text-primary-foreground hover:bg-[hsl(var(--area-negocio))]/90",
    surface: "from-[hsl(var(--area-negocio))]/18 via-[hsl(var(--area-negocio))]/8 to-transparent",
    desc: "Ideias e modelos de negócio inovadores",
  },
  {
    key: "produto",
    label: "Expor Produto",
    icon: Package,
    color: "bg-[hsl(var(--area-produto))] text-primary-foreground hover:bg-[hsl(var(--area-produto))]/90",
    surface: "from-[hsl(var(--area-produto))]/18 via-[hsl(var(--area-produto))]/8 to-transparent",
    desc: "Produtos e protótipos tecnológicos",
  },
];

const AGENDAR_EVENTO_URL = "https://agendar.uorconnect.space/";
const HIDDEN_EXPOSURE_SECTION_VIEWS_KEY = "uor_home_exposure_types_views";

function readExposureSectionViewCount() {
  if (typeof window === "undefined") return 0;

  try {
    const raw = window.localStorage.getItem(HIDDEN_EXPOSURE_SECTION_VIEWS_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeExposureSectionViewCount(nextValue: number) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(HIDDEN_EXPOSURE_SECTION_VIEWS_KEY, String(nextValue));
  } catch {
    // noop
  }
}

function formatAgendaTypeLabel(type?: string) {
  return {
    PANEL: "Painel",
    WORKSHOP: "Workshop",
    PRESENTATION: "Apresentação",
    CEREMONY: "Cerimónia",
    BREAK: "Intervalo",
  }[type ?? ""] ?? type ?? "Sessão";
}

function formatAgendaDayLabel(day?: string) {
  return day === "DAY2" ? "Dia 2" : "Dia 1";
}

function parseAgendaDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatAgendaShortDate(value?: string) {
  if (!value) return "";

  return parseAgendaDate(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  });
}

function getAgendaDateTime(date: string, time: string) {
  const base = parseAgendaDate(date);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hours,
    minutes,
    0,
    0
  ).getTime();
}

function getAgendaIcon(type?: string) {
  if (type === "PANEL" || type === "Painel") return TrendingUp;
  if (type === "WORKSHOP" || type === "Workshop" || type === "Curso") return BookOpen;
  if (type === "CEREMONY" || type === "Cerimónia") return Award;
  if (type === "BREAK" || type === "Intervalo") return Clock;
  return Presentation;
}

type LivePreviewItem = {
  id: number;
  time: string;
  endTime: string;
  title: string;
  local: string;
  type: string;
};

function toLivePreviewItem(item: AgendaItem | null | undefined): LivePreviewItem | null {
  if (!item) return null;

  return {
    id: item.id,
    time: item.startTime,
    endTime: item.endTime,
    title: item.title,
    local: item.local,
    type: formatAgendaTypeLabel(item.type),
  };
}

function resolveLivePreview(liveState: AgendaLiveState | null, agendaItems: AgendaItem[], now: Date) {
  const upcoming = [...agendaItems]
    .sort((left, right) => getAgendaDateTime(left.date, left.startTime) - getAgendaDateTime(right.date, right.startTime))
    .filter((item) => getAgendaDateTime(item.date, item.endTime) >= now.getTime());

  const current = toLivePreviewItem(liveState?.current);
  const next = toLivePreviewItem(liveState?.next);
  const featured = current ?? next ?? toLivePreviewItem(upcoming[0]);
  const secondary = current
    ? (next ?? toLivePreviewItem(upcoming.find((item) => item.id !== current.id)))
    : toLivePreviewItem(upcoming.find((item) => item.id !== featured?.id));

  return {
    featured,
    secondary,
    featuredLabel: current ? "Agora" : featured ? "Próxima sessão" : "Sem programação ao vivo",
    secondaryLabel: current ? "A seguir" : "Depois",
  };
}

function StarRating({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          style={{ width: size, height: size }}
          className={`transition-colors ${rating >= s ? "text-primary fill-primary" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, label, icon: Icon }: { target: string; label: string; icon: React.ElementType }) {
  const numericValue = parseInt(target.replace(/\D/g, ""));
  const suffix = target.replace(/\d/g, "");
  const [count, setCount] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1200;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(progress * numericValue));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, numericValue]);

  return (
    <div
      ref={ref}
      className="flex h-full min-h-[124px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/75 px-4 py-5 text-center shadow-sm backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shadow-sm"
      >
        <Icon className="w-7 h-7 text-primary" />
      </motion.div>
      <div className="text-3xl md:text-4xl font-heading font-bold text-foreground leading-none">
        {count}{suffix}
      </div>
      <div className="mt-2 text-sm md:text-base text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

function LivePreview({ liveState, agendaItems }: { liveState: AgendaLiveState | null; agendaItems: AgendaItem[] }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const { featured, secondary, featuredLabel, secondaryLabel } = resolveLivePreview(liveState, agendaItems, now);

  if (!featured) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Ainda não há sessões configuradas para o módulo Ao Vivo.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300 }}
        className="relative border-2 border-primary rounded-xl bg-primary/5 p-6 md:p-8 overflow-hidden cursor-pointer group"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
        <div className="flex items-center gap-2.5 mb-4">
          <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
            <span className={`w-2 h-2 rounded-full ${featuredLabel === "Agora" ? "bg-primary-foreground animate-pulse" : "bg-primary-foreground/70"}`} />
            {featuredLabel}
          </span>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${liveTypeColors[featured.type] || "bg-secondary text-secondary-foreground"}`}>
            {featured.type}
          </span>
        </div>
        <h3 className="font-heading font-bold text-lg md:text-xl mb-3">{featured.title}</h3>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />{featured.time} — {featured.endTime}</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />{featured.local}</span>
        </div>
      </motion.div>

      {secondary && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
          className="border border-border rounded-xl bg-card p-6 md:p-8 group cursor-pointer hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-3 py-1.5 rounded-full">{secondaryLabel}</span>
            <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${liveTypeColors[secondary.type] || "bg-secondary text-secondary-foreground"}`}>
              {secondary.type}
            </span>
          </div>
          <h3 className="font-heading font-bold text-lg md:text-xl mb-3">{secondary.title}</h3>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />{secondary.time} — {secondary.endTime}</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />{secondary.local}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function getActivityLabel(item: ActivityFeedItem) {
  if (item.type === "vote") {
    return "votou em";
  }

  if (item.type === "submission") {
    return "novo projeto aprovado";
  }

  return "comentou em";
}

function TopProjectsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [projects, setProjects] = useState<ProjectCardItem[]>([]);
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));
  const [mode, setMode] = useState<"winners" | "now">("winners");
  const [qrProject, setQrProject] = useState<ProjectCardItem | null>(null);
  const navigate = useNavigate();
  const sorted = [...projects].sort((a, b) => {
    const leftCanVote = canVoteSubmission(a.type, a.area, a.canVote);
    const rightCanVote = canVoteSubmission(b.type, b.area, b.canVote);

    if (leftCanVote !== rightCanVote) return leftCanVote ? -1 : 1;
    if (mode === "now") return b.votesCount - a.votesCount;
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return b.votesCount - a.votesCount;
  });

  useEffect(() => {
    setLoggedIn(Boolean(getToken()));
    api.interactions.projects()
      .then((items) => {
        setProjects(items.map((item) => ({
          ...item,
          userHasLiked: false,
          userHasVoted: false,
        })));
      })
      .catch(() => setProjects([]));
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
  };

  const handleRequireLogin = (message: string) => {
    toast.error(message);
    navigate("/login?redirect=/projetos");
  };

  const handleShare = async (project: ProjectPublicFeedItem) => {
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
      toast.success("Link do expositor copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao partilhar expositor.");
    }
  };

  const handlePrimaryAction = async (project: ProjectCardItem) => {
    const canVote = canVoteSubmission(project.type, project.area, project.canVote);

    if (!loggedIn) {
      handleRequireLogin(canVote ? "Faz login para votar." : "Faz login para gostar deste expositor.");
      return;
    }

    if (canVote && project.userHasVoted) {
      toast.info("Já votaste neste projeto.");
      return;
    }

    try {
      if (canVote) {
        const result = await api.interactions.vote(project.id);
        setProjects((current) => current.map((entry) => (
          entry.id === project.id
            ? { ...entry, userHasVoted: true, votesCount: result.votesCount }
            : entry
        )));
        toast.success("Voto registado.");
        return;
      }

      const result = await api.interactions.like(project.id);
      setProjects((current) => current.map((entry) => (
        entry.id === project.id
          ? { ...entry, userHasLiked: result.liked, likesCount: result.likesCount }
          : entry
      )));
      toast.success(result.liked ? "Like registado." : "Like removido.");
    } catch (err) {
      if (isAuthError(err)) {
        setToken(null);
        setLoggedIn(false);
        handleRequireLogin("A tua sessão expirou. Inicia novamente.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Erro ao interagir com o expositor.");
    }
  };

  return (
    <div className="relative">
      <div className="mb-5 flex flex-wrap gap-2">
        <Button size="sm" variant={mode === "winners" ? "default" : "outline"} onClick={() => setMode("winners")}>
          Destaques
        </Button>
        <Button size="sm" variant={mode === "now" ? "default" : "outline"} onClick={() => setMode("now")}>
          Mais votados agora
        </Button>
      </div>

      <button onClick={() => scroll("left")} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors hidden md:flex">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button onClick={() => scroll("right")} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors hidden md:flex">
        <ChevronRight className="w-5 h-5" />
      </button>

      <div ref={scrollRef} className="flex gap-5 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory -mx-1 px-1">
        {sorted.map((project, index) => (
          <ProjectShowcaseCard
            key={project.id}
            project={project}
            index={index}
            className="min-w-[320px] max-w-[360px] snap-start"
            onShare={handleShare}
            onOpenQr={(item) => setQrProject(item)}
            onPrimaryAction={handlePrimaryAction}
          />
        ))}
      </div>

      <ProjectQrDialog
        project={qrProject}
        open={Boolean(qrProject)}
        onClose={() => setQrProject(null)}
      />
    </div>
  );
}

const defaultCourses = [
  { id: 1, name: "Eng. Informática", description: "Formação prática orientada a software, arquitetura de sistemas e produtos digitais.", preview: "Curso gerido por parceiro tecnológico.", communityUrl: null, companyName: "Parceiro Tech AO", companyCategory: "Tecnologia", companyLogoUrl: null, companyWebsite: null, companyInstagram: null, companyLinkedin: null, isPaid: false, priceLabel: "Gratuito", studentCount: 0, likesCount: 0, accentColor: "#2563eb", accentColorSecondary: "#38bdf8", courseColor: "#2563eb", sortOrder: 0, isPublished: true },
  { id: 2, name: "Eng. Telecomunicações", description: "Infraestrutura, redes modernas e operações digitais aplicadas ao mercado.", preview: "Curso gerido por parceiro de telecom.", communityUrl: null, companyName: "Parceiro Connect AO", companyCategory: "Telecomunicações", companyLogoUrl: null, companyWebsite: null, companyInstagram: null, companyLinkedin: null, isPaid: true, priceLabel: "Pago", studentCount: 0, likesCount: 0, accentColor: "#f97316", accentColorSecondary: "#fb923c", courseColor: "#d97706", sortOrder: 1, isPublished: true },
];

const speakers = [
  { name: "Dr. Manuel Santos", role: "Especialista em Telecomunicações", talk: "Inovação nas Telecomunicações" },
  { name: "Eng. Ana Ferreira", role: "Engenheira de Redes 5G", talk: "Introdução ao 5G e IoT" },
  { name: "Dra. Carla Mendes", role: "Consultora de Marca Pessoal", talk: "Marca Pessoal na Era Digital" },
  { name: "Eng. Pedro Lopes", role: "Developer & Mentor", talk: "GitHub, LinkedIn e Portfólio" },
];

const patternIconNames = [
  "WifiHigh",
  "GlobeHemisphereWest",
  "CellSignalHigh",
  "Lightning",
  "ChatCenteredText",
  "LightbulbFilament",
  "GraduationCap",
  "Briefcase",
];

function clampPercent(value: number) {
  return Math.max(4, Math.min(96, value));
}

function toFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSizeToRem(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  if (normalized.endsWith("px")) return parsed / 16;
  return parsed;
}

function buildFluidRem(minRem: number, maxRem: number, baseRem: number, vwSlope: number) {
  return `clamp(${minRem.toFixed(2)}rem, calc(${baseRem.toFixed(2)}rem + ${vwSlope.toFixed(2)}vw), ${maxRem.toFixed(2)}rem)`;
}

function spreadFloatingIcons(items: typeof defaultHomeSocialConfig.heroFloatingIcons) {
  if (!items.length) return items;

  const minDecorativeIcons = 8;
  const expanded = [...items];
  let cursor = 0;

  while (expanded.length < minDecorativeIcons) {
    const base = items[cursor % items.length];
    const baseTop = clampPercent(toFiniteNumber(base.top, 50));
    const baseLeft = clampPercent(toFiniteNumber(base.left, 50));
    const baseRotate = toFiniteNumber(base.rotate, 0);
    const baseSize = toFiniteNumber(base.size, 32);
    const baseOpacity = toFiniteNumber(base.opacity, 100);
    const ring = Math.floor(cursor / items.length) + 1;
    const offsetY = 12 + ring * 9;
    const offsetX = 18 + ring * 10;
    const direction = cursor % 2 === 0 ? 1 : -1;

    expanded.push({
      ...base,
      id: `${base.id}-auto-${ring}-${cursor}`,
      top: clampPercent(baseTop + direction * offsetY),
      left: clampPercent(baseLeft - direction * offsetX),
      rotate: baseRotate + direction * (22 + ring * 9),
      size: Math.max(18, Math.min(96, Math.round(baseSize * (0.84 + (cursor % 3) * 0.08)))),
      opacity: Math.max(8, Math.round(baseOpacity * 0.82)),
    });

    cursor += 1;
  }

  return expanded;
}

function FloatingIcons({
  items,
  accentColor,
  iconsOpacity,
}: {
  items: typeof defaultHomeSocialConfig.heroFloatingIcons;
  accentColor: string;
  iconsOpacity: number;
}) {
  const spreadItems = spreadFloatingIcons(items);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {spreadItems.map((item, i) => {
        const Icon = getHeroIconByName(item.icon);
        const top = clampPercent(toFiniteNumber(item.top, 50));
        const left = clampPercent(toFiniteNumber(item.left, 50));
        const rotate = toFiniteNumber(item.rotate, 0);
        const size = Math.max(18, Math.min(96, toFiniteNumber(item.size, 32)));
        const itemOpacity = Math.max(0, Math.min(100, toFiniteNumber(item.opacity, 100)));
        const globalOpacity = Math.max(0, Math.min(100, toFiniteNumber(iconsOpacity, 100)));
        const rawOpacity = (itemOpacity / 100) * (globalOpacity / 100);
        const finalOpacity = rawOpacity === 0 ? 0 : Math.max(0.14, rawOpacity);
        const floatAmplitude = 8 + (i % 4) * 2;
        const floatDuration = 5 + (i % 5) * 0.7;
        return (
          <div
            key={item.id}
            className="pointer-events-none absolute"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              transform: "translate(-50%, -50%)",
              color: accentColor,
              opacity: finalOpacity,
              filter: "drop-shadow(0 10px 20px rgba(15,23,42,0.14))",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.84 }}
              animate={{
                opacity: 1,
                y: [0, -floatAmplitude, 0, floatAmplitude * 0.6, 0],
                rotate: [rotate, rotate + 7, rotate - 6, rotate],
                scale: [1, 1.04, 1],
              }}
              transition={{
                delay: 0.22 + i * 0.06,
                duration: floatDuration,
                ease: "easeInOut",
                repeat: Infinity,
              }}
            >
              <Icon size={size} />
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function IconPattern({ className, density = 10 }: { className?: string; density?: number }) {
  const safeDensity = Math.max(1, Math.min(density, patternIconNames.length));

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}>
      {patternIconNames.slice(0, safeDensity).map((iconName, i) => {
        const Icon = getHeroIconByName(iconName);
        return (
          <Icon
            key={`${iconName}-${i}`}
            className="absolute text-foreground/10"
            style={{
              width: `${24 + (i % 3) * 10}px`,
              height: `${24 + (i % 3) * 10}px`,
              top: `${8 + (i * 19) % 84}%`,
              left: `${6 + (i * 23) % 88}%`,
              transform: `translate(-50%, -50%) rotate(${i * 37}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Painel: "bg-primary/10 text-primary",
    Curso: "bg-accent text-accent-foreground",
    Workshop: "bg-accent text-accent-foreground",
    Apresentação: "bg-secondary text-secondary-foreground",
    Cerimónia: "bg-primary text-primary-foreground",
    Intervalo: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${colors[type] || "bg-secondary text-secondary-foreground"}`}>
      {type}
    </span>
  );
}

function SectionDivider() {
  return (
    <div className="px-4 md:px-8">
      <div className="h-px border-t border-dashed border-primary/35" />
    </div>
  );
}

function SponsorsMarquee({
  items,
  dashedColor,
  dashedOpacity,
}: {
  items: typeof defaultHeroSponsors;
  dashedColor: string;
  dashedOpacity: number;
}) {
  const safeItems = items.length ? items : defaultHeroSponsors;
  const neicOnlyItems = safeItems.filter((item) => /neic|núcleo|nucleo/i.test(`${item.id} ${item.name} ${item.label ?? ""}`));
  const visibleItems = (neicOnlyItems.length ? neicOnlyItems : safeItems.slice(0, 1)).slice(0, 1);
  const marqueeItems = [...visibleItems, ...visibleItems];

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Patrocinadores</span>
        <div className="h-px flex-1 border-t border-dashed" style={{ borderColor: dashedColor, opacity: dashedOpacity / 100 }} />
      </div>
      <div className="sponsor-marquee overflow-hidden rounded-2xl border border-white/45 bg-white/22 px-3 py-3 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-white/14">
        <div className="sponsor-marquee-track flex min-w-max items-center gap-4">
          {marqueeItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="flex shrink-0 items-center justify-center rounded-xl border border-white/55 bg-white/30 px-5 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/18"
            >
              <img src={item.imageUrl} alt={item.name} className="h-12 w-auto object-contain sm:h-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [studentProfile, setStudentProfile] = useState<{ name?: string | null; course?: string | null } | null>(null);
  const [homeContent, setHomeContent] = useState<HomeContent>({
    courses: [],
    panelTopics: [],
    socialConfig: defaultHomeSocialConfig,
  });
  const [coursesContent, setCoursesContent] = useState<CoursesContent>({ courses: [], topCourses: [], preview: [] });
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [liveChat, setLiveChat] = useState<LiveChatMessage[]>([]);
  const [liveState, setLiveState] = useState<AgendaLiveState | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [likedCourseIds, setLikedCourseIds] = useState<Set<number>>(new Set());
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<number>>(new Set());
  const [courseEnrollmentsByCourse, setCourseEnrollmentsByCourse] = useState<Record<number, StudentEnrollmentListItem>>({});
  const [chatInput, setChatInput] = useState("");
  const [hideExposureSection] = useState(() => readExposureSectionViewCount() >= 2);
  const exposureSectionRef = useRef<HTMLElement | null>(null);
  const exposureSectionTrackedRef = useRef(false);

  const redirectToCourseLogin = (message: string) => {
    toast.warning(message);
    navigate("/login?redirect=/cursos");
  };

  const handleCourseAccessError = (error: unknown, fallbackMessage: string) => {
    if (isAuthError(error)) {
      setToken(null);
      redirectToCourseLogin("Inicia sessão para continuar com o curso.");
      return true;
    }

    toast.error(error instanceof Error ? error.message : fallbackMessage);
    return false;
  };

  const refreshHomeCourseEnrollments = async () => {
    if (!getToken()) {
      setCourseEnrollmentsByCourse({});
      setEnrolledCourseIds(new Set());
      return;
    }

    const enrollmentItems = await api.courses.enrollmentsMine();
    setCourseEnrollmentsByCourse(
      enrollmentItems.reduce<Record<number, StudentEnrollmentListItem>>((acc, item) => {
        acc[item.courseId] = item;
        return acc;
      }, {})
    );
    setEnrolledCourseIds(new Set(enrollmentItems.map((item) => item.courseId)));
  };

  const handleLogout = () => {
    setToken(null);
    setStudentProfile(null);
  };

  useEffect(() => {
    api.stats.get()
      .then(setStats)
      .catch(console.error);

    api.homeContent.list()
      .then(setHomeContent)
      .catch(() => setHomeContent({
        courses: [],
        panelTopics: [],
        socialConfig: defaultHomeSocialConfig,
      }));

    api.courses.list()
      .then(setCoursesContent)
      .catch(() => setCoursesContent({ courses: [], topCourses: [], preview: [] }));

    api.agenda.list()
      .then(setAgendaItems)
      .catch(() => setAgendaItems([]));

    api.speakers.list()
      .then(setSpeakers)
      .catch(() => setSpeakers([]));

    api.interactions.activityFeed()
      .then(setActivityFeed)
      .catch(() => setActivityFeed([]));

    api.interactions.liveChat()
      .then(setLiveChat)
      .catch(() => setLiveChat([]));

    api.agenda.live()
      .then(setLiveState)
      .catch(() => setLiveState(null));

    api.faq.list()
      .then(setFaqs)
      .catch(() => setFaqs([]));

    if (getToken()) {
      api.interactions.me()
        .then((res) => setStudentProfile(res.student ?? null))
        .catch(() => undefined);
      api.courses.myLikes()
        .then((res) => setLikedCourseIds(new Set(res.likedCourseIds)))
        .catch(() => undefined);
      void refreshHomeCourseEnrollments().catch(() => undefined);
    }
  }, []);

  const statsData = [
    { value: stats ? `${stats.participants}` : "0", label: "Participantes", icon: Users },
    { value: stats ? `${stats.submissions}` : "0", label: "Projetos Exibidos", icon: FolderOpen },
    { value: `${speakers.length}`, label: "Palestrantes", icon: Mic },
    { value: `${agendaItems.length}`, label: "Sessões na Agenda", icon: GraduationCap },
  ];

  const homepageCourses = coursesContent.preview.length ? coursesContent.preview : defaultCourses;
  const topCourses = coursesContent.topCourses.length ? coursesContent.topCourses : defaultCourses;
  const recentActivity = activityFeed.slice(0, 3);
  const laboratorioHref = useMemo(() => getContestAbsoluteUrl("/"), []);
  const quickActions = useMemo(() => ([
    { label: "Votar Projetos", icon: Vote, path: "/projetos", color: "bg-primary hover:bg-primary/90 text-primary-foreground", desc: "Vota nos teus favoritos" },
    { label: "Submeter Projeto", icon: Send, path: "/submeter", color: "bg-[hsl(var(--area-ia))] hover:bg-[hsl(var(--area-ia))]/90 text-primary-foreground", desc: "Inscreve o teu trabalho" },
    { label: "Entrar no Laboratório", icon: Rocket, href: laboratorioHref, external: true, color: "bg-[linear-gradient(135deg,#041013,#0b1c23,#00b894)] hover:opacity-95 text-white", desc: "Acede à app dedicada do laboratório" },
    { label: "Agendar Evento", icon: CalendarDays, href: AGENDAR_EVENTO_URL, external: true, color: "bg-emerald-600 hover:bg-emerald-500 text-white", desc: "Leva a plataforma para o teu evento" },
    { label: "Ver Agenda", icon: CalendarDays, path: "/agenda", color: "bg-[hsl(var(--area-web))] hover:bg-[hsl(var(--area-web))]/90 text-primary-foreground", desc: "Horários e sessões" },
    { label: "Palestrantes", icon: Mic, path: "/palestrantes", color: "bg-[hsl(var(--area-negocio))] hover:bg-[hsl(var(--area-negocio))]/90 text-primary-foreground", desc: "Quem vai falar" },
    { label: "Cursos", icon: GraduationCap, path: "/cursos", color: "bg-[hsl(var(--area-iot))] hover:bg-[hsl(var(--area-iot))]/90 text-primary-foreground", desc: "Lista completa de cursos" },
    { label: "Guia do Evento", icon: BookOpen, path: "/guia", color: "bg-[hsl(var(--area-produto))] hover:bg-[hsl(var(--area-produto))]/90 text-primary-foreground", desc: "Tudo o que precisas" },
  ]), [laboratorioHref]);
  const heroConfig = useMemo(() => ({
    ...defaultHomeSocialConfig,
    ...homeContent.socialConfig,
    heroFloatingIcons: homeContent.socialConfig?.heroFloatingIcons?.length ? homeContent.socialConfig.heroFloatingIcons : defaultHomeSocialConfig.heroFloatingIcons,
    sponsors: homeContent.socialConfig?.sponsors?.length ? homeContent.socialConfig.sponsors : defaultHeroSponsors,
  }), [homeContent.socialConfig]);
  const heroTypography = useMemo(() => {
    const titleMobile = parseSizeToRem(heroConfig.heroTitleMobileSize, 2.8);
    const titleTablet = parseSizeToRem(heroConfig.heroTitleTabletSize, 4.2);
    const titleDesktop = parseSizeToRem(heroConfig.heroTitleDesktopSize, 5.4);
    const subtitleMobile = parseSizeToRem(heroConfig.heroSubtitleMobileSize, 1.05);
    const subtitleTablet = parseSizeToRem(heroConfig.heroSubtitleTabletSize, 1.2);
    const subtitleDesktop = parseSizeToRem(heroConfig.heroSubtitleDesktopSize, 1.35);

    const titleMax = Math.max(titleTablet, titleDesktop);
    const titleMin = Math.max(1.9, Math.min(titleMobile * 0.78, titleMax));
    const titleBase = Math.max(1.1, Math.min(titleMobile * 0.56, titleMax - 0.4));

    const subtitleMax = Math.max(subtitleTablet, subtitleDesktop);
    const subtitleMin = Math.max(0.96, Math.min(subtitleMobile * 0.88, subtitleMax));
    const subtitleBase = Math.max(0.78, Math.min(subtitleMobile * 0.72, subtitleMax - 0.15));

    return {
      titleFluid: buildFluidRem(titleMin, titleMax, titleBase, 4.1),
      subtitleFluid: buildFluidRem(subtitleMin, subtitleMax, subtitleBase, 1.55),
    };
  }, [
    heroConfig.heroTitleMobileSize,
    heroConfig.heroTitleTabletSize,
    heroConfig.heroTitleDesktopSize,
    heroConfig.heroSubtitleMobileSize,
    heroConfig.heroSubtitleTabletSize,
    heroConfig.heroSubtitleDesktopSize,
  ]);
  const faqPreviewItems = faqs.slice(0, 5);
  const homepagePanels = homeContent.panelTopics.length
    ? homeContent.panelTopics.map((panel) => ({
        ...panel,
        date: panel.dateLabel,
        desc: panel.description,
        icon: getAgendaIcon(panel.type),
      }))
    : agendaItems.slice(0, 6).map((item) => ({
        id: item.id,
        day: formatAgendaDayLabel(item.day),
        date: formatAgendaShortDate(item.date),
        icon: getAgendaIcon(item.type),
        title: item.title,
        speaker: item.speaker || "Sem orador definido",
        time: item.startTime,
        local: item.local,
        desc: item.description,
        type: formatAgendaTypeLabel(item.type),
      }));

  useEffect(() => {
    if (hideExposureSection || exposureSectionTrackedRef.current || typeof window === "undefined" || !exposureSectionRef.current) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting || exposureSectionTrackedRef.current) {
        return;
      }

      exposureSectionTrackedRef.current = true;
      const currentViews = readExposureSectionViewCount();
      writeExposureSectionViewCount(Math.min(currentViews + 1, 2));
      observer.disconnect();
    }, {
      threshold: 0.45,
    });

    observer.observe(exposureSectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hideExposureSection]);

  const handleLiveChatSend = async () => {
    if (!chatInput.trim()) return;
    if (!getToken()) {
      toast.error("Faz login para comentar no mini-chat.");
      return;
    }

    try {
      const created = await api.interactions.sendLiveChat(chatInput.trim());
      setLiveChat((current) => [created, ...current].slice(0, 30));
      setChatInput("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar mensagem");
    }
  };

  const handleCourseLike = async (courseId: number) => {
    if (!getToken()) {
      redirectToCourseLogin("Inicia sessão para curtir um curso.");
      return;
    }

    try {
      const result = await api.courses.like(courseId);
      setLikedCourseIds((current) => {
        const next = new Set(current);
        if (result.liked) next.add(courseId);
        else next.delete(courseId);
        return next;
      });
      setCoursesContent((current) => ({
        ...current,
        courses: current.courses.map((course) => course.id === courseId ? { ...course, likesCount: result.likesCount } : course),
        topCourses: current.topCourses.map((course) => course.id === courseId ? { ...course, likesCount: result.likesCount } : course),
        preview: current.preview.map((course) => course.id === courseId ? { ...course, likesCount: result.likesCount } : course),
      }));
    } catch (error) {
      handleCourseAccessError(error, "Falha ao curtir curso");
    }
  };

  const handleCourseEnroll = async (courseId: number) => {
    if (!getToken()) {
      redirectToCourseLogin("Inicia sessão para te inscreveres num curso.");
      return;
    }

    try {
      const result = await api.courses.enroll(courseId);
      setCoursesContent((current) => ({
        ...current,
        courses: current.courses.map((course) => course.id === courseId ? { ...course, studentCount: result.studentCount } : course),
        topCourses: current.topCourses.map((course) => course.id === courseId ? { ...course, studentCount: result.studentCount } : course),
        preview: current.preview.map((course) => course.id === courseId ? { ...course, studentCount: result.studentCount } : course),
      }));
      await refreshHomeCourseEnrollments();
      toast.success("Inscrição registada. A comunidade do curso foi desbloqueada.");
    } catch (error) {
      handleCourseAccessError(error, "Falha ao inscrever no curso");
    }
  };

  return (
    <div className="min-h-screen">
      {/* ─── HERO ─── */}
      <section className={`relative overflow-x-clip py-16 md:py-28 ${heroConfig.heroMeshEnabled ? "hero-mesh" : ""}`}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: heroConfig.primaryGradient, opacity: heroConfig.heroBlobsIntensity / 280 }}
        />
        <FloatingIcons items={heroConfig.heroFloatingIcons} accentColor={heroConfig.accentColor} iconsOpacity={heroConfig.heroIconsOpacity} />
        {/* Soft glow orbs */}
        <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full blur-[120px] pointer-events-none -translate-y-1/3 translate-x-1/3" style={{ backgroundColor: withAlpha(heroConfig.primaryColor, "18"), opacity: heroConfig.heroBlobsIntensity / 100 }} />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full blur-[90px] pointer-events-none" style={{ backgroundColor: withAlpha(heroConfig.accentColor, "16"), opacity: heroConfig.heroBlobsIntensity / 100 }} />
        <div className="absolute top-1/2 left-1/2 h-[300px] w-[300px] rounded-full blur-[80px] pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: withAlpha(heroConfig.titleColor, "10"), opacity: heroConfig.heroBlobsIntensity / 150 }} />

        <div className="relative z-10 mx-auto w-full max-w-screen-xl px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_410px] xl:grid-cols-[minmax(0,1fr)_450px] 2xl:grid-cols-[minmax(0,1fr)_480px] lg:gap-20 xl:gap-24">
            {/* Left: Main content */}
            <div className="mx-auto w-full min-w-0 max-w-4xl text-left lg:pr-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-6 flex min-w-0 flex-col items-start justify-start gap-2 sm:flex-row sm:gap-3"
              >
                <img src="/logoworconnect.png" alt="UOR Connect" className="h-10 shrink-0 drop-shadow-sm sm:h-12" />
                <div className="hidden h-6 w-px bg-border sm:block" />
                <span className="max-w-[17rem] text-left text-[11px] font-semibold uppercase leading-4 tracking-[0.16em] text-muted-foreground sm:max-w-none sm:text-sm sm:leading-normal sm:tracking-wider">
                  NEIC · Universidade Óscar Ribas
                </span>
              </motion.div>

              {/* Badge da edição — font-mono para feel técnico/académico */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-center text-sm font-semibold shadow-sm sm:text-sm"
                style={{
                  backgroundColor: withAlpha(heroConfig.primaryColor, "16"),
                  color: heroConfig.accentColor,
                  boxShadow: `0 10px 30px ${withAlpha(heroConfig.primaryColor, "14")}`,
                }}
              >
                <Sparkles className="h-4 w-4 animate-pulse" />
                {heroConfig.heroBadgeText}
              </motion.div>

              {/* Título H1 — separado em duas partes para aplicar duas cores e quebra responsiva */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                className="mb-5 w-full min-w-0 max-w-[12ch] break-words hyphens-auto font-heading font-extrabold tracking-tight leading-[1.03] text-balance text-pretty text-[length:var(--hero-title-fluid-size)] lg:max-w-[10.2ch]"
                style={{
                  ["--hero-title-fluid-size" as string]: heroTypography.titleFluid,
                }}
              >
                <span className="inline" style={{ color: heroConfig.titleColor }}>{heroConfig.heroTitlePrefix} </span>
                <motion.span
                  className="inline-block"
                  style={{ color: heroConfig.accentColor }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.45 }}
                >
                  {heroConfig.heroTitleHighlight}
                </motion.span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.54, duration: 0.5 }}
                className="mb-10 max-w-xl font-normal leading-relaxed tracking-normal text-pretty text-[length:var(--hero-subtitle-fluid-size)]"
                style={{
                  color: heroConfig.heroSubtitleColor,
                  ["--hero-subtitle-fluid-size" as string]: heroTypography.subtitleFluid,
                }}
              >
                {heroConfig.heroSubtitleText}
              </motion.p>

              {/* CTAs — estrutura inspirada no bloco de exemplo */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.68 }}
                className="mb-12 grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-3"
              >
                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className="w-full min-w-0">
                  <Button
                    asChild
                    size="lg"
                    className="h-11 w-full min-w-0 justify-center gap-2 overflow-hidden rounded-xl px-2.5 text-[13px] font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 sm:px-3 sm:text-sm"
                    style={{
                      backgroundColor: heroConfig.primaryColor,
                      boxShadow: `0 22px 40px ${withAlpha(heroConfig.primaryColor, "26")}`,
                    }}
                  >
                    <Link to="/projetos" className="flex w-full min-w-0 items-center justify-center gap-2">
                      <Vote className="h-4 w-4 shrink-0" />
                      <span className="truncate">Votar Projetos</span>
                    </Link>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className="w-full min-w-0">
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="hero-primary-action h-11 w-full min-w-0 justify-center gap-2 overflow-hidden rounded-xl bg-card px-2.5 text-[13px] font-semibold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 sm:px-3 sm:text-sm"
                    style={{ borderColor: withAlpha(heroConfig.titleColor, "26"), color: heroConfig.titleColor }}
                  >
                    <Link to="/submeter" className="flex w-full min-w-0 items-center justify-center gap-2">
                      <Send className="h-4 w-4 shrink-0" />
                      <span className="truncate">Submeter candidatura</span>
                    </Link>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className="w-full min-w-0">
                  <Button
                    asChild
                    size="lg"
                    className="h-11 w-full min-w-0 justify-center overflow-hidden rounded-xl border border-destructive/30 bg-destructive/8 px-2.5 text-[13px] font-semibold text-destructive shadow-none transition-all hover:border-destructive/50 hover:bg-destructive/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive active:scale-[0.98] sm:px-3 sm:text-sm"
                    style={{ backdropFilter: "blur(4px)" }}
                  >
                    <a href={laboratorioHref} className="flex w-full min-w-0 items-center justify-center gap-2">
                      <Rocket className="h-4 w-4 shrink-0" />
                      <span className="truncate">Entrar no Laboratório</span>
                    </a>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className="w-full min-w-0">
                  <Button
                    asChild
                    size="lg"
                    className="h-11 w-full min-w-0 justify-center gap-2 overflow-hidden rounded-xl bg-emerald-600 px-2.5 text-[13px] font-semibold text-white shadow-lg shadow-emerald-700/20 transition-all hover:bg-emerald-500 sm:px-3 sm:text-sm"
                  >
                    <a href={AGENDAR_EVENTO_URL} target="_blank" rel="noopener noreferrer" className="flex w-full min-w-0 items-center justify-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span className="truncate">Agendar evento</span>
                    </a>
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }} className="w-full min-w-0">
                  <Button
                    asChild
                    size="lg"
                    className="h-11 w-full min-w-0 justify-center gap-2 overflow-hidden rounded-xl border border-[hsl(var(--area-iot))]/20 bg-[linear-gradient(135deg,rgba(3,105,161,0.96),rgba(14,116,144,0.92),rgba(34,197,94,0.84))] px-2.5 text-[13px] font-semibold text-white shadow-[0_18px_38px_rgba(3,105,161,0.24)] sm:px-3 sm:text-sm"
                  >
                    <Link to="/cursos" className="flex w-full min-w-0 items-center justify-center gap-2">
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <span className="truncate">Ver Cursos</span>
                    </Link>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Login prompt or user profile */}
              {!studentProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mx-auto mb-8 w-full max-w-md rounded-2xl border border-dashed bg-card/80 p-4 backdrop-blur-sm sm:mx-0 sm:max-w-2xl sm:p-5"
                  style={{ borderColor: withAlpha(heroConfig.primaryColor, "40") }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3 text-left">
                      <div className="shrink-0 rounded-2xl p-2.5" style={{ backgroundColor: withAlpha(heroConfig.primaryColor, "14"), color: heroConfig.primaryColor }}>
                        <Lock className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-bold" style={{ color: heroConfig.primaryColor }}>Faz login para desbloquear todos os recursos</p>
                        <p className="text-xs leading-5 text-muted-foreground mt-1">Sem sessão ativa consegues ver projetos, mas votar, gostar e comentar exigem autenticação.</p>
                      </div>
                    </div>
                    <Button asChild className="w-full shrink-0 rounded-xl font-semibold sm:w-auto">
                      <Link to="/login?redirect=/projetos">Entrar</Link>
                    </Button>
                  </div>
                </motion.div>
              )}

              {studentProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mx-auto mb-8 flex w-full max-w-md flex-col items-start gap-3 rounded-2xl border p-4 backdrop-blur-sm sm:mx-0 sm:max-w-lg sm:flex-row sm:items-center md:p-5"
                  style={{ borderColor: withAlpha(heroConfig.primaryColor, "33"), backgroundColor: withAlpha(heroConfig.primaryColor, "10") }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading font-bold" style={{ backgroundColor: withAlpha(heroConfig.primaryColor, "18"), color: heroConfig.primaryColor }}>
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-heading font-bold" style={{ color: heroConfig.primaryColor }}>Sessão ativa</p>
                    <p className="truncate text-base font-semibold">{(studentProfile?.name ?? "").split(" ").slice(0, 2).join(" ") || "Estudante"}</p>
                    <p className="truncate text-xs text-muted-foreground">{studentProfile?.course ?? "Curso não informado"}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-9 w-full rounded-lg text-xs sm:h-8 sm:w-auto" onClick={handleLogout}>
                    Logout
                  </Button>
                </motion.div>
              )}

              <SponsorsMarquee items={heroConfig.sponsors} dashedColor={heroConfig.dashedColor} dashedOpacity={heroConfig.dashedOpacity} />
            </div>

            {/* Right: Stats — visible on large screens */}
            <motion.div
              className="hidden lg:block lg:mt-[450px]"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-md p-6 shadow-xl shadow-black/5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">Em números</p>
                <div className="grid grid-cols-2 gap-3">
                  {statsData.map((s) => (
                    <AnimatedCounter key={s.label} target={s.value} label={s.label} icon={s.icon} />
                  ))}
                </div>
                {/* Live badge */}
                <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                  </span>
                  <Link to="/ao-vivo" className="text-sm font-semibold text-destructive hover:underline">
                    Acompanhar Ao Vivo
                  </Link>
                  <ArrowRight className="ml-auto h-4 w-4 text-destructive" />
                </div>
                {/* Quick link to schedule */}
                <Link
                  to="/agenda"
                  className="mt-3 flex items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Ver Agenda Completa
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Stats — mobile only */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-10 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden"
          >
            {statsData.map((s) => (
              <AnimatedCounter key={s.label} target={s.value} label={s.label} icon={s.icon} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── QUICK ACTIONS BAR ─── */}
      <section className="border-y border-border bg-muted/30 py-10 md:py-14">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 flex items-center gap-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Rocket className="w-5 h-5" />
              </div>
              <span className="text-xl font-heading font-bold">Acesso Rápido</span>
            </div>
            <div className="h-px flex-1 border-t border-dashed border-primary/20" />
            <span className="text-xs font-medium text-muted-foreground">{quickActions.length} atalhos</span>
          </motion.div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {quickActions.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -5, scale: 1.03, transition: { duration: 0.18 } }}
                whileTap={{ scale: 0.96 }}
              >
                {action.external ? (
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`quick-action-card ${action.color}`}
                  >
                    <action.icon className="h-7 w-7 md:h-8 md:w-8" />
                    <span className="text-xs font-bold leading-tight">{action.label}</span>
                  </a>
                ) : (
                  <Link
                    to={action.path ?? "/"}
                    className={`quick-action-card ${action.color}`}
                  >
                    <action.icon className="h-7 w-7 md:h-8 md:w-8" />
                    <span className="text-xs font-bold leading-tight">{action.label}</span>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">Cursos em Destaque</h2>
            <p className="text-muted-foreground mb-10 text-base">Prévia dos cursos oficiais. A lista completa está na página de cursos.</p>
          </motion.div>

          <div className="mb-8 grid gap-3 md:grid-cols-3">
            {topCourses.slice(0, 3).map((course, index) => (
              <div
                key={`${course.id}-${index}`}
                className="rounded-xl border p-4"
                style={{
                  borderColor: withAlpha(course.courseColor, "44"),
                  background: `linear-gradient(135deg, ${withAlpha(course.accentColor)}, ${withAlpha(course.accentColorSecondary)})`
                }}
              >
                <p className="text-xs font-bold mb-1" style={{ color: course.courseColor }}>Top #{index + 1}</p>
                <p className="font-heading font-semibold text-base">{course.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{course.studentCount} inscritos</p>
              </div>
            ))}
          </div>

          <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2">
            {homepageCourses.map((course, i) => (
              <motion.div
                key={course.id ?? i}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 200 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="snap-start min-w-[340px] max-w-[340px] md:min-w-[390px] md:max-w-[390px]"
              >
                <FeaturedCourseCard
                  course={course}
                  liked={likedCourseIds.has(course.id)}
                  enrolled={enrolledCourseIds.has(course.id)}
                  enrollmentStatusLabel={courseEnrollmentsByCourse[course.id]?.statusLabel}
                  className="h-full shadow-sm"
                  onEnroll={() => {
                    const enrollment = courseEnrollmentsByCourse[course.id];
                    if (enrollment?.receiptPath) {
                      navigate(enrollment.receiptPath);
                      return;
                    }

                    void handleCourseEnroll(course.id);
                  }}
                  onCommunity={() => {
                    if (!enrolledCourseIds.has(course.id)) {
                      toast.warning("Precisas estar inscrito no curso antes de entrar na comunidade.");
                      return;
                    }

                    openExternal(course.communityUrl, "A comunidade deste curso ainda não foi configurada.");
                  }}
                  onLike={() => void handleCourseLike(course.id)}
                  onOpenExternal={openExternal}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AO VIVO — TOP ─── */}
      <section className="py-14 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-2xl md:text-4xl font-heading font-bold">Ao Vivo</h2>
              <motion.span
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-flex items-center gap-1.5 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
              >
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                Em direto
              </motion.span>
            </div>
            <p className="text-muted-foreground mb-8 text-base">Acompanha o que está a acontecer agora no evento.</p>
          </motion.div>

          <LivePreview liveState={liveState} agendaItems={agendaItems} />

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-[hsl(var(--area-web))]/8" />
              <IconPattern density={5} />
              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h3 className="font-heading text-lg font-bold">Mini-chat Ao Vivo</h3>
                </div>
                <div className="mb-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {liveChat.map((message) => (
                    <div key={message.id} className="rounded-lg border border-border/70 bg-background/80 p-3">
                      <p className="text-sm font-semibold text-primary">{message.studentName}</p>
                      <p
                        className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: withAlpha(message.courseColor, "1c"),
                          color: message.courseColor || "#64748b"
                        }}
                      >
                        {message.course || "Curso não informado"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{message.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Escreve uma mensagem..."
                    className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-base md:text-sm"
                  />
                  <Button className="h-11" onClick={() => void handleLiveChatSend()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-[hsl(var(--area-negocio))]/8" />
              <IconPattern density={5} />
              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-heading text-lg font-bold">Atividade Recente</h3>
                </div>
                <div className="space-y-3">
                  {recentActivity.length ? recentActivity.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="rounded-xl border border-border/70 bg-background/85 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-primary md:text-[0.95rem]">{item.actorName}</p>
                          <p className="mt-1 text-sm text-foreground/90">
                            {getActivityLabel(item)} <span className="font-semibold text-foreground">{item.subject}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                          {new Date(item.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.message}</p>
                      <div className="mt-3">
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: withAlpha(item.actorCourseColor, "18"),
                            color: item.actorCourseColor || "#64748b"
                          }}
                        >
                          {item.actorCourse || "Curso não informado"}
                        </span>
                      </div>
                    </motion.div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/75 p-4 text-sm text-muted-foreground">
                      Ainda não há atividade recente para mostrar.
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/ao-vivo">Ver mais atividades</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8 text-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="lg" className="font-semibold rounded-xl shadow-md text-base h-12">
                <Link to="/ao-vivo"><Radio className="mr-2 h-5 w-5" />Ver Evento Ao Vivo</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {!hideExposureSection ? (
        <>
          <SectionDivider />

          {/* ─── TIPOS DE EXPOSIÇÃO ─── */}
          <section ref={exposureSectionRef} className="py-14 md:py-20">
            <div className="container mx-auto px-4">
              <div className="relative overflow-hidden rounded-[30px] border border-border/70 bg-card/90 p-5 shadow-xl shadow-black/5 md:p-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(2,132,199,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(217,119,6,0.12),transparent_46%)]" />
                <IconPattern density={8} />
                <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="relative z-10 mb-8 md:mb-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary shadow-sm sm:text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                    Exposição na 3ª edição da Feira do Dia das Telecomunicações
                  </div>
                  <h2 className="mt-3 text-xl font-heading font-bold leading-snug sm:text-2xl md:text-[1.9rem]">Tipos de Exposição</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-[15px]">Três formas de participar e mostrar o teu trabalho.</p>
                </motion.div>

                <div className="relative z-10 flex gap-5 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-3 md:overflow-visible">
                  {projectTypes.map((t, i) => (
                    <motion.div
                      key={t.key}
                      initial={{ opacity: 0, y: 20, rotate: -2 }}
                      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                      className="min-w-[285px] md:min-w-0"
                    >
                      <Link to="/submeter" className="group relative block overflow-hidden rounded-2xl border border-border/70 bg-white/85 p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl md:p-9">
                        <div className={`absolute inset-0 bg-gradient-to-br ${t.surface}`} />
                        <div className="relative z-10">
                          <motion.div
                            whileHover={{ rotate: [0, -10, 10, 0], scale: 1.12 }}
                            transition={{ duration: 0.5 }}
                            className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg ${t.color}`}
                          >
                            <t.icon className="h-10 w-10" />
                          </motion.div>
                          <h3 className="mb-2 font-heading text-lg font-bold md:text-xl">{t.label}</h3>
                          <p className="mb-4 text-sm text-muted-foreground md:text-base">{t.desc}</p>
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            Submeter <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <SectionDivider />

      {/* ─── TOP PROJETOS — CAROUSEL ─── */}
      <section className="py-14 md:py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}>
                <Award className="w-7 h-7 text-primary" />
              </motion.div>
              <h2 className="text-2xl md:text-4xl font-heading font-bold">Top Projetos</h2>
            </div>
            <p className="text-muted-foreground mb-10 text-base">Os projetos, negócios e produtos mais votados. Arrasta para ver todos!</p>
          </motion.div>

          <TopProjectsCarousel />

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-10 text-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="lg" variant="outline" className="font-semibold rounded-xl border-foreground/20 hover:bg-secondary text-base h-12">
                <Link to="/projetos">Ver Todos os Projetos <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ─── PAINÉIS ─── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">Painéis</h2>
            <p className="text-muted-foreground mb-12 text-base">As sessões que vão marcar esta semana académica.</p>
          </motion.div>

          <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
            {homepagePanels.map((panel, i) => (
              <motion.div
                key={panel.id ?? `${panel.title}-${panel.time}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative group min-w-[320px] rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300 lg:min-w-0"
              >
                <div className="h-1.5 bg-primary" />
                <div className="relative z-10 p-6 md:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-full">{panel.day} · {panel.date}</span>
                    <TypeBadge type={panel.type} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mb-4"><Clock className="w-4 h-4" />{panel.time}</div>
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><panel.icon className="w-6 h-6 text-primary" /></div>
                    <h3 className="font-heading font-bold text-base md:text-lg leading-snug pt-1">{panel.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">{panel.desc}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-t border-border pt-4">
                    <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-primary" />{panel.speaker}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />{panel.local}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {!homepagePanels.length ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Ainda não há painéis publicados para mostrar na home.
            </div>
          ) : null}

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-10 text-center">
            <Button asChild size="lg" variant="outline" className="font-semibold rounded-xl border-foreground/20 hover:bg-secondary text-base h-12">
              <Link to="/agenda">Ver Agenda Completa <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ─── SPEAKERS ─── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">Palestrantes</h2>
            <p className="text-muted-foreground mb-12 text-base">Profissionais que vão partilhar conhecimento e experiência.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {speakers.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="relative border border-border rounded-xl bg-card p-6 md:p-8 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group overflow-hidden"
              >
                <IconPattern density={5} />
                <div className="relative z-10">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5 mx-auto"
                  >
                    <User className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                  </motion.div>
                  <h3 className="font-heading font-bold text-base md:text-lg text-center">{s.name}</h3>
                  <p className="text-sm text-muted-foreground text-center mt-1.5">{s.role}</p>
                  <div className="mt-4 pt-4 border-t border-border"><p className="text-sm md:text-base text-center text-primary font-medium">{s.talk}</p></div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-10 text-center">
            <Button asChild size="lg" variant="outline" className="font-semibold rounded-xl border-foreground/20 hover:bg-secondary text-base h-12">
              <Link to="/palestrantes">Ver Todos os Palestrantes <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ─── FAQ ─── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">Perguntas Frequentes</h2>
            <p className="text-muted-foreground mb-10 text-base">Respostas rápidas às dúvidas mais comuns.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card"
          >
            <Accordion type="single" collapsible className="divide-y divide-border">
              {faqPreviewItems.map((faq) => (
                <AccordionItem key={faq.id} value={`home-faq-${faq.id}`} className="border-none">
                  <AccordionTrigger className="px-5 py-4 text-sm font-heading font-semibold hover:no-underline hover:bg-secondary/50 transition-colors">
                    <span className="flex items-center gap-2 text-left">
                      <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4 pl-11 text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {!faqPreviewItems.length ? (
              <div className="px-5 py-6 text-sm text-muted-foreground">
                Ainda não há perguntas frequentes publicadas.
              </div>
            ) : null}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-8 text-center">
            <Button asChild variant="ghost" size="lg" className="font-semibold text-primary text-base">
              <Link to="/faq">{faqs.length > 5 ? "Ver mais perguntas" : "Ver todas as perguntas"} <ChevronRight className="ml-1 h-5 w-5" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ─── CTA ─── */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative bg-primary rounded-2xl p-10 md:p-14 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {patternIconNames.map((iconName, i) => {
                const Icon = getHeroIconByName(iconName);
                return (
                  <Icon key={`${iconName}-${i}`} className="absolute text-primary-foreground/[0.08]" style={{
                    width: `${28 + (i % 3) * 12}px`,
                    height: `${28 + (i % 3) * 12}px`,
                    top: `${5 + (i * 27) % 80}%`,
                    left: `${3 + (i * 29) % 90}%`,
                    transform: `rotate(${i * 41}deg)`,
                  }} />
                );
              })}
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-heading font-bold text-primary-foreground mb-3">Tens um projeto, negócio ou produto?</h2>
              <p className="text-primary-foreground/80 text-base md:text-lg max-w-lg">Submete o teu trabalho e apresenta-o perante profissionais e colegas da universidade.</p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="relative z-10">
              <Button asChild size="lg" variant="secondary" className="font-semibold rounded-xl shrink-0 shadow-md text-base px-8 h-12">
                <Link to="/submeter">Submeter Agora <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── ADMIN LINK ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="fixed bottom-4 right-4 z-40"
      >
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Link
            to="/admin"
            className="flex items-center gap-2 bg-card border border-border shadow-lg rounded-full px-5 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            <Settings className="w-5 h-5" />
            Admin
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
