import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { LoginUseCase, isInvalidCredentialsErrorMessage } from "../use-cases/login";
import { StudentRepository } from "../infra/student.repository";
import { signJuryToken, signStudentToken, signTrainerToken } from "../utils/jwt";
import { loadEnv, type Env } from "../../../config/env";
import {
  normalizeAngolaPhone,
  normalizeCourse,
  normalizeStudentName,
  normalizeStudentProfile,
} from "../domain/student-format";
import { DeleteStudentUseCase, ListStudentsWithStatsUseCase } from "../use-cases/manage-students";
import {
  AuthorizeAdminStudentUseCase,
  ListAdminSecurityOverviewUseCase,
  RevokeAdminStudentUseCase,
} from "../use-cases/manage-admin-security";
import { authGuard } from "./auth.middleware";
import { adminGuard, getAdminProfileByStudentNumber, getJuryAdminProfileById, requireAdminPermission, setDefaultAdminPermission } from "./admin.middleware";
import { isDefaultAdminStudentNumber, serializeAdminPermissions } from "../domain/admin-authorized-students";
import {
  appendCookie,
  clearCookie,
  getCookie,
  resolveSharedCookieDomain,
  serializeCookie,
  shouldUseSecureCookies,
} from "../../../shared/cookies";
import { PrismaSubmissionRepository } from "../../submission/infra/prisma/prisma.submission.repository";
import { type StudentLoginOrigin } from "../domain/student";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { profileState } from "../../profile/application/profile-completion.service";
import {
  hasSocialProfileFields,
  upsertStudentProfileExtra,
} from "../../profile/application/profile-extra.service";
import { escapeHtml, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { renderQrDataUri } from "../../../shared/qr";
import { persistMediaValue } from "../../media/application/media-storage";
import {
  createOdinDeviceId,
  recordOdinEvent,
  resolveOdinDeviceIdFromRequest,
} from "../../security/application/odin.service";

const AUTH_COOKIE = "uor_auth";
const CSRF_COOKIE = "uor_csrf";
const SESSION_HINT_COOKIE = "uor_session_hint";
const DEVICE_COOKIE = "uor_device";
const LAST_CONNECTION_COOKIE = "uor_last_connection";
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;
const DEVICE_MAX_AGE = 60 * 60 * 24 * 180;

function normalizeLoginIdentifier(value: string, identifierType: "studentNumber" | "username") {
  const trimmed = value.trim();
  if (identifierType === "username") {
    return trimmed.replace(/\s+/g, " ").slice(0, 40);
  }
  return trimmed.replace(/\D/g, "").slice(0, 12);
}

function normalizeInstitutionalStudentLookup(value: string) {
  const trimmed = value.trim();
  if (/^ISPTEC[-_\s]/i.test(trimmed)) {
    const raw = trimmed.replace(/^ISPTEC[-_\s]*/i, "").replace(/\D/g, "");
    return raw ? `ISPTEC-${raw}` : trimmed.toUpperCase();
  }
  return trimmed.replace(/\D/g, "").slice(0, 12);
}

const loginSchema = z.object({
  studentNumber: z.string().trim().min(1).max(40),
  identifierType: z.enum(["studentNumber", "username"]).optional().default("studentNumber"),
  password: z.string().min(1, "Password is required"),
  provider: z.enum(["uor", "isptec"]).optional().default("uor"),
  origin: z.preprocess(
    (value) => value === "admin" ? "uorconnect" : value,
    z.enum(["uorconnect"]).optional(),
  ),
}).superRefine((value, ctx) => {
  if (value.identifierType === "username") {
    const username = normalizeLoginIdentifier(value.studentNumber, "username");
    if (value.provider === "isptec") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["identifierType"],
        message: "O ISPTEC aceita apenas número de estudante.",
      });
      return;
    }
    if (username.length < 2 || username.length > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentNumber"],
        message: "Nome de utilizador deve ter entre 2 e 40 caracteres.",
      });
    }
    if (!/^[\p{L}\p{N}._@ -]+$/u.test(username)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["studentNumber"],
        message: "Nome de utilizador contém caracteres inválidos.",
      });
    }
    return;
  }

  const normalized = normalizeLoginIdentifier(value.studentNumber, "studentNumber");
  if (normalized.length < 8 || normalized.length > 12) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["studentNumber"],
      message: "Student number must have between 8 and 12 digits",
    });
  }
});

const authErrorSchema = z.object({
  success: z.literal(false),
  error: z.string()
});

const fastifyErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  error: z.string().optional()
});

const profileAvatarSchema = z.union([
  z.string().trim().url().max(700),
  z.string().trim().regex(/^\/(?:api\/)?media\/files\/.+/).max(700),
  z.string().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/).max(500_000),
  z.literal(""),
  z.null(),
]);

function normalizeNullablePhone(value?: string | null) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (!value.trim()) return null;
  return normalizeAngolaPhone(value) ?? value.trim();
}

function normalizeAvatarUrl(value?: string | null) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

const profileConsentKeys = [
  "consentPhotoCredential",
  "consentPublicProfile",
  "consentSocialLinks",
  "consentSms",
  "consentWhatsapp",
] as const;

type ProfileConsentKey = typeof profileConsentKeys[number];
type ProfileConsentSnapshot = Record<ProfileConsentKey, boolean>;

function pickProfileConsentSnapshot(extra?: Partial<Record<ProfileConsentKey, boolean | null>> | null): ProfileConsentSnapshot {
  return {
    consentPhotoCredential: extra?.consentPhotoCredential === true,
    consentPublicProfile: extra?.consentPublicProfile === true,
    consentSocialLinks: extra?.consentSocialLinks === true,
    consentSms: extra?.consentSms === true,
    consentWhatsapp: extra?.consentWhatsapp === true,
  };
}

function hasProfileConsentPatch(input: Partial<Record<ProfileConsentKey, unknown>>) {
  return profileConsentKeys.some((key) => input[key] !== undefined);
}

function profileConsentChanges(before: ProfileConsentSnapshot, after: ProfileConsentSnapshot) {
  return profileConsentKeys
    .filter((key) => before[key] !== after[key])
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

const sensitiveProfileKeys = [
  "name",
  "email",
  "course",
  "phone",
  "alternatePhone",
  "avatarUrl",
  "bio",
  "address",
  "instagramUrl",
  "facebookUrl",
  "linkedinUrl",
  "githubUrl",
  "websiteUrl",
  "visibilityJson",
] as const;

function profileAuditSnapshot(student: Partial<Record<typeof sensitiveProfileKeys[number], unknown>>) {
  return Object.fromEntries(sensitiveProfileKeys.map((key) => [key, student[key] ?? null]));
}

function profileChangedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter((key) => before[key] !== after[key]);
}

type ProfileFieldSource = "SECRETARIA" | "STUDENT" | "ADMIN" | "IMPORT" | "SYSTEM" | "UNKNOWN";

function resolveProfileFieldSources(student: {
  academicSyncedAt?: Date | string | null;
  registrationSource?: string | null;
  profileCompletedAt?: Date | string | null;
}): Record<string, ProfileFieldSource> {
  const academicSource: ProfileFieldSource = student.academicSyncedAt ? "SECRETARIA" : "UNKNOWN";
  const declaredSource: ProfileFieldSource = student.profileCompletedAt ? "STUDENT" : "UNKNOWN";
  const registration = student.registrationSource?.toUpperCase() ?? "";
  const importSource: ProfileFieldSource = registration.includes("IMPORT") || registration.includes("OFFICIAL") ? "IMPORT" : declaredSource;

  return {
    studentNumber: "SYSTEM",
    name: academicSource === "SECRETARIA" ? "SECRETARIA" : importSource,
    course: academicSource,
    classCode: academicSource,
    academicYear: academicSource,
    academicPeriod: academicSource,
    curricularYear: academicSource,
    phone: declaredSource,
    alternatePhone: declaredSource,
    email: declaredSource,
    avatarUrl: declaredSource,
    bio: declaredSource,
    address: declaredSource,
    instagramUrl: declaredSource,
    facebookUrl: declaredSource,
    linkedinUrl: declaredSource,
    githubUrl: declaredSource,
    websiteUrl: declaredSource,
  };
}

const studentResponseSchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  accessType: z.enum(["OFFICIAL", "TEMPORARY"]),
  institutionFlag: z.enum(["UOR", "ISPTEC", "UNKNOWN"]),
  institutionEvidence: z.enum([
    "REGISTRATION_SOURCE",
    "STUDENT_NUMBER_PREFIX",
    "INSTITUTIONAL_EMAIL",
    "UNIVERSITY",
    "BOOLEAN_FLAG",
    "CONTACT_PROFILE",
    "UNKNOWN",
  ]),
  name: z.string().nullable(),
  email: z.string().nullable(),
  course: z.string().nullable(),
  classCode: z.string().nullable().optional(),
  academicYear: z.string().nullable().optional(),
  academicPeriod: z.string().nullable().optional(),
  curricularYear: z.string().nullable().optional(),
  academicSyncedAt: z.coerce.date().nullable().optional(),
  birthDate: z.coerce.date().nullable(),
  nationality: z.string().nullable(),
  phone: z.string().nullable(),
  alternatePhone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  university: z.string().nullable().optional(),
  isUorStudent: z.boolean().nullable().optional(),
  registrationSource: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  instagramUrl: z.string().nullable().optional(),
  facebookUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  githubUrl: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  profileCompletedAt: z.coerce.date().nullable().optional(),
  lastLoginAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const studentStatsCountSchema = z.object({
  likes: z.number(),
  votes: z.number(),
  comments: z.number(),
  courseEnrollments: z.number(),
  certificates: z.number(),
  attendanceCheckIns: z.number(),
  submissions: z.number(),
  submissionMemberships: z.number(),
  liveChatMessages: z.number(),
  passportScans: z.number(),
  passportPointLedger: z.number(),
  passportChallengeAnswers: z.number(),
  passportStudentBadges: z.number(),
  passportSurpriseEffects: z.number(),
  exhibitorVoteScoreEvents: z.number(),
  exhibitorActorScoreEvents: z.number(),
});

const studentActivityProjectSchema = z.object({
  id: z.number(),
  referenceCode: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string(),
  role: z.enum(["RESPONSAVEL", "MEMBRO"]),
  course: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable().optional(),
});

const studentActivitySummarySchema = z.object({
  projects: z.array(studentActivityProjectSchema),
  businesses: z.array(studentActivityProjectSchema),
  products: z.array(studentActivityProjectSchema),
  courses: z.array(z.object({
    id: z.number(),
    name: z.string(),
    paymentStatus: z.string(),
    createdAt: z.coerce.date(),
  })),
  challenges: z.object({
    digitalPassportEvents: z.number(),
    exhibitorEvents: z.number(),
    badges: z.number(),
  }),
  recentEvents: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "AUTH",
      "PROJECT",
      "BUSINESS",
      "PRODUCT",
      "COURSE",
      "CERTIFICATE",
      "ATTENDANCE",
      "DIGITAL_PASSPORT",
      "EXHIBITOR_CHALLENGE",
      "LIVE_CHAT",
    ]),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    points: z.number().nullable().optional(),
    happenedAt: z.coerce.date(),
  })),
});

const studentWithStatsResponseSchema = studentResponseSchema.extend({
  _count: studentStatsCountSchema,
  activitySummary: studentActivitySummarySchema.optional(),
});

const studentProfileExtraResponseSchema = z.object({
  bio: z.string().nullable(),
  address: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  consentPhotoCredential: z.boolean(),
  consentPublicProfile: z.boolean(),
  consentSocialLinks: z.boolean(),
  consentSms: z.boolean(),
  consentWhatsapp: z.boolean(),
  visibilityJson: z.string().nullable(),
});

const profileRequirementStateSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
});

const profileCompletionStateSchema = z.object({
  key: z.enum(["BASIC", "CONTACT_READY", "PUBLIC_READY", "TEAM_READY", "ADMIN_READY", "EXPOSITOR_READY"]),
  label: z.string(),
  completionScore: z.number(),
  ready: z.boolean(),
  missingFields: z.array(profileRequirementStateSchema),
  missingRequiredFields: z.array(profileRequirementStateSchema),
});

const profileFieldSourcesSchema = z.record(z.string(), z.enum(["SECRETARIA", "STUDENT", "ADMIN", "IMPORT", "SYSTEM", "UNKNOWN"]));

const studentProfileStateResponseSchema = z.object({
  primaryState: z.string(),
  completionScore: z.number(),
  contexts: z.array(profileCompletionStateSchema),
  profileExtra: studentProfileExtraResponseSchema.nullable(),
  fieldSources: profileFieldSourcesSchema,
});

const adminAuthorizedStudentSchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  team: z.string(),
  role: z.string(),
  permissions: z.string(),
  isActive: z.boolean(),
  revokedAt: z.coerce.date().nullable().optional(),
  revokedByStudentNumber: z.string().nullable().optional(),
  revocationReason: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const adminAccessConflictSchema = z.object({
  studentNumber: z.string(),
  issue: z.enum(["NO_ACTIVE_MEMBERSHIP", "BLOCKED_BY_INACTIVE_MEMBERSHIP", "OFFICIAL_MEMBERSHIP_PRECEDENCE"]),
  severity: z.enum(["MEDIUM", "HIGH"]),
  accessBlocked: z.boolean(),
  effectiveSource: z.enum(["ADMIN_AUTHORIZED_STUDENT", "TEAM_MEMBERSHIP", "BLOCKED"]),
  admin: adminAuthorizedStudentSchema,
  memberships: z.array(z.object({
    id: z.number(),
    fullName: z.string(),
    category: z.string(),
    team: z.string(),
    role: z.string(),
    permissions: z.string(),
    status: z.string(),
    updatedAt: z.coerce.date(),
  })),
});

const adminAccessProfileSchema = z.object({
  studentNumber: z.string(),
  team: z.string(),
  role: z.string(),
  permissions: z.array(z.string()),
  isSuperAdmin: z.boolean(),
});

const securityOverviewSchema = z.object({
  authorizedStudents: z.array(adminAuthorizedStudentSchema),
  recentLogins: z.array(studentResponseSchema),
  adminAccessConflicts: z.array(adminAccessConflictSchema),
});

const securityStudentNumberSchema = z.object({
  studentNumber: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 8 && value.length <= 12, "Student number must have between 8 and 12 digits"),
  team: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["SUPER_ADMIN", "TEAM_LEAD", "MEMBER"]).optional(),
  permissions: z.array(z.string().trim().min(1).max(40)).optional(),
});

const studentsPagedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50),
  search: z.string().trim().max(120).optional(),
  course: z.string().trim().max(120).optional(),
  university: z.string().trim().max(140).optional(),
  accessType: z.enum(["OFFICIAL", "TEMPORARY", "all", "todos"]).optional(),
  sort: z.enum([
    "created_desc",
    "created_asc",
    "name_asc",
    "name_desc",
    "number_asc",
    "number_desc",
    "course_asc",
    "course_desc",
    "university_asc",
    "university_desc",
    "interactions_desc",
  ]).default("created_desc"),
});

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  course: z.string().trim().min(2).max(120).optional(),
  phone: z.union([z.string().trim().min(8).max(20), z.literal("")]).optional(),
  alternatePhone: z.union([z.string().trim().min(8).max(20), z.literal(""), z.null()]).optional(),
  avatarUrl: profileAvatarSchema.optional(),
  bio: z.string().trim().max(500).optional(),
  address: z.string().trim().max(200).optional(),
  instagramUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
  facebookUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
  linkedinUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
  githubUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
  websiteUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
  consentPhotoCredential: z.boolean().optional(),
  consentPublicProfile: z.boolean().optional(),
  consentSocialLinks: z.boolean().optional(),
  consentSms: z.boolean().optional(),
  consentWhatsapp: z.boolean().optional(),
  visibilityJson: z.string().trim().max(2_000).nullable().optional(),
});

const juryMemberResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  team: z.string(),
  role: z.string(),
  permissions: z.string(),
  isActive: z.boolean(),
  lastCodeSentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const juryMemberCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  team: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["SUPER_ADMIN", "TEAM_LEAD", "MEMBER"]).optional(),
  permissions: z.array(z.string().trim().min(1).max(40)).optional(),
});

const juryMemberIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const jurySendCodeSchema = z.object({
  expiresInMinutes: z.coerce.number().int().min(3).max(60).optional(),
});

const juryLoginSchema = z.object({
  phone: z.string().trim().min(8).max(30),
  code: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 6, "Código deve ter exatamente 6 dígitos"),
});

const conventionalProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email(), z.literal(""), z.null()]).optional(),
  phone: z.string().trim().min(8).max(30),
  university: z.string().trim().min(2).max(140),
  isUorStudent: z.boolean().default(false),
  course: z.string().trim().min(2).max(140).optional(),
  classCode: z.string().trim().max(60).optional(),
  academicYear: z.string().trim().max(60).optional(),
  nationality: z.string().trim().max(80).optional(),
  avatarUrl: profileAvatarSchema.optional(),
  bio: z.string().trim().max(500).optional(),
  consentPhotoCredential: z.boolean().optional(),
  consentPublicProfile: z.boolean().optional(),
  consentSocialLinks: z.boolean().optional(),
  consentSms: z.boolean().optional(),
  consentWhatsapp: z.boolean().optional(),
});

const conventionalVerifySchema = z.object({
  phone: z.string().trim().min(8).max(30),
  code: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 6, "Código deve ter exatamente 6 dígitos"),
});

const CONVENTIONAL_SMS_DISABLED_MESSAGE = "O acesso por SMS foi desativado. Usa o login oficial UOR ou ISPTEC.";

const studentRepository = new StudentRepository(prisma);
const submissionRepository = new PrismaSubmissionRepository();
let envCache: Env;
const listStudentsWithStatsUseCase = new ListStudentsWithStatsUseCase(studentRepository);
const deleteStudentUseCase = new DeleteStudentUseCase(studentRepository);
const listAdminSecurityOverviewUseCase = new ListAdminSecurityOverviewUseCase(studentRepository);
const authorizeAdminStudentUseCase = new AuthorizeAdminStudentUseCase(studentRepository);
const revokeAdminStudentUseCase = new RevokeAdminStudentUseCase(studentRepository);

function normalizeLoginOrigin(origin?: string | null): StudentLoginOrigin {
  if (origin === "conventional") return "conventional";
  return "uorconnect";
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
    return local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
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

function normalizeSender(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
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

  async sendMessage(payload: { message: string; from: string; to: string }) {
    if (!this.token) {
      return {
        ok: false,
        status: 0,
        payload: { message: "OMBALA_API_TOKEN não configurado." },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: payload.message,
          from: payload.from,
          to: payload.to,
        }),
      });

      const raw = await response.text();
      let providerPayload: unknown = null;

      if (raw) {
        try {
          providerPayload = JSON.parse(raw);
        } catch {
          providerPayload = raw;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        payload: providerPayload,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          message: error instanceof Error ? error.message : "Falha ao comunicar com o provedor SMS.",
        },
      };
    }
  }
}

function generateJuryAccessCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashJuryAccessCode(juryMemberId: number, code: string, env: Env) {
  return createHash("sha256")
    .update(`${env.JWT_SECRET}:${juryMemberId}:${code}`)
    .digest("hex");
}

function hashStudentAccessCode(phone: string, code: string, env: Env) {
  return createHash("sha256")
    .update(`${env.JWT_SECRET}:student-access:${phone}:${code}`)
    .digest("hex");
}

