import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, ExternalLink, ShieldCheck, BarChart3, QrCode,
  Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap,
  MessageSquare, Users, FolderOpen, Mic, GraduationCap,
  Vote, Trophy, Play, CheckCircle2, ArrowRight, Sparkles,
  TrendingUp, Lock, Eye, Settings, Crown, Star, Heart,
  BookOpen, Building2, Instagram, Send, Clock, MapPin,
  Lightbulb, Target, Award, ChevronRight, ThumbsUp, FileText, Ticket, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getPrimaryPortalHref } from "@/lib/contest-lab";

const WHATSAPP_LINK = `https://wa.me/244951203163?text=Ol%C3%A1%2C%20gostaria%20de%20levar%20a%20UOR%20Connect%20ao%20meu%20evento.`;

function withAlpha(color?: string | null, alpha = "22") {
  return color ? `${color}${alpha}` : `rgba(249,115,22,0.12)`;
}

/* ─── Area classes (mirror of Projetos.tsx) ─── */
const areaColors: Record<string, string> = {
  IoT: "bg-[hsl(199,89%,48%)]/10 text-[hsl(199,89%,48%)]",
  Telecom: "bg-primary/10 text-primary",
  "Segurança": "bg-destructive/10 text-destructive",
  Web: "bg-[hsl(200,92%,42%)]/10 text-[hsl(200,92%,42%)]",
  IA: "bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,45%)]",
  "Negócio": "bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)]",
  Produto: "bg-[hsl(330,81%,60%)]/10 text-[hsl(330,81%,60%)]",
};
const areaTopBar: Record<string, string> = {
  IoT: "bg-[hsl(199,89%,48%)]",
  Telecom: "bg-primary",
  "Segurança": "bg-destructive",
  Web: "bg-[hsl(200,92%,42%)]",
  IA: "bg-[hsl(142,71%,45%)]",
  "Negócio": "bg-[hsl(38,92%,50%)]",
  Produto: "bg-[hsl(330,81%,60%)]",
};
const areaBorderAccent: Record<string, string> = {
  IoT: "border-[hsl(199,89%,48%)]/30 hover:border-[hsl(199,89%,48%)]/60",
  Telecom: "border-primary/30 hover:border-primary/60",
  "Segurança": "border-destructive/30 hover:border-destructive/60",
  Web: "border-[hsl(200,92%,42%)]/30 hover:border-[hsl(200,92%,42%)]/60",
  IA: "border-[hsl(142,71%,45%)]/30 hover:border-[hsl(142,71%,45%)]/60",
  "Negócio": "border-[hsl(38,92%,50%)]/30 hover:border-[hsl(38,92%,50%)]/60",
  Produto: "border-[hsl(330,81%,60%)]/30 hover:border-[hsl(330,81%,60%)]/60",
};
function getAreaClasses(area: string, type?: string) {
  if (type === "BUSINESS" || type === "Negócio") return { badge: areaColors["Negócio"] || "bg-amber-500/10 text-amber-700", topBar: areaTopBar["Negócio"] || "bg-amber-500", border: areaBorderAccent["Negócio"] || "border-amber-500/30" };
  if (type === "PRODUCT" || type === "Produto") return { badge: areaColors.Produto || "bg-pink-500/10 text-pink-600", topBar: areaTopBar.Produto || "bg-pink-500", border: areaBorderAccent.Produto || "border-pink-500/30" };
  return {
    badge: areaColors[area] || "bg-secondary text-secondary-foreground",
    topBar: areaTopBar[area] || "bg-primary",
    border: areaBorderAccent[area] || "border-border hover:border-primary/40",
  };
}

