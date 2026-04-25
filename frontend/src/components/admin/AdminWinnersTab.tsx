import { motion } from "framer-motion";
import { Award, Briefcase, Crown, GraduationCap, Package, Trophy, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProjectSummary = {
  id: number;
  nome: string;
  tipo: "projeto" | "negocio" | "produto";
  votos: number;
  rating: number;
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-heading font-bold">
          <Trophy className="h-5 w-5 text-[hsl(var(--warning))]" />
          Selecionar Vencedor
        </h2>
        <Button variant="outline" onClick={onClearWinner}>
          Desclassificar Projeto
        </Button>
      </div>

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-primary" />
            Melhor Projeto Académico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {approvedProjects.map((project) => {
            const Icon = tipoIcons[project.tipo];
            const isSelected = selectedProjectWinnerId === project.id;
            return (
              <motion.div
                key={project.id}
                whileHover={{ scale: 1.01 }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/40 hover:border-primary/30"}`}
                onClick={() => onSelectWinner(project.id)}
              >
                {isSelected && <Crown className="h-5 w-5 text-[hsl(var(--warning))]" />}
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{project.nome}</span>
                <Badge variant="outline" className={tipoBadgeColors[project.tipo]}>{project.tipo}</Badge>
                <span className="text-xs text-muted-foreground">{project.votos} votos · ⭐ {project.rating}</span>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
