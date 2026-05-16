import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MapPin, User, Filter, CalendarDays, Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type AgendaItem } from "@/lib/api";

const patternIcons = [Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb];

type Session = {
  id: number;
  day: string;
  date: string;
  time: string;
  title: string;
  local: string;
  speaker: string;
  desc: string;
  type: "Painel" | "Workshop" | "Apresentação" | "Intervalo" | "Cerimónia";
  theme: string;
};

const sessionTypes = ["Todos", "Painel", "Workshop", "Apresentação", "Intervalo", "Cerimónia"];

const typeColors: Record<string, string> = {
  Painel: "bg-primary/10 text-primary border-primary/20",
  Workshop: "bg-accent text-accent-foreground border-accent",
  Apresentação: "bg-secondary text-secondary-foreground border-secondary",
  Intervalo: "bg-muted text-muted-foreground border-muted",
  Cerimónia: "bg-primary text-primary-foreground border-primary",
};

const dayThemes: Record<string, string> = {
  DAY1: "Marca pessoal, formações práticas e visita aos stands",
  DAY2: "Transformação de projetos académicos em oportunidades reais",
};

const dayLabels: Record<string, string> = {
  DAY1: "Dia 1",
  DAY2: "Dia 2",
};

const typeLabels: Record<string, Session["type"]> = {
  PANEL: "Painel",
  WORKSHOP: "Workshop",
  PRESENTATION: "Apresentação",
  BREAK: "Intervalo",
  CEREMONY: "Cerimónia",
};

function formatAgendaDateLabel(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
  })
    .format(parsedDate)
    .replace(".", "");
}

function formatDayLabel(day: string) {
  return dayLabels[day] ?? day;
}

function getDaySortValue(day: string) {
  if (day === "DAY1") return 1;
  if (day === "DAY2") return 2;
  return 99;
}

