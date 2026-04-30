import { motion } from "framer-motion";
import { Calendar, FolderOpen, Users, GraduationCap, Target, Lightbulb, Handshake, MapPin, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import logoNeic from "@/assets/logo-neic.jpeg";
import { UOR_EVENT_LEMA, UOR_EVENT_TITLE_HIGHLIGHT, UOR_EVENT_TITLE_PREFIX } from "@/lib/home-content";

const stats = [
  { label: "Edição", value: "3.ª", icon: Calendar },
  { label: "Projetos", value: "50+", icon: FolderOpen },
  { label: "Participantes", value: "300+", icon: Users },
  { label: "Cursos", value: "10+", icon: GraduationCap },
];

const values = [
  { title: "Inovação", description: "Incentivar soluções tecnológicas criativas que resolvam problemas reais da sociedade angolana.", icon: Lightbulb },
  { title: "Empreendedorismo", description: "Conectar o conhecimento académico ao mercado de trabalho, preparando os estudantes para criar valor.", icon: Target },
  { title: "Comunidade", description: "Reunir estudantes, professores e profissionais numa rede de partilha de conhecimento e oportunidades.", icon: Handshake },
];

export default function Sobre() {
  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
            Sobre o evento
          </div>
          <h1 className="mx-auto mb-4 max-w-4xl font-heading text-3xl font-bold leading-tight md:text-5xl">
            {UOR_EVENT_TITLE_PREFIX} {UOR_EVENT_TITLE_HIGHLIGHT}
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground leading-relaxed">
            {UOR_EVENT_LEMA}. Evento académico em celebração do Dia Mundial das Telecomunicações e da Sociedade da Informação.
            Dois dias de painéis, workshops, exposições e apresentação de projetos que reúnem estudantes, professores e profissionais.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[16px] border border-border/60 bg-white/94 p-5 text-center shadow-sm">
              <stat.icon className="mx-auto h-6 w-6 text-primary/70 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <div className="section-divider mb-14" />

        {/* Missão */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <h2 className="font-heading text-2xl font-bold mb-3">Missão</h2>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            Conectar o conhecimento académico ao mercado de trabalho, incentivando inovação e empreendedorismo
            entre estudantes da Universidade Óscar Ribas. A UOR Connect é mais do que um evento — é uma plataforma
            que cria pontes entre a academia e a indústria tecnológica angolana.
          </p>
        </motion.div>

        {/* Valores */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <h2 className="font-heading text-2xl font-bold mb-6">Os nossos valores</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {values.map((v) => (
              <div key={v.title} className="rounded-[16px] border border-border/60 bg-white/94 p-6 shadow-sm">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading font-bold mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="section-divider mb-14" />

        {/* Organizadores */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <h2 className="font-heading text-2xl font-bold mb-6">Organização</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-6">
            <div className="text-center">
              <img src={logoNeic} alt="NEIC" className="h-16 mx-auto mb-3 rounded-xl" />
              <p className="font-semibold text-sm">NEIC</p>
              <p className="text-xs text-muted-foreground">Núcleo de Eng. Informática e Comunicações</p>
            </div>
            <div className="hidden sm:block h-16 w-px bg-border" />
            <div className="text-center">
              <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-16 mx-auto mb-3" />
              <p className="font-semibold text-sm">UOR Connect</p>
              <p className="text-xs text-muted-foreground">Plataforma Académica Digital</p>
            </div>
          </div>
        </motion.div>

        {/* Contacto */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-[18px] border border-border/60 bg-white/94 p-6 md:p-8 shadow-sm"
        >
          <h2 className="font-heading text-xl font-bold mb-4">Contacto</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary/70 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Universidade Óscar Ribas</p>
                <p className="text-sm text-muted-foreground">Luanda, Angola</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary/70 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <a href="mailto:neic@uor.ao" className="text-sm text-primary hover:underline">neic@uor.ao</a>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Tem perguntas? Consulte o nosso{" "}
              <Link to="/faq" className="text-primary font-medium hover:underline">FAQ</Link>
              {" "}ou o{" "}
              <Link to="/guia" className="text-primary font-medium hover:underline">Guia do Participante</Link>.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
