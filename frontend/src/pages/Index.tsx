import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Send, Users, FolderOpen, Mic, ArrowRight,
  Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap,
  MessageSquare, Clock, MapPin, User, Presentation, BookOpen,
  Lightbulb, Target, Award, TrendingUp, HelpCircle, ChevronRight,
  Sparkles, ThumbsUp, Star, ChevronLeft, Briefcase, Package, GraduationCap,
  Settings, Vote, Rocket, Trophy, Play, Heart, Share2, Loader2, Crown,
  Building2, Instagram, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { api, type ActivityFeedItem, type AgendaItem, type AgendaLiveState, type CoursesContent, type FaqItem, type HomeContent, type LiveChatMessage, type ProjectPublicFeedItem, type Speaker, type Stats, getToken, isAuthError, setToken } from "@/lib/api";
import logoUor from "@/assets/logo-uor.png";
import logoNeic from "@/assets/logo-neic.jpeg";
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
  { key: "projeto", label: "Projetos Académicos", icon: GraduationCap, color: "bg-primary text-primary-foreground hover:bg-primary/90", desc: "Trabalhos de estudantes avaliados por júri" },
  { key: "negocio", label: "Expor Negócio", icon: Briefcase, color: "bg-[hsl(var(--area-negocio))] text-primary-foreground hover:bg-[hsl(var(--area-negocio))]/90", desc: "Ideias e modelos de negócio inovadores" },
  { key: "produto", label: "Expor Produto", icon: Package, color: "bg-[hsl(var(--area-produto))] text-primary-foreground hover:bg-[hsl(var(--area-produto))]/90", desc: "Produtos e protótipos tecnológicos" },
];

const sponsors = [
  { src: logoUor, alt: "Universidade Óscar Ribas", label: "", logoClassName: "h-10 w-10 object-contain" },
  { src: logoNeic, alt: "Núcleo de Engenharia Informática e Comunicações", label: "Núcleo de Engenharia Informática e Comunicações", logoClassName: "h-10 w-10 rounded-lg object-cover" },
  { src: "/logo.svg", alt: "UOR Connect", label: "UOR Connect", logoClassName: "h-12 w-12 object-contain" },
];

const AGENDAR_EVENTO_URL = "https://agendar.uorconnect.space/";

