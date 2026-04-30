import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";

const submissionStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const smsAudienceTypeSchema = z.enum([
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

const smsAudienceSchema = z.object({
  type: smsAudienceTypeSchema,
  studentClassCodes: z.array(z.string().trim().min(1).max(40)).max(200).optional(),
  studentCourses: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
  courseIds: z.array(z.coerce.number().int().positive()).max(100).optional(),
  submissionStatuses: z.array(submissionStatusSchema).max(3).optional(),
  selectedStudentNumbers: z.array(z.string().trim().min(1)).max(5000).optional(),
  selectedPhones: z.array(z.string().trim().min(1)).max(5000).optional(),
  cookieMarketingOptIn: z.boolean().optional(),
  cookieAnalyticsOptIn: z.boolean().optional(),
  activeWithinDays: z.coerce.number().int().min(1).max(365).optional(),
});

const smsPreviewBodySchema = z.object({
  audience: smsAudienceSchema,
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

const smsSendBodySchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  sender: z.string().trim().min(3).max(16).optional(),
  message: z.string().trim().min(5).max(1500),
  audience: smsAudienceSchema,
  schedule: z.string().trim().max(80).optional(),
});

const smsRecipientPreviewSchema = z.object({
  studentId: z.number().nullable(),
  studentNumber: z.string().nullable(),
  name: z.string().nullable(),
  course: z.string().nullable(),
  classCode: z.string().nullable(),
  phone: z.string(),
  providerTo: z.string(),
  sources: z.array(z.string()),
});

const smsCampaignSummarySchema = z.object({
  id: z.number(),
  title: z.string().nullable(),
  sender: z.string(),
  audienceType: z.string(),
  status: z.string(),
  totalRecipients: z.number(),
  successCount: z.number(),
  failedCount: z.number(),
  createdByStudentNumber: z.string(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
  scheduleAt: z.string().nullable(),
});

const smsProviderProxySchema = z.object({
  ok: z.boolean(),
  status: z.number(),
  payload: z.unknown(),
});

const smsAudienceButtonSchema = z.object({
  type: smsAudienceTypeSchema,
  label: z.string(),
  total: z.number(),
  sendable: z.number(),
});

const smsStudentCourseButtonSchema = z.object({
  course: z.string(),
  total: z.number(),
  sendable: z.number(),
});

const smsStudentClassButtonSchema = z.object({
  classCode: z.string(),
  total: z.number(),
  sendable: z.number(),
});

type SmsAudienceInput = z.infer<typeof smsAudienceSchema>;

type SmsCandidate = {
  studentId: number | null;
  studentNumber: string | null;
  name: string | null;
  course: string | null;
  classCode: string | null;
  phone: string | null;
  source: string;
};

type SmsRecipient = {
  studentId: number | null;
  studentNumber: string | null;
  name: string | null;
  course: string | null;
  classCode: string | null;
  phone: string;
  providerTo: string;
  sources: string[];
};

type SmsSkip = SmsCandidate & { reason: string };

type SmsResolution = {
  recipients: SmsRecipient[];
  skipped: SmsSkip[];
  filteredTotal: number;
};

function normalizeStudentNumber(value: string) {
  return value.replace(/\D/g, "").trim();
}

function normalizeSearch(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeSender(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizeMessage(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizePhoneForOmbala(value?: string | null): { phone: string; providerTo: string } | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00244") && digits.length >= 14) {
    const local = digits.slice(5, 14);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.startsWith("244") && digits.length >= 12) {
    const local = digits.slice(3, 12);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    const local = digits.slice(1);
    return local.startsWith("9") ? { phone: `+244${local}`, providerTo: local } : null;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return { phone: `+244${digits}`, providerTo: digits };
  }

  if (digits.length === 8) {
    const local = `9${digits}`;
    return { phone: `+244${local}`, providerTo: local };
  }

  return null;
}

function toDateFromCompactSchedule(schedule: string) {
  const match = schedule.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function toCompactSchedule(date: Date) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}${hh}${mm}${ss}`;
}

function parseSchedule(schedule?: string) {
  if (!schedule?.trim()) {
    return { scheduleAt: null as Date | null, providerSchedule: null as string | null };
  }

  const trimmed = schedule.trim();
  const compactDate = toDateFromCompactSchedule(trimmed);
  if (compactDate) {
    return {
      scheduleAt: compactDate,
      providerSchedule: toCompactSchedule(compactDate),
    };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data de agendamento inválida. Usa YYYYMMDDHHmmss ou data/hora válida.");
  }

  return {
    scheduleAt: parsed,
    providerSchedule: toCompactSchedule(parsed),
  };
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringifyProviderPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const direct = pickString(record.message_id)
    ?? pickString(record.messageId)
    ?? pickString(record.id)
    ?? pickString(record.uuid);

  if (direct) return direct;

  const nestedData = record.data;
  if (nestedData && typeof nestedData === "object") {
    return extractProviderMessageId(nestedData);
  }

  return null;
}

function extractSenderNames(payload: unknown): string[] {
  if (!payload) return [];

  const values = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null
      ? Object.values(payload as Record<string, unknown>)
      : [];

  const names: string[] = [];
  for (const item of values) {
    if (typeof item === "string") {
      names.push(item.trim());
      continue;
    }

    if (item && typeof item === "object") {
      const name = pickString((item as Record<string, unknown>).name);
      if (name) names.push(name.trim());
    }
  }

  return Array.from(new Set(names.filter(Boolean)));
}

function extractCredits(payload: unknown): number | null {
  const parseCreditValue = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim()
        .replace(/\s+/g, "")
        .replace(/(?<=\d)[.,](?=\d{3}(\D|$))/g, "")
        .replace(",", ".");
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  };

  const direct = parseCreditValue(payload);
  if (direct !== null) return direct;

  if (!payload || typeof payload !== "object") return null;

  const creditKeys = new Set([
    "available",
    "available_sms",
    "balance",
    "credit",
    "credits",
    "remaining",
    "saldo",
    "sms",
    "total",
    "value",
  ]);

  const visit = (value: unknown, depth = 0): number | null => {
    const parsed = parseCreditValue(value);
    if (parsed !== null) return parsed;

    if (!value || typeof value !== "object" || depth > 4) return null;

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = visit(item, depth + 1);
        if (nested !== null) return nested;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    for (const [key, item] of Object.entries(record)) {
      if (!creditKeys.has(key.toLowerCase())) continue;
      const nested = visit(item, depth + 1);
      if (nested !== null) return nested;
    }

    for (const key of ["data", "result", "payload", "response"]) {
      if (!(key in record)) continue;
      const nested = visit(record[key], depth + 1);
      if (nested !== null) return nested;
    }

    return null;
  };

  return visit(payload);
}

function extractProviderMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" && payload.trim() ? payload : null;
  }

  const record = payload as Record<string, unknown>;
  const direct = pickString(record.message)
    ?? pickString(record.error)
    ?? pickString(record.detail)
    ?? pickString(record.description);
  if (direct) return direct;

  for (const key of ["data", "result", "payload", "response"]) {
    const nested = extractProviderMessage(record[key]);
    if (nested) return nested;
  }

  return null;
}

function applyTemplate(message: string, recipient: SmsRecipient) {
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

function filterCandidatesBySearch(candidates: SmsCandidate[], search?: string) {
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

function resolveRecipients(candidates: SmsCandidate[], search?: string): SmsResolution {
  const filtered = filterCandidatesBySearch(candidates, search);
  const byPhone = new Map<string, SmsRecipient>();
  const providerToByStudentId = new Map<number, string>();
  const skipped: SmsSkip[] = [];

  for (const candidate of filtered) {
    const normalized = normalizePhoneForOmbala(candidate.phone);
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

  return students.map<SmsCandidate>((student) => ({
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
    .map<SmsCandidate>((student) => ({
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
    .map<SmsCandidate>((student) => ({
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

  return enrollments.map<SmsCandidate>((entry) => ({
    studentId: entry.studentId,
    studentNumber: entry.student.studentNumber ?? entry.studentNumber,
    name: entry.student.name ?? entry.studentName,
    course: entry.student.course ?? entry.studentCourse ?? entry.course.name,
    classCode: entry.student.classCode,
    phone: entry.student.phone ?? entry.paymentPhone,
    source: `course:${entry.course.id}`,
  }));
}

async function loadSubmissionCandidates(input: { onlyWinners?: boolean; submissionStatuses?: Array<z.infer<typeof submissionStatusSchema>> }) {
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

  return submissions.map<SmsCandidate>((submission) => ({
    studentId: submission.student?.id ?? null,
    studentNumber: submission.student?.studentNumber ?? submission.studentNumberSnapshot ?? null,
    name: submission.student?.name ?? submission.leaderName ?? null,
    course: submission.student?.course ?? submission.course ?? null,
    classCode: submission.student?.classCode ?? null,
    phone: submission.student?.phone ?? submission.leaderPhone ?? null,
    source: input.onlyWinners ? `winner:${submission.id}` : `submission:${submission.id}`,
  }));
}

async function loadSelectedStudentCandidates(input: SmsAudienceInput) {
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

  const studentCandidates = students.map<SmsCandidate>((student) => ({
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
    .map<SmsCandidate>((phone) => ({
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

async function resolveAudienceCandidates(audience: SmsAudienceInput) {
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
    case "COURSE_OR_SUBMISSION_ENROLLED": {
      const [course, submissions] = await Promise.all([
        loadCourseEnrollmentCandidates(audience.courseIds),
        loadSubmissionCandidates({ submissionStatuses: audience.submissionStatuses }),
      ]);
      return [...course, ...submissions];
    }
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

function audienceTypeLabel(type: z.infer<typeof smsAudienceTypeSchema>) {
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

async function buildStudentCourseButtons() {
  const candidates = await loadStudentCourseCandidates();
  const grouped = new Map<string, SmsCandidate[]>();

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

async function buildStudentClassButtons() {
  const candidates = await loadStudentClassCandidates();
  const grouped = new Map<string, SmsCandidate[]>();

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

function hasCookieAudienceFilters(audience: SmsAudienceInput) {
  return Boolean(audience.cookieMarketingOptIn || audience.cookieAnalyticsOptIn || audience.activeWithinDays);
}

async function applyCookieAudienceFilters(candidates: SmsCandidate[], audience: SmsAudienceInput) {
  if (!hasCookieAudienceFilters(audience)) {
    return { candidates, skipped: [] as SmsSkip[] };
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

  const accepted: SmsCandidate[] = [];
  const skipped: SmsSkip[] = [];

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

class OmbalaClient {
  constructor(private readonly env: Env) {}

  private get baseUrl() {
    return this.env.OMBALA_API_BASE_URL.replace(/\/$/, "");
  }

  private get token() {
    return this.env.OMBALA_API_TOKEN?.trim();
  }

  get isConfigured() {
    return Boolean(this.token);
  }

  private withQuery(path: string, query: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, String(value));
    }

    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  async sendMessage(payload: { message: string; from: string; to: string; schedule?: string | null }) {
    return this.request("/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        message: payload.message,
        from: payload.from,
        to: payload.to,
        ...(payload.schedule ? { schedule: payload.schedule } : {}),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async getCredits() {
    return this.request("/v1/credits");
  }

  async getApprovedSenders() {
    return this.request("/v1/senders/approved");
  }

  async getSenders() {
    return this.request("/v1/senders");
  }

  async getPendingSenders() {
    return this.request("/v1/senders/pending");
  }

  async createSender(name: string) {
    return this.request("/v1/senders/", {
      method: "POST",
      body: JSON.stringify({ name }),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async deleteSender(senderId: string) {
    return this.request(`/v1/senders/${encodeURIComponent(senderId)}`, {
      method: "DELETE",
    });
  }

  async listMessages(page?: number) {
    return this.request(this.withQuery("/v1/messages", { page }));
  }

  async deleteMessage(messageId: string) {
    return this.request(`/v1/messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    });
  }

  async listRecipients(page?: number) {
    return this.request(this.withQuery("/v1/messages/recipients", { page }));
  }

  async listMessagesByDate(start: string, end: string, page?: number) {
    return this.request(this.withQuery("/v1/messages/date", { start, end, page }));
  }

  async listMessagesByRecipient(phoneNumber: string, page?: number) {
    return this.request(this.withQuery("/v1/messages/recipient", { phone_number: phoneNumber, page }));
  }

  async getMessageOne(input: { messageId?: string; id?: string }) {
    return this.request(this.withQuery("/v1/messages/one", {
      message_id: input.messageId,
      id: input.id,
    }));
  }

  private async request(path: string, init?: RequestInit) {
    if (!this.token) {
      return {
        ok: false,
        status: 0,
        payload: { message: "OMBALA_API_TOKEN não configurado." },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Token ${this.token}`,
          ...(init?.headers ?? {}),
        },
      });

      const raw = await response.text();
      let payload: unknown = null;

      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          message: error instanceof Error ? error.message : "Falha de rede ao comunicar com o Ombala",
        },
      };
    }
  }
}

const smsContextAutomationDefinitions = {
  SUBMISSION_CONTEXT_AUDIENCE: {
    label: "SMS para turma/curso da candidatura",
    description: "Envia SMS para estudantes da mesma turma e/ou curso quando uma candidatura é submetida.",
    defaultTitle: "Nova exposição na turma",
    defaultMessage: "Olá {{nome}}, {{colega}} da turma {{turma}} submeteu {{titulo}} no UOR Connect. {{link}}",
  },
  LIVE_CHAT_CONTEXT_AUDIENCE: {
    label: "SMS de interação ao vivo por turma/curso",
    description: "Envia SMS para estudantes da mesma turma e/ou curso quando há uma interação relevante no Ao Vivo.",
    defaultTitle: "Nova interação ao vivo",
    defaultMessage: "Olá {{nome}}, {{colega}} publicou uma nova interação no Ao Vivo para a turma {{turma}}. {{link}}",
  },
} as const;

type SmsContextAutomationKey = keyof typeof smsContextAutomationDefinitions;

function renderSmsAutomationTemplate(
  template: string,
  values: Record<string, string | null | undefined>,
) {
  const recipientKeys = new Set(["nome", "numero", "curso", "turma"]);
  return template
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (placeholder, rawKey: string) => {
      const key = rawKey.trim();
      if (recipientKeys.has(key.toLowerCase())) return placeholder;
      const value = values[key];
      return typeof value === "string" ? value : "";
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

async function resolveSmsContextAutomationSetting(eventKey: SmsContextAutomationKey) {
  const definition = smsContextAutomationDefinitions[eventKey];
  return prisma.whatsAppAutomationSetting.upsert({
    where: { eventKey },
    create: {
      eventKey,
      label: definition.label,
      description: definition.description,
      enabled: false,
    },
    update: {
      label: definition.label,
      description: definition.description,
    },
  });
}

export async function sendSmsAudienceAutomationEvent(
  env: Env,
  eventKey: SmsContextAutomationKey,
  context: {
    audience: SmsAudienceInput;
    excludeStudentId?: number | null;
    values?: Record<string, string | null | undefined>;
  },
) {
  const definition = smsContextAutomationDefinitions[eventKey];
  const setting = await resolveSmsContextAutomationSetting(eventKey);

  if (!setting.enabled) {
    return { ok: false, skipped: true, reason: `Automação ${eventKey} desativada.` };
  }

  const ombala = new OmbalaClient(env);
  if (!ombala.isConfigured) {
    return { ok: false, skipped: true, reason: "Integração SMS não configurada." };
  }

  const sender = normalizeSender(env.OMBALA_SMS_DEFAULT_SENDER ?? "");
  if (!sender || !/^[A-Z0-9 _-]{3,16}$/.test(sender)) {
    return { ok: false, skipped: true, reason: "Remetente SMS padrão inválido." };
  }

  const rawCandidates = await resolveAudienceCandidates(context.audience);
  const candidates = typeof context.excludeStudentId === "number"
    ? rawCandidates.filter((candidate) => candidate.studentId !== context.excludeStudentId)
    : rawCandidates;
  const consentFiltered = await applyCookieAudienceFilters(candidates, {
    ...context.audience,
    cookieMarketingOptIn: true,
  });
  const resolved = resolveRecipients(consentFiltered.candidates);

  if (resolved.recipients.length === 0) {
    return { ok: false, skipped: true, reason: "Nenhum destinatário com consentimento e telefone válido." };
  }

  const values = {
    titulo: "",
    referencia: "",
    detalhe: "",
    link: "",
    evento: "",
    ...(context.values ?? {}),
  };
  const title = renderSmsAutomationTemplate(setting.customTitle ?? definition.defaultTitle, values)
    .replace(/{{\s*(nome|numero|curso|turma)\s*}}/gi, "")
    .replace(/\s+/g, " ")
    .trim() || definition.defaultTitle;
  const messageTemplate = renderSmsAutomationTemplate(setting.customMessage ?? definition.defaultMessage, values);

  if (!messageTemplate) {
    return { ok: false, skipped: true, reason: `Automação ${eventKey} sem mensagem configurada.` };
  }

  const campaign = await prisma.smsCampaign.create({
    data: {
      title,
      message: messageTemplate,
      sender,
      audienceType: eventKey,
      audienceFiltersJson: JSON.stringify({
        ...context.audience,
        excludeStudentId: context.excludeStudentId ?? null,
        consent: "marketing",
      }),
      totalRecipients: resolved.recipients.length,
      status: "PROCESSING",
      createdByStudentNumber: "system",
    },
    select: { id: true },
  });

  await prisma.smsCampaignRecipient.createMany({
    data: resolved.recipients.map((recipient) => ({
      campaignId: campaign.id,
      studentId: recipient.studentId,
      studentNumber: recipient.studentNumber,
      recipientName: recipient.name,
      recipientCourse: recipient.course,
      phone: recipient.phone,
      providerTo: recipient.providerTo,
      status: "QUEUED",
    })),
  });

  let successCount = 0;
  let failedCount = 0;
  const concurrency = 5;

  for (let i = 0; i < resolved.recipients.length; i += concurrency) {
    const chunk = resolved.recipients.slice(i, i + concurrency);

    await Promise.all(chunk.map(async (recipient) => {
      const renderedMessage = applyTemplate(messageTemplate, recipient);
      const providerResponse = await ombala.sendMessage({
        from: sender,
        message: renderedMessage,
        to: recipient.providerTo,
      });

      const baseUpdate = {
        providerResponseJson: stringifyProviderPayload(providerResponse.payload),
        providerMessageId: extractProviderMessageId(providerResponse.payload),
        sentAt: new Date(),
      };

      if (providerResponse.ok) {
        successCount += 1;
        await prisma.smsCampaignRecipient.update({
          where: { campaignId_phone: { campaignId: campaign.id, phone: recipient.phone } },
          data: { ...baseUpdate, status: "SENT", errorMessage: null },
        });
        return;
      }

      failedCount += 1;
      const reason = pickString((providerResponse.payload as Record<string, unknown>)?.message)
        ?? `Falha no provedor (status ${providerResponse.status || "desconhecido"}).`;
      await prisma.smsCampaignRecipient.update({
        where: { campaignId_phone: { campaignId: campaign.id, phone: recipient.phone } },
        data: { ...baseUpdate, status: "FAILED", errorMessage: reason },
      });
    }));
  }

  const status = failedCount === 0 ? "SENT" : successCount === 0 ? "FAILED" : "PARTIAL";

  await prisma.smsCampaign.update({
    where: { id: campaign.id },
    data: { status, successCount, failedCount, sentAt: new Date() },
  });

  return {
    ok: failedCount === 0,
    skipped: false,
    campaignId: campaign.id,
    status,
    successCount,
    failedCount,
    totalRecipients: resolved.recipients.length,
  };
}

export async function smsRoutes(app: FastifyInstance, opts: { env: Env }) {
  const ombala = new OmbalaClient(opts.env);

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);

      const ensureProviderConfigured = () => {
        if (!ombala.isConfigured) {
          return {
            ok: false,
            status: 0,
            payload: { message: "Integração SMS não configurada. Define OMBALA_API_TOKEN no backend." },
          };
        }

        return null;
      };

      adminApp.get("/admin/overview", {
        schema: {
          response: {
            200: z.object({
              integration: z.object({
                configured: z.boolean(),
                baseUrl: z.string(),
                defaultSender: z.string().nullable(),
                approvedSenders: z.array(z.string()),
                credits: z.number().nullable(),
                providerStatus: z.string(),
                providerMessage: z.string().nullable(),
              }),
              audiences: z.object({
                allStudents: z.object({ total: z.number(), sendable: z.number() }),
                courseEnrolled: z.object({ total: z.number(), sendable: z.number() }),
                exhibitors: z.object({ total: z.number(), sendable: z.number() }),
                winners: z.object({ total: z.number(), sendable: z.number() }),
                marketingConsented: z.object({ total: z.number(), sendable: z.number() }),
                activeLast7Days: z.object({ total: z.number(), sendable: z.number() }),
              }),
              campaigns: z.array(smsCampaignSummarySchema),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const [allStudents, courseEnrolled, exhibitors, winners, campaigns] = await Promise.all([
          resolveAudienceCandidates({ type: "ALL_STUDENTS" }),
          resolveAudienceCandidates({ type: "COURSE_ENROLLED" }),
          resolveAudienceCandidates({ type: "SUBMISSION_ENROLLED" }),
          resolveAudienceCandidates({ type: "WINNERS" }),
          prisma.smsCampaign.findMany({
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              title: true,
              sender: true,
              audienceType: true,
              status: true,
              totalRecipients: true,
              successCount: true,
              failedCount: true,
              createdByStudentNumber: true,
              createdAt: true,
              sentAt: true,
              scheduleAt: true,
            },
          }),
        ]);

        const allStudentsResolved = resolveRecipients(allStudents);
        const courseEnrolledResolved = resolveRecipients(courseEnrolled);
        const exhibitorsResolved = resolveRecipients(exhibitors);
        const winnersResolved = resolveRecipients(winners);
        const marketingConsented = await applyCookieAudienceFilters(allStudents, {
          type: "ALL_STUDENTS",
          cookieMarketingOptIn: true,
        });
        const activeLast7Days = await applyCookieAudienceFilters(allStudents, {
          type: "ALL_STUDENTS",
          activeWithinDays: 7,
        });
        const marketingConsentedResolved = resolveRecipients(marketingConsented.candidates);
        const activeLast7DaysResolved = resolveRecipients(activeLast7Days.candidates);

        let approvedSenders: string[] = [];
        let credits: number | null = null;
        let providerStatus = "not_configured";
        let providerMessage: string | null = null;

        if (ombala.isConfigured) {
          const [sendersResponse, creditsResponse] = await Promise.all([
            ombala.getApprovedSenders(),
            ombala.getCredits(),
          ]);

          approvedSenders = sendersResponse.ok ? extractSenderNames(sendersResponse.payload) : [];
          credits = creditsResponse.ok ? extractCredits(creditsResponse.payload) : null;
          providerStatus = sendersResponse.ok && creditsResponse.ok && credits !== null
            ? "ok"
            : sendersResponse.ok || creditsResponse.ok
              ? "partial"
              : "error";

          if (!sendersResponse.ok || !creditsResponse.ok) {
            providerMessage = extractProviderMessage(sendersResponse.payload)
              ?? extractProviderMessage(creditsResponse.payload)
              ?? "Não foi possível consultar o provedor Ombala.";
          } else if (credits === null) {
            providerMessage = "O provedor respondeu à consulta de créditos, mas o formato do saldo não foi reconhecido.";
          }
        }

        return {
          integration: {
            configured: ombala.isConfigured,
            baseUrl: opts.env.OMBALA_API_BASE_URL,
            defaultSender: opts.env.OMBALA_SMS_DEFAULT_SENDER ?? null,
            approvedSenders,
            credits,
            providerStatus,
            providerMessage,
          },
          audiences: {
            allStudents: { total: allStudents.length, sendable: allStudentsResolved.recipients.length },
            courseEnrolled: { total: courseEnrolled.length, sendable: courseEnrolledResolved.recipients.length },
            exhibitors: { total: exhibitors.length, sendable: exhibitorsResolved.recipients.length },
            winners: { total: winners.length, sendable: winnersResolved.recipients.length },
            marketingConsented: { total: marketingConsented.candidates.length, sendable: marketingConsentedResolved.recipients.length },
            activeLast7Days: { total: activeLast7Days.candidates.length, sendable: activeLast7DaysResolved.recipients.length },
          },
          campaigns: campaigns.map((campaign) => ({
            ...campaign,
            title: campaign.title ?? null,
            createdAt: campaign.createdAt.toISOString(),
            sentAt: campaign.sentAt?.toISOString() ?? null,
            scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
          })),
        };
      });

      adminApp.get("/admin/filters", {
        schema: {
          response: {
            200: z.object({
              audienceButtons: z.array(smsAudienceButtonSchema),
              studentClassButtons: z.array(smsStudentClassButtonSchema),
              studentCourseButtons: z.array(smsStudentCourseButtonSchema),
              updatedAt: z.string(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const audienceTypes: Array<z.infer<typeof smsAudienceTypeSchema>> = [
          "ALL_STUDENTS",
          "STUDENT_CLASS",
          "STUDENT_COURSE",
          "STUDENT_CLASS_OR_COURSE",
          "COURSE_ENROLLED",
          "EXHIBITORS",
          "COURSE_OR_EXHIBITORS",
          "WINNERS",
          "SELECTED_STUDENTS",
        ];

        const audienceButtons = await Promise.all(
          audienceTypes.map(async (type) => {
            const candidates = await resolveAudienceCandidates({ type });
            const resolved = resolveRecipients(candidates);
            return {
              type,
              label: audienceTypeLabel(type),
              total: candidates.length,
              sendable: resolved.recipients.length,
            };
          }),
        );

        const [studentClassButtons, studentCourseButtons] = await Promise.all([
          buildStudentClassButtons(),
          buildStudentCourseButtons(),
        ]);

        return {
          audienceButtons,
          studentClassButtons,
          studentCourseButtons,
          updatedAt: new Date().toISOString(),
        };
      });

      adminApp.get("/admin/campaigns", {
        schema: {
          querystring: z.object({
            page: z.coerce.number().int().min(0).optional(),
            pageSize: z.coerce.number().int().min(1).max(100).optional(),
          }),
          response: {
            200: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              campaigns: z.array(smsCampaignSummarySchema),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const query = request.query as { page?: number; pageSize?: number };
        const page = query.page ?? 0;
        const pageSize = query.pageSize ?? 20;

        const [total, campaigns] = await Promise.all([
          prisma.smsCampaign.count(),
          prisma.smsCampaign.findMany({
            orderBy: { createdAt: "desc" },
            skip: page * pageSize,
            take: pageSize,
            select: {
              id: true,
              title: true,
              sender: true,
              audienceType: true,
              status: true,
              totalRecipients: true,
              successCount: true,
              failedCount: true,
              createdByStudentNumber: true,
              createdAt: true,
              sentAt: true,
              scheduleAt: true,
            },
          }),
        ]);

        return {
          page,
          pageSize,
          total,
          campaigns: campaigns.map((campaign) => ({
            ...campaign,
            title: campaign.title ?? null,
            createdAt: campaign.createdAt.toISOString(),
            sentAt: campaign.sentAt?.toISOString() ?? null,
            scheduleAt: campaign.scheduleAt?.toISOString() ?? null,
          })),
        };
      });

      adminApp.get("/admin/campaigns/:id/failures", {
        schema: {
          params: z.object({ id: z.coerce.number().int() }),
          response: {
            200: z.object({
              campaignId: z.number(),
              title: z.string().nullable(),
              message: z.string(),
              sender: z.string(),
              failures: z.array(z.object({
                phone: z.string(),
                providerTo: z.string(),
                errorMessage: z.string().nullable(),
                studentNumber: z.string().nullable(),
              })),
            }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };

        const campaign = await prisma.smsCampaign.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            message: true,
            sender: true,
            recipients: {
              where: { status: "FAILED" },
              select: {
                phone: true,
                providerTo: true,
                errorMessage: true,
                studentNumber: true,
              },
            },
          },
        });

        if (!campaign) {
          return reply.code(404).send({ message: "Campanha não encontrada." });
        }

        return {
          campaignId: campaign.id,
          title: campaign.title,
          message: campaign.message,
          sender: campaign.sender,
          failures: campaign.recipients,
        };
      });

      adminApp.get("/admin/provider/credits", {
        schema: {
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        return ombala.getCredits();
      });

      adminApp.get("/admin/provider/messages", {
        schema: {
          querystring: z.object({
            page: z.coerce.number().int().min(0).optional(),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const query = request.query as { page?: number };
        return ombala.listMessages(query.page);
      });

      adminApp.get("/admin/provider/messages/date", {
        schema: {
          querystring: z.object({
            start: z.string().regex(/^\d{8}$/),
            end: z.string().regex(/^\d{8}$/),
            page: z.coerce.number().int().min(0).optional(),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const query = request.query as { start: string; end: string; page?: number };
        return ombala.listMessagesByDate(query.start, query.end, query.page);
      });

      adminApp.get("/admin/provider/messages/recipient", {
        schema: {
          querystring: z.object({
            phoneNumber: z.string().min(8).max(20),
            page: z.coerce.number().int().min(0).optional(),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const query = request.query as { phoneNumber: string; page?: number };
        return ombala.listMessagesByRecipient(query.phoneNumber, query.page);
      });

      adminApp.get("/admin/provider/messages/one", {
        schema: {
          querystring: z.object({
            messageId: z.string().optional(),
            id: z.string().optional(),
          }).refine((value) => Boolean(value.messageId || value.id), {
            message: "messageId ou id é obrigatório",
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const query = request.query as { messageId?: string; id?: string };
        return ombala.getMessageOne(query);
      });

      adminApp.delete("/admin/provider/messages/:messageId", {
        schema: {
          params: z.object({
            messageId: z.string().min(1),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const params = request.params as { messageId: string };
        return ombala.deleteMessage(params.messageId);
      });

      adminApp.get("/admin/provider/recipients", {
        schema: {
          querystring: z.object({
            page: z.coerce.number().int().min(0).optional(),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const query = request.query as { page?: number };
        return ombala.listRecipients(query.page);
      });

      adminApp.get("/admin/provider/senders", {
        schema: {
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        return ombala.getSenders();
      });

      adminApp.get("/admin/provider/senders/approved", {
        schema: {
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        return ombala.getApprovedSenders();
      });

      adminApp.get("/admin/provider/senders/pending", {
        schema: {
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async () => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        return ombala.getPendingSenders();
      });

      adminApp.post("/admin/provider/senders", {
        schema: {
          body: z.object({
            name: z.string().trim().min(3).max(16),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const body = request.body as { name: string };
        return ombala.createSender(normalizeSender(body.name));
      });

      adminApp.delete("/admin/provider/senders/:senderId", {
        schema: {
          params: z.object({
            senderId: z.string().min(1),
          }),
          response: {
            200: smsProviderProxySchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const missing = ensureProviderConfigured();
        if (missing) return missing;
        const params = request.params as { senderId: string };
        return ombala.deleteSender(params.senderId);
      });

      adminApp.post("/admin/preview", {
        schema: {
          body: smsPreviewBodySchema,
          response: {
            200: z.object({
              totalCandidates: z.number(),
              filteredCandidates: z.number(),
              totalRecipients: z.number(),
              skippedCount: z.number(),
              recipients: z.array(smsRecipientPreviewSchema),
              skipped: z.array(z.object({
                studentId: z.number().nullable(),
                studentNumber: z.string().nullable(),
                name: z.string().nullable(),
                course: z.string().nullable(),
                classCode: z.string().nullable(),
                phone: z.string().nullable(),
                source: z.string(),
                reason: z.string(),
              })),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request) => {
        const body = request.body as z.infer<typeof smsPreviewBodySchema>;
        const rawCandidates = await resolveAudienceCandidates(body.audience);
        const cookieFiltered = await applyCookieAudienceFilters(rawCandidates, body.audience);
        const resolved = resolveRecipients(cookieFiltered.candidates, body.search);
        const skipped = [...cookieFiltered.skipped, ...resolved.skipped];
        const limit = body.limit ?? 120;

        return {
          totalCandidates: rawCandidates.length,
          filteredCandidates: resolved.filteredTotal,
          totalRecipients: resolved.recipients.length,
          skippedCount: skipped.length,
          recipients: resolved.recipients.slice(0, limit),
          skipped: skipped.slice(0, Math.min(limit, 80)),
        };
      });

      adminApp.post("/admin/send", {
        schema: {
          body: smsSendBodySchema,
          response: {
            200: z.object({
              campaignId: z.number(),
              status: z.string(),
              totalCandidates: z.number(),
              totalRecipients: z.number(),
              skippedCount: z.number(),
              successCount: z.number(),
              failedCount: z.number(),
              sender: z.string(),
              scheduleAt: z.string().nullable(),
              failures: z.array(z.object({
                phone: z.string(),
                providerTo: z.string(),
                reason: z.string(),
              })),
            }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        if (!ombala.isConfigured) {
          return reply.code(400).send({
            message: "Integração SMS não configurada. Define OMBALA_API_TOKEN no backend.",
          });
        }

        const body = request.body as z.infer<typeof smsSendBodySchema>;
        const sender = normalizeSender(body.sender ?? opts.env.OMBALA_SMS_DEFAULT_SENDER ?? "");

        if (!sender || !/^[A-Z0-9 _-]{3,16}$/.test(sender)) {
          return reply.code(400).send({
            message: "Remetente inválido. Usa 3-16 caracteres (A-Z, 0-9, espaço, _ ou -).",
          });
        }

        let scheduleAt: Date | null = null;
        let providerSchedule: string | null = null;

        try {
          const parsedSchedule = parseSchedule(body.schedule);
          scheduleAt = parsedSchedule.scheduleAt;
          providerSchedule = parsedSchedule.providerSchedule;
        } catch (error) {
          return reply.code(400).send({
            message: error instanceof Error ? error.message : "Data de agendamento inválida.",
          });
        }

        const rawCandidates = await resolveAudienceCandidates(body.audience);
        const cookieFiltered = await applyCookieAudienceFilters(rawCandidates, body.audience);
        const resolved = resolveRecipients(cookieFiltered.candidates);
        const skipped = [...cookieFiltered.skipped, ...resolved.skipped];

        if (resolved.recipients.length === 0) {
          return reply.code(400).send({
            message: "Nenhum destinatário válido encontrado para esta audiência.",
          });
        }

        request.log.info({
          audienceType: body.audience.type,
          sender,
          totalRecipients: resolved.recipients.length,
          scheduleAt: scheduleAt?.toISOString() ?? null,
        }, "Starting SMS admin campaign");

        const campaign = await prisma.smsCampaign.create({
          data: {
            title: body.title?.trim() || null,
            message: normalizeMessage(body.message),
            sender,
            audienceType: body.audience.type,
            audienceFiltersJson: JSON.stringify(body.audience),
            totalRecipients: resolved.recipients.length,
            status: "PROCESSING",
            scheduleAt,
            createdByStudentNumber: request.student?.studentNumber ?? "unknown",
          },
          select: { id: true },
        });

        await prisma.smsCampaignRecipient.createMany({
          data: resolved.recipients.map((recipient) => ({
            campaignId: campaign.id,
            studentId: recipient.studentId,
            studentNumber: recipient.studentNumber,
            recipientName: recipient.name,
            recipientCourse: recipient.course,
            phone: recipient.phone,
            providerTo: recipient.providerTo,
            status: "QUEUED",
          })),
        });

        const failures: Array<{ phone: string; providerTo: string; reason: string }> = [];
        let successCount = 0;
        let failedCount = 0;

        const concurrency = 5;
        const recipients = resolved.recipients;

        for (let i = 0; i < recipients.length; i += concurrency) {
          const chunk = recipients.slice(i, i + concurrency);

          await Promise.all(chunk.map(async (recipient) => {
            const renderedMessage = applyTemplate(normalizeMessage(body.message), recipient);
            const providerResponse = await ombala.sendMessage({
              from: sender,
              message: renderedMessage,
              to: recipient.providerTo,
              schedule: providerSchedule,
            });

            const baseUpdate = {
              providerResponseJson: stringifyProviderPayload(providerResponse.payload),
              providerMessageId: extractProviderMessageId(providerResponse.payload),
              sentAt: new Date(),
            };

            if (providerResponse.ok) {
              successCount += 1;
              await prisma.smsCampaignRecipient.update({
                where: {
                  campaignId_phone: {
                    campaignId: campaign.id,
                    phone: recipient.phone,
                  },
                },
                data: {
                  ...baseUpdate,
                  status: providerSchedule ? "SCHEDULED" : "SENT",
                  errorMessage: null,
                },
              });
              return;
            }

            failedCount += 1;
            const reason = pickString((providerResponse.payload as Record<string, unknown>)?.message)
              ?? `Falha no provedor (status ${providerResponse.status || "desconhecido"}).`;

            failures.push({
              phone: recipient.phone,
              providerTo: recipient.providerTo,
              reason,
            });

            await prisma.smsCampaignRecipient.update({
              where: {
                campaignId_phone: {
                  campaignId: campaign.id,
                  phone: recipient.phone,
                },
              },
              data: {
                ...baseUpdate,
                status: "FAILED",
                errorMessage: reason,
              },
            });
          }));
        }

        const status = failedCount === 0
          ? providerSchedule ? "SCHEDULED" : "SENT"
          : successCount === 0
            ? "FAILED"
            : "PARTIAL";

        await prisma.smsCampaign.update({
          where: { id: campaign.id },
          data: {
            status,
            successCount,
            failedCount,
            sentAt: new Date(),
          },
        });

        const logPayload = {
          campaignId: campaign.id,
          status,
          sender,
          successCount,
          failedCount,
          sampleFailure: failures[0]?.reason ?? null,
        };

        if (failedCount > 0) {
          request.log.warn(logPayload, "SMS admin campaign completed with failures");
        } else {
          request.log.info(logPayload, "SMS admin campaign completed successfully");
        }

        return {
          campaignId: campaign.id,
          status,
          totalCandidates: rawCandidates.length,
          totalRecipients: resolved.recipients.length,
          skippedCount: skipped.length,
          successCount,
          failedCount,
          sender,
          scheduleAt: scheduleAt?.toISOString() ?? null,
          failures: failures.slice(0, 80),
        };
      });
    });
  });
}
