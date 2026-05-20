export type StudentInstitutionCode = "UOR" | "ISPTEC";

export type StudentInstitutionInput = {
  studentNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  university?: string | null;
  registrationSource?: string | null;
  isUorStudent?: boolean | null;
};

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

export function resolveStudentInstitutionCode(input: StudentInstitutionInput): StudentInstitutionCode {
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
