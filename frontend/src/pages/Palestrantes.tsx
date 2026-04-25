import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Linkedin, Presentation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/social/UserAvatar";
import { ShareButtons } from "@/components/social/ShareButtons";
import { api, type Speaker } from "@/lib/api";

export default function Palestrantes() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.speakers.list()
      .then(setSpeakers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-1">Palestrantes</h1>
          <p className="text-muted-foreground text-sm mb-10">Conheça os profissionais que vão partilhar conhecimento e experiência.</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {speakers.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 24 } }}
              className="relative overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg hover:border-primary/20 group"
            >
              <div className="h-0.5 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />

              <div className="relative z-10 p-6 flex flex-col sm:flex-row gap-5">
                {/* Avatar */}
                <div className="shrink-0 mx-auto sm:mx-0">
                  <UserAvatar
                    name={s.name}
                    avatarUrl={(s as Record<string, unknown>).avatarUrl as string | undefined}
                    size="lg"
                    className="h-16 w-16 text-lg"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="font-heading font-bold text-lg">{s.name}</h2>
                  <p className="text-xs text-primary font-semibold mt-0.5">{s.specialty}</p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{s.bio}</p>

                  <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Presentation className="w-3.5 h-3.5 text-primary" />
                      {s.talk}
                    </span>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground">{s.day}</span>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    {s.linkedin && s.linkedin !== "#" && (
                      <Button variant="outline" size="sm" className="rounded-lg text-xs h-8" asChild>
                        <a href={s.linkedin} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="w-3.5 h-3.5 mr-1" />
                          LinkedIn
                        </a>
                      </Button>
                    )}
                    <ShareButtons
                      url="/palestrantes"
                      title={`${s.name} — ${s.specialty}`}
                      description={s.talk}
                      compact
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
