import { ChevronLeft, ChevronRight, MessageSquare, Search, Star, ThumbsUp, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContextualSmsAction } from "@/components/admin/ContextualSmsAction";
import type { StudentWithStats } from "@/lib/api";

type StudentSort = "interacoes" | "nome" | "numero" | "curso";

type AdminStudentsTabProps = {
  availableStudentCourses: string[];
  groupStudentsByCourse: boolean;
  groupedStudents: Record<string, StudentWithStats[]>;
  loadingStudentsList: boolean;
  studentCourseFilter: string;
  studentListRows: StudentWithStats[];
  studentPage: number;
  studentPageSize: number;
  studentSearchTerm: string;
  studentSortBy: StudentSort;
  studentsTotal: number;
  studentsTotalPages: number;
  onGroupStudentsByCourseChange: (value: boolean) => void;
  onRemoveStudent: (student: StudentWithStats) => void;
  onStudentCourseFilterChange: (value: string) => void;
  onStudentPageChange: (value: number | ((current: number) => number)) => void;
  onStudentPageSizeChange: (value: number) => void;
  onStudentSearchTermChange: (value: string) => void;
  onStudentSortByChange: (value: StudentSort) => void;
};

function studentInteractions(student: StudentWithStats) {
  return (student._count?.likes ?? 0) + (student._count?.votes ?? 0) + (student._count?.comments ?? 0);
}

function StudentRow({ student, onRemove }: { student: StudentWithStats; onRemove: (student: StudentWithStats) => void }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium">{student.studentNumber}</p>
            <p className="break-words text-sm text-muted-foreground">{student.name || `Estudante ${student.studentNumber}`}</p>
            <p className="break-words text-[11px] text-muted-foreground">{student.course || "Curso não informado"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
                Turma {student.classCode || "não sincronizada"}
              </Badge>
              {student.academicYear ? (
                <Badge variant="outline" className="border-border/70 bg-background text-[10px] text-muted-foreground">
                  {student.academicYear}{student.academicPeriod ? ` · ${student.academicPeriod}` : ""}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground sm:flex sm:gap-4">
            <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {student._count?.likes ?? 0}</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {student._count?.comments ?? 0}</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {student._count?.votes ?? 0}</span>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Badge className="w-fit border-primary/20 bg-primary/10 text-[10px] text-primary">{studentInteractions(student)} interações</Badge>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              <ContextualSmsAction
                title="Enviar comunicação ao estudante"
                recipient={{
                  name: student.name,
                  studentNumber: student.studentNumber,
                  phone: student.phone,
                  course: student.course,
                }}
                defaultMessage="Olá {{nome}}, temos uma atualização importante para ti no UOR Connect. Entra na plataforma para acompanhar os detalhes."
              />
              <Button size="sm" variant="destructive" className="w-full sm:w-auto" onClick={() => onRemove(student)}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remover
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminStudentsTab({
  availableStudentCourses,
  groupStudentsByCourse,
  groupedStudents,
  loadingStudentsList,
  studentCourseFilter,
  studentListRows,
  studentPage,
  studentPageSize,
  studentSearchTerm,
  studentSortBy,
  studentsTotal,
  studentsTotalPages,
  onGroupStudentsByCourseChange,
  onRemoveStudent,
  onStudentCourseFilterChange,
  onStudentPageChange,
  onStudentPageSizeChange,
  onStudentSearchTermChange,
  onStudentSortByChange,
}: AdminStudentsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, número, curso ou turma..." value={studentSearchTerm} onChange={(event) => onStudentSearchTermChange(event.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={studentCourseFilter} onChange={(event) => onStudentCourseFilterChange(event.target.value)}>
          <option value="todos">Todos os cursos</option>
          {availableStudentCourses.map((course) => (
            <option key={course} value={course}>{course}</option>
          ))}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={studentSortBy} onChange={(event) => onStudentSortByChange(event.target.value as StudentSort)}>
          <option value="interacoes">Mais interações</option>
          <option value="nome">Nome A-Z</option>
          <option value="numero">Número do estudante</option>
          <option value="curso">Curso</option>
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={studentPageSize} onChange={(event) => onStudentPageSizeChange(Number(event.target.value))}>
          <option value={10}>10 por página</option>
          <option value={20}>20 por página</option>
          <option value={50}>50 por página</option>
        </select>
        <Button variant={groupStudentsByCourse ? "default" : "outline"} onClick={() => onGroupStudentsByCourseChange(!groupStudentsByCourse)}>
          {groupStudentsByCourse ? "Agrupado" : "Sem grupo"}
        </Button>
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {loadingStudentsList
          ? "A carregar estudantes..."
          : studentsTotal === 0
            ? "Nenhum estudante encontrado."
            : `${studentsTotal} estudante(s) encontrado(s).`}
      </div>

      {studentListRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
          Nenhum estudante encontrado.
        </div>
      ) : groupStudentsByCourse ? (
        Object.entries(groupedStudents).map(([course, courseStudents]) => (
          <div key={course} className="space-y-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm font-semibold">{course}</p>
              <p className="text-xs text-muted-foreground">{courseStudents.length} estudante(s) nesta página</p>
            </div>
            {courseStudents.map((student) => (
              <StudentRow key={student.id} student={student} onRemove={onRemoveStudent} />
            ))}
          </div>
        ))
      ) : (
        studentListRows.map((student) => (
          <StudentRow key={student.id} student={student} onRemove={onRemoveStudent} />
        ))
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
        <p className="text-muted-foreground">
          Página {studentPage} de {studentsTotalPages}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onStudentPageChange((current) => Math.max(1, current - 1))} disabled={loadingStudentsList || studentPage <= 1}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            Anterior
          </Button>
          <Button size="sm" variant="outline" onClick={() => onStudentPageChange((current) => Math.min(studentsTotalPages, current + 1))} disabled={loadingStudentsList || studentPage >= studentsTotalPages}>
            Próximo
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
