export const ALL_ADMIN_PERMISSIONS = [
  "OVERVIEW",
  "ANALYTICS",
  "SMS",
  "JURY",
  "ATTENDANCE",
  "CERTIFICATES",
  "AUDIT",
  "DATA_EXPORT",
  "NUCLEUS",
  "CREDENTIALS",
  "TASKS",
  "SUBMISSIONS",
  "SPEAKERS",
  "SCHEDULE",
  "GUIDE",
  "COURSES",
  "PANELS",
  "EVENTO",
  "FAQ",
  "LIVE",
  "VOTES",
  "SECURITY",
  "STUDENTS",
  "WINNERS",
  "UOR_STUDENT",
] as const;

export type AdminPermission = typeof ALL_ADMIN_PERMISSIONS[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  OVERVIEW: "Visão Geral",
  ANALYTICS: "Cookies & Analytics",
  SMS: "SMS",
  JURY: "Júri",
  ATTENDANCE: "Check-in",
  CERTIFICATES: "Certificados",
  AUDIT: "Auditoria",
  DATA_EXPORT: "Exportação de dados",
  NUCLEUS: "Núcleo",
  CREDENTIALS: "Credenciais",
  TASKS: "Tarefas",
  SUBMISSIONS: "Candidaturas",
  SPEAKERS: "Palestrantes",
  SCHEDULE: "Agenda",
  GUIDE: "Guia",
  COURSES: "Cursos",
  PANELS: "Painéis",
  EVENTO: "Evento",
  FAQ: "FAQ",
  LIVE: "Ao Vivo",
  VOTES: "Votações",
  SECURITY: "Segurança",
  STUDENTS: "Estudantes",
  WINNERS: "Vencedores",
  UOR_STUDENT: "UOR Estudante",
};

export type AdminRole = "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER";

export type AdminAccessInput = {
  team?: string;
  role?: string;
  permissions?: string[];
};

export function normalizeAdminRole(role?: string | null): AdminRole {
  if (role === "TEAM_LEAD" || role === "MEMBER") return role;
  return "SUPER_ADMIN";
}

export function normalizeAdminPermissions(permissions?: string[] | string | null) {
  const rawValues = Array.isArray(permissions)
    ? permissions
    : (permissions ?? "").split(",");

  const unique = Array.from(
    new Set(
      rawValues
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  if (unique.includes("ALL")) {
    return ["ALL"];
  }

  const allowed = new Set<string>(ALL_ADMIN_PERMISSIONS);
  const normalized = unique.filter((value): value is AdminPermission => allowed.has(value));
  return normalized.length > 0 ? normalized : ["OVERVIEW"];
}

export function serializeAdminPermissions(permissions?: string[] | string | null) {
  return normalizeAdminPermissions(permissions).join(",");
}

export function expandAdminPermissions(permissions?: string[] | string | null) {
  const normalized = normalizeAdminPermissions(permissions);
  if (normalized.includes("ALL")) {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  return normalized as AdminPermission[];
}

export function hasAdminPermission(permissions: string[] | string | null | undefined, required: AdminPermission | AdminPermission[]) {
  const normalized = normalizeAdminPermissions(permissions);
  if (normalized.includes("ALL")) return true;

  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((permission) => normalized.includes(permission));
}

export function normalizeAdminStudentNumber(studentNumber: string) {
  return studentNumber.replace(/\D/g, "").trim();
}

function configuredDefaultAdminStudentNumbers() {
  return new Set(
    (process.env.DEFAULT_ADMIN_STUDENT_NUMBERS ?? "")
      .split(",")
      .map(normalizeAdminStudentNumber)
      .filter(Boolean),
  );
}

export function isDefaultAdminStudentNumber(studentNumber: string) {
  const normalized = normalizeAdminStudentNumber(studentNumber);
  return configuredDefaultAdminStudentNumbers().has(normalized);
}
