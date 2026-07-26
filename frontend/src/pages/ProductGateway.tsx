import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Landmark,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProductKey = "student" | "events" | "direction";

type ProductGatewayProps = {
  product: ProductKey;
};

const productConfig = {
  student: {
    eyebrow: "UOR Connect Estudante",
    title: "Vida académica individual, sem ruído de eventos ou direção.",
    description:
      "Base da experiência do estudante para reunir aprendizagem, vida académica, finanças, serviços e percurso num contexto próprio.",
    icon: GraduationCap,
    accent: "from-blue-600 to-cyan-500",
    primaryAction: { label: "Entrar na Minha Área", to: "/minha-area" },
    sections: [
      { title: "Hoje", description: "Prioridades, prazos e alertas académicos.", icon: Sparkles },
      { title: "Aprendizagem", description: "Integração pedagógica com Moodle.", icon: BookOpen },
      { title: "Finanças", description: "Dados oficiais vindos da Secretaria.", icon: WalletCards },
      { title: "Agenda", description: "Calendário académico e compromissos.", icon: CalendarDays },
    ],
  },
  events: {
    eyebrow: "UOR Connect Eventos",
    title: "Eventos, projetos, votação e passaporte digital num produto próprio.",
    description:
      "Mantém o ecossistema atual de eventos separado da experiência académica permanente do estudante.",
    icon: Trophy,
    accent: "from-orange-500 to-rose-500",
    primaryAction: { label: "Explorar eventos", to: "/projetos" },
    sections: [
      { title: "Projetos", description: "Submissões, exposições e detalhe público.", icon: UsersRound },
      { title: "Agenda", description: "Programação, blocos e atividade ao vivo.", icon: CalendarDays },
      { title: "Votação", description: "Interações, ranking e avaliação.", icon: BarChart3 },
      { title: "Passaporte", description: "QR Codes, desafios e gamificação.", icon: ShieldCheck },
    ],
  },
  direction: {
    eyebrow: "UOR Connect Direção",
    title: "Indicadores institucionais com permissões e privacidade explícitas.",
    description:
      "Base do ambiente estratégico para direção académica, financeira e institucional, sem acesso indiscriminado a dados individuais.",
    icon: Landmark,
    accent: "from-slate-800 to-slate-600",
    primaryAction: { label: "Abrir área administrativa", to: "/admin" },
    sections: [
      { title: "Académico", description: "Indicadores agregados de desempenho.", icon: GraduationCap },
      { title: "Financeiro", description: "Métricas autorizadas e consolidadas.", icon: WalletCards },
      { title: "Eventos", description: "Acompanhamento institucional de participação.", icon: Trophy },
      { title: "Auditoria", description: "Acesso registado e limitado por finalidade.", icon: ShieldCheck },
    ],
  },
} satisfies Record<ProductKey, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof GraduationCap;
  accent: string;
  primaryAction: { label: string; to: string };
  sections: Array<{ title: string; description: string; icon: typeof GraduationCap }>;
}>;

export default function ProductGateway({ product }: ProductGatewayProps) {
  const config = productConfig[product];
  const ProductIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600 shadow-sm">
              <ProductIcon className="h-4 w-4" />
              {config.eyebrow}
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                {config.title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                {config.description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to={config.primaryAction.to}>
                  {config.primaryAction.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Autenticar</Link>
              </Button>
            </div>
          </div>

          <div className={`rounded-[2rem] bg-gradient-to-br ${config.accent} p-1 shadow-2xl shadow-slate-900/10`}>
            <div className="rounded-[1.85rem] bg-white/95 p-6 backdrop-blur">
              <div className="grid gap-4 sm:grid-cols-2">
                {config.sections.map((section) => {
                  const SectionIcon = section.icon;

                  return (
                    <Card key={section.title} className="border-slate-200/80 bg-white/90">
                      <CardHeader className="space-y-3 pb-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
                          <SectionIcon className="h-5 w-5" />
                        </span>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-6 text-slate-600">{section.description}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
