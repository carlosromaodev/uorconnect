import { z } from "zod";
import { prisma } from "../../shared/prisma";

export const communicationSubmissionStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const communicationAudienceTypeSchema = z.enum([
  "ALL_STUDENTS",
  "STUDENT_CLASS",
  "STUDENT_COURSE",
  "STUDENT_CLASS_OR_COURSE",
  "COURSE_ENROLLED",
  "SUBMISSION_ENROLLED",
  "COURSE_OR_SUBMISSION_ENROLLED",
  "EXHIBITORS",
  "COURSE_OR_EXHIBITORS",
  "WINNERS",
  "SELECTED_STUDENTS",
]);

export const communicationAudienceSchema = z.object({
  type: communicationAudienceTypeSchema,
  studentClassCodes: z.array(z.string().trim().min(1).max(40)).max(200).optional(),
  studentCourses: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  courseIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
  submissionStatuses: z.array(communicationSubmissionStatusSchema).max(3).optional(),
  selectedStudentNumbers: z.array(z.string().trim().min(1)).max(5000).optional(),
  selectedPhones: z.array(z.string().trim().min(1)).max(5000).optional(),
  cookieMarketingOptIn: z.boolean().optional(),
  cookieAnalyticsOptIn: z.boolean().optional(),
  activeWithinDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type CommunicationAudienceInput = z.infer<typeof communicationAudienceSchema>;
export type CommunicationAudienceType = z.infer<typeof communicationAudienceTypeSchema>;

export type CommunicationCandidate = {
  studentId: number | null;
  studentNumber: string | null;
  name: string | null;
  course: string | null;
  classCode: string | null;
  phone: string | null;
  source: string;
};

export type CommunicationRecipient = {
  studentId: number | null;
  studentNumber: string | null;
  name: string | null;
  course: string | null;
  classCode: string | null;
  phone: string;
  providerTo: string;
  sources: string[];
};

export type CommunicationSkip = CommunicationCandidate & { reason: string };

export type CommunicationResolution = {
  recipients: CommunicationRecipient[];
  skipped: CommunicationSkip[];
  filteredTotal: number;
};

export function normalizeStudentNumber(value: string) {
  return value.replace(/\D/g, "").trim();
}

export function normalizeSearch(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeMessage(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export function pickString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function stringifyProviderPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

export function applyTemplate(message: string, recipient: CommunicationRecipient) {
  const nome = recipient.name ?? "estudante";
  const numero = recipient.studentNumber ?? "";
  const curso = recipient.course ?? "";
  const turma = recipient.classCode ?? "";

  return message
    .replace(/{{\s*nome\s*}}/gi, nome)
    .replace(/{{\s*numero\s*}}/gi, numero)
    .replace(/{{\s*curso\s*}}/gi, curso)
    .replace(/{{\s*turma\s*}}/gi, turma);
}

export function normalizePhoneForWhatsApp(value?: string | null): { phone: string; providerTo: string } | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00244") && digits.length >= 14) {
    const local = digits.slice(5, 14);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: `244${local}` }
      : null;
  }

  if (digits.startsWith("244") && digits.length >= 12) {
    const local = digits.slice(3, 12);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: `244${local}` }
      : null;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    const local = digits.slice(1);
    return local.startsWith("9") ? { phone: `+244${local}`, providerTo: `244${local}` } : null;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return { phone: `+244${digits}`, providerTo: `244${digits}` };
  }

  if (digits.length === 8) {
    const local = `9${digits}`;
    return { phone: `+244${local}`, providerTo: `244${local}` };
  }

  return null;
}

