export type StudentAreaTab =
  | "home"
  | "desafio"
  | "submissoes"
  | "inscricoes"
  | "certificados"
  | "passes";

const studentAreaTabs = new Set<StudentAreaTab>([
  "home",
  "desafio",
  "submissoes",
  "inscricoes",
  "certificados",
  "passes",
]);

export function normalizeStudentAreaTab(value: string | null | undefined): StudentAreaTab {
  return studentAreaTabs.has(value as StudentAreaTab) ? (value as StudentAreaTab) : "home";
}