export default function Agenda() {
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [activeType, setActiveType] = useState("Todos");
  const [activeTheme, setActiveTheme] = useState("Todos");
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agenda.list()
      .then(setAgendaItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const sessions: Session[] = useMemo(() => agendaItems.map((item) => ({
    id: item.id,
    day: item.day,
    date: item.date,
    time: item.endTime ? `${item.startTime} — ${item.endTime}` : item.startTime ?? "",
    title: item.title,
    local: item.local,
    speaker: item.speaker,
    desc: item.description,
    type: typeLabels[item.type] ?? "Apresentação",
    theme: item.theme,
  })), [agendaItems]);

  const themes = useMemo(() => {
    const uniqueThemes = Array.from(new Set(sessions.map((session) => session.theme).filter(Boolean)));
    return ["Todos", ...uniqueThemes];
  }, [sessions]);

  const days = useMemo(() => {
    const grouped = new Map<string, {
      day: string;
      dayKey: string;
      date: string;
      dayTheme: string;
      events: Session[];
    }>();

    for (const session of sessions) {
      const key = session.day || session.date;
      const existing = grouped.get(key);

      if (existing) {
        existing.events.push(session);
        continue;
      }

      grouped.set(key, {
        day: formatDayLabel(session.day),
        dayKey: session.day,
        date: formatAgendaDateLabel(session.date),
        dayTheme: dayThemes[session.day] ?? "Programação oficial do evento",
        events: [session],
      });
    }

    return Array.from(grouped.values())
      .sort((left, right) => {
        const dayDiff = getDaySortValue(left.dayKey) - getDaySortValue(right.dayKey);
        if (dayDiff !== 0) return dayDiff;
        return left.date.localeCompare(right.date);
      })
      .map((day) => ({
        ...day,
        events: [...day.events].sort((left, right) => left.time.localeCompare(right.time)),
      }));
  }, [sessions]);

  const filteredDays = days
    .map((day, i) => {
      if (activeDay !== null && activeDay !== i) return null;
      const filtered = day.events.filter((ev) => {
        if (activeType !== "Todos" && ev.type !== activeType) return false;
        if (activeTheme !== "Todos" && ev.theme !== activeTheme) return false;
        return true;
      });
      if (filtered.length === 0) return null;
      return { ...day, events: filtered };
    })
    .filter(Boolean);

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-1">Agenda</h1>
          <p className="text-muted-foreground text-sm mb-8">Programação completa dos dois dias do evento.</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="border border-border rounded-xl bg-card p-4 md:p-5 mb-8 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-heading font-semibold text-muted-foreground">
                <Filter className="w-4 h-4" />
                Filtros
              </div>

              {/* Day filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Dia</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={activeDay === null ? "default" : "outline"}
                    className="rounded-full text-xs h-8"
                    onClick={() => setActiveDay(null)}
                  >
                    Todos
                  </Button>
                  {days.map((d, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={activeDay === i ? "default" : "outline"}
                      className="rounded-full text-xs h-8"
                      onClick={() => setActiveDay(activeDay === i ? null : i)}
                    >
                      <CalendarDays className="w-3 h-3 mr-1" />
                      {d.day} — {d.date}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Type filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Tipo de Sessão</p>
                <div className="flex flex-wrap gap-2">
                  {sessionTypes.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={activeType === t ? "default" : "outline"}
                      className="rounded-full text-xs h-8"
                      onClick={() => setActiveType(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Theme filter */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Tema</p>
                <div className="flex flex-wrap gap-2">
                  {themes.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={activeTheme === t ? "default" : "outline"}
                      className="rounded-full text-xs h-8"
                      onClick={() => setActiveTheme(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Timeline */}
            <div className="space-y-8">
              <AnimatePresence mode="wait">
                {filteredDays.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-16 text-muted-foreground text-sm"
                  >
                    Nenhuma sessão encontrada com os filtros selecionados.
                  </motion.div>
                )}

                {filteredDays.map((day) =>
                  day ? (
                    <motion.div
                      key={day.day}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="relative"
                    >
                      {/* Day header */}
                      <div className="flex items-center gap-3 mb-5">
                        <div className="bg-primary text-primary-foreground px-4 py-2 rounded-xl">
                          <span className="font-heading font-bold text-sm">{day.day}</span>
                          <span className="text-primary-foreground/70 text-xs ml-2">{day.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium hidden md:block">{day.dayTheme}</p>
                      </div>

                      {/* Timeline line */}
                      <div className="relative pl-6 md:pl-8 border-l-2 border-primary/20 space-y-4">
                        {day.events.map((ev, i) => (
                          <motion.div
                            key={ev.id}
                            initial={{ opacity: 0, x: -8 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                            className="relative group"
                          >
                            {/* Timeline dot */}
                            <div className="absolute -left-[calc(1.5rem+5px)] md:-left-[calc(2rem+5px)] top-5 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                            <div className="border border-border rounded-xl bg-card p-5 hover:shadow-md hover:border-primary/20 transition-all duration-300 overflow-hidden relative">
                              {/* Pattern bg */}
                              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {patternIcons.slice(0, 4).map((Icon, j) => (
                                  <Icon
                                    key={j}
                                    className="absolute text-primary/[0.03] group-hover:text-primary/[0.06] transition-colors duration-500"
                                    style={{
                                      width: `${16 + ((i + j) % 3) * 6}px`,
                                      height: `${16 + ((i + j) % 3) * 6}px`,
                                      top: `${10 + ((j * 31 + i * 17) % 70)}%`,
                                      left: `${60 + ((j * 23) % 35)}%`,
                                      transform: `rotate(${(i + j) * 47}deg)`,
                                    }}
                                  />
                                ))}
                              </div>

                              <div className="relative z-10">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                                    {ev.time}
                                  </span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${typeColors[ev.type] || ""}`}>
                                    {ev.type}
                                  </span>
                                </div>
                                <h3 className="font-heading font-bold text-sm mb-1">{ev.title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{ev.desc}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{ev.local}</span>
                                  {ev.speaker && <span className="flex items-center gap-1"><User className="w-3 h-3 text-primary" />{ev.speaker}</span>}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : null
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