export function filterCandidatesBySearch(candidates: CommunicationCandidate[], search?: string) {
  const query = normalizeSearch(search);
  if (!query) return candidates;

  return candidates.filter((candidate) => {
    const searchable = [
      candidate.name,
      candidate.studentNumber,
      candidate.course,
      candidate.classCode,
      candidate.phone,
      candidate.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

export function resolveRecipients(
  candidates: CommunicationCandidate[],
  search?: string,
  normalizePhone: (value?: string | null) => { phone: string; providerTo: string } | null = normalizePhoneForWhatsApp,
): CommunicationResolution {
  const filtered = filterCandidatesBySearch(candidates, search);
  const byPhone = new Map<string, CommunicationRecipient>();
  const providerToByStudentId = new Map<number, string>();
  const skipped: CommunicationSkip[] = [];

  for (const candidate of filtered) {
    const normalized = normalizePhone(candidate.phone);
    if (!normalized) {
      skipped.push({ ...candidate, reason: "Telefone ausente ou inválido" });
      continue;
    }

    if (candidate.studentId) {
      const existingProviderTo = providerToByStudentId.get(candidate.studentId);
      if (existingProviderTo && existingProviderTo !== normalized.providerTo) {
        const existingRecipient = byPhone.get(existingProviderTo);
        if (existingRecipient) {
          existingRecipient.sources = Array.from(new Set([...existingRecipient.sources, candidate.source]));
          if (!existingRecipient.studentNumber && candidate.studentNumber) existingRecipient.studentNumber = candidate.studentNumber;
          if (!existingRecipient.name && candidate.name) existingRecipient.name = candidate.name;
          if (!existingRecipient.course && candidate.course) existingRecipient.course = candidate.course;
          if (!existingRecipient.classCode && candidate.classCode) existingRecipient.classCode = candidate.classCode;
          continue;
        }
      }
    }

    const existing = byPhone.get(normalized.providerTo);
    if (!existing) {
      byPhone.set(normalized.providerTo, {
        studentId: candidate.studentId,
        studentNumber: candidate.studentNumber,
        name: candidate.name,
        course: candidate.course,
        classCode: candidate.classCode,
        phone: normalized.phone,
        providerTo: normalized.providerTo,
        sources: [candidate.source],
      });
      if (candidate.studentId) providerToByStudentId.set(candidate.studentId, normalized.providerTo);
      continue;
    }

    const sources = new Set([...existing.sources, candidate.source]);
    existing.sources = Array.from(sources);

    if (!existing.studentId && candidate.studentId) existing.studentId = candidate.studentId;
    if (!existing.studentNumber && candidate.studentNumber) existing.studentNumber = candidate.studentNumber;
    if (!existing.name && candidate.name) existing.name = candidate.name;
    if (!existing.course && candidate.course) existing.course = candidate.course;
    if (!existing.classCode && candidate.classCode) existing.classCode = candidate.classCode;
  }

  const recipients = Array.from(byPhone.values())
    .sort((a, b) => (a.name ?? a.studentNumber ?? a.providerTo).localeCompare(b.name ?? b.studentNumber ?? b.providerTo));

  return {
    recipients,
    skipped,
    filteredTotal: filtered.length,
  };
}

async function loadAllStudentCandidates() {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      studentNumber: true,
      name: true,
      course: true,
      classCode: true,
      phone: true,
    },
  });

  return students.map<CommunicationCandidate>((student) => ({
    studentId: student.id,
    studentNumber: student.studentNumber,
    name: student.name,
    course: student.course,
    classCode: student.classCode,
    phone: student.phone,
    source: "student",
  }));
}

async function loadStudentClassCandidates(classCodes?: string[]) {
  const normalizedClassCodes = Array.from(new Set(
    (classCodes ?? [])
      .map((classCode) => classCode.trim())
      .filter(Boolean),
  ));

  const students = await prisma.student.findMany({
    where: normalizedClassCodes.length
      ? { classCode: { in: normalizedClassCodes } }
      : { classCode: { not: null } },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      course: true,
      classCode: true,
      phone: true,
    },
  });

  return students
    .filter((student) => Boolean(student.classCode?.trim()))
    .map<CommunicationCandidate>((student) => ({
      studentId: student.id,
      studentNumber: student.studentNumber,
      name: student.name,
      course: student.course,
      classCode: student.classCode,
      phone: student.phone,
      source: `student-class:${student.classCode?.trim() ?? "Sem turma"}`,
    }));
}

