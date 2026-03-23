import { motion } from "framer-motion";
import logoUor from "@/assets/logo-uor.png";
import logoNeic from "@/assets/logo-neic.jpeg";

export default function Sobre() {
  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-1">Sobre</h1>
          <p className="text-muted-foreground text-sm mb-10">Organizado pelo NEIC da Universidade Óscar Ribas.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="border border-border rounded-xl bg-card p-6 md:p-8 space-y-6">
          <div>
            <h2 className="font-heading font-bold text-lg mb-2">3ª edição da Feira do Dia das Telecomunicações</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Evento académico em celebração do Dia Mundial das Telecomunicações e da Sociedade da Informação. 
              Dois dias de painéis, workshops, exposições e apresentação de projetos que reúnem estudantes, professores e profissionais.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="font-heading font-bold text-lg mb-2">Missão</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Conectar conhecimento académico ao mercado de trabalho, incentivando inovação e empreendedorismo 
              entre estudantes da Universidade Óscar Ribas.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="font-heading font-bold text-lg mb-3">Organizadores</h2>
            <div className="flex items-center justify-center gap-12 py-4">
              <div className="text-center">
                <img src={logoUor} alt="UOR" className="h-12 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-medium">Universidade Óscar Ribas</p>
              </div>
              <div className="text-center">
                <img src={logoNeic} alt="NEIC" className="h-12 mx-auto mb-2 rounded-lg" />
                <p className="text-xs text-muted-foreground font-medium">NEIC</p>
              </div>
              <div className="text-center">
                <img src="/logo.svg" alt="UOR Connect" className="h-12 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-medium">UOR Connect</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
