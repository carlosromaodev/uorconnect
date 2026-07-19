export type StudentInstitutionCode = "UOR" | "ISPTEC";

export type StudentInstitutionInput = {
  studentNumber?: string | null;
  institutionCode?: string | null;
  email?: string | null;
  course?: string | null;
  classCode?: string | null;
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
  "GESTAO DE ADMINISTRACAO E MARKETING",
  "GESTAO ADMINISTRACAO E MARKETING",
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

export function hasVerifiedIsptecStudentEmail(studentNumber?: string | null, email?: string | null) {
  const normalizedStudentNumber = normalizeStudentNumberForIdentity(studentNumber).toLowerCase();
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  const [localPart, domain] = normalizedEmail.split("@");

  return Boolean(
    normalizedStudentNumber
      && domain === "isptec.co.ao"
      && localPart === normalizedStudentNumber,
  );
}

export function hasOfficialStudentNumberShape(studentNumber?: string | null) {
  return normalizeStudentNumberForIdentity(studentNumber).startsWith("2");
}

export function resolveStudentInstitutionCodeFromCourse(course?: string | null): StudentInstitutionCode | null {
  const normalizedCourse = normalizeCourseName(course);
  if (!normalizedCourse || normalizedCourse === "ENGENHARIA CIVIL") return null;
  if (UOR_EXCLUSIVE_COURSES.has(normalizedCourse)) return "UOR";
  if (ISPTEC_EXCLUSIVE_COURSES.has(normalizedCourse)) return "ISPTEC";
  return null;
}

export function resolveStudentInstitutionCodeFromClass(classCode?: string | null): StudentInstitutionCode | null {
  const normalizedClass = (classCode ?? "").trim().toUpperCase();
  if (!normalizedClass) return null;

  if (/^T[A-Z]+/.test(normalizedClass)) return "UOR";
  if (/^(CBT|CTB|ECN|ECV|EELT|EIN|EMC|EPI|EPT|EQM|GEO|GES)/.test(normalizedClass)) return "ISPTEC";

  return null;
}

function normalizeExplicitInstitution(value?: string | null): StudentInstitutionCode | null {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "UOR" || normalized.includes("OSCAR RIBAS") || normalized.includes("ÓSCAR RIBAS")) return "UOR";
  if (normalized === "ISPTEC" || normalized.includes("INSTITUTO SUPERIOR POLITECNICO")) return "ISPTEC";
  return null;
}

export function resolveStudentInstitutionCode(input: StudentInstitutionInput): StudentInstitutionCode {
  const source = (input.registrationSource ?? "").trim().toUpperCase();

  if (source === "SECRETARIA") return "UOR";
  if (hasVerifiedIsptecStudentEmail(input.studentNumber, input.email)) return "ISPTEC";

  return "UOR";
}

export function canonicalStudentUniversityName(institutionCode: StudentInstitutionCode) {
  return institutionCode;
}

export function buildStudentIdentityWhere(studentNumber: string, institutionCode: StudentInstitutionCode) {
  return {
    institutionCode_studentNumber: {
      institutionCode,
      studentNumber: normalizeStudentNumberForIdentity(studentNumber),
    },
  };
}
