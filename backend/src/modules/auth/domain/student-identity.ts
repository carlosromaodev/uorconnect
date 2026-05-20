export type StudentInstitutionCode = "UOR" | "ISPTEC";

export type StudentInstitutionInput = {
  studentNumber?: string | null;
  email?: string | null;
  course?: string | null;
  phone?: string | null;
  university?: string | null;
  registrationSource?: string | null;
  isUorStudent?: boolean | null;
};

const ISPTEC_EXCLUSIVE_COURSES = new Set([
  "CONTABILIDADE",
  "ECONOMIA",
  "ENGENHARIA DE PETROLEOS",
  "ENGENHARIA DE PRODUCAO INDUSTRIAL",
  "ENGENHARIA ELECTROTECNICA",
  "ENGENHARIA ELETROTECNICA",
  "ENGENHARIA INFORMATICA",
  "ENGENHARIA MECANICA",
  "ENGENHARIA QUIMICA",
  "GEOFISICA",
]);

const UOR_EXCLUSIVE_COURSES = new Set([
  "ARQUITECTURA E URBANISMO",
  "ARQUITETURA E URBANISMO",
  "CONTABILIDADE E FINANCAS",
  "DIREITO",
  "ENGENHARIA DE GESTAO INDUSTRIAL",
  "ENGENHARIA ELECTROMECANICA",
  "ENGENHARIA ELETROMECANICA",
  "ENGENHARIA INFORMATICA E COMUNICACOES",
  "GESTAO E MARKETING",
  "GESTAO INDUSTRIAL",
  "PSICOLOGIA",
  "RELACOES INTERNACIONAIS",
]);

function normalizeCourseName(course?: string | null) {
  return (course ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function hasIsptecInstitutionalEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase().endsWith("@isptec.co.ao");
}

export function hasIsptecEmailReference(email?: string | null) {
  return hasIsptecInstitutionalEmail(email);
}

export function normalizeStudentNumberForIdentity(studentNumber?: string | null) {
  const normalized = (studentNumber ?? "").trim();
  const legacyIsptecMatch = normalized.match(/^ISPTEC[-_\s]*(2\d+)$/i);
  return legacyIsptecMatch?.[1] ?? normalized;
}

export function hasOfficialStudentNumberShape(studentNumber?: string | null) {
  return normalizeStudentNumberForIdentity(studentNumber).startsWith("2");
}

export function resolveStudentInstitutionCodeFromCourse(course?: string | null): StudentInstitutionCode | null {
  const normalizedCourse = normalizeCourseName(course);
  if (!normalizedCourse || normalizedCourse === "ENGENHARIA CIVIL") return null;
  if (UOR_EXCLUSIVE_COURSES.has(normalizedCourse)) return "UOR";
  if (ISPTEC_EXCLUSIVE_COURSES.has(normalizedCourse)) return "ISPTEC";
  if (normalizedCourse.startsWith("GESTAO")) return "ISPTEC";
  return null;
}

export function resolveStudentInstitutionCode(input: StudentInstitutionInput): StudentInstitutionCode {
  const institutionFromCourse = resolveStudentInstitutionCodeFromCourse(input.course);
  if (institutionFromCourse) return institutionFromCourse;

  return hasIsptecInstitutionalEmail(input.email) ? "ISPTEC" : "UOR";
}

export function buildStudentIdentityWhere(studentNumber: string, institutionCode: StudentInstitutionCode) {
  return {
    institutionCode_studentNumber: {
      institutionCode,
      studentNumber: normalizeStudentNumberForIdentity(studentNumber),
    },
  };
}