async function loadStudentCourseCandidates(courseNames?: string[]) {
  const normalizedCourseNames = Array.from(new Set(
    (courseNames ?? [])
      .map((course) => course.trim())
      .filter(Boolean),
  ));

  const students = await prisma.student.findMany({
    where: normalizedCourseNames.length
      ? { course: { in: normalizedCourseNames } }
      : { course: { not: null } },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      course: true,
      classCode: true,
      phone: true,
    },
  });

  return students
    .filter((student) => Boolean(student.course?.trim()))
    .map<CommunicationCandidate>((student) => ({
      studentId: student.id,
      studentNumber: student.studentNumber,
      name: student.name,
      course: student.course,
      classCode: student.classCode,
      phone: student.phone,
      source: `student-course:${student.course?.trim() ?? "Sem curso"}`,
    }));
}

async function loadCourseEnrollmentCandidates(courseIds?: number[]) {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: courseIds?.length ? { courseId: { in: courseIds } } : undefined,
    select: {
      studentId: true,
      studentNumber: true,
      studentName: true,
      studentCourse: true,
      paymentPhone: true,
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
          classCode: true,
          phone: true,
        },
      },
      course: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return enrollments.map<CommunicationCandidate>((entry) => ({
    studentId: entry.studentId,
    studentNumber: entry.student.studentNumber ?? entry.studentNumber,
    name: entry.student.name ?? entry.studentName,
    course: entry.student.course ?? entry.studentCourse ?? entry.course.name,
    classCode: entry.student.classCode,
    phone: entry.student.phone ?? entry.paymentPhone,
    source: `course:${entry.course.id}`,
  }));
}

async function loadSubmissionCandidates(input: { onlyWinners?: boolean; submissionStatuses?: Array<z.infer<typeof communicationSubmissionStatusSchema>> }) {
  const submissions = await prisma.submission.findMany({
    where: {
      isWinner: input.onlyWinners ? true : undefined,
      status: input.onlyWinners ? undefined : input.submissionStatuses?.length ? { in: input.submissionStatuses } : undefined,
    },
    select: {
      id: true,
      course: true,
      studentNumberSnapshot: true,
      leaderName: true,
      leaderPhone: true,
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
          course: true,
          classCode: true,
          phone: true,
        },
      },
    },
  });

  return submissions.map<CommunicationCandidate>((submission) => ({
    studentId: submission.student?.id ?? null,
    studentNumber: submission.student?.studentNumber ?? submission.studentNumberSnapshot ?? null,
    name: submission.student?.name ?? submission.leaderName ?? null,
    course: submission.student?.course ?? submission.course ?? null,
    classCode: submission.student?.classCode ?? null,
    phone: submission.student?.phone ?? submission.leaderPhone ?? null,
    source: input.onlyWinners ? `winner:${submission.id}` : `submission:${submission.id}`,
  }));
}

async function loadSelectedStudentCandidates(input: CommunicationAudienceInput) {
  const normalizedStudentNumbers = Array.from(new Set((input.selectedStudentNumbers ?? [])
    .map(normalizeStudentNumber)
    .filter(Boolean)));

  const students = normalizedStudentNumbers.length
    ? await prisma.student.findMany({
      where: { studentNumber: { in: normalizedStudentNumbers } },
      select: {
        id: true,
        studentNumber: true,
        name: true,
        course: true,
        classCode: true,
        phone: true,
      },
    })
    : [];

  const studentCandidates = students.map<CommunicationCandidate>((student) => ({
    studentId: student.id,
    studentNumber: student.studentNumber,
    name: student.name,
    course: student.course,
    classCode: student.classCode,
    phone: student.phone,
    source: "selected:student",
  }));

  const manualPhoneCandidates = Array.from(new Set(input.selectedPhones ?? []))
    .filter(Boolean)
    .map<CommunicationCandidate>((phone) => ({
      studentId: null,
      studentNumber: null,
      name: null,
      course: null,
      classCode: null,
      phone,
      source: "selected:phone",
    }));

  return [...studentCandidates, ...manualPhoneCandidates];
}

