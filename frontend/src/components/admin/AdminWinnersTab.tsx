import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Award, Briefcase, Crown, GraduationCap, Loader2, Map, Package, Route, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type DigitalPassportAdminOverview } from "@/lib/api";

type ProjectSummary = {
  id: number;
  nome: string;
  tipo: "projeto" | "negocio" | "produto";
  votos: number;
  rating: number;
  pageViews?: number;
  uniqueVisitors?: number;
};

type AdminWinnersTabProps = {
  approvedProjects: ProjectSummary[];
  selectedProjectWinnerId: number | null;
  onClearWinner: () => void;
  onSelectWinner: (projectId: number) => void;
};

const tipoIcons: Record<ProjectSummary["tipo"], LucideIcon> = {
  projeto: GraduationCap,
  negocio: Briefcase,
  produto: Package,
};

const tipoBadgeColors: Record<ProjectSummary["tipo"], string> = {
  projeto: "border-primary/20 bg-primary/10 text-primary",
  negocio: "border-[hsl(var(--area-negocio))]/25 bg-[hsl(var(--area-negocio))]/10 text-[hsl(var(--area-negocio))]",
  produto: "border-[hsl(var(--area-produto))]/25 bg-[hsl(var(--area-produto))]/10 text-[hsl(var(--area-produto))]",
};

export default function AdminWinnersTab({
  approvedProjects,
  selectedProjectWinnerId,
  onClearWinner,
  onSelectWinner,
}: AdminWinnersTabProps) {
  const [passportOverview, setPassportOverview] = useState<DigitalPassportAdminOverview | null>(null);
  const [loadingPassport, setLoadingPassport] = useState(true);

  useEffect(() => {
    let active = true;
    api.passport.overview()
      .then((overview) => {
        if (active) setPassportOverview(overview);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingPassport(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sortedProjects = useMemo(
    () => approvedProjects.slice().sort((a, b) => b.votos - a.votos || b.rating - a.rating),
    [approvedProjects],
  );
  const maxVotes = Math.max(...sortedProjects.map((project) => project.votos), 1);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
              <Trophy className="h-4 w-4" />
              Vencedores e jornada
            </p>
            <h2 className="mt-2 text-2xl font-heading font-bold">Decisão final com contexto real de participação</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              A escolha do vencedor junta a votação dos projetos com o pulso do Passaporte Digital: estudantes a jogar, missões percorridas e envolvimento no evento.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-[430px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3">
              <UsersRound className="h-4 w-4 text-emerald-300" />
              <p className="mt-2 text-xl font-bold">{passportOverview?.participants ?? 0}</p>
              <p className="text-[11px] text-white/55">jogadores</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3">
              <Route className="h-4 w-4 text-sky-300" />
              <p className="mt-2 text-xl font-bold">{passportOverview?.totalScans ?? 0}</p>
              <p className="text-[11px] text-white/55">scans</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3">
              <Award className="h-4 w-4 text-orange-300" />
              <p className="mt-2 text-xl font-bold">{passportOverview?.totalPoints ?? 0}</p>
              <p className="text-[11px] text-white/55">pontos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-primary/25 bg-white shadow-sm">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-primary" />
              Melhor Projeto Académico
            </CardTitle>
            <Button variant="outline" onClick={onClearWinner}>
              Desclassificar Projeto
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
          {sortedProjects.map((project, index) => {
            const Icon = tipoIcons[project.tipo];
            const isSelected = selectedProjectWinnerId === project.id;
            const pct = Math.round((project.votos / maxVotes) * 100);
            return (
              <motion.div
                key={project.id}
                whileHover={{ y: -2 }}
                className={`cursor-pointer overflow-hidden rounded-2xl border transition-all ${isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/50 hover:border-primary/30 hover:shadow-sm"}`}
                onClick={() => onSelectWinner(project.id)}
              >
                <div className="flex items-center gap-3 p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                    {isSelected ? <Crown className="h-5 w-5" /> : <span className="text-xs font-black">#{index + 1}</span>}
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{project.nome}</p>
                    <p className="text-xs text-muted-foreground">{project.votos} votos · score {project.rating}</p>
                  </div>
                  <Badge variant="outline" className={tipoBadgeColors[project.tipo]}>{project.tipo}</Badge>
                </div>
                <div className="h-1.5 bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className="h-full bg-primary"
                  />
                </div>
              </motion.div>
            );
          })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-200 bg-emerald-50/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-950">
              <Map className="h-4 w-4 text-emerald-700" />
              Mapa do Passaporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingPassport && !passportOverview ? (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-white/70 px-4 py-10 text-sm text-emerald-800">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A carregar jornada...
              </div>
            ) : (
              (passportOverview?.missions ?? []).slice(0, 6).map((mission, index) => (
                <div key={mission.id} className="relative rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm">
                  {index < Math.min((passportOverview?.missions.length ?? 1), 6) - 1 && (
                    <span className="absolute left-6 top-[42px] h-5 w-px bg-emerald-200" aria-hidden="true" />
                  )}
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-emerald-950">{mission.title}</p>
                      <p className="text-xs text-emerald-800/70">{mission.scansCount} scans · {mission.ledgerCount} pontuações</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">
                      {mission.points} pts
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
