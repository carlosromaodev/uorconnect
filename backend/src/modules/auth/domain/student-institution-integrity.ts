export type StudentInstitutionFlag = "UOR" | "ISPTEC" | "UNKNOWN";

export type StudentInstitutionEvidence =
  | "REGISTRATION_SOURCE"
  | "STUDENT_NUMBER_PREFIX"
  | "INSTITUTIONAL_EMAIL"
  | "UNIVERSITY"
  | "BOOLEAN_FLAG"
  | "CONTACT_PROFILE"
  | "UNKNOWN";

export type StudentInstitutionIdentity = {
  flag: StudentInstitutionFlag;
  evidence: StudentInstitutionEvidence;
};

export type StudentInstitutionIssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type StudentInstitutionIssueCode =
  | "ISPTEC_NUMBER_NOT_SCOPED"
  | "DECLARED_ISPTEC_WITHOUT_OFFICIAL_SOURCE"
  | "UOR_NUMBER_SCOPED_AS_ISPTEC"
  | "SOURCE_UNIVERSITY_MISMATCH"
  | "SOURCE_BOOLEAN_FLAG_MISMATCH"
  | "ACADEMIC_SYNC_WITHOUT_INSTITUTION_SOURCE"
  | "OFFICIAL_SOURCE_WITHOUT_EXPECTED_UNIVERSITY";

