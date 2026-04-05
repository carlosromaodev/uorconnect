import { ArrowRight } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import { type LaboratorioModuleStatus } from "@/data/laboratorio-modules";
import { LaboratorioPageSection, LaboratorioPublicLayout } from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";
import { laboratorioCourseClusters, useLaboratorioHub } from "@/lib/laboratorio-hub-state";

function getStatusTone(status: LaboratorioModuleStatus) {
  switch (status) {
    case "operacional":
      return "success" as const;
    case "piloto":
      return "accent" as const;
    case "curadoria":
      return "warning" as const;
    case "planeado":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

function getAccessModeLabel(value: string) {
  switch (value) {
    case "aberto":
      return "Entrada aberta";
    case "curado":
      return "Entrada com curadoria";
    case "por-selecao":
      return "Entrada por seleção";
    case "competitivo":
      return "Entrada competitiva";
    default:
      return value;
  }
}

export default function LaboratorioModuleDetailPage() {
  const { contestConfig } = useArenaState();
  const { modules } = useLaboratorioHub();
  const clock = useArenaClock(contestConfig);
  const { slug } = useParams<{ slug: string }>();
  const module = modules.find((item) => item.slug === slug);

  if (!module) {
    return <Navigate replace to="/programas" />;
  }

  const supportedClusters = laboratorioCourseClusters.filter((cluster) =>
    module.supportedCourseClusters.includes(cluster.slug),
  );

  return (
    <LaboratorioPublicLayout
      title={module.title}
      subtitle={module.summary}
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to={module.primaryPath}>
              {module.primaryLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/agenda">Ver agenda</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
        <LaboratorioPageSection kicker={`programa.${module.slug}`} title="Visão geral do módulo">
          <ContestBadge tone={getStatusTone(module.status)}>{module.statusLabel}</ContestBadge>
          <p className="mt-5 text-sm leading-7 text-[#9fb0c3]">{module.description}</p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <DetailCard label="Formato" value={module.format} />
            <DetailCard label="Cadência" value={module.cadence} />
            <DetailCard label="Acesso" value={getAccessModeLabel(module.accessMode)} />
            <DetailCard label="Entrega" value={module.deliveryModes.join(", ")} />
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="outcomes" title="Resultados esperados">
          <div className="grid gap-3">
            {module.outcomes.map((item) => (
              <div key={item} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-[#9fb0c3]">
                {item}
              </div>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <LaboratorioPageSection kicker="operacao" title="Esquema de funcionamento">
          <div className="space-y-3 text-sm leading-7 text-[#9fb0c3]">
            <p>{module.operationalModel}</p>
            <p>{module.adminSurface}</p>
            <p>Este módulo foi desenhado para encaixar no fluxo completo do Laboratório: descoberta, entrada, execução, feedback e continuidade.</p>
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="publicos" title="Cursos e públicos servidos">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Públicos prioritários</p>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-[#9fb0c3]">
                {module.audiences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Clusters atendidos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {supportedClusters.map((cluster) => (
                  <ContestBadge key={cluster.slug} tone="neutral">{cluster.title}</ContestBadge>
                ))}
              </div>
            </div>
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <LaboratorioPageSection kicker="metricas" title="Indicadores de leitura">
          <div className="grid gap-3">
            {module.kpis.map((kpi) => (
              <div key={kpi} className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-[#9fb0c3]">
                {kpi}
              </div>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="proximo.passo" title="Entrada recomendada">
          <ContestCard tone="terminal" className="shadow-none">
            <p className="text-sm leading-7 text-[#9fb0c3]">
              Se este módulo fizer sentido para o teu momento, entra pela superfície própria dele. O acesso, a cadência e o formato já foram definidos para evitar confusão entre experiência pública, curadoria e prova técnica.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
                <Link to={module.primaryPath}>{module.primaryLabel}</Link>
              </Button>
              <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
                <Link to="/programas">Voltar ao catálogo</Link>
              </Button>
            </div>
          </ContestCard>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7f8da0]">{label}</p>
      <p className="mt-3 text-sm leading-7 text-[#dce5ef]">{value}</p>
    </div>
  );
}