export async function resolveAudienceCandidates(audience: CommunicationAudienceInput) {
  switch (audience.type) {
    case "ALL_STUDENTS":
      return loadAllStudentCandidates();
    case "STUDENT_CLASS":
      return loadStudentClassCandidates(audience.studentClassCodes);
    case "STUDENT_COURSE":
      return loadStudentCourseCandidates(audience.studentCourses);
    case "STUDENT_CLASS_OR_COURSE": {
      const shouldLoadClasses = Boolean(audience.studentClassCodes?.length);
      const shouldLoadCourses = Boolean(audience.studentCourses?.length);
      const [classes, courses] = await Promise.all([
        shouldLoadClasses ? loadStudentClassCandidates(audience.studentClassCodes) : Promise.resolve([]),
        shouldLoadCourses ? loadStudentCourseCandidates(audience.studentCourses) : Promise.resolve([]),
      ]);
      return [...classes, ...courses];
    }
    case "COURSE_ENROLLED":
      return loadCourseEnrollmentCandidates(audience.courseIds);
    case "SUBMISSION_ENROLLED":
    case "EXHIBITORS":
      return loadSubmissionCandidates({ submissionStatuses: audience.submissionStatuses });
    case "COURSE_OR_SUBMISSION_ENROLLED":
    case "COURSE_OR_EXHIBITORS": {
      const [course, submissions] = await Promise.all([
        loadCourseEnrollmentCandidates(audience.courseIds),
        loadSubmissionCandidates({ submissionStatuses: audience.submissionStatuses }),
      ]);
      return [...course, ...submissions];
    }
    case "WINNERS":
      return loadSubmissionCandidates({ onlyWinners: true });
    case "SELECTED_STUDENTS":
      return loadSelectedStudentCandidates(audience);
    default:
      return [];
  }
}

export function audienceTypeLabel(type: CommunicationAudienceType) {
  switch (type) {
    case "ALL_STUDENTS":
      return "Todos os estudantes";
    case "STUDENT_CLASS":
      return "Turmas dos estudantes";
    case "STUDENT_COURSE":
      return "Cursos dos estudantes";
    case "STUDENT_CLASS_OR_COURSE":
      return "Turmas + cursos dos estudantes";
    case "COURSE_ENROLLED":
      return "Inscritos em cursos";
    case "SUBMISSION_ENROLLED":
    case "EXHIBITORS":
      return "Expositores";
    case "COURSE_OR_SUBMISSION_ENROLLED":
    case "COURSE_OR_EXHIBITORS":
      return "Cursos + expositores";
    case "WINNERS":
      return "Vencedores";
    case "SELECTED_STUDENTS":
      return "Selecionados manualmente";
    default:
      return type;
  }
}

export async function buildStudentClassButtons() {
  const candidates = await loadStudentClassCandidates();
  const grouped = new Map<string, CommunicationCandidate[]>();

  for (const candidate of candidates) {
    const classCode = candidate.classCode?.trim();
    if (!classCode) continue;
    const existing = grouped.get(classCode) ?? [];
    existing.push(candidate);
    grouped.set(classCode, existing);
  }

  const buttons = Array.from(grouped.entries()).map(([classCode, classCandidates]) => {
    const resolved = resolveRecipients(classCandidates);
    return {
      classCode,
      total: classCandidates.length,
      sendable: resolved.recipients.length,
    };
  });

  return buttons
    .sort((a, b) => {
      if (b.sendable !== a.sendable) return b.sendable - a.sendable;
      return a.classCode.localeCompare(b.classCode);
    });
}

export async function buildStudentCourseButtons() {
  const candidates = await loadStudentCourseCandidates();
  const grouped = new Map<string, CommunicationCandidate[]>();

  for (const candidate of candidates) {
    const course = candidate.course?.trim();
    if (!course) continue;
    const existing = grouped.get(course) ?? [];
    existing.push(candidate);
    grouped.set(course, existing);
  }

  const buttons = Array.from(grouped.entries()).map(([course, courseCandidates]) => {
    const resolved = resolveRecipients(courseCandidates);
    return {
      course,
      total: courseCandidates.length,
      sendable: resolved.recipients.length,
    };
  });

  return buttons
    .sort((a, b) => {
      if (b.sendable !== a.sendable) return b.sendable - a.sendable;
      return a.course.localeCompare(b.course);
    });
}

