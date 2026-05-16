import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Radio, MapPin, Clock, Users, ChevronRight, Wifi, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { api, type AgendaItem, type AgendaLiveState, type Venue } from "@/lib/api";

const patternIcons = [Wifi, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb];

type Activity = AgendaItem;

const typeColors: Record<string, string> = {
  PANEL: "bg-primary/10 text-primary",
  WORKSHOP: "bg-accent/10 text-accent",
  PRESENTATION: "bg-secondary text-secondary-foreground",
  BREAK: "bg-muted text-muted-foreground",
  CEREMONY: "bg-primary text-primary-foreground",
};

export default function EventoAoVivo() {
  const [schedule, setSchedule] = useState<AgendaItem[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [liveState, setLiveState] = useState<AgendaLiveState>({ current: null, next: null, mode: "AGENDA", source: "agenda" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLiveSnapshot = (keepCurrentGuide = false) => {
      Promise.all([api.agenda.list(), api.agenda.live(), keepCurrentGuide ? Promise.resolve(null) : api.guide.content()])
        .then(([agenda, live, guide]) => {
          setSchedule(agenda);
          setLiveState(live);
          if (guide) {
            setVenues(guide.venues);
          }
        })
        .catch(() => {
          setSchedule([]);
          setLiveState({ current: null, next: null, mode: "AGENDA", source: "agenda" });
          if (!keepCurrentGuide) {
            setVenues([]);
          }
        })
        .finally(() => setLoading(false));
    };

    loadLiveSnapshot();
    const interval = window.setInterval(() => loadLiveSnapshot(true), 30000);

    return () => window.clearInterval(interval);
  }, []);

  const sortedActivities = [...schedule].sort((a, b) => new Date(`${a.date.slice(0, 10)}T${a.startTime}:00`).getTime() - new Date(`${b.date.slice(0, 10)}T${b.startTime}:00`).getTime());
  const current = liveState.current;
  const next = liveState.next;

  const groupedSchedule = sortedActivities.reduce<Record<string, { day: string; date: string; activities: AgendaItem[] }>>((acc, item) => {
    if (!acc[item.day]) {
      acc[item.day] = { day: item.day, date: item.date, activities: [] };
    }
    acc[item.day].activities.push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold">Evento Ao Vivo</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-8">Guia em tempo real — acompanha todas as atividades do evento.</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
        <>
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {/* AGORA */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="border-2 border-primary/30 rounded-xl bg-primary/5 p-5 relative overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {patternIcons.slice(0, 3).map((Icon, j) => (
                <Icon key={j} className="absolute text-primary/[0.04]" style={{ width: 20 + j * 4, height: 20 + j * 4, top: `${20 + j * 25}%`, right: `${5 + j * 10}%`, transform: `rotate(${j * 35}deg)` }} />
              ))}
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <Radio className="w-3 h-3" /> AGORA
                </span>
                <span className="bg-muted text-muted-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                  {liveState.source === "admin" ? "Conteúdo admin" : "Agenda"}
                </span>
                {current && (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${typeColors[current.type] || ""}`}>
                      {current.type}
                    </span>
                  )}
                </div>
              {current ? (
                <>
                  <h3 className="font-heading font-bold text-lg mb-1">{current.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{current.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-primary" />{current.startTime} — {current.endTime}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{current.local}</span>
                    {current.speaker && <span className="flex items-center gap-1"><Users className="w-3 h-3 text-primary" />{current.speaker}</span>}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-primary/15 bg-white/70 p-4 text-sm text-muted-foreground">
                  Nenhuma sessão está marcada como ativa neste momento. Consulta o programa completo para veres o próximo ponto da agenda.
                </div>
              )}
            </div>
          </motion.div>

          {/* PRÓXIMO */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-border rounded-xl bg-card p-5 relative overflow-hidden"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {patternIcons.slice(3, 6).map((Icon, j) => (
                <Icon key={j} className="absolute text-primary/[0.03]" style={{ width: 18 + j * 3, height: 18 + j * 3, top: `${15 + j * 28}%`, right: `${8 + j * 12}%`, transform: `rotate(${j * 45}deg)` }} />
              ))}
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-muted text-muted-foreground text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3" /> PRÓXIMO
                </span>
                {next && (
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${typeColors[next.type] || ""}`}>
                    {next.type}
                  </span>
                )}
              </div>
              {next ? (
                <>
                  <h3 className="font-heading font-bold text-lg mb-1">{next.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{next.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-primary" />{next.startTime} — {next.endTime}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-primary" />{next.local}</span>
                    {next.speaker && <span className="flex items-center gap-1"><Users className="w-3 h-3 text-primary" />{next.speaker}</span>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma atividade seguinte programada.</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Full schedule timeline */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-10">
          <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Programa Completo
          </h2>

          {Object.values(groupedSchedule).length ? Object.values(groupedSchedule).map((day) => (
            <div key={day.day} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-heading font-bold">{day.day}</span>
                <span className="text-xs text-muted-foreground">{day.date}</span>
              </div>

              <div className="space-y-2">
                {day.activities.map((a, i) => {
                  const isCurrent = current?.id === a.id;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-4 rounded-xl p-3.5 transition-colors ${
                        isCurrent ? "border-2 border-primary/30 bg-primary/5" : "border border-border bg-card hover:border-primary/10"
                      }`}
                    >
                      {isCurrent && <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />}
                      <span className="text-xs font-mono font-semibold text-primary w-20 shrink-0">{a.startTime} — {a.endTime}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-sm truncate">{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.local}</span>
                          {a.speaker && <span>• {a.speaker}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 hidden sm:block ${typeColors[a.type] || ""}`}>
                        {a.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              A programação oficial ainda não foi publicada.
            </div>
          )}
        </motion.div>

        {/* Venue map */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-lg font-heading font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Locais do Evento
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {venues.map((v, i) => (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="border border-border rounded-xl bg-card p-4 hover:border-primary/20 transition-colors group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <MapPin className="w-4.5 h-4.5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-sm mb-0.5">{v.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{v.description}</p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{v.capacity}</span>
                  <span>• {v.floor}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="text-center mt-10">
          <Button asChild variant="outline" className="font-semibold rounded-lg">
            <Link to="/agenda">
              <CalendarDays className="w-4 h-4 mr-1.5" />
              Ver Agenda Completa
            </Link>
          </Button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
