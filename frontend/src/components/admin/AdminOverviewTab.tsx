import { motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle,
  Crown,
  Download,
  FolderOpen,
  GraduationCap,
  Loader2,
  Package,
  ThumbsUp,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentWithStats } from "@/lib/api";

type ProjectSummary = {
  id: number;
  nome: string;
  tipo: "projeto" | "negocio" | "produto";
  votos: number;
  isWinner: boolean;
};

type AdminOverviewStats = {
  total: number;
  pendentes: number;
  aprovados: number;
  recusados: number;
  totalVotos: number;
  totalEstudantes: number;
};

type AdminOverviewTabProps = {
  exportingReport: boolean;
  rankedProjects: ProjectSummary[];
  rankedStudents: StudentWithStats[];
  stats: AdminOverviewStats;
  onExportOverviewReport: () => void;
};

const tipoIcons: Record<ProjectSummary["tipo"], LucideIcon> = {
  projeto: GraduationCap,
  negocio: Briefcase,
  produto: Package,
};

function studentInteractions(student: StudentWithStats) {
  return (student._count?.likes ?? 0) + (student._count?.votes ?? 0) + (student._count?.comments ?? 0);
}

function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string | number; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/60">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-heading text-2xl font-bold">{value}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AdminOverviewTab({
  exportingReport,
  rankedProjects,
  rankedStudents,
  stats,
  onExportOverviewReport,
}: AdminOverviewTabProps) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold">Visão Geral Administrativa</h2>
          <p className="text-sm text-muted-foreground">Resumo consolidado da plataforma com opção única de exportação.</p>
        </div>
        <Button onClick={onExportOverviewReport} disabled={exportingReport}>
          {exportingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar relatório
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={FolderOpen} label="Candidaturas" value={stats.total} color="bg-primary/10 text-primary" />
        <StatCard icon={AlertTriangle} label="Pendentes" value={stats.pendentes} color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" />
        <StatCard icon={CheckCircle} label="Aprovados" value={stats.aprovados} color="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" />
        <StatCard icon={XCircle} label="Recusados" value={stats.recusados} color="bg-destructive/10 text-destructive" />
        <StatCard icon={ThumbsUp} label="Votos" value={stats.totalVotos} color="bg-[hsl(var(--area-iot))]/10 text-[hsl(var(--area-iot))]" />
        <StatCard icon={Users} label="Estudantes" value={stats.totalEstudantes} color="bg-[hsl(var(--area-web))]/10 text-[hsl(var(--area-web))]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-primary" />
              Top Projetos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankedProjects.slice(0, 5).map((project, index) => {
              const Icon = tipoIcons[project.tipo];
              return (
                <div key={project.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {index + 1}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{project.nome}</span>
                  {project.isWinner && <Crown className="h-4 w-4 text-[hsl(var(--warning))]" />}
                  <span className="text-xs text-muted-foreground">{project.votos} votos</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Estudantes Mais Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankedStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                Dados de estudantes ainda não carregados. Abre a aba "Estudantes" para sincronizar.
              </div>
            ) : (
              rankedStudents.slice(0, 5).map((student, index) => (
                <div key={student.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{student.name || `Estudante ${student.studentNumber}`}</span>
                  <span className="text-xs text-muted-foreground">{studentInteractions(student)} interações</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