/* ─── Floating icons pattern (same as Index) ─── */
const patternIcons = [Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb];
function FloatingIcons() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {patternIcons.map((Icon, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.12, duration: 0.8 }}>
          <Icon className="absolute text-primary/[0.05]" style={{
            width: `${28 + (i % 3) * 12}px`, height: `${28 + (i % 3) * 12}px`,
            top: `${10 + (i * 23) % 80}%`, left: `${5 + (i * 31) % 85}%`,
            transform: `rotate(${i * 37}deg)`,
          }} />
        </motion.div>
      ))}
    </div>
  );
}
function IconPattern({ density = 6 }: { density?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
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

/* ─── Animated Counter (same as Index) ─── */
function AnimatedCounter({ target, suffix = "", label, icon: Icon, color = "text-primary", bg = "bg-primary/10" }:
  { target: number; suffix?: string; label: string; icon: React.ElementType; color?: string; bg?: string }) {
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
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1400, 1);
      setCount(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target]);
  return (
    <div ref={ref} className="flex h-full min-h-[124px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-card/75 px-4 py-5 text-center shadow-sm backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1">
      <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${bg} shadow-sm`}>
        <Icon className={`w-7 h-7 ${color}`} />
      </motion.div>
      <div className="text-3xl md:text-4xl font-heading font-bold text-foreground leading-none">{count}{suffix}</div>
      <div className="mt-2 text-sm md:text-base text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

/* ─── Section Label pill ─── */
function SectionLabel({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "blue" | "green" | "warning" }) {
  const c = { primary: "bg-primary/10 text-primary border-primary/20", blue: "bg-blue-500/10 text-blue-600 border-blue-500/20", green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", warning: "bg-amber-500/10 text-amber-700 border-amber-500/20" };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm ${c[variant]}`}>{children}</span>;
}