export type StudentInstitutionAuditRow = {
  id: number;
  studentNumber: string;
  name?: string | null;
  email?: string | null;
  course?: string | null;
  phone?: string | null;
  university?: string | null;
  registrationSource?: string | null;
  isUorStudent?: boolean | null;
  academicSyncedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type StudentInstitutionIssue = {
  studentId: number;
  studentNumber: string;
  rawStudentNumber: string | null;
  institutionFlag: StudentInstitutionFlag;
  code: StudentInstitutionIssueCode;
  severity: StudentInstitutionIssueSeverity;
  message: string;
  expectedStudentNumber?: string | null;
};

export type SharedStudentIdentifier = {
  rawStudentNumber: string;
  institutions: StudentInstitutionFlag[];
  studentIds: number[];
  studentNumbers: string[];
  status: "SEPARATED" | "NEEDS_REVIEW";
};

export type StudentInstitutionAudit = {
  generatedAt: Date;
  totals: {
    students: number;
    byInstitution: Record<StudentInstitutionFlag, number>;
    byEvidence: Record<StudentInstitutionEvidence, number>;
    issues: number;
    criticalIssues: number;
    highIssues: number;
    sharedIdentifiers: number;
    sharedIdentifiersSeparated: number;
    sharedIdentifiersNeedingReview: number;
  };
  issues: StudentInstitutionIssue[];
  criticalIssues: StudentInstitutionIssue[];
  sharedIdentifiers: SharedStudentIdentifier[];
};

const ISPTEC_PREFIX = "ISPTEC-";

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function extractRawStudentNumber(studentNumber?: string | null) {
  const value = studentNumber?.trim() ?? "";
  if (!value) return null;
  const withoutInstitutionPrefix = value.replace(/^ISPTEC[-_\s]*/i, "");
  const digits = withoutInstitutionPrefix.replace(/\D/g, "");
  return digits || withoutInstitutionPrefix.trim().toUpperCase() || null;
}

function hasIsptecPrefix(studentNumber?: string | null) {
  return (studentNumber ?? "").trim().toUpperCase().startsWith(ISPTEC_PREFIX);
}

function institutionFromRegistrationSource(source?: string | null): StudentInstitutionFlag {
  const normalized = normalizeText(source);
  if (normalized === "SECRETARIA") return "UOR";
  if (normalized === "ISPTEC_OFFICIAL") return "ISPTEC";
  return "UNKNOWN";
}

function institutionFromUniversity(university?: string | null): StudentInstitutionFlag {
  const normalized = normalizeText(university);
  if (!normalized) return "UNKNOWN";
  if (
    normalized.includes("ISPTEC") ||
    normalized.includes("INSTITUTO SUPERIOR POLITECNICO DE TECNOLOGIAS E CIENCIAS")
  ) {
    return "ISPTEC";
  }
  if (
    normalized === "UOR" ||
    normalized.includes("OSCAR RIBAS") ||
    normalized.includes("UNIVERSIDADE OSCAR RIBAS")
  ) {
    return "UOR";
  }
  return "UNKNOWN";
}

function institutionFromEmail(email?: string | null): StudentInstitutionFlag {
  const normalized = (email ?? "").trim().toLowerCase();
  const domain = normalized.includes("@") ? normalized.split("@").pop() ?? "" : "";
  if (!domain) return "UNKNOWN";
  if (domain.includes("isptec")) return "ISPTEC";
  if (domain.includes("uor") || domain.includes("oscar")) return "UOR";
  return "UNKNOWN";
}

function hasPersonalEmail(email?: string | null) {
  const normalized = (email ?? "").trim();
  if (!normalized || !normalized.includes("@")) return false;
  return institutionFromEmail(normalized) === "UNKNOWN";
}

function hasUsablePhone(phone?: string | null) {
  return (phone ?? "").replace(/\D/g, "").length >= 8;
}

function hasRawNumericStudentNumber(studentNumber?: string | null) {
  const raw = extractRawStudentNumber(studentNumber);
  return Boolean(raw && /^\d{6,14}$/.test(raw) && !hasIsptecPrefix(studentNumber));
}

function hasUorContactProfile(student: Pick<StudentInstitutionAuditRow, "studentNumber" | "email" | "phone">) {
  return hasRawNumericStudentNumber(student.studentNumber)
    && hasUsablePhone(student.phone)
    && hasPersonalEmail(student.email);
}

export function resolveStudentInstitutionIdentity(student: Pick<
  StudentInstitutionAuditRow,
  "studentNumber" | "registrationSource" | "university" | "isUorStudent" | "academicSyncedAt" | "email" | "phone"
>): StudentInstitutionIdentity {
  const sourceInstitution = institutionFromRegistrationSource(student.registrationSource);
  if (sourceInstitution !== "UNKNOWN") return { flag: sourceInstitution, evidence: "REGISTRATION_SOURCE" };

  if (hasIsptecPrefix(student.studentNumber)) return { flag: "ISPTEC", evidence: "STUDENT_NUMBER_PREFIX" };

  const emailInstitution = institutionFromEmail(student.email);
  if (emailInstitution !== "UNKNOWN") return { flag: emailInstitution, evidence: "INSTITUTIONAL_EMAIL" };

  const universityInstitution = institutionFromUniversity(student.university);
  if (universityInstitution !== "UNKNOWN") return { flag: universityInstitution, evidence: "UNIVERSITY" };

  if (student.isUorStudent === true) return { flag: "UOR", evidence: "BOOLEAN_FLAG" };

  if (hasUorContactProfile(student)) return { flag: "UOR", evidence: "CONTACT_PROFILE" };

  return { flag: "UNKNOWN", evidence: "UNKNOWN" };
}

export function resolveStudentInstitutionFlag(student: Pick<
  StudentInstitutionAuditRow,
  "studentNumber" | "registrationSource" | "university" | "isUorStudent" | "academicSyncedAt" | "email" | "phone"
>): StudentInstitutionFlag {
  return resolveStudentInstitutionIdentity(student).flag;
}

export function buildInstitutionScopedStudentNumber(institution: StudentInstitutionFlag, studentNumber: string) {
  const raw = extractRawStudentNumber(studentNumber) ?? studentNumber.trim();
  if (institution === "ISPTEC") return `${ISPTEC_PREFIX}${raw}`;
  if (institution === "UOR") return raw;
  return studentNumber.trim();
}

function issue(input: {
  student: StudentInstitutionAuditRow;
  institutionFlag: StudentInstitutionFlag;
  code: StudentInstitutionIssueCode;
  severity: StudentInstitutionIssueSeverity;
  message: string;
  expectedStudentNumber?: string | null;
}): StudentInstitutionIssue {
  return {
    studentId: input.student.id,
    studentNumber: input.student.studentNumber,
    rawStudentNumber: extractRawStudentNumber(input.student.studentNumber),
    institutionFlag: input.institutionFlag,
    code: input.code,
    severity: input.severity,
    message: input.message,
    expectedStudentNumber: input.expectedStudentNumber,
  };
}

export function detectStudentInstitutionIssues(student: StudentInstitutionAuditRow): StudentInstitutionIssue[] {
  const issues: StudentInstitutionIssue[] = [];
  const identity = resolveStudentInstitutionIdentity(student);
  const institutionFlag = identity.flag;
  const sourceInstitution = institutionFromRegistrationSource(student.registrationSource);
  const emailInstitution = institutionFromEmail(student.email);
  const universityInstitution = institutionFromUniversity(student.university);

  if (sourceInstitution === "ISPTEC" && !hasIsptecPrefix(student.studentNumber)) {
    issues.push(issue({
      student,
      institutionFlag,
      code: "ISPTEC_NUMBER_NOT_SCOPED",
      severity: "CRITICAL",
      message: "Conta oficial ISPTEC guardada com número cru. Pode colidir com estudante UOR com o mesmo número.",
      expectedStudentNumber: buildInstitutionScopedStudentNumber("ISPTEC", student.studentNumber),
    }));
  }

  if (
    sourceInstitution !== "ISPTEC" &&
    (universityInstitution === "ISPTEC" || emailInstitution === "ISPTEC") &&
    !hasIsptecPrefix(student.studentNumber)
  ) {
    issues.push(issue({
      student,
      institutionFlag: "ISPTEC",
      code: "DECLARED_ISPTEC_WITHOUT_OFFICIAL_SOURCE",
      severity: "MEDIUM",
      message: "Conta aponta para ISPTEC, mas não veio do login oficial ISPTEC. Deve ser revista antes de receber escopo institucional definitivo.",
      expectedStudentNumber: buildInstitutionScopedStudentNumber("ISPTEC", student.studentNumber),
    }));
  }

  if (sourceInstitution === "UOR" && hasIsptecPrefix(student.studentNumber)) {
    issues.push(issue({
      student,
      institutionFlag: "UOR",
      code: "UOR_NUMBER_SCOPED_AS_ISPTEC",
      severity: "CRITICAL",
      message: "Conta oficial UOR guardada com prefixo ISPTEC. Pode estar associada à instituição errada.",
      expectedStudentNumber: buildInstitutionScopedStudentNumber("UOR", student.studentNumber),
    }));
  }

  if (
    sourceInstitution !== "UNKNOWN" &&
    universityInstitution !== "UNKNOWN" &&
    sourceInstitution !== universityInstitution
  ) {
    issues.push(issue({
      student,
      institutionFlag: sourceInstitution,
      code: "SOURCE_UNIVERSITY_MISMATCH",
      severity: "HIGH",
      message: `Origem oficial ${sourceInstitution} contradiz universidade ${student.university}.`,
      expectedStudentNumber: buildInstitutionScopedStudentNumber(sourceInstitution, student.studentNumber),
    }));
  }

  if (
    sourceInstitution === "UOR" && student.isUorStudent === false ||
    sourceInstitution === "ISPTEC" && student.isUorStudent === true
  ) {
    issues.push(issue({
      student,
      institutionFlag: sourceInstitution,
      code: "SOURCE_BOOLEAN_FLAG_MISMATCH",
      severity: "HIGH",
      message: `Origem oficial ${sourceInstitution} contradiz a flag isUorStudent=${String(student.isUorStudent)}.`,
      expectedStudentNumber: buildInstitutionScopedStudentNumber(sourceInstitution, student.studentNumber),
    }));
  }

  if (
    student.academicSyncedAt &&
    sourceInstitution === "UNKNOWN" &&
    universityInstitution === "UNKNOWN" &&
    emailInstitution === "UNKNOWN" &&
    !hasUorContactProfile(student)
  ) {
    issues.push(issue({
      student,
      institutionFlag,
      code: "ACADEMIC_SYNC_WITHOUT_INSTITUTION_SOURCE",
      severity: "MEDIUM",
      message: "Conta tem sincronização académica mas não tem origem institucional suficiente para separar UOR/ISPTEC.",
      expectedStudentNumber: null,
    }));
  }

  if (sourceInstitution !== "UNKNOWN" && universityInstitution === "UNKNOWN" && !student.university?.trim()) {
    issues.push(issue({
      student,
      institutionFlag: sourceInstitution,
      code: "OFFICIAL_SOURCE_WITHOUT_EXPECTED_UNIVERSITY",
      severity: "LOW",
      message: `Conta oficial ${sourceInstitution} sem universidade preenchida. Não mistura dados, mas empobrece filtros e auditoria.`,
      expectedStudentNumber: buildInstitutionScopedStudentNumber(sourceInstitution, student.studentNumber),
    }));
  }

  return issues;
}

function compareFlags(left: StudentInstitutionFlag, right: StudentInstitutionFlag) {
  const order: Record<StudentInstitutionFlag, number> = { ISPTEC: 0, UOR: 1, UNKNOWN: 2 };
  return order[left] - order[right];
}

export function auditStudentInstitutionIntegrity(students: StudentInstitutionAuditRow[]): StudentInstitutionAudit {
  const byInstitution: Record<StudentInstitutionFlag, number> = { UOR: 0, ISPTEC: 0, UNKNOWN: 0 };
  const byEvidence: Record<StudentInstitutionEvidence, number> = {
    REGISTRATION_SOURCE: 0,
    STUDENT_NUMBER_PREFIX: 0,
    INSTITUTIONAL_EMAIL: 0,
    UNIVERSITY: 0,
    BOOLEAN_FLAG: 0,
    CONTACT_PROFILE: 0,
    UNKNOWN: 0,
  };
  const issues = students.flatMap((student) => detectStudentInstitutionIssues(student));
  const rowsByRawNumber = new Map<string, StudentInstitutionAuditRow[]>();

  for (const student of students) {
    const identity = resolveStudentInstitutionIdentity(student);
    byInstitution[identity.flag] += 1;
    byEvidence[identity.evidence] += 1;
    const raw = extractRawStudentNumber(student.studentNumber);
    if (!raw) continue;
    const list = rowsByRawNumber.get(raw) ?? [];
    list.push(student);
    rowsByRawNumber.set(raw, list);
  }

  const sharedIdentifiers = Array.from(rowsByRawNumber.entries())
    .map(([rawStudentNumber, rows]) => {
      const institutions = Array.from(new Set(rows.map(resolveStudentInstitutionFlag))).sort(compareFlags);
      if (rows.length < 2 || institutions.length < 2) return null;
      const hasReviewRisk = rows.some((row) => {
        const flag = resolveStudentInstitutionFlag(row);
        return flag === "UNKNOWN" || (flag === "ISPTEC" && !hasIsptecPrefix(row.studentNumber));
      });
      return {
        rawStudentNumber,
        institutions,
        studentIds: rows.map((row) => row.id),
        studentNumbers: rows.map((row) => row.studentNumber),
        status: hasReviewRisk ? "NEEDS_REVIEW" as const : "SEPARATED" as const,
      };
    })
    .filter((item): item is SharedStudentIdentifier => Boolean(item))
    .sort((left, right) => left.rawStudentNumber.localeCompare(right.rawStudentNumber, "pt"));

  const criticalIssues = issues.filter((item) => item.severity === "CRITICAL");
  const highIssues = issues.filter((item) => item.severity === "HIGH");

  return {
    generatedAt: new Date(),
    totals: {
      students: students.length,
      byInstitution,
      byEvidence,
      issues: issues.length,
      criticalIssues: criticalIssues.length,
      highIssues: highIssues.length,
      sharedIdentifiers: sharedIdentifiers.length,
      sharedIdentifiersSeparated: sharedIdentifiers.filter((item) => item.status === "SEPARATED").length,
      sharedIdentifiersNeedingReview: sharedIdentifiers.filter((item) => item.status === "NEEDS_REVIEW").length,
    },
    issues,
    criticalIssues,
    sharedIdentifiers,
  };
}
