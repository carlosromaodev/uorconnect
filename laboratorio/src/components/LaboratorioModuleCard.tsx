import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  Code2,
  Handshake,
  Lightbulb,
  Network,
  Speech,
  Swords,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import type { LaboratorioModule, LaboratorioModuleStatus } from "@/data/laboratorio-modules";

function getModuleIcon(icon: LaboratorioModule["icon"]): ReactNode {
  const className = "h-5 w-5";

  switch (icon) {
    case "arena":
      return <Code2 className={className} />;
    case "group-learning":
      return <Users className={className} />;
    case "business-simulation":
      return <BriefcaseBusiness className={className} />;
    case "hackathon":
      return <Swords className={className} />;
    case "mentoring":
      return <Handshake className={className} />;
    case "impact":
      return <Lightbulb className={className} />;
    case "prototyping":
      return <Wrench className={className} />;
    case "soft-skills":
      return <Speech className={className} />;
    case "interdisciplinary":
      return <Network className={className} />;
    default:
      return <Code2 className={className} />;
  }
}

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

export function LaboratorioModuleCard({
  module,
  compact = false,
}: {
  module: LaboratorioModule;
  compact?: boolean;
}) {
  return (
    <ContestCard tone={module.status === "operacional" ? "accent" : "subtle"} className="h-full shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00e5c8]/16 bg-[#00e5c8]/10 text-[#00e5c8]">
          {getModuleIcon(module.icon)}
        </div>
        <ContestBadge tone={getStatusTone(module.status)} size="compact">
          {module.statusLabel}
        </ContestBadge>
      </div>

      <h3 className="mt-5 text-xl font-semibold text-white">{module.title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#8ea1b8]">{module.summary}</p>

      {!compact ? (
        <p className="mt-4 text-sm leading-7 text-[#64748b]">{module.format}</p>
      ) : null}

      <div className="mt-5">
        <Button asChild className={cn("h-11 px-5", contestButtonClassNames.primary)}>
          <Link to={module.primaryPath}>{module.primaryLabel}</Link>
        </Button>
      </div>
    </ContestCard>
  );
}