async function generateConventionalStudentNumber() {
  for (let index = 0; index < 8; index += 1) {
    const candidate = `8${String(randomInt(0, 100_000_000_000)).padStart(11, "0")}`;
    const existing = await prisma.student.findUnique({ where: { studentNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `8${Date.now().toString().slice(-11)}`;
}

export async function authRoutes(app: FastifyInstance, opts: { env?: Env } = {}) {
  envCache = opts.env ?? loadEnv();
  const ombala = new OmbalaClient(envCache);
  const secureCookies = shouldUseSecureCookies(envCache);
  const sharedCookieDomain = resolveSharedCookieDomain(envCache) ?? undefined;
  const scopedLoginUseCase = new LoginUseCase(studentRepository, envCache.JWT_SECRET);

  function appendAuthCookies(reply: FastifyReply, token: string, request: FastifyRequest, deviceId = resolveOdinDeviceIdFromRequest(request) ?? createOdinDeviceId()) {
    const csrfToken = randomUUID();
    const nowIso = new Date().toISOString();

    appendCookie(reply, serializeCookie(AUTH_COOKIE, token, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(CSRF_COOKIE, csrfToken, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      domain: sharedCookieDomain,
      httpOnly: false,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(SESSION_HINT_COOKIE, "1", {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      domain: sharedCookieDomain,
      httpOnly: false,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(DEVICE_COOKIE, deviceId, {
      path: "/",
      maxAge: DEVICE_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    }));
    appendCookie(reply, serializeCookie(LAST_CONNECTION_COOKIE, nowIso, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    }));
  }

  function clearAuthCookies(reply: FastifyReply) {
    clearCookie(reply, AUTH_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, CSRF_COOKIE, {
      path: "/",
      domain: sharedCookieDomain,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, SESSION_HINT_COOKIE, {
      path: "/",
      domain: sharedCookieDomain,
      secure: secureCookies,
      sameSite: "Strict"
    });
    clearCookie(reply, LAST_CONNECTION_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict"
    });
  }

  app.post<{ Body: z.infer<typeof loginSchema> }>(
    "/login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60_000,
        }
      },
      schema: {
        description: "Login com credenciais da secretaria",
        tags: ["Auth"],
        body: loginSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            studentNumber: z.string(),
            student: studentResponseSchema,
            token: z.string()
          }),
          400: z.union([authErrorSchema, fastifyErrorSchema]),
          401: authErrorSchema,
          500: z.union([authErrorSchema, fastifyErrorSchema])
        }
      }
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof loginSchema> }>, reply: FastifyReply) => {
      try {
        const result = await scopedLoginUseCase.execute({
          studentNumber: normalizeLoginIdentifier(request.body.studentNumber, request.body.identifierType),
          password: request.body.password,
          provider: request.body.provider,
          identifierType: request.body.identifierType,
        });

        if (result.success) {
          const studentNumber = result.studentNumber ?? request.body.studentNumber;
          const token = signStudentToken(result.student!.id, studentNumber, envCache);
          let normalizedStudent = normalizeStudentProfile(result.student!);
          const deviceId = resolveOdinDeviceIdFromRequest(request) ?? createOdinDeviceId();

          // Auto-complete profile for default admin students so they skip the profile step
          if (!normalizedStudent.profileCompletedAt && isDefaultAdminStudentNumber(studentNumber)) {
            await prisma.student.update({
              where: { id: normalizedStudent.id },
              data: { profileCompletedAt: new Date() },
            });
            normalizedStudent = { ...normalizedStudent, profileCompletedAt: new Date() };
          }

          // Run post-login side effects in parallel — none block the response
          await Promise.all([
            studentRepository.recordLoginAudit(normalizedStudent, normalizeLoginOrigin(request.body.origin)),
            recordOdinEvent({
              request,
              deviceId,
              student: {
                id: normalizedStudent.id,
                studentNumber: normalizedStudent.studentNumber,
                name: normalizedStudent.name,
                course: normalizedStudent.course,
              },
              eventType: "LOGIN_SUCCESS",
              riskContext: {
                provider: request.body.provider,
                identifierType: request.body.identifierType,
                origin: request.body.origin ?? "uorconnect",
              },
            }),
            submissionRepository.assignOwnershipByPhone(
              normalizedStudent.id,
              normalizedStudent.studentNumber,
              normalizedStudent.phone,
            ),
          ]);
          appendAuthCookies(reply, token, request, deviceId);
          return reply.status(200).send({
            ...result,
            student: normalizedStudent,
            token
          });
        }
        const errorMessage = result.error || "Número de estudante ou palavra-passe inválidos.";
        const statusCode = isInvalidCredentialsErrorMessage(errorMessage) ? 401 : 400;
        return reply.status(statusCode).send({
          success: false,
          error: errorMessage
        });
      } catch (err) {
        request.log.error({ err }, "login failed unexpectedly");
        return reply.status(500).send({
          success: false,
          error: "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes."
        });
      }
    }
  );

  app.post<{ Body: z.infer<typeof conventionalProfileSchema> }>(
    "/conventional/register",
    {
      config: {
        rateLimit: {
          max: 8,
          timeWindow: 60_000,
        }
      },
      schema: {
        description: "Cria ou atualiza um perfil convencional e envia código de autenticação por SMS",
        tags: ["Auth"],
        body: conventionalProfileSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            phone: z.string(),
            codeLast4: z.string(),
            expiresAt: z.string(),
            deliveryStatus: z.string(),
          }),
          400: z.object({ message: z.string() }),
          410: z.object({ message: z.string() }),
          502: z.object({ message: z.string() }),
        }
      }
    },
    async (_request, reply) => {
      return reply.code(410).send({ message: CONVENTIONAL_SMS_DISABLED_MESSAGE });
    }
  );

  app.post<{ Body: z.infer<typeof conventionalVerifySchema> }>(
    "/conventional/verify",
    {
      config: {
        rateLimit: {
          max: 12,
          timeWindow: 60_000,
        }
      },
      schema: {
        description: "Valida código SMS do acesso convencional e inicia sessão",
        tags: ["Auth"],
        body: conventionalVerifySchema,
        response: {
          200: z.object({
            success: z.literal(true),
            studentNumber: z.string(),
            student: studentResponseSchema,
            token: z.string(),
          }),
          400: z.object({ success: z.literal(false), error: z.string() }),
          401: z.object({ success: z.literal(false), error: z.string() }),
          410: z.object({ success: z.literal(false), error: z.string() }),
        }
      }
    },
    async (_request, reply) => {
      return reply.code(410).send({ success: false, error: CONVENTIONAL_SMS_DISABLED_MESSAGE });
    }
  );

  app.post<{ Body: z.infer<typeof juryLoginSchema> }>(
    "/jury/login",
    {
      config: {
        rateLimit: {
          max: 12,
          timeWindow: 60_000,
        },
      },
      schema: {
        description: "Login de júri com código único enviado por SMS",
        tags: ["Auth"],
        body: juryLoginSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            token: z.string(),
            juryMember: juryMemberResponseSchema,
          }),
          400: z.object({ message: z.string() }),
          401: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const normalizedPhone = normalizePhoneForOmbala(request.body.phone)?.phone;
      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Número de telefone inválido." });
      }

      const juryMember = await prisma.juryMember.findFirst({
        where: {
          phone: normalizedPhone,
          isActive: true,
        },
      });

      if (!juryMember) {
        return reply.code(401).send({
          success: false,
          error: "Código inválido ou expirado.",
        });
      }

      const now = new Date();
      const activeCode = await prisma.juryAccessCode.findFirst({
        where: {
          juryMemberId: juryMember.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { sentAt: "desc" },
      });

      if (!activeCode) {
        return reply.code(401).send({
          success: false,
          error: "Código inválido ou expirado.",
        });
      }

      const incomingHash = hashJuryAccessCode(juryMember.id, request.body.code, envCache);
      if (incomingHash !== activeCode.codeHash) {
        return reply.code(401).send({
          success: false,
          error: "Código inválido ou expirado.",
        });
      }

      await prisma.juryAccessCode.update({
        where: { id: activeCode.id },
        data: { usedAt: now },
      });

      const token = signJuryToken(juryMember.id, juryMember.phone, envCache);
      appendAuthCookies(reply, token, request);

      return reply.code(200).send({
        success: true,
        token,
        juryMember,
      });
    },
  );

  app.post("/logout", {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: 60_000,
      },
    },
    schema: {
      response: {
        200: z.object({ success: z.literal(true) })
      }
    }
  }, async (_, reply) => {
    clearAuthCookies(reply);
    return reply.send({ success: true });
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: envCache });

    protectedApp.post(
      "/session/refresh",
      {
        config: {
          rateLimit: {
            max: 20,
            timeWindow: 60_000,
          },
        },
        schema: {
          description: "Renova o cookie HttpOnly e o token CSRF da sessão atual",
          tags: ["Auth"],
          response: {
            200: z.object({ success: z.literal(true), role: z.enum(["student", "jury", "trainer"]) }),
            401: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        if (request.student) {
          appendAuthCookies(reply, signStudentToken(request.student.id, request.student.studentNumber, envCache), request);
          return reply.send({ success: true, role: "student" });
        }

        if (request.jury) {
          appendAuthCookies(reply, signJuryToken(request.jury.id, request.jury.phone, envCache), request);
          return reply.send({ success: true, role: "jury" });
        }

        if (request.trainer) {
          appendAuthCookies(reply, signTrainerToken(request.trainer.id, request.trainer.phone, envCache), request);
          return reply.send({ success: true, role: "trainer" });
        }

        return reply.code(401).send({ message: "Missing or invalid token" });
      },
    );

    protectedApp.get(
      "/me",
      {
        schema: {
          description: "Obtém o perfil autenticado do estudante atual",
          tags: ["Auth"],
          response: {
            200: studentResponseSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;

        if (!studentId) {
          if (request.jury) {
            return reply.code(403).send({ message: "Sessão de júri não possui perfil de estudante." });
          }
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const student = await studentRepository.findByIdWithStats(studentId);

        if (!student) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const normalizedStudent = normalizeStudentProfile(student);
        await submissionRepository.assignOwnershipByPhone(
          normalizedStudent.id,
          normalizedStudent.studentNumber,
          normalizedStudent.phone,
        );
        if (normalizedStudent.alternatePhone && normalizedStudent.alternatePhone !== normalizedStudent.phone) {
          await submissionRepository.assignOwnershipByPhone(
            normalizedStudent.id,
            normalizedStudent.studentNumber,
            normalizedStudent.alternatePhone,
          );
        }

        return reply.send(normalizedStudent);
      }
    );

    protectedApp.get(
      "/me/profile-state",
      {
        schema: {
          description: "Obtém estados de completude do perfil por finalidade",
          tags: ["Auth"],
          response: {
            200: studentProfileStateResponseSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;
        if (!studentId) {
          if (request.jury) {
            return reply.code(403).send({ message: "Sessão de júri não possui perfil de estudante." });
          }
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const student = await prisma.student.findUnique({
          where: { id: studentId },
          include: {
            profileExtra: true,
            teamMemberships: {
              where: { status: "ACTIVE" },
              orderBy: [{ updatedAt: "desc" }],
            },
          },
        });

        if (!student) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const membership = student.teamMemberships.find((item) => item.permissions.trim().length > 0) ?? student.teamMemberships[0] ?? null;
        const credential = membership
          ? await prisma.eventTeamCredential.findFirst({
              where: { teamMembershipId: membership.id },
              orderBy: { createdAt: "desc" },
            })
          : null;

        const member = credential ?? membership;
        return {
          ...profileState({
            student: normalizeStudentProfile(student),
            profileExtra: student.profileExtra,
            member,
          }),
          fieldSources: resolveProfileFieldSources(student),
          profileExtra: student.profileExtra ? {
            bio: student.profileExtra.bio,
            address: student.profileExtra.address,
            instagramUrl: student.profileExtra.instagramUrl,
            facebookUrl: student.profileExtra.facebookUrl,
            linkedinUrl: student.profileExtra.linkedinUrl,
            githubUrl: student.profileExtra.githubUrl,
            websiteUrl: student.profileExtra.websiteUrl,
            consentPhotoCredential: student.profileExtra.consentPhotoCredential,
            consentPublicProfile: student.profileExtra.consentPublicProfile,
            consentSocialLinks: student.profileExtra.consentSocialLinks,
            consentSms: student.profileExtra.consentSms,
            consentWhatsapp: student.profileExtra.consentWhatsapp,
            visibilityJson: student.profileExtra.visibilityJson,
          } : null,
        };
      }
    );

    protectedApp.patch(
      "/me",
      {
        schema: {
          description: "Atualiza campos editáveis do perfil autenticado do estudante atual",
          tags: ["Auth"],
          body: profileUpdateSchema,
          response: {
            200: studentResponseSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;
        if (!studentId) {
          if (request.jury) {
            return reply.code(403).send({ message: "Sessão de júri não possui perfil de estudante." });
          }
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const existing = await studentRepository.findByIdWithStats(studentId);
        if (!existing) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const body = request.body as z.infer<typeof profileUpdateSchema>;
        if (Object.keys(body).length === 0) {
          return reply.code(400).send({ message: "Nenhum campo para atualizar foi enviado." });
        }

        const officialName = normalizeStudentName(existing.name);
        const requestedName = body.name !== undefined ? normalizeStudentName(body.name) : undefined;
        if (existing.academicSyncedAt && requestedName && officialName && requestedName !== officialName) {
          return reply.code(409).send({
            message: "O nome oficial vem da Secretaria e não pode ser alterado livremente no perfil.",
          });
        }

        const officialCourse = normalizeCourse(existing.course);
        const requestedCourse = body.course !== undefined ? normalizeCourse(body.course) : undefined;
        if (existing.academicSyncedAt && requestedCourse && officialCourse && requestedCourse !== officialCourse) {
          return reply.code(409).send({
            message: "O curso oficial vem da Secretaria e não pode ser alterado livremente no perfil.",
          });
        }

        const shouldAuditConsentChange = hasProfileConsentPatch(body);
        const beforeProfileExtra = shouldAuditConsentChange || body.visibilityJson !== undefined
          ? await prisma.studentProfileExtra.findUnique({ where: { studentId } })
          : null;
        const beforeProfileSnapshot = profileAuditSnapshot({
          ...existing,
          visibilityJson: beforeProfileExtra?.visibilityJson ?? null,
        });

        const avatarUrl = body.avatarUrl !== undefined
          ? await persistMediaValue(envCache, body.avatarUrl, { purpose: "avatars", maxImageDimension: 900 })
          : undefined;

        const updated = await studentRepository.updateProfile(studentId, {
          name: body.name !== undefined ? normalizeStudentName(body.name) : undefined,
          email: body.email !== undefined ? (body.email.trim() || undefined) : undefined,
          course: body.course !== undefined ? normalizeCourse(body.course) : undefined,
          phone: body.phone !== undefined ? normalizeAngolaPhone(body.phone) : undefined,
          alternatePhone: body.alternatePhone !== undefined ? normalizeNullablePhone(body.alternatePhone) : undefined,
          avatarUrl: body.avatarUrl !== undefined ? normalizeAvatarUrl(avatarUrl) : undefined,
          bio: body.bio !== undefined ? (body.bio?.trim() || null) : undefined,
          address: body.address !== undefined ? (body.address?.trim() || null) : undefined,
          instagramUrl: body.instagramUrl !== undefined ? (body.instagramUrl?.trim() || null) : undefined,
          facebookUrl: body.facebookUrl !== undefined ? (body.facebookUrl?.trim() || null) : undefined,
          linkedinUrl: body.linkedinUrl !== undefined ? (body.linkedinUrl?.trim() || null) : undefined,
          githubUrl: body.githubUrl !== undefined ? (body.githubUrl?.trim() || null) : undefined,
          websiteUrl: body.websiteUrl !== undefined ? (body.websiteUrl?.trim() || null) : undefined,
        });

        if (!updated) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const profileExtraHasSocials = hasSocialProfileFields(body);
        const nextProfileExtra = await upsertStudentProfileExtra(prisma, studentId, {
          bio: body.bio,
          address: body.address,
          instagramUrl: body.instagramUrl,
          facebookUrl: body.facebookUrl,
          linkedinUrl: body.linkedinUrl,
          githubUrl: body.githubUrl,
          websiteUrl: body.websiteUrl,
          consentPhotoCredential: body.consentPhotoCredential,
          consentPublicProfile: body.consentPublicProfile,
          consentSocialLinks: body.consentSocialLinks !== undefined
            ? body.consentSocialLinks && profileExtraHasSocials
            : undefined,
          consentSms: body.consentSms,
          consentWhatsapp: body.consentWhatsapp,
          visibilityJson: body.visibilityJson,
        });

        if (shouldAuditConsentChange) {
          const before = pickProfileConsentSnapshot(beforeProfileExtra);
          const after = pickProfileConsentSnapshot(nextProfileExtra ?? beforeProfileExtra);
          const changes = profileConsentChanges(before, after);
          if (changes.length > 0) {
            await recordAdminAudit({
              actorStudentNumber: existing.studentNumber,
              actorRole: "student",
              action: "student_profile.consent_update",
              entityType: "StudentProfileExtra",
              entityId: studentId,
              summary: `${existing.studentNumber} atualizou consentimentos do perfil.`,
              metadata: { changes, before, after },
            });
          }
        }

        const afterProfileSnapshot = profileAuditSnapshot({
          ...updated,
          visibilityJson: (nextProfileExtra ?? beforeProfileExtra)?.visibilityJson ?? null,
        });
        const profileChanges = profileChangedFields(beforeProfileSnapshot, afterProfileSnapshot);
        if (profileChanges.length > 0) {
          await recordAdminAudit({
            actorStudentNumber: existing.studentNumber,
            actorRole: "student",
            action: "student_profile.update",
            entityType: "Student",
            entityId: studentId,
            summary: `${existing.studentNumber} atualizou dados sensíveis do perfil.`,
            metadata: {
              changedFields: profileChanges,
              before: beforeProfileSnapshot,
              after: afterProfileSnapshot,
              officialFields: {
                name: existing.academicSyncedAt ? "SECRETARIA" : "DECLARED",
                course: existing.academicSyncedAt ? "SECRETARIA" : "DECLARED",
              },
            },
          });
        }

        const normalizedStudent = normalizeStudentProfile(updated);
        await submissionRepository.assignOwnershipByPhone(
          normalizedStudent.id,
          normalizedStudent.studentNumber,
          normalizedStudent.phone,
        );
        if (normalizedStudent.alternatePhone && normalizedStudent.alternatePhone !== normalizedStudent.phone) {
          await submissionRepository.assignOwnershipByPhone(
            normalizedStudent.id,
            normalizedStudent.studentNumber,
            normalizedStudent.alternatePhone,
          );
        }

        return reply.send(normalizedStudent);
      }
    );

    const completeProfileSchema = z.object({
      name: z.string().trim().min(2).max(120),
      avatarUrl: profileAvatarSchema.optional().nullable(),
      bio: z.string().trim().max(500).optional(),
      address: z.string().trim().max(200).optional(),
      instagramUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
      facebookUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
      linkedinUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
      githubUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
      websiteUrl: z.union([z.string().trim().url().max(300), z.literal(""), z.null()]).optional(),
      consentPhotoCredential: z.boolean().optional(),
      consentPublicProfile: z.boolean().optional(),
      consentSocialLinks: z.boolean().optional(),
      consentSms: z.boolean().optional(),
      consentWhatsapp: z.boolean().optional(),
      visibilityJson: z.string().trim().max(2_000).nullable().optional(),
    });

    protectedApp.post(
      "/complete-profile",
      {
        schema: {
          description: "Completa o perfil do estudante no onboarding pós-login",
          tags: ["Auth"],
          body: completeProfileSchema,
          response: {
            200: studentResponseSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const studentId = request.student?.id;
        if (!studentId) {
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const existing = await studentRepository.findByIdWithStats(studentId);
        if (!existing) {
          return reply.code(404).send({ message: "Student not found" });
        }

        if (existing.profileCompletedAt) {
          return reply.code(409).send({ message: "Este perfil já foi concluído. Usa a área pessoal para atualizar os teus dados." });
        }

        const body = request.body as z.infer<typeof completeProfileSchema>;
        const officialName = normalizeStudentName(existing.name);
        const requestedName = normalizeStudentName(body.name);
        if (existing.academicSyncedAt && officialName && requestedName && requestedName !== officialName) {
          return reply.code(409).send({
            message: "O nome oficial vem da Secretaria e não pode ser alterado livremente no onboarding.",
          });
        }

        const avatarUrl = body.avatarUrl
          ? await persistMediaValue(envCache, body.avatarUrl, { purpose: "avatars", maxImageDimension: 900 })
          : null;

        const updated = await studentRepository.updateProfile(studentId, {
          name: existing.academicSyncedAt && officialName ? officialName : requestedName,
          avatarUrl: avatarUrl ? normalizeAvatarUrl(avatarUrl) : existing.avatarUrl,
          bio: body.bio?.trim() || null,
          address: body.address?.trim() || null,
          instagramUrl: body.instagramUrl?.trim() || null,
          facebookUrl: body.facebookUrl?.trim() || null,
          linkedinUrl: body.linkedinUrl?.trim() || null,
          githubUrl: body.githubUrl?.trim() || null,
          websiteUrl: body.websiteUrl?.trim() || null,
          profileCompletedAt: new Date(),
        });

        if (!updated) {
          return reply.code(404).send({ message: "Student not found" });
        }

        const beforeProfileSnapshot = profileAuditSnapshot(existing);
        const afterProfileSnapshot = profileAuditSnapshot(updated);
        const profileChanges = profileChangedFields(beforeProfileSnapshot, afterProfileSnapshot);
        if (profileChanges.length > 0) {
          await recordAdminAudit({
            actorStudentNumber: existing.studentNumber,
            actorRole: "student",
            action: "student_profile.update",
            entityType: "Student",
            entityId: studentId,
            summary: `${existing.studentNumber} concluiu perfil e atualizou dados sensíveis.`,
            metadata: {
              changedFields: profileChanges,
              before: beforeProfileSnapshot,
              after: afterProfileSnapshot,
              source: "complete-profile",
            },
          });
        }

        const beforeProfileExtra = await prisma.studentProfileExtra.findUnique({ where: { studentId } });
        const nextProfileExtra = await upsertStudentProfileExtra(prisma, studentId, {
          bio: body.bio,
          address: body.address,
          instagramUrl: body.instagramUrl,
          facebookUrl: body.facebookUrl,
          linkedinUrl: body.linkedinUrl,
          githubUrl: body.githubUrl,
          websiteUrl: body.websiteUrl,
          consentPhotoCredential: body.consentPhotoCredential,
          consentPublicProfile: body.consentPublicProfile,
          consentSocialLinks: body.consentSocialLinks !== undefined
            ? body.consentSocialLinks && hasSocialProfileFields(body)
            : undefined,
          consentSms: body.consentSms,
          consentWhatsapp: body.consentWhatsapp,
          visibilityJson: body.visibilityJson,
        });

        if (hasProfileConsentPatch(body)) {
          const before = pickProfileConsentSnapshot(beforeProfileExtra);
          const after = pickProfileConsentSnapshot(nextProfileExtra ?? beforeProfileExtra);
          const changes = profileConsentChanges(before, after);
          if (changes.length > 0) {
            await recordAdminAudit({
              actorStudentNumber: existing.studentNumber,
              actorRole: "student",
              action: "student_profile.consent_update",
              entityType: "StudentProfileExtra",
              entityId: studentId,
              summary: `${existing.studentNumber} definiu consentimentos no onboarding.`,
              metadata: { changes, before, after, source: "complete-profile" },
            });
          }
        }

        return reply.send(normalizeStudentProfile(updated));
      }
    );

    protectedApp.get(
      "/me/pass.pdf",
      {
        schema: {
          description: "Gera o passe/credencial do estudante em PDF",
          tags: ["Auth"],
          response: {
            401: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const studentId = request.student?.id;
        if (!studentId) {
          return reply.code(401).send({ message: "Missing or invalid token" });
        }

        const studentRow = await prisma.student.findUnique({
          where: { id: studentId },
          include: { attendanceCredential: true, profileExtra: true },
        });

        if (!studentRow) {
          return reply.code(404).send({ message: "Student not found" });
        }

        // Cast to include new social fields (available after migration)
        const student = studentRow as typeof studentRow & {
          instagramUrl?: string | null;
          linkedinUrl?: string | null;
          githubUrl?: string | null;
        };

        const name = student.name ?? "Estudante UOR Connect";
        const course = student.course ?? "";
        const credentialToken = student.attendanceCredential?.token;
        const baseUrl = envCache.PUBLIC_APP_URL
          ?? envCache.CORS_ORIGIN.split(",").map((s) => s.trim()).find((s) => s.startsWith("http"))
          ?? "https://uorconnect.space";
        const validationUrl = credentialToken
          ? `${baseUrl}/validar/${credentialToken}`
          : `${baseUrl}/minha-area`;

        const [qrDataUri, logoDataUri] = await Promise.all([
          renderQrDataUri(validationUrl, 720),
          loadLogoDataUri(),
        ]);

        const canShowSocials = Boolean(student.profileExtra?.consentSocialLinks);
        const socialLinks = {
          instagram: canShowSocials ? student.instagramUrl ?? null : null,
          linkedin: canShowSocials ? student.linkedinUrl ?? null : null,
          github: canShowSocials ? student.githubUrl ?? null : null,
        };
        const hasSocials = socialLinks.instagram || socialLinks.linkedin || socialLinks.github;

        const html = `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Passe ${escapeHtml(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 210mm; min-height: 297mm; font-family: 'DM Sans', Inter, Arial, sans-serif; color: #0f172a; background: #f8fafc; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .sheet { position: relative; width: 210mm; height: 297mm; padding: 18mm; display: grid; place-items: center; background: #f8fafc; }
    .cut { position: absolute; width: 10mm; height: 10mm; border-color: #94a3b8; }
    .cut.tl { top: 72mm; left: 53mm; border-top: .3mm solid; border-left: .3mm solid; }
    .cut.tr { top: 72mm; right: 53mm; border-top: .3mm solid; border-right: .3mm solid; }
    .cut.bl { bottom: 78mm; left: 53mm; border-bottom: .3mm solid; border-left: .3mm solid; }
    .cut.br { bottom: 78mm; right: 53mm; border-bottom: .3mm solid; border-right: .3mm solid; }
    .cut-line { position: absolute; left: 56mm; top: 75mm; width: 98mm; height: 141mm; border: .25mm dashed rgba(148, 163, 184, .5); border-radius: 4mm; pointer-events: none; }
    .print-note { position: absolute; left: 18mm; right: 18mm; top: 18mm; display: flex; justify-content: space-between; gap: 8mm; color: #94a3b8; font-size: 8px; font-weight: 500; letter-spacing: .04em; }
    .pass { position: relative; width: 98mm; height: 141mm; overflow: hidden; border-radius: 4mm; background: #fff; border: .3mm solid #e2e8f0; box-shadow: 0 4mm 14mm rgba(15, 23, 42, .08); }
    .top { position: relative; min-height: 40mm; padding: 5.5mm 6mm 18mm; color: #fff; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); }
    .brand { display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
    .brand img { max-width: 35mm; max-height: 12mm; object-fit: contain; filter: brightness(0) invert(1); opacity: .9; }
    .brand-fallback { font-size: 13px; font-weight: 800; letter-spacing: .02em; opacity: .9; }
    .badge { border: .25mm solid rgba(255,255,255,.2); border-radius: 999px; padding: 1.8mm 4mm; font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; background: rgba(255,255,255,.08); }
    .body { position: relative; padding: 5mm 6mm 12mm; }
    h1 { margin: 0; text-align: center; font-size: 19px; font-weight: 700; line-height: 1.15; color: #0f172a; }
    .subtitle { margin: 2mm auto 0; max-width: 75mm; text-align: center; color: #64748b; font-size: 11px; line-height: 1.35; }
    .student-id { margin: 3mm auto 0; text-align: center; }
    .student-id span { display: inline-block; background: #0f172a; color: #fff; font-size: 9.5px; font-weight: 700; letter-spacing: .08em; padding: 1.5mm 4mm; border-radius: 1.5mm; }
    .info-grid { margin: 3.5mm 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; }
    .info-cell { border: .25mm solid #e2e8f0; border-radius: 2.5mm; padding: 3mm 3.5mm; background: #f8fafc; }
    .info-cell .label { display: block; color: #94a3b8; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .info-cell .value { display: block; margin-top: 1mm; color: #1e293b; font-size: 10.5px; font-weight: 600; line-height: 1.2; }
    .social-row { margin-top: 3mm; display: flex; flex-wrap: wrap; gap: 2mm; justify-content: center; }
    .social-tag { display: inline-flex; align-items: center; gap: 1mm; border: .2mm solid #e2e8f0; border-radius: 1.5mm; padding: 1.2mm 3mm; font-size: 8.5px; font-weight: 600; color: #475569; background: #f8fafc; }
    .qr-section { display: grid; grid-template-columns: 28mm 1fr; gap: 3.5mm; align-items: center; border-top: .25mm solid #e2e8f0; padding-top: 3.5mm; margin-top: 3.5mm; margin-bottom: 6mm; }
    .qr { width: 28mm; height: 28mm; display: grid; place-items: center; border: .25mm solid #e2e8f0; border-radius: 2.5mm; background: #fff; }
    .qr img { width: 24mm; height: 24mm; }
    .verify .verify-label { display: block; color: #1e293b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .verify p { margin: 1.2mm 0 0; color: #64748b; font-size: 9px; line-height: 1.35; overflow-wrap: anywhere; }
    .pass-footer { position: absolute; left: 6mm; right: 6mm; bottom: 4mm; display: flex; justify-content: space-between; align-items: center; }
    .pass-footer span { color: #94a3b8; font-size: 8px; font-weight: 600; letter-spacing: .04em; }
    .pass-footer .accent { width: 10mm; height: .6mm; background: linear-gradient(90deg, #1e293b, #64748b); border-radius: 1mm; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="print-note">
      <span>UOR Connect · Credencial de Estudante</span>
      <span>Recortar pelas linhas tracejadas</span>
    </div>
    <span class="cut tl"></span><span class="cut tr"></span><span class="cut bl"></span><span class="cut br"></span>
    <div class="cut-line"></div>
    <article class="pass">
      <section class="top">
        <div class="brand">
          ${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : `<div class="brand-fallback">UOR Connect</div>`}
          <div class="badge">Estudante</div>
        </div>
      </section>
      <section class="body">
        <h1>${escapeHtml(name)}</h1>
        <p class="subtitle">${escapeHtml(course || "Universidade Óscar Ribas")}</p>
        <div class="student-id"><span>N.º ${escapeHtml(student.studentNumber)}</span></div>
        <div class="info-grid">
          <div class="info-cell"><span class="label">Número</span><span class="value">${escapeHtml(student.studentNumber)}</span></div>
          <div class="info-cell"><span class="label">Curso</span><span class="value">${escapeHtml(course || "—")}</span></div>
        </div>
        ${hasSocials ? `<div class="social-row">
          ${socialLinks.instagram ? `<span class="social-tag">Instagram</span>` : ""}
          ${socialLinks.linkedin ? `<span class="social-tag">LinkedIn</span>` : ""}
          ${socialLinks.github ? `<span class="social-tag">GitHub</span>` : ""}
        </div>` : ""}
        <div class="qr-section">
          <div class="qr"><img src="${qrDataUri}" alt="QR" /></div>
          <div class="verify">
            <span class="verify-label">Validação</span>
            <p>${escapeHtml(validationUrl)}</p>
          </div>
        </div>
        <div class="pass-footer">
          <span>UOR CONNECT</span>
          <div class="accent"></div>
          <span>${escapeHtml(student.studentNumber)}</span>
        </div>
      </section>
    </article>
  </div>
</body>
</html>`;

        const buffer = await renderPdfFromHtml(html, {
          preferCssPageSize: true,
          displayHeaderFooter: false,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });

        const fileName = `Passe_${student.studentNumber}.pdf`;
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `inline; filename="${fileName}"`)
          .send(buffer);
      },
    );
  });

  app.get<{ Params: { studentNumber: string } }>(
    "/students/:studentNumber",
    {
      schema: {
        description: "Obtém dados do estudante pelo número",
        tags: ["Students"],
        params: z.object({
          studentNumber: z.string().trim()
        }),
        response: {
          200: studentResponseSchema,
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const studentNumber = normalizeInstitutionalStudentLookup(request.params.studentNumber);
      const student = await studentRepository.findByStudentNumber(studentNumber);
      if (!student) {
        return reply.code(404).send({ message: "Student not found" });
      }
      const normalizedStudent = normalizeStudentProfile(student);
      return reply.send(normalizedStudent);
    }
  );

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: envCache });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["STUDENTS"]);

    adminApp.get(
      "/admin/access",
      {
        config: { adminPermissionPolicy: null },
        schema: {
          description: "Perfil de acesso administrativo da sessão atual",
          tags: ["Students"],
          response: {
            200: adminAccessProfileSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
      if (request.jury) {
          const juryProfile = await getJuryAdminProfileById(request.jury.id);
          if (!juryProfile) return reply.status(403).send({ message: "Access denied" });
          return reply.send(juryProfile);
        }

        if (!request.student) {
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const profile = await getAdminProfileByStudentNumber(request.student.studentNumber);
        if (!profile) {
          return reply.status(403).send({ message: "Access denied" });
        }

        return reply.send(profile);
      }
    );

    adminApp.get(
      "/students/paged",
      {
        schema: {
          description: "Lista paginada de estudantes com estatísticas",
          tags: ["Students"],
          querystring: studentsPagedQuerySchema,
          response: {
            200: z.object({
              items: z.array(studentWithStatsResponseSchema),
              total: z.number(),
              page: z.number(),
              totalPages: z.number(),
              stats: z.object({
                total: z.number(),
                official: z.number(),
                temporary: z.number(),
                universities: z.number(),
                synced: z.number(),
                profileComplete: z.number(),
                withEmail: z.number(),
                withPhone: z.number(),
              }),
              facets: z.object({
                courses: z.array(z.string()),
                universities: z.array(z.string()),
              }),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() })
          }
        }
      },
      async (request, reply) => {
        const query = studentsPagedQuerySchema.parse(request.query);
        const payload = await studentRepository.listAllWithStatsPaged(query);
        return reply.send({
          ...payload,
          items: payload.items.map((student) => normalizeStudentProfile(student)),
        });
      }
    );

    adminApp.get(
      "/students",
      {
        schema: {
          description: "Lista todos os estudantes",
          tags: ["Students"],
          response: {
            200: z.array(
              studentWithStatsResponseSchema
            ),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() })
          }
        }
      },
      async (_, reply) => {
        const students = await listStudentsWithStatsUseCase.execute();
        return reply.send(
          students.map((student) => normalizeStudentProfile(student))
        );
      }
    );

    adminApp.get(
      "/security",
      {
        config: requireAdminPermission(["SECURITY"]),
        schema: {
          description: "Visão geral da segurança administrativa",
          tags: ["Students"],
          response: {
            200: securityOverviewSchema,
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          }
        }
      },
      async (_, reply) => {
        const overview = await listAdminSecurityOverviewUseCase.execute();
        return reply.send({
          authorizedStudents: overview.authorizedStudents,
          recentLogins: overview.recentLogins.map((student) => normalizeStudentProfile(student)),
          adminAccessConflicts: overview.adminAccessConflicts,
        });
      }
    );

    adminApp.post<{ Body: z.infer<typeof securityStudentNumberSchema> }>(
      "/security/authorized-students",
      {
        config: requireAdminPermission(["SECURITY"], "ALL"),
        schema: {
          description: "Autoriza um número de estudante a abrir a área administrativa",
          tags: ["Students"],
          body: securityStudentNumberSchema,
          response: {
            201: adminAuthorizedStudentSchema,
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const result = await authorizeAdminStudentUseCase.execute(request.body.studentNumber, {
          team: request.body.team,
          role: request.body.role,
          permissions: request.body.permissions,
        });
        if (!result.success) {
          return reply.code(400).send({ message: result.error });
        }

        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "security.authorize_admin",
          entityType: "AdminAuthorizedStudent",
          entityId: result.authorizedStudent?.studentNumber,
          summary: `Acesso administrativo autorizado para ${result.authorizedStudent?.studentNumber} (${result.authorizedStudent?.team}).`,
        });

        return reply.code(201).send(result.authorizedStudent);
      }
    );

    adminApp.delete<{ Params: z.infer<typeof securityStudentNumberSchema> }>(
      "/security/authorized-students/:studentNumber",
      {
        config: requireAdminPermission(["SECURITY"], "ALL"),
        schema: {
          description: "Revoga o acesso administrativo por número de estudante",
          tags: ["Students"],
          params: securityStudentNumberSchema,
          response: {
            200: z.object({ success: z.literal(true) }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      },
      async (request, reply) => {
        const result = await revokeAdminStudentUseCase.execute(request.params.studentNumber, {
          revokedByStudentNumber: request.student?.studentNumber ?? null,
        });
        if (result.success) {
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "security.revoke_admin",
            entityType: "AdminAuthorizedStudent",
            entityId: request.params.studentNumber,
            summary: `Acesso administrativo revogado para ${request.params.studentNumber}.`,
          });
          return reply.send({ success: true });
        }

        if (result.error === "Authorized student not found") {
          return reply.code(404).send({ message: result.error });
        }

        return reply.code(400).send({ message: result.error ?? "Unable to revoke student access" });
      }
    );

    adminApp.get(
      "/security/jury-members",
      {
        config: requireAdminPermission(["SECURITY"]),
        schema: {
          description: "Lista os números autorizados para login do júri",
          tags: ["Students"],
          response: {
            200: z.object({
              juryMembers: z.array(juryMemberResponseSchema),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (_, reply) => {
        const juryMembers = await prisma.juryMember.findMany({
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        });
        return reply.send({ juryMembers });
      },
    );

    adminApp.post<{ Body: z.infer<typeof juryMemberCreateSchema> }>(
      "/security/jury-members",
      {
        config: requireAdminPermission(["SECURITY"], "ALL"),
        schema: {
          description: "Regista um novo número para acesso de júri",
          tags: ["Students"],
          body: juryMemberCreateSchema,
          response: {
            201: juryMemberResponseSchema,
            400: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const normalizedPhone = normalizePhoneForOmbala(request.body.phone)?.phone;
        if (!normalizedPhone) {
          return reply.code(400).send({ message: "Número de telefone inválido para SMS." });
        }

        try {
          const juryMember = await prisma.juryMember.create({
            data: {
              name: request.body.name.trim(),
              phone: normalizedPhone,
              team: request.body.team?.trim() || "Júri",
              role: request.body.role ?? "TEAM_LEAD",
              permissions: request.body.role === "SUPER_ADMIN"
                ? "ALL"
                : serializeAdminPermissions(request.body.permissions ?? ["OVERVIEW", "SUBMISSIONS", "VOTES", "WINNERS"]),
              isActive: true,
            },
          });

          return reply.code(201).send(juryMember);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return reply.code(409).send({ message: "Este número já está registado como júri." });
          }
          throw error;
        }
      },
    );

    adminApp.delete<{ Params: z.infer<typeof juryMemberIdSchema> }>(
      "/security/jury-members/:id",
      {
        config: requireAdminPermission(["SECURITY"], "ALL"),
        schema: {
          description: "Remove um número de júri",
          tags: ["Students"],
          params: juryMemberIdSchema,
          response: {
            200: z.object({ success: z.literal(true) }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const existing = await prisma.juryMember.findUnique({
          where: { id: request.params.id },
          select: { id: true },
        });

        if (!existing) {
          return reply.code(404).send({ message: "Júri não encontrado." });
        }

        await prisma.juryMember.delete({ where: { id: request.params.id } });
        return reply.send({ success: true });
      },
    );

    adminApp.post<{ Params: z.infer<typeof juryMemberIdSchema>; Body: z.infer<typeof jurySendCodeSchema> }>(
      "/security/jury-members/:id/send-code",
      {
        config: requireAdminPermission(["SECURITY"]),
        schema: {
          description: "Gera e envia um código único de acesso para um júri por SMS",
          tags: ["Students"],
          params: juryMemberIdSchema,
          body: jurySendCodeSchema,
          response: {
            200: z.object({
              success: z.literal(true),
              juryMemberId: z.number(),
              phone: z.string(),
              codeLast4: z.string(),
              expiresAt: z.string(),
              deliveryStatus: z.string(),
            }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            502: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        if (!ombala.isConfigured) {
          return reply.code(400).send({ message: "Integração SMS não configurada. Define OMBALA_API_TOKEN no backend." });
        }

        const juryMember = await prisma.juryMember.findUnique({
          where: { id: request.params.id },
        });

        if (!juryMember || !juryMember.isActive) {
          return reply.code(404).send({ message: "Júri não encontrado ou inativo." });
        }

        const normalizedPhone = normalizePhoneForOmbala(juryMember.phone);
        if (!normalizedPhone) {
          return reply.code(400).send({ message: "Telefone do júri inválido para envio SMS." });
        }

        const sender = normalizeSender(envCache.OMBALA_SMS_DEFAULT_SENDER ?? "");
        if (!sender || !/^[A-Z0-9 _-]{3,16}$/.test(sender)) {
          return reply.code(400).send({
            message: "Remetente SMS inválido. Ajusta OMBALA_SMS_DEFAULT_SENDER para 3-16 caracteres válidos.",
          });
        }

        const expiresInMinutes = request.body.expiresInMinutes ?? 15;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + expiresInMinutes * 60_000);
        const code = generateJuryAccessCode();
        const codeHash = hashJuryAccessCode(juryMember.id, code, envCache);
        const codeLast4 = code.slice(-4);

        await prisma.juryAccessCode.updateMany({
          where: {
            juryMemberId: juryMember.id,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            usedAt: now,
            deliveryStatus: "REVOKED",
            errorMessage: "Código substituído por um novo envio administrativo.",
          },
        });

        const smsMessage = `UOR Connect: codigo do juri ${code}. Valido por ${expiresInMinutes} minutos. Nao partilhe este codigo.`;
        const providerResponse = await ombala.sendMessage({
          from: sender,
          message: smsMessage,
          to: normalizedPhone.providerTo,
        });

        const providerError = pickString((providerResponse.payload as Record<string, unknown>)?.message)
          ?? `Falha no provedor (status ${providerResponse.status || "desconhecido"}).`;

        const createdCode = await prisma.juryAccessCode.create({
          data: {
            juryMemberId: juryMember.id,
            codeHash,
            codeLast4,
            expiresAt,
            usedAt: providerResponse.ok ? null : now,
            sentAt: now,
            createdByStudentNumber: request.student?.studentNumber ?? "unknown",
            providerMessageId: extractProviderMessageId(providerResponse.payload),
            providerResponseJson: stringifyProviderPayload(providerResponse.payload),
            deliveryStatus: providerResponse.ok ? "SENT" : "FAILED",
            errorMessage: providerResponse.ok ? null : providerError,
          },
        });

        if (!providerResponse.ok) {
          return reply.code(502).send({
            message: `Não foi possível enviar o código por SMS. ${providerError}`,
          });
        }

        await prisma.juryMember.update({
          where: { id: juryMember.id },
          data: { lastCodeSentAt: now },
        });

        return reply.send({
          success: true,
          juryMemberId: juryMember.id,
          phone: juryMember.phone,
          codeLast4: createdCode.codeLast4,
          expiresAt: createdCode.expiresAt.toISOString(),
          deliveryStatus: createdCode.deliveryStatus,
        });
      },
    );

    adminApp.delete<{ Params: { id: string } }>(
      "/students/:id",
      {
        schema: {
          description: "Remove estudante e respetivas interações",
          tags: ["Students"],
          params: z.object({
            id: z.string().trim()
          }),
          response: {
            200: z.object({ success: z.literal(true) }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request, reply) => {
        const result = await deleteStudentUseCase.execute(Number(request.params.id));
        if (result.success) {
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "student.delete",
            entityType: "Student",
            entityId: request.params.id,
            summary: `Estudante ${request.params.id} removido pelo administrador.`,
          });
          return reply.send({ success: true });
        }

        if (result.error === "Student not found") {
          return reply.code(404).send({ message: result.error });
        }

        return reply.code(400).send({ message: result.error ?? "Unable to delete student" });
      }
    );
  });
}