function hasCookieAudienceFilters(audience: CommunicationAudienceInput) {
  return Boolean(audience.cookieMarketingOptIn || audience.cookieAnalyticsOptIn || audience.activeWithinDays);
}

export async function applyCookieAudienceFilters(candidates: CommunicationCandidate[], audience: CommunicationAudienceInput) {
  if (!hasCookieAudienceFilters(audience)) {
    return { candidates, skipped: [] as CommunicationSkip[] };
  }

  const studentIds = Array.from(new Set(
    candidates
      .map((candidate) => candidate.studentId)
      .filter((value): value is number => typeof value === "number" && Number.isInteger(value)),
  ));

  if (studentIds.length === 0) {
    return {
      candidates: [],
      skipped: candidates.map((candidate) => ({
        ...candidate,
        reason: "Sem vínculo de estudante para validar cookies e consentimento.",
      })),
    };
  }

  const consentRows = await prisma.consentRecord.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: [{ studentId: "asc" }, { createdAt: "desc" }],
    select: {
      studentId: true,
      analytics: true,
      marketing: true,
    },
  });

  const latestConsentByStudent = new Map<number, { analytics: boolean; marketing: boolean }>();
  for (const row of consentRows) {
    if (!row.studentId) continue;
    if (!latestConsentByStudent.has(row.studentId)) {
      latestConsentByStudent.set(row.studentId, {
        analytics: row.analytics,
        marketing: row.marketing,
      });
    }
  }

  const sessionConsentRows = await prisma.analyticsSession.findMany({
    where: { studentId: { in: studentIds } },
    orderBy: [{ studentId: "asc" }, { lastSeenAt: "desc" }],
    select: {
      studentId: true,
      analyticsAllowed: true,
      marketingAllowed: true,
    },
  });

  for (const row of sessionConsentRows) {
    if (!row.studentId || latestConsentByStudent.has(row.studentId)) continue;
    latestConsentByStudent.set(row.studentId, {
      analytics: row.analyticsAllowed,
      marketing: row.marketingAllowed,
    });
  }

  let activeStudentIds = new Set<number>();
  if (audience.activeWithinDays) {
    const threshold = new Date(Date.now() - audience.activeWithinDays * 24 * 60 * 60 * 1000);
    const sessions = await prisma.analyticsSession.findMany({
      where: {
        studentId: { in: studentIds },
        lastSeenAt: { gte: threshold },
      },
      select: {
        studentId: true,
      },
    });

    activeStudentIds = new Set(
      sessions
        .map((session) => session.studentId)
        .filter((value): value is number => typeof value === "number" && Number.isInteger(value)),
    );
  }

  const accepted: CommunicationCandidate[] = [];
  const skipped: CommunicationSkip[] = [];

  for (const candidate of candidates) {
    if (!candidate.studentId) {
      skipped.push({
        ...candidate,
        reason: "Sem vínculo de estudante para validar cookies e consentimento.",
      });
      continue;
    }

    const consent = latestConsentByStudent.get(candidate.studentId);
    if (audience.cookieMarketingOptIn && !consent?.marketing) {
      skipped.push({
        ...candidate,
        reason: "Utilizador sem consentimento de marketing ativo.",
      });
      continue;
    }

    if (audience.cookieAnalyticsOptIn && !consent?.analytics) {
      skipped.push({
        ...candidate,
        reason: "Utilizador sem consentimento de analytics ativo.",
      });
      continue;
    }

    if (audience.activeWithinDays && !activeStudentIds.has(candidate.studentId)) {
      skipped.push({
        ...candidate,
        reason: `Sem atividade recente nos últimos ${audience.activeWithinDays} dias.`,
      });
      continue;
    }

    accepted.push(candidate);
  }

  return { candidates: accepted, skipped };
}
