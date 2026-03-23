import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Linkedin, Presentation, Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Speaker } from "@/lib/api";

const patternIcons = [Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb];

const speakers = [
  {
    name: "Dr. Manuel Santos",
    bio: "Doutorado em Engenharia de Telecomunicações pela Universidade de Lisboa. Mais de 15 anos de experiência no setor de telecomunicações em Angola, com foco em infraestrutura de rede e regulamentação.",
    specialty: "Telecomunicações & Infraestrutura",
    talk: "Inovação nas Telecomunicações em Angola",
    day: "Dia 1 — 09:30",
    linkedin: "#",
  },
  {
    name: "Eng. Ana Ferreira",
    bio: "Engenheira de redes com especialização em tecnologias 5G e IoT. Trabalha com implementação de soluções de conectividade para empresas e governo em mercados emergentes.",
    specialty: "5G & Internet das Coisas",
    talk: "Workshop: Introdução ao 5G e IoT",
    day: "Dia 1 — 11:00",
    linkedin: "#",
  },
  {
    name: "Dra. Carla Mendes",
    bio: "Consultora de marca pessoal e comunicação digital. Ajuda profissionais e estudantes a construírem presença online autêntica e posicionamento estratégico no mercado de trabalho.",
    specialty: "Marca Pessoal & Comunicação",
    talk: "Marca Pessoal na Era Digital",
    day: "Dia 2 — 09:00",
    linkedin: "#",
  },
  {
    name: "Eng. Pedro Lopes",
    bio: "Full-stack developer e mentor de carreira tecnológica. Defensor do open source e da partilha de conhecimento, com experiência em programas de mentoria para jovens desenvolvedores.",
    specialty: "Desenvolvimento & Mentoria",
    talk: "Workshop: GitHub, LinkedIn e Portfólio",
    day: "Dia 2 — 10:30",
    linkedin: "#",
  },
];

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
      <div className="container mx-auto px-4">
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
              className="relative border border-border rounded-xl bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all duration-300 group"
            >
              {/* Pattern */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {patternIcons.slice(0, 5).map((Icon, j) => (
                  <Icon
                    key={j}
                    className="absolute text-primary/[0.03] group-hover:text-primary/[0.06] transition-colors duration-500"
                    style={{
                      width: `${18 + ((i + j) % 3) * 7}px`,
                      height: `${18 + ((i + j) % 3) * 7}px`,
                      top: `${10 + ((j * 27 + i * 19) % 70)}%`,
                      left: `${55 + ((j * 31) % 40)}%`,
                      transform: `rotate(${(i + j) * 39}deg)`,
                    }}
                  />
                ))}
              </div>

              <div className="h-1 bg-primary" />

              <div className="relative z-10 p-6 flex flex-col sm:flex-row gap-5">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                  <User className="w-10 h-10 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="font-heading font-bold text-lg">{s.name}</h2>
                  <p className="text-xs text-primary font-semibold mt-0.5">{s.specialty}</p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{s.bio}</p>

                  <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Presentation className="w-3.5 h-3.5 text-primary" />
                      {s.talk}
                    </span>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground">{s.day}</span>
                  </div>

                  <div className="mt-3">
                    <Button variant="outline" size="sm" className="rounded-full text-xs h-8" asChild>
                      <a href={s.linkedin || "#"} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="w-3.5 h-3.5 mr-1" />
                        LinkedIn
                      </a>
                    </Button>
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