/* ─── Animated feature card with step list ─── */
function AnimatedFeatureBlock({ icon: Icon, title, desc, steps, color = "text-primary", bg = "bg-primary/10", accent = "border-primary/20", delay = 0 }:
  { icon: React.ElementType; title: string; desc: string; steps: string[]; color?: string; bg?: string; accent?: string; delay?: number }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % steps.length), 2200);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay, type: "spring", stiffness: 180 }}
      className={`relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow ${accent}`}>
      <IconPattern density={5} />
      <div className="relative z-10">
        <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <h3 className="font-heading font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">{desc}</p>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <AnimatePresence key={i} mode="wait">
              <motion.div
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${active === i ? `${bg} ${color} font-semibold` : "text-muted-foreground"}`}
                animate={{ x: active === i ? 4 : 0 }}
              >
                <motion.div animate={{ scale: active === i ? 1 : 0.7 }}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${active === i ? color.replace("text-", "bg-").replace("/", "/20 ") + " " + color : "bg-border/60"}`}>
                  {active === i ? <CheckCircle2 className="h-3 w-3" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                </motion.div>
                {s}
              </motion.div>
            </AnimatePresence>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Live chat demo ─── */
const demoMessages = [
  { name: "Juelma Vanda", course: "Eng. Informática", color: "#f97316", text: "Excelente apresentação! 🎉" },
  { name: "Samuel Pereira", course: "Eng. Telecom", color: "#3b82f6", text: "Quando sai o próximo painel?" },
  { name: "Patrícia Cayeye", course: "Gestão", color: "#10b981", text: "Muito inspirador, obrigada! 🙏" },
  { name: "Emanuel Lumengo", course: "Eng. Informática", color: "#f97316", text: "Podem partilhar os slides?" },
];
type DemoMsg = typeof demoMessages[number];
function LiveChatDemo() {
  const [msgs, setMsgs] = useState<DemoMsg[]>([demoMessages[0]]);
  const [input, setInput] = useState("");
  useEffect(() => {
    let i = 1;
    const t = setInterval(() => {
      if (i < demoMessages.length) {
        const msg = demoMessages[i];
        setMsgs(p => [...p, msg]);
        i++;
      }
    }, 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-[hsl(var(--area-web))]/8" />
      <IconPattern density={5} />
      <div className="relative z-10">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-lg font-bold">Mini-chat Ao Vivo</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 bg-destructive/10 text-destructive text-xs font-bold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" /> Em direto
          </span>
        </div>
        <div className="mb-4 max-h-52 space-y-2.5 overflow-y-auto pr-1">
          <AnimatePresence>
            {msgs.map((msg, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border/70 bg-background/80 p-3">
                <p className="text-sm font-semibold" style={{ color: msg.color }}>{msg.name}</p>
                <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium mt-0.5"
                  style={{ backgroundColor: withAlpha(msg.color, "1c"), color: msg.color }}>
                  {msg.course}
                </span>
                <p className="mt-1 text-sm text-muted-foreground">{msg.text}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escreve uma mensagem..."
            className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
          <Button className="h-11"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Demo expositor cards (design = Projetos.tsx) ─── */
const demoExpositores = [
  { id: 1, name: "Sistema de Avaliação por IA", summary: "Deteção de padrões de plágio e correção semi-automática com modelos de linguagem.", area: "IA", type: "PROJECT", members: "António Machado, Carla Silva", votes: 380, likes: 142, comments: 15, isWinner: true, canVote: true },
  { id: 2, name: "App de Gestão de Energia IoT", summary: "Monitorização em tempo real do consumo energético com sensores ESP32 e dashboard web.", area: "IoT", type: "PROJECT", members: "Juelma Vanda, Samuel Pereira", votes: 210, likes: 98, comments: 8, isWinner: false, canVote: true },
  { id: 3, name: "NegoTech Angola", summary: "Plataforma de marketplace B2B para PMEs angolanas com integração de pagamentos móveis.", area: "Negócio", type: "BUSINESS", members: "Emanuel Lumengo, Patrícia Cayeye", votes: 0, likes: 67, comments: 12, isWinner: false, canVote: false },
  { id: 4, name: "CiberShield — Segurança em Redes", summary: "Deteção de intrusão em tempo real com análise comportamental e alertas automáticos.", area: "Segurança", type: "PROJECT", members: "David Neto, Ana Campos", votes: 155, likes: 44, comments: 6, isWinner: false, canVote: true },
];

/* ─── Demo course cards (Index.tsx gradient design) ─── */
const demoCourses = [
  { id: 1, name: "Eng. Informática e Comunicações", companyName: "UOR — NEIC", companyCategory: "Tecnologia", courseColor: "#f97316", accentColor: "rgba(249,115,22,0.12)", accentColorSecondary: "rgba(249,115,22,0.05)", isPaid: false, studentCount: 3102, likesCount: 248, description: "Formação prática em redes, sistemas, programação e arquitectura de software orientada ao mercado tecnológico angolano.", preview: "Curso oficial da Universidade Óscar Ribas." },
  { id: 2, name: "Masterclass Empreendedorismo", companyName: "NEIC Business Hub", companyCategory: "Negócios", courseColor: "#8b5cf6", accentColor: "rgba(139,92,246,0.12)", accentColorSecondary: "rgba(139,92,246,0.05)", isPaid: true, studentCount: 85, likesCount: 64, description: "Como converter projectos académicos em startups viáveis. Estratégia, pitching e modelo de negócio.", preview: "Inclui sessões práticas com mentores." },
];

type ShowcaseStats = {
  participants: number;
  projects: number;
  speakers: number;
  sessions: number;
};

const EMPTY_SHOWCASE_STATS: ShowcaseStats = {
  participants: 0,
  projects: 0,
  speakers: 0,
  sessions: 0,
};

export default function SaasShowcase() {
  const [likedCourse, setLikedCourse] = useState<Set<number>>(new Set());
  const [likedExpositor, setLikedExpositor] = useState<Set<number>>(new Set());
  const [showcaseStats, setShowcaseStats] = useState<ShowcaseStats>(EMPTY_SHOWCASE_STATS);
  const primaryPortalHref = getPrimaryPortalHref("/");

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      api.stats.get(),
      api.speakers.list(),
      api.agenda.list(),
    ]).then(([statsResult, speakersResult, agendaResult]) => {
      if (!active) return;

      setShowcaseStats({
        participants: statsResult.status === "fulfilled" ? statsResult.value.participants : 0,
        projects: statsResult.status === "fulfilled" ? statsResult.value.submissions : 0,
        speakers: speakersResult.status === "fulfilled" ? speakersResult.value.length : 0,
        sessions: agendaResult.status === "fulfilled" ? agendaResult.value.length : 0,
      });
    }).catch(() => {
      if (!active) return;
      setShowcaseStats(EMPTY_SHOWCASE_STATS);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">

      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-10" />
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-xs font-bold text-foreground">UOR Connect</span>
              <span className="text-[10px] text-muted-foreground">Gestão Digital de Eventos</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <a href={primaryPortalHref} className="hidden md:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors">← Voltar ao Evento</a>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-[#20bd5a] hover:-translate-y-px transition-all">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Obter para o meu Evento</span>
              <span className="sm:hidden">Contactar</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <FloatingIcons />
        <div className="absolute top-10 right-10 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[hsl(var(--area-web))]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-3 mb-6">
              <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-12" />
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">UOR Connect · Universidade Óscar Ribas</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 animate-pulse" /> Plataforma Académica Digital · Chave-na-Mão
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl md:text-6xl lg:text-7xl font-heading font-extrabold leading-[1.03] mb-5 tracking-tight">
              Gestão de Eventos{" "}
              <motion.span className="text-primary inline-block" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                Académicos e Corporativos.
              </motion.span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl">
              Do check-in com QR Code à votação ao vivo. A UOR Connect é o motor digital completo para Feiras, Simpósios e Conferências.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-4 mb-12">
              <motion.a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-7 py-3.5 text-base font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all">
                <MessageCircle className="h-5 w-5" /> Falar com a Equipa
              </motion.a>
              <motion.a href="#features" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 rounded-xl border border-foreground/20 bg-card px-7 py-3.5 text-base font-semibold hover:bg-secondary transition-colors">
                Ver Funcionalidades <ArrowRight className="h-4 w-4" />
              </motion.a>
            </motion.div>
          </div>
          {/* Stats — cumulative historical data */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
            className="mt-4 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
            <AnimatedCounter target={showcaseStats.participants} suffix="+" label="Participantes" icon={Users} />
            <AnimatedCounter target={showcaseStats.projects} suffix="+" label="Projetos Exibidos" icon={FolderOpen} color="text-[hsl(var(--area-negocio))]" bg="bg-[hsl(var(--area-negocio))]/10" />
            <AnimatedCounter target={showcaseStats.speakers} suffix="+" label="Palestrantes" icon={Mic} color="text-[hsl(var(--area-ia))]" bg="bg-[hsl(var(--area-ia))]/10" />
            <AnimatedCounter target={showcaseStats.sessions} label="Sessões na Agenda" icon={Trophy} color="text-amber-600" bg="bg-amber-500/10" />
          </motion.div>
        </div>
      </section>

      {/* ─── O QUE O ESTUDANTE FAZ ─── */}
      <section className="scroll-mt-24 border-y border-border bg-muted/30 py-16 md:py-24" id="features">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-14">
            <SectionLabel variant="warning"><Star className="h-3 w-3" /> Para os Participantes</SectionLabel>
            <h2 className="mt-4 text-3xl md:text-5xl font-heading font-extrabold tracking-tight">A experiência que o teu estudante vive</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">Interface fluida, sem instalar app. Tudo no browser do telemóvel.</p>
          </motion.div>

          {/* Animated feature blocks */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-16">
            <AnimatedFeatureBlock icon={Vote} title="Votação em Projetos" desc="Cada participante autenticado vota uma vez por projeto."
              steps={["Faz login com o número de estudante", "Navega para a lista de projetos", "Clica em Votar no seu favorito", "Voto registado com timestamp"]}
              color="text-primary" bg="bg-primary/10" accent="border-primary/20" delay={0} />
            <AnimatedFeatureBlock icon={Send} title="Submeter Projeto" desc="Formulário guiado com categorização automática por área."
              steps={["Escolhe o tipo: Projeto / Negócio / Produto", "Preenche nome, equipa e descrição", "Seleciona a área e o stand físico", "Recebe confirmação por número"]}
              color="text-[hsl(var(--area-ia))]" bg="bg-[hsl(var(--area-ia))]/10" accent="border-[hsl(var(--area-ia))]/25" delay={0.07} />
            <AnimatedFeatureBlock icon={Play} title="Sessões Ao Vivo" desc="Acompanha e comenta em tempo real durante os painéis."
              steps={["Acede à página Ao Vivo", "Vê a sessão atual e a próxima", "Envia mensagem no mini-chat", "Moderação admin em direto"]}
              color="text-destructive" bg="bg-destructive/10" accent="border-destructive/20" delay={0.14} />
            <AnimatedFeatureBlock icon={GraduationCap} title="Cursos e Certificações" desc="Inscreve-te, entra na comunidade e recebe certificado digital."
              steps={["Explora os cursos disponíveis", "Clica em Inscrever", "Acede à comunidade exclusiva", "Certifica a tua participação"]}
              color="text-[hsl(var(--area-negocio))]" bg="bg-[hsl(var(--area-negocio))]/10" accent="border-[hsl(var(--area-negocio))]/25" delay={0.21} />
          </div>

          {/* Live chat demo */}
          <div className="grid gap-8 lg:grid-cols-2 mb-16 max-w-5xl mx-auto">
            <LiveChatDemo />
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-[hsl(var(--area-negocio))]/8" />
              <IconPattern density={5} />
              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-heading text-lg font-bold">Atividade Recente</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "Juelma Vanda", action: "votou em", subject: "Sistema de Avaliação por IA", color: "#f97316", time: "08:32" },
                    { name: "Samuel Pereira", action: "comentou em", subject: "App IoT de Energia", color: "#3b82f6", time: "08:14" },
                    { name: "Patrícia Cayeye", action: "novo projeto aprovado", subject: "Telemedicina Rural", color: "#10b981", time: "07:55" },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                      className="rounded-xl border border-border/70 bg-background/85 p-4 shadow-sm hover:border-primary/20 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold truncate" style={{ color: item.color }}>{item.name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                          <span className="h-2 w-2 rounded-full bg-primary/70" />{item.time}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-foreground/90">{item.action} <span className="font-semibold">{item.subject}</span></p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Expositor demo cards — design identical to Projetos.tsx — example data */}
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-3 mb-3">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}>
                <Award className="w-7 h-7 text-primary" />
              </motion.div>
              <h2 className="text-2xl md:text-3xl font-heading font-bold">Como ficam os Projetos e Expositores</h2>
              <span className="ml-2 text-xs rounded-full bg-primary/10 text-primary font-semibold px-3 py-1 border border-primary/20">Exemplo de demonstração</span>
            </div>
            <p className="text-muted-foreground mb-8 text-base">Cada expositor tem votação pública, likes, comentários e detalhes completos. Os expositores do tipo Negócio não têm votação.</p>
          </motion.div>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-2">
            {demoExpositores.map((project, i) => {
              const areaUi = getAreaClasses(project.area, project.type);
              return (
                <motion.div key={project.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }} whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.07, type: "spring", stiffness: 200 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className={`min-w-[300px] max-w-[340px] snap-start border rounded-2xl bg-card overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg ${areaUi.border}`}>
                  <div className={`h-1.5 ${areaUi.topBar}`} />
                  <div className="p-4 sm:p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${areaUi.badge}`}>{project.area}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MessageCircle className="h-3 w-3" /> {project.comments}</span>
                    </div>
                    <h3 className="font-heading font-semibold text-sm sm:text-base mb-1 flex items-center gap-2">
                      {project.isWinner && <Crown className="h-4 w-4 text-[hsl(var(--warning))]" />}
                      <span>{project.name}</span>
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3 flex-1 line-clamp-3">{project.summary}</p>
                    <p className="text-xs text-muted-foreground mb-4">Equipa: {project.members}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {project.likes + (likedExpositor.has(project.id) ? 1 : 0)}</span>
                      {project.canVote ? (
                        <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" /> {project.votes}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[hsl(var(--area-negocio))]"><Shield className="w-3.5 h-3.5" /> Sem votação</span>
                      )}
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {project.comments}</span>
                    </div>
                    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
                      <Button size="sm" className="h-10 rounded-xl text-xs font-semibold">Ver mais</Button>
                      <Button size="sm" variant="outline" className="h-10 rounded-xl text-xs font-semibold"
                        onClick={() => setLikedExpositor(prev => { const s = new Set(prev); s.has(project.id) ? s.delete(project.id) : s.add(project.id); return s; })}>
                        <Heart className={`mr-1.5 h-3.5 w-3.5 ${likedExpositor.has(project.id) ? "fill-current text-destructive" : ""}`} />
                        {likedExpositor.has(project.id) ? "Gostei" : "Gostar"}
                      </Button>
                      <Button size="sm" variant={project.canVote ? "outline" : "ghost"}
                        className={`h-10 rounded-xl text-xs font-semibold ${project.canVote ? "border-primary/30 text-primary hover:bg-primary/10" : "opacity-50 cursor-default"}`}
                        disabled={!project.canVote}>
                        {project.canVote ? <Trophy className="mr-1.5 h-4 w-4" /> : <Shield className="mr-1.5 h-4 w-4" />}
                        {project.canVote ? "Votar" : "Exposição"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {/* Demo courses — IDENTICAL to Index.tsx */}
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-20">
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">Cursos em Destaque</h2>
            <p className="text-muted-foreground mb-8 text-base">Cada curso tem inscrição, comunidade exclusiva e métricas de popularidade.</p>
          </motion.div>
          <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2">
            {demoCourses.map((course, i) => (
              <motion.div key={course.id} initial={{ opacity: 0, scale: 0.9, y: 20 }} whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07, type: "spring", stiffness: 200 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="min-w-[300px] max-w-[360px] snap-start">
                <article className="relative h-full overflow-hidden rounded-2xl border bg-card p-5 md:p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
                  style={{ borderColor: `${course.courseColor}44`, background: `linear-gradient(140deg, ${course.accentColor}, ${course.accentColorSecondary})` }}>
                  <IconPattern density={6} />
                  <div className="relative z-10">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-white/60">
                          <BookOpen className="h-6 w-6" style={{ color: course.courseColor }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: course.courseColor }}>
                            {course.isPaid ? course.priceLabel : "Gratuito"}
                          </p>
                          <h3 className="font-heading text-lg font-bold leading-tight md:text-[1.25rem]">{course.name}</h3>
                          <p className="mt-1 truncate text-sm font-medium text-foreground/80">{course.companyName}</p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold shadow-sm" style={{ color: course.courseColor }}>
                        <Heart className="h-3.5 w-3.5 fill-current" />{course.likesCount + (likedCourse.has(course.id) ? 1 : 0)}
                      </span>
                    </div>
                    <p className="mb-4 text-[15px] leading-6 text-foreground/85">{course.description}</p>
                    <p className="mb-4 text-sm leading-6 text-muted-foreground line-clamp-2">{course.preview}</p>
                    <div className="mb-4 rounded-xl border border-white/60 bg-white/72 p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: withAlpha(course.courseColor, "22") }}>
                          <Building2 className="h-4 w-4" style={{ color: course.courseColor }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{course.companyName}</p>
                          <p className="text-xs font-medium text-muted-foreground">{course.companyCategory}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mb-4 text-sm font-semibold" style={{ color: course.courseColor }}>{course.studentCount} inscritos</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button size="sm" className="h-auto min-h-10 w-full rounded-xl px-3 py-2 text-sm font-semibold shadow-sm">Inscrever</Button>
                      <Button size="sm" variant="outline" className="h-auto min-h-10 w-full rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold" disabled>
                        <Lock className="mr-1.5 h-3.5 w-3.5" /> Comunidade
                      </Button>
                      <Button size="sm" variant={likedCourse.has(course.id) ? "default" : "outline"}
                        className="h-auto min-h-10 rounded-xl px-3 py-2 text-sm font-semibold sm:col-span-2"
                        onClick={() => setLikedCourse(prev => { const s = new Set(prev); s.has(course.id) ? s.delete(course.id) : s.add(course.id); return s; })}>
                        <Heart className="mr-1.5 h-4 w-4" />{likedCourse.has(course.id) ? "Curtido" : "Curtir"}
                      </Button>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" /> A comunidade abre depois da inscrição.
                    </p>
                  </div>
                </article>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── O QUE O ADMIN CONTROLA ─── */}
      <section className="py-16 md:py-28 bg-card border-y border-border/50 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-[hsl(var(--area-negocio))] to-primary" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mb-16">
            <SectionLabel variant="blue"><ShieldCheck className="h-3 w-3" /> Exclusivo Organização</SectionLabel>
            <h2 className="mt-4 text-4xl md:text-5xl font-heading font-extrabold tracking-tight mb-6">
              Controlo Total, <span className="text-primary">Sem Código.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              O Painel de Administração é a cabine de pilotagem do teu evento. Tudo acessível do telemóvel, em tempo real.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <AnimatedFeatureBlock icon={FolderOpen} title="Gestão de Candidaturas" desc="Aprova, recusa ou contacta expositores via WhatsApp com um clique."
              steps={["Recebes candidatura de expositor", "Vês observações e preço estimado", "Aprova ou Recusa na ficha", "Contacto automático via WhatsApp"]}
              color="text-[hsl(var(--area-negocio))]" bg="bg-[hsl(var(--area-negocio))]/10" accent="border-[hsl(var(--area-negocio))]/25" delay={0} />
            <AnimatedFeatureBlock icon={Settings} title="Identidade dos Expositores" desc="Personaliza cores, banner e visual de cada expositor público."
              steps={["Abre a ficha do expositor", "Define cor principal e secundária", "Carrega foto/banner opcional", "Card público atualiza em tempo real"]}
              color="text-primary" bg="bg-primary/10" accent="border-primary/20" delay={0.07} />
            <AnimatedFeatureBlock icon={BarChart3} title="Analytics em Tempo Real" desc="Funil de conversão, top páginas e logística de campanhas."
              steps={["Visitou → Viu ticket → Fez login", "Inscreveu-se → Baixou PDF", "Top páginas por tráfego", "Logística: Sinal de ocupação"]}
              color="text-[hsl(var(--area-ia))]" bg="bg-[hsl(var(--area-ia))]/10" accent="border-[hsl(var(--area-ia))]/25" delay={0.14} />
            <AnimatedFeatureBlock icon={MessageCircle} title="Moderação Ao Vivo" desc="Controla o chat público durante sessões em direto."
              steps={["Lê todas as mensagens do chat", "Elimina comentários inadequados", "Filtra por estudante ou projeto", "Mini-chat moderado em segundos"]}
              color="text-destructive" bg="bg-destructive/10" accent="border-destructive/20" delay={0.21} />
            <AnimatedFeatureBlock icon={Users} title="Gestão de Estudantes" desc="Lista completa agrupada por curso com ações rápidas."
              steps={["Pesquisa por nome, número ou curso", "Agrupa por interações", "Vê likes, votos e comentários", "Remove estudante da plataforma"]}
              color="text-[hsl(var(--area-engenharia))]" bg="bg-[hsl(var(--area-engenharia))]/10" accent="border-[hsl(var(--area-engenharia))]/25" delay={0.28} />
            <AnimatedFeatureBlock icon={Crown} title="Vencedores e Auditoria" desc="Validação de campeões com auditoria antifraude completa."
              steps={["Votos contados automaticamente", "Cada voto tem timestamp + identidade", "Validas o vencedor com um toque", "Resultado exibido no evento"]}
              color="text-amber-600" bg="bg-amber-500/10" accent="border-amber-500/20" delay={0.35} />
          </div>

          {/* PDF Reports block */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-5 relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-card p-6 md:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-primary/5" />
            <IconPattern density={6} />
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                    <FileText className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-heading font-bold text-xl">Relatórios e Tickets em PDF</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  O sistema gera automaticamente PDFs para cada inscrição, submissão e confirmação. O participante descarrega o seu talão pessoal; o gestor exporta relatórios completos do evento.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Talão de submissão", "Recibo de inscrição", "Relatório admin", "Comprovativo de candidatura"].map(tag => (
                    <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { icon: Ticket, label: "Talão de Embarque", desc: "Gerado após submeter projeto/candidatura — descarrega em PDF", color: "text-primary", bg: "bg-primary/10" },
                  { icon: GraduationCap, label: "Recibo de Inscrição", desc: "Comprovativo de inscrição em curso com dados e estado de pagamento", color: "text-emerald-600", bg: "bg-emerald-500/10" },
                  { icon: FileText, label: "Relatório Admin", desc: "Exportação completa dos dados do evento para análise pós-evento", color: "text-[hsl(var(--area-ia))]", bg: "bg-[hsl(var(--area-ia))]/10" },
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/85 px-4 py-3.5 shadow-sm">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
                      <item.icon className={`h-4 w-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Security block */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-10 relative overflow-hidden rounded-2xl border border-[hsl(var(--area-ia))]/30 bg-card p-6 md:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--area-ia))]/5 via-transparent to-primary/5" />
            <IconPattern density={8} />
            <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--area-ia))]/10">
                    <ShieldCheck className="h-6 w-6 text-[hsl(var(--area-ia))]" />
                  </div>
                  <h3 className="font-heading font-bold text-xl">Controlo de Acessos</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">Autoriza números de estudante individualmente. O sistema bloqueia automaticamente qualquer utilizador não autorizado antes de entrar.</p>
                <div className="flex flex-wrap gap-2">
                  {["Autorizar número", "Remover acesso", "Histórico de logins", "WhatsApp direto"].map(tag => (
                    <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-[hsl(var(--area-ia))]/10 text-[hsl(var(--area-ia))] border border-[hsl(var(--area-ia))]/20">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {["20242099 — Autorizado em 23/03/2026", "20240066 — Autorizado em 23/03/2026", "20240660 — Autorizado em 24/03/2026", "20230259 — Autorizado em 24/03/2026"].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm">
                    <span className="text-sm font-mono font-medium">{item}</span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors">Remover</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-16 md:py-24 relative overflow-hidden bg-primary/5 border-t border-primary/15">
        <div className="absolute inset-0 pointer-events-none">
          {patternIcons.slice(0, 6).map((Icon, i) => (
            <Icon key={i} className="absolute text-primary/[0.04]" style={{
              width: `${32 + (i % 3) * 14}px`, height: `${32 + (i % 3) * 14}px`,
              top: `${15 + (i * 29) % 70}%`, left: `${10 + (i * 37) % 80}%`,
              transform: `rotate(${i * 43}deg)`,
            }} />
          ))}
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="max-w-2xl mx-auto space-y-8">
            <div className="flex justify-center"><img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-14" /></div>
            <h2 className="text-3xl md:text-5xl font-heading font-extrabold tracking-tight">Leva a UOR Connect ao teu evento.</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Entra em contacto via WhatsApp. A equipa avalia o teu projeto e dá-te uma proposta personalizada em menos de 48h.
            </p>
            <motion.a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 rounded-full bg-[#25D366] px-10 py-4 text-base font-bold text-white shadow-xl hover:shadow-[#25D366]/40 transition-all">
              <MessageCircle className="h-5 w-5" /> Obter Plataforma via WhatsApp <ExternalLink className="h-4 w-4 opacity-70" />
            </motion.a>
            <p className="text-xs text-muted-foreground">© 2026 UOR Connect — Universidade Óscar Ribas</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
