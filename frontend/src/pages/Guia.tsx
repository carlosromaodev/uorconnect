import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BookOpen, UserCheck, Handshake, Presentation, CalendarDays,
  ArrowRight, CheckCircle, Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type GuideStep, type GuideTip } from "@/lib/api";

const patternIcons = [Wifi, Radio, Globe, Smartphone, Cpu, Monitor, Signal, Zap, MessageSquare, Lightbulb];

const iconMap = {
  UserCheck,
  CalendarDays,
  Presentation,
  Handshake,
  BookOpen
} as const;

export default function Guia() {
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [tips, setTips] = useState<GuideTip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.guide.content()
      .then((content) => {
        setSteps(content.steps);
        setTips(content.tips);
      })
      .catch(() => {
        setSteps([]);
        setTips([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen py-12 md:py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-1">Guia do Participante</h1>
          <p className="text-muted-foreground text-sm mb-10">Tudo o que precisas saber para aproveitar ao máximo o evento.</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
        <>
        <div className="grid sm:grid-cols-2 gap-5 mb-12">
          {steps.map((step, i) => {
            const StepIcon = iconMap[step.icon as keyof typeof iconMap] ?? BookOpen;
            return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="relative border border-border rounded-xl bg-card p-6 hover:shadow-md hover:border-primary/20 transition-all duration-300 group overflow-hidden"
            >
              {/* Pattern */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {patternIcons.slice(0, 4).map((Icon, j) => (
                  <Icon
                    key={j}
                    className="absolute text-primary/[0.03] group-hover:text-primary/[0.06] transition-colors duration-500"
                    style={{
                      width: `${16 + ((i + j) % 3) * 6}px`,
                      height: `${16 + ((i + j) % 3) * 6}px`,
                      top: `${15 + ((j * 29) % 60)}%`,
                      left: `${60 + ((j * 23) % 35)}%`,
                      transform: `rotate(${(i + j) * 43}deg)`,
                    }}
                  />
                ))}
              </div>

              <div className="relative z-10">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-base mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                {step.link && (
                  <Button asChild variant="ghost" size="sm" className="mt-3 text-primary font-semibold px-0 hover:bg-transparent hover:text-primary/80">
                    <Link to={step.link}>
                      {step.linkText || "Saber mais"}
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            </motion.div>
          )})}
        </div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-border rounded-xl bg-card p-6 md:p-8"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5 text-primary" />
            </div>
            <h2 className="font-heading font-bold text-lg">Dicas Úteis</h2>
          </div>
          <ul className="space-y-3">
            {tips.map((tip) => (
              <li key={tip.id} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                {tip.content}
              </li>
            ))}
          </ul>
        </motion.div>
        </>
        )}
      </div>
    </div>
  );
}
