import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  laboratorioAgendaStatusLabel,
  type LaboratorioAgendaStatus,
} from "@/data/laboratorio-hub";
import {
  LaboratorioPageSection,
  LaboratorioPublicLayout,
} from "@/components/LaboratorioPublicLayout";
import { useArenaClock, useArenaState } from "@/lib/arena-state";
import { useLaboratorioHub } from "@/lib/laboratorio-hub-state";

function formatAgendaDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    weekday: "short",
  });
}

function getAgendaTone(status: LaboratorioAgendaStatus) {
  switch (status) {
    case "aberto":
      return "success" as const;
    case "curadoria":
      return "warning" as const;
    case "reservado":
      return "neutral" as const;
    case "encerrado":
      return "muted" as const;
    default:
      return "neutral" as const;
  }
}

export default function LaboratorioAgendaPage() {
  const { contestConfig } = useArenaState();
  const { agendaItems, modules } = useLaboratorioHub();
  const clock = useArenaClock(contestConfig);
  const moduleLabelMap = new Map(modules.map((module) => [module.slug, module.title]));
  const featuredItems = agendaItems.filter((item) => item.featured).slice(0, 3);

  return (
    <LaboratorioPublicLayout
      title="Agenda do Laboratório"
      subtitle="Calendário operativo das experiências do Laboratório, com leitura clara por módulo, público, formato e estado de entrada."
      contestConfig={contestConfig}
      clock={clock}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
            <Link to="/programas">
              Ver programas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)}>
            <Link to="/funcionamento">Ver cadeia de funcionamento</Link>
          </Button>
        </div>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <LaboratorioPageSection kicker="agenda.featured" title="Momentos em destaque">
          <div className="grid gap-4">
            {featuredItems.map((item) => (
              <ContestCard key={item.id} tone="accent" className="shadow-none">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">
                      {formatAgendaDate(item.date)}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{item.title}</h3>
                  </div>
                  <ContestBadge tone={getAgendaTone(item.status)}>
                    {laboratorioAgendaStatusLabel[item.status]}
                  </ContestBadge>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#d7e2ee]">{item.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-[#d7e2ee]">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{item.startTime} - {item.endTime}</span>
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />{item.location}</span>
                </div>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>

        <LaboratorioPageSection kicker="agenda.reading" title="Como usar esta agenda">
          <div className="space-y-3 text-sm leading-7 text-[#9fb0c3]">
            <p>Esta agenda existe para evitar dispersão. Cada momento do Laboratório mostra módulo, público, formato, estado de acesso e entrada recomendada.</p>
            <p>Um estudante pode entrar pela agenda e depois seguir para o módulo correto, em vez de precisar navegar por páginas que misturam tudo.</p>
            <p>Quando o módulo for competitivo, como a Arena, a agenda encaminha para sala de espera, catálogo ou prova. Nos restantes casos, encaminha para o programa correspondente.</p>
          </div>
        </LaboratorioPageSection>
      </section>

      <section className="mt-8">
        <LaboratorioPageSection kicker="agenda.timeline" title="Agenda completa">
          <div className="grid gap-4">
            {agendaItems.map((item) => (
              <ContestCard key={item.id} tone="subtle" className="shadow-none">
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr_auto] lg:items-center">
                  <div>
                    <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">
                      {formatAgendaDate(item.date)}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-sm text-[#7f8da0]">{moduleLabelMap.get(item.moduleSlug) || "Módulo do Laboratório"}</p>
                  </div>

                  <div>
                    <p className="text-sm leading-7 text-[#9fb0c3]">{item.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#9fb0c3]">
                      <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#7bd3c6]" />{item.startTime} - {item.endTime}</span>
                      <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#7bd3c6]" />{item.location}</span>
                      <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-[#7bd3c6]" />{item.audience}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <ContestBadge tone={getAgendaTone(item.status)}>
                      {laboratorioAgendaStatusLabel[item.status]}
                    </ContestBadge>
                    <Button asChild variant="outline" className={cn("h-10 px-4", contestButtonClassNames.secondary)}>
                      <Link to={item.ctaPath}>{item.ctaLabel}</Link>
                    </Button>
                  </div>
                </div>
              </ContestCard>
            ))}
          </div>
        </LaboratorioPageSection>
      </section>
    </LaboratorioPublicLayout>
  );
}
