export type StudentInstitutionCode = "UOR" | "ISPTEC";

export type StudentInstitutionInput = {
  studentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  university?: string | null;
  registrationSource?: string | null;
  isUorStudent?: boolean | null;
};

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeStudentNumberForIdentity(studentNumber?: string | null) {
  return (studentNumber ?? "").trim();
}

export function hasIsptecEmailReference(email?: string | null) {
  return (email ?? "").trim().toLowerCase().includes("isptec");
}

function hasPersonalEmail(email?: string | null) {
  const normalized = (email ?? "").trim();
  return normalized.includes("@") && !hasIsptecEmailReference(normalized);
}

function hasUsablePhone(phone?: string | null) {
  return (phone ?? "").replace(/\D/g, "").length >= 8;
}

function hasStudentNumber(studentNumber?: string | null) {
  return normalizeStudentNumberForIdentity(studentNumber).length > 0;
}

function hasUorContactProfile(input: StudentInstitutionInput) {
  return hasStudentNumber(input.studentNumber) && hasUsablePhone(input.phone) && hasPersonalEmail(input.email);
}

export function resolveStudentInstitutionCode(input: StudentInstitutionInput): StudentInstitutionCode {
  const source = normalizeText(input.registrationSource);
  if (source === "ISPTEC_OFFICIAL") return "ISPTEC";

  if (hasIsptecEmailReference(input.email)) return "ISPTEC";
  if (normalizeText(input.studentNumber).includes("ISPTEC")) return "ISPTEC";

  const university = normalizeText(input.university);
  if (
    university.includes("ISPTEC") ||
    university.includes("INSTITUTO SUPERIOR POLITECNICO DE TECNOLOGIAS E CIENCIAS")
  ) {
    return "ISPTEC";
  }

  if (source === "SECRETARIA") return "UOR";

  if (university === "UOR" || university.includes("OSCAR RIBAS")) return "UOR";
  if (input.isUorStudent === true) return "UOR";
  if (hasUorContactProfile(input)) return "UOR";

  return "UOR";
}

export function buildStudentIdentityWhere(studentNumber: string, institutionCode: StudentInstitutionCode) {
  return {
    institutionCode_studentNumber: {
      institutionCode,
      studentNumber: normalizeStudentNumberForIdentity(studentNumber),
    },
  };
}