/* ─── Quick Actions for Students ─── */
const quickActions = [
  { label: "Votar Projetos", icon: Vote, path: "/projetos", color: "bg-primary hover:bg-primary/90 text-primary-foreground", desc: "Vota nos teus favoritos" },
  { label: "Submeter Projeto", icon: Send, path: "/submeter", color: "bg-[hsl(var(--area-ia))] hover:bg-[hsl(var(--area-ia))]/90 text-primary-foreground", desc: "Inscreve o teu trabalho" },
  { label: "Agendar Evento", icon: CalendarDays, href: AGENDAR_EVENTO_URL, external: true, color: "bg-emerald-600 hover:bg-emerald-500 text-white", desc: "Leva a plataforma para o teu evento" },
  { label: "Ao Vivo", icon: Play, path: "/ao-vivo", color: "bg-destructive hover:bg-destructive/90 text-destructive-foreground", desc: "Acompanha em direto" },
  { label: "Ver Agenda", icon: CalendarDays, path: "/agenda", color: "bg-[hsl(var(--area-web))] hover:bg-[hsl(var(--area-web))]/90 text-primary-foreground", desc: "Horários e sessões" },
  { label: "Palestrantes", icon: Mic, path: "/palestrantes", color: "bg-[hsl(var(--area-negocio))] hover:bg-[hsl(var(--area-negocio))]/90 text-primary-foreground", desc: "Quem vai falar" },
  { label: "Cursos", icon: GraduationCap, path: "/cursos", color: "bg-[hsl(var(--area-iot))] hover:bg-[hsl(var(--area-iot))]/90 text-primary-foreground", desc: "Lista completa de cursos" },
  { label: "Guia do Evento", icon: BookOpen, path: "/guia", color: "bg-[hsl(var(--area-produto))] hover:bg-[hsl(var(--area-produto))]/90 text-primary-foreground", desc: "Tudo o que precisas" },
];

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
  const [votedProjects, setVotedProjects] = useState<Set<number>>(new Set());
  const [loggedIn, setLoggedIn] = useState(false);
  const [projects, setProjects] = useState<ProjectPublicFeedItem[]>([]);
  const [mode, setMode] = useState<"winners" | "now">("winners");
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
    if (getToken()) setLoggedIn(true);
    api.interactions.projects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
  };

  const handleVote = async (id: number) => {
    const project = projects.find((item) => item.id === id);

    if (project && !canVoteSubmission(project.type, project.area, project.canVote)) {
      toast.info("Esta candidatura está em exposição e não participa na votação pública.");
      return;
    }

    if (!loggedIn) {
      toast.error("Faz login para votar.");
      navigate("/login?redirect=/projetos");
      return;
    }
    if (votedProjects.has(id)) { toast.info("Já votaste neste projeto."); return; }
    try {
      await api.interactions.vote(id);
      setVotedProjects(prev => new Set(prev).add(id));
      setProjects(prev => prev.map((project) => project.id === id ? { ...project, votesCount: project.votesCount + 1 } : project));
      toast.success("Voto registado! 🏆");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao votar.");
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
        {sorted.map((p, i) => {
          const areaUi = getAreaClasses(p.area, p.type);
          const displayArea = getSubmissionAreaLabel(p.area, p.type);
          const canVote = canVoteSubmission(p.type, p.area, p.canVote);

          return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 200 }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className={`relative min-w-[320px] max-w-[360px] snap-start overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:shadow-lg ${areaUi.border}`}
          >
            <div className={`h-1.5 ${areaUi.topBar}`} />

            {(p.isWinner || i < 3) && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1, type: "spring" }}
                className={`absolute top-5 right-4 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground shadow-lg ${
                  p.isWinner ? "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]" : i === 0 ? "bg-primary" : i === 1 ? "bg-muted-foreground" : "bg-[hsl(var(--area-negocio))]"
                }`}
              >
                {p.isWinner ? <Crown className="w-5 h-5" /> : i === 0 ? <Trophy className="w-5 h-5" /> : `#${i + 1}`}
              </motion.div>
            )}

            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${areaUi.badge}`}>
                  {displayArea}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {p.commentsCount}
                </span>
              </div>

              <div className="mb-2 flex items-start gap-2">
                {p.isWinner && <Crown className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />}
                <h3 className="font-heading text-base font-bold leading-snug sm:text-lg">{p.name}</h3>
              </div>

              <p className="mb-2 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>
              <p className="mb-4 text-xs text-muted-foreground">Equipa: {p.members}</p>
              <p className="mb-4 rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                {getSubmissionAudienceCopy(p.type, p.area)}
              </p>

              <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" /> {p.likesCount}
                </span>
                {canVote ? (
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" /> {p.votesCount}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[hsl(var(--area-negocio))]">
                    <Lock className="h-3.5 w-3.5" /> Exposição
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> {p.commentsCount}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <motion.div className="flex-1" whileTap={{ scale: 0.95 }}>
                  <Button
                    variant={canVote && votedProjects.has(p.id) ? "default" : "outline"}
                    className={`h-10 w-full rounded-xl text-xs font-semibold ${canVote && votedProjects.has(p.id) ? "bg-primary text-primary-foreground hover:bg-primary/90" : canVote ? "border-primary/30 text-primary hover:border-primary/60 hover:bg-primary/10" : "border-border text-muted-foreground"}`}
                    onClick={() => canVote ? handleVote(p.id) : undefined}
                    disabled={!canVote}
                  >
                    {canVote ? <Trophy className="mr-1.5 h-4 w-4" /> : <Lock className="mr-1.5 h-4 w-4" />}
                    {canVote ? (votedProjects.has(p.id) ? "Votado" : "Votar") : "Exposição"}
                  </Button>
                </motion.div>
                <Button asChild variant="outline" className="h-10 rounded-xl text-xs font-semibold">
                  <Link to="/projetos">
                    <Trophy className="mr-1.5 h-4 w-4" />
                    Detalhes
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
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

const patternIcons = [Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb];

function FloatingIcons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {patternIcons.map((Icon, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.15, duration: 0.8 }}
        >
          <Icon className="absolute text-primary/[0.06]" style={{
            width: `${28 + (i % 3) * 12}px`, height: `${28 + (i % 3) * 12}px`,
            top: `${10 + (i * 23) % 80}%`, left: `${5 + (i * 31) % 85}%`,
            transform: `rotate(${i * 37}deg)`,
          }} />
        </motion.div>
      ))}
    </div>
  );
}

function IconPattern({ className, density = 10 }: { className?: string; density?: number }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {patternIcons.slice(0, density).map((Icon, i) => (
        <Icon key={i} className="absolute text-primary/[0.04]" style={{
          width: `${24 + (i % 3) * 10}px`, height: `${24 + (i % 3) * 10}px`,
          top: `${10 + (i * 23) % 80}%`, left: `${5 + (i * 31) % 85}%`,
          transform: `rotate(${i * 37}deg)`,
        }} />
      ))}
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

function SponsorsMarquee() {
  const marqueeItems = [...sponsors, ...sponsors];

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Patrocinadores</span>
        <div className="h-px flex-1 border-t border-dashed border-primary/25" />
      </div>
      <div className="sponsor-marquee overflow-hidden rounded-2xl border border-border/70 bg-white/80 px-3 py-3 shadow-sm backdrop-blur">
        <div className="sponsor-marquee-track flex min-w-max items-center gap-4">
          {marqueeItems.map((item, index) => (
            <div
              key={`${item.alt}-${index}`}
              className="flex shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-4 py-3 shadow-sm"
            >
              <img src={item.src} alt={item.alt} className={item.logoClassName} />
              {item.label ? <span className="whitespace-nowrap text-xs font-semibold text-foreground">{item.label}</span> : null}
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
    socialConfig: { key: "default", instagramUrl: null, facebookUrl: null, linkedinUrl: null, createdAt: "", updatedAt: "" }
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
  const [chatInput, setChatInput] = useState("");

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
        socialConfig: { key: "default", instagramUrl: null, facebookUrl: null, linkedinUrl: null, createdAt: "", updatedAt: "" }
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
      api.courses.myEnrollments()
        .then((res) => setEnrolledCourseIds(new Set(res.enrolledCourseIds)))
        .catch(() => undefined);
    }
  }, []);

  const statsData = [
    { value: stats ? `${stats.participants}` : "0", label: "Participantes", icon: Users },
    { value: stats ? `${stats.approved}` : "0", label: "Projetos Exibidos", icon: FolderOpen },
    { value: `${speakers.length}`, label: "Palestrantes", icon: Mic },
    { value: `${agendaItems.length}`, label: "Sessões na Agenda", icon: GraduationCap },
  ];

  const homepageCourses = coursesContent.preview.length ? coursesContent.preview : defaultCourses;
  const topCourses = coursesContent.topCourses.length ? coursesContent.topCourses : defaultCourses;
  const recentActivity = activityFeed.slice(0, 3);
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
      setEnrolledCourseIds((current) => new Set(current).add(courseId));
      setCoursesContent((current) => ({
        ...current,
        courses: current.courses.map((course) => course.id === courseId ? { ...course, studentCount: result.studentCount } : course),
        topCourses: current.topCourses.map((course) => course.id === courseId ? { ...course, studentCount: result.studentCount } : course),
        preview: current.preview.map((course) => course.id === courseId ? { ...course, studentCount: result.studentCount } : course),
      }));
      toast.success("Inscrição registada. A comunidade do curso foi desbloqueada.");
    } catch (error) {
      handleCourseAccessError(error, "Falha ao inscrever no curso");
    }
  };

  return (
    <div className="min-h-screen">
      {/* ─── HERO ─── */}
      <section className="relative py-16 md:py-28 overflow-hidden">
        <FloatingIcons />
        <div className="absolute top-10 right-10 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[hsl(var(--area-web))]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-6"
            >
              <img src="/logo.svg" alt="UOR" className="h-12" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">NEIC · Universidade Óscar Ribas</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-2 rounded-full mb-6"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              17 — 18 Maio 2026
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
              className="text-4xl md:text-6xl lg:text-7xl font-heading font-800 leading-[1.03] mb-5"
            >
              3ª edição da{" "}
              <motion.span
                className="text-primary inline-block"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                Feira do Dia das Telecomunicações
              </motion.span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl"
            >
              Conectando conhecimento académico, produto e empreendedorismo ao mercado tecnológico com uma experiência mais viva, estruturada e pública.
            </motion.p>

            {/* Primary CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-4 grid max-w-3xl gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="min-w-0">
                <Button asChild size="lg" className="h-12 w-full justify-center rounded-xl px-6 text-base font-semibold shadow-lg transition-shadow hover:shadow-xl">
                  <Link to="/projetos"><Vote className="mr-2 h-5 w-5" />Votar Projetos</Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="min-w-0">
                <Button asChild size="lg" variant="outline" className="h-12 w-full justify-center rounded-xl border-foreground/20 px-6 text-base font-semibold hover:bg-secondary">
                  <Link to="/submeter"><Send className="mr-2 h-5 w-5" />Submeter Projeto</Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="min-w-0">
                <Button asChild size="lg" variant="outline" className="h-12 w-full justify-center rounded-xl border-destructive/30 px-6 text-base font-semibold text-destructive hover:bg-destructive/10">
                  <Link to="/ao-vivo"><Play className="mr-2 h-5 w-5" />Ao Vivo</Link>
                </Button>
              </motion.div>
            </motion.div>

            {!studentProfile && (
              <div className="mb-8 max-w-2xl rounded-2xl border border-dashed border-primary/30 bg-card/90 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-heading font-bold text-primary">Faz login para desbloquear todos os recursos</p>
                      <p className="text-xs leading-6 text-muted-foreground">Sem sessão ativa consegues ver projetos, mas votar, gostar e comentar exigem autenticação.</p>
                    </div>
                  </div>
                  <Button asChild className="rounded-xl font-semibold">
                    <Link to="/login?redirect=/projetos">Entrar</Link>
                  </Button>
                </div>
              </div>
            )}

            {studentProfile && (
              <div className="border border-primary/20 rounded-xl bg-primary/5 p-4 md:p-5 mb-8 flex items-center gap-3 max-w-lg">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary font-heading font-bold">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-heading font-bold text-primary">Sessão ativa</p>
                  <p className="text-base font-semibold">{(studentProfile?.name ?? "").split(" ").slice(0, 2).join(" ") || "Estudante"}</p>
                  <p className="text-xs text-muted-foreground">{studentProfile?.course ?? "Curso não informado"}</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            )}

            <SponsorsMarquee />
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {statsData.map((s) => (
              <AnimatedCounter key={s.label} target={s.value} label={s.label} icon={s.icon} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── QUICK ACTIONS BAR ─── */}
      <section className="border-y border-border bg-muted/40 py-8 md:py-10">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-2.5 mb-6"
          >
            <Rocket className="w-6 h-6 text-primary" />
            <span className="text-lg font-heading font-bold">Acesso Rápido</span>
          </motion.div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.96 }}
              >
                {action.external ? (
                  <a
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-center gap-3 rounded-xl p-5 text-center shadow-sm transition-all duration-200 hover:shadow-lg md:p-6 ${action.color}`}
                  >
                    <action.icon className="h-7 w-7 md:h-8 md:w-8" />
                    <span className="text-sm font-bold leading-tight">{action.label}</span>
                  </a>
                ) : (
                  <Link
                    to={action.path ?? "/"}
                    className={`flex flex-col items-center gap-3 rounded-xl p-5 text-center shadow-sm transition-all duration-200 hover:shadow-lg md:p-6 ${action.color}`}
                  >
                    <action.icon className="h-7 w-7 md:h-8 md:w-8" />
                    <span className="text-sm font-bold leading-tight">{action.label}</span>
                  </Link>
                )}
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

      <SectionDivider />

      {/* ─── TIPOS DE EXPOSIÇÃO ─── */}
      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-4xl font-heading font-bold mb-3">Tipos de Exposição</h2>
            <p className="text-muted-foreground mb-10 text-base">Três formas de participar e mostrar o teu trabalho.</p>
          </motion.div>

          <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-3 md:overflow-visible">
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
                <Link to="/submeter" className="relative block overflow-hidden rounded-xl border border-border bg-card p-8 md:p-10 hover:shadow-xl transition-all duration-300 group text-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-[hsl(var(--area-web))]/8" />
                  <IconPattern density={6} />
                  <div className="relative z-10">
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0], scale: 1.15 }}
                      transition={{ duration: 0.5 }}
                      className={`w-20 h-20 rounded-2xl ${t.color} flex items-center justify-center mx-auto mb-5`}
                    >
                      <t.icon className="w-10 h-10" />
                    </motion.div>
                    <h3 className="font-heading font-bold text-lg md:text-xl mb-2">{t.label}</h3>
                    <p className="text-sm md:text-base text-muted-foreground mb-4">{t.desc}</p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Submeter <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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
                className="min-w-[300px] max-w-[360px] snap-start"
              >
                <article
                  className="relative h-full overflow-hidden rounded-2xl border bg-card p-5 md:p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                  style={{
                    borderColor: withAlpha(course.courseColor, "44"),
                    background: `linear-gradient(140deg, ${withAlpha(course.accentColor)}, ${withAlpha(course.accentColorSecondary)})`
                  }}
                >
                  <IconPattern density={6} />
                  <div className="relative z-10">
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
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold shadow-sm" style={{ color: course.courseColor }}>
                        <Heart className="h-3.5 w-3.5 fill-current" />
                        {course.likesCount}
                      </span>
                    </div>
                    <p className="mb-4 text-[15px] leading-6 text-foreground/85">{course.description}</p>
                    {course.preview && <p className="mb-4 text-sm leading-6 text-muted-foreground line-clamp-2">{course.preview}</p>}
                    <div className="mb-4 rounded-xl border border-white/60 bg-white/72 p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: withAlpha(course.courseColor, "22") }}>
                          <Building2 className="h-4.5 w-4.5" style={{ color: course.courseColor }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{course.companyName}</p>
                          <p className="text-xs font-medium text-muted-foreground">{course.companyCategory}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                        {course.companyWebsite && <button onClick={() => openExternal(course.companyWebsite)} className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Website</button>}
                        {course.companyInstagram && <button onClick={() => openExternal(course.companyInstagram)} className="inline-flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</button>}
                      </div>
                    </div>
                    <p className="mb-4 text-sm font-semibold" style={{ color: course.courseColor }}>{course.studentCount} inscritos</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        size="sm"
                        className="h-auto min-h-10 w-full min-w-0 rounded-xl px-3 py-2 text-center text-sm font-semibold leading-tight shadow-sm whitespace-normal"
                        onClick={() => void handleCourseEnroll(course.id)}
                        disabled={enrolledCourseIds.has(course.id)}
                      >
                        {enrolledCourseIds.has(course.id) ? "Inscrito" : "Inscrever"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-auto min-h-10 w-full min-w-0 rounded-xl bg-white/70 px-3 py-2 text-center text-sm font-semibold leading-tight whitespace-normal"
                        disabled={!enrolledCourseIds.has(course.id)}
                        onClick={() => {
                          if (!enrolledCourseIds.has(course.id)) {
                            toast.warning("Precisas estar inscrito para entrar na comunidade.");
                            return;
                          }
                          openExternal(course.communityUrl, "A comunidade deste curso ainda não foi configurada.");
                        }}
                      >
                        {enrolledCourseIds.has(course.id) ? "Entrar na comunidade" : "Comunidade bloqueada"}
                      </Button>
                      <Button size="sm" variant={likedCourseIds.has(course.id) ? "default" : "outline"} className="h-auto min-h-10 rounded-xl px-3 py-2 text-sm font-semibold leading-tight sm:col-span-2" onClick={() => void handleCourseLike(course.id)}>
                        <Heart className="mr-1.5 h-4 w-4" />
                        {likedCourseIds.has(course.id) ? "Curtido" : "Curtir"}
                      </Button>
                    </div>
                    {!enrolledCourseIds.has(course.id) && (
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" />
                        A comunidade abre depois da inscrição.
                      </p>
                    )}
                  </div>
                </article>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/cursos">Explorar todos os cursos <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
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
              {patternIcons.map((Icon, i) => (
                <Icon key={i} className="absolute text-primary-foreground/[0.08]" style={{
                  width: `${28 + (i % 3) * 12}px`, height: `${28 + (i % 3) * 12}px`,
                  top: `${5 + (i * 27) % 80}%`, left: `${3 + (i * 29) % 90}%`, transform: `rotate(${i * 41}deg)`,
                }} />
              ))}
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
