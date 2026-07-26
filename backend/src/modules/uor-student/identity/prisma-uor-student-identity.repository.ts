import { randomUUID } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import type { UorStudentIdentity, UorStudentIdentityRepository } from "../application/ports";
import type {
  UorStudentDataRequestView,
  UorStudentPrivacyPreferenceView,
  UorStudentPrivacyPurpose,
  UorStudentProfileField,
  UorStudentProfileView,
} from "../domain/models";

type Database = typeof prisma;

const POLICY_VERSION = "uor-student-privacy-2026-07-22";
const PURPOSES = new Set<UorStudentPrivacyPurpose>([
  "public_profile",
  "learning_recommendations",
  "ranking_participation",
  "notifications_sms",
  "notifications_whatsapp",
  "finance_reference_sharing",
  "tutoring_data_access",
]);

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; }
  catch { return fallback; }
}

function declaredField(value: string | null, updatedAt: Date | null): UorStudentProfileField<string> {
  return { value, source: value === null ? "unknown" : "student", observedAt: updatedAt?.toISOString() ?? null };
}

function officialField(value: string | null, observedAt: Date | null): UorStudentProfileField<string> {
  return { value, source: value === null ? "unknown" : "secretaria_uor", observedAt: observedAt?.toISOString() ?? null };
}

function dataStatus(value: string): UorStudentDataRequestView["status"] {
  return value.toLowerCase() as UorStudentDataRequestView["status"];
}

function dataRequestView(record: {
  id: string;
  type: string;
  status: string;
  scopeJson: string;
  retentionJson: string;
  resultJson: string | null;
  errorCode: string | null;
  requestedAt: Date;
  completedAt: Date | null;
}): UorStudentDataRequestView {
  return {
    id: record.id,
    type: record.type === "DELETE" ? "delete" : "export",
    status: dataStatus(record.status),
    scope: parseJson<string[]>(record.scopeJson, []),
    retentions: parseJson(record.retentionJson, []),
    resultAvailable: Boolean(record.resultJson) && record.status === "COMPLETED",
    errorCode: record.errorCode,
    requestedAt: record.requestedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}

function privacyView(record: {
  id: string;
  purpose: string;
  enabled: boolean;
  policyVersion: string;
  fieldsJson: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  updatedAt: Date;
}): UorStudentPrivacyPreferenceView {
  if (!PURPOSES.has(record.purpose as UorStudentPrivacyPurpose)) throw new Error("UOR_STUDENT_PRIVACY_PURPOSE_INVALID");
  return {
    id: record.id,
    purpose: record.purpose as UorStudentPrivacyPurpose,
    enabled: record.enabled,
    policyVersion: record.policyVersion,
    fields: parseJson<string[]>(record.fieldsJson, []),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PrismaUorStudentIdentityRepository implements UorStudentIdentityRepository {
  constructor(private readonly db: Database = prisma) {}

  async getProfile(student: UorStudentIdentity): Promise<UorStudentProfileView | null> {
    let record = await this.db.student.findFirst({
      where: { id: student.id, institutionCode: student.institutionCode, studentNumber: student.studentNumber, deletedAt: null },
      select: {
        id: true,
        uorStudentPublicId: true,
        institutionCode: true,
        studentNumber: true,
        name: true,
        course: true,
        classCode: true,
        academicYear: true,
        academicPeriod: true,
        academicSyncedAt: true,
        updatedAt: true,
        uorStudentProfileFields: { select: { field: true, valueJson: true, updatedAt: true } },
      },
    });
    if (!record) return null;
    if (!record.uorStudentPublicId) {
      const publicId = randomUUID();
      await this.db.student.updateMany({
        where: { id: record.id, uorStudentPublicId: null },
        data: { uorStudentPublicId: publicId },
      });
      record = { ...record, uorStudentPublicId: (await this.db.student.findUnique({ where: { id: record.id }, select: { uorStudentPublicId: true } }))?.uorStudentPublicId ?? publicId };
    }
    const fields = new Map(record.uorStudentProfileFields.map((field) => [field.field, field]));
    const publicId = record.uorStudentPublicId;
    if (!publicId) throw new Error("UOR_STUDENT_PUBLIC_ID_MISSING");
    const declared = (name: string) => {
      const field = fields.get(name);
      const value = field ? parseJson<string | null>(field.valueJson, null) : null;
      return declaredField(value, field?.updatedAt ?? null);
    };
    return {
      id: publicId,
      institutionCode: record.institutionCode,
      studentNumber: record.studentNumber,
      fields: {
        displayName: officialField(record.name, record.academicSyncedAt),
        course: officialField(record.course, record.academicSyncedAt),
        classCode: officialField(record.classCode, record.academicSyncedAt),
        academicYear: officialField(record.academicYear, record.academicSyncedAt),
        academicPeriod: officialField(record.academicPeriod, record.academicSyncedAt),
        email: declared("email"),
        phone: declared("phone"),
        alternatePhone: declared("alternatePhone"),
        bio: declared("bio"),
        address: declared("address"),
      },
    };
  }

  async updateProfile(input: Parameters<UorStudentIdentityRepository["updateProfile"]>[0]) {
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const exists = await tx.student.findFirst({
        where: { id: input.student.id, institutionCode: input.student.institutionCode, studentNumber: input.student.studentNumber, deletedAt: null },
        select: { id: true },
      });
      if (!exists) throw new Error("UOR_STUDENT_NOT_FOUND");
      for (const [field, value] of Object.entries(input.patch)) {
        await tx.uorStudentProfileField.upsert({
          where: { studentId_field: { studentId: input.student.id, field } },
          create: {
            studentId: input.student.id,
            institutionCode: input.student.institutionCode,
            field,
            valueJson: JSON.stringify(value ?? null),
          },
          update: { valueJson: JSON.stringify(value ?? null), source: "student" },
        });
      }
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          domain: "identity",
          action: "profile.updated",
          resourceType: "student_profile",
          purpose: "self_service_profile",
          result: "succeeded",
          traceId: input.traceId,
          metadataJson: JSON.stringify({ fields: Object.keys(input.patch).sort(), at: now.toISOString() }),
        },
      });
    });
    const profile = await this.getProfile(input.student);
    if (!profile) throw new Error("UOR_STUDENT_NOT_FOUND");
    return profile;
  }

  async listPrivacy(student: UorStudentIdentity) {
    const rows = await this.db.uorStudentPrivacyPreference.findMany({
      where: { studentId: student.id, institutionCode: student.institutionCode },
      orderBy: { purpose: "asc" },
    });
    return rows.map(privacyView);
  }

  async setPrivacy(input: Parameters<UorStudentIdentityRepository["setPrivacy"]>[0]) {
    const fields = [...new Set(input.fields)].sort();
    const now = new Date();
    const record = await this.db.$transaction(async (tx) => {
      const preference = await tx.uorStudentPrivacyPreference.upsert({
        where: { studentId_purpose: { studentId: input.student.id, purpose: input.purpose } },
        create: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          purpose: input.purpose,
          enabled: input.enabled,
          policyVersion: POLICY_VERSION,
          fieldsJson: JSON.stringify(fields),
          expiresAt: input.expiresAt,
          revokedAt: input.enabled ? null : now,
        },
        update: {
          enabled: input.enabled,
          policyVersion: POLICY_VERSION,
          fieldsJson: JSON.stringify(fields),
          expiresAt: input.expiresAt,
          revokedAt: input.enabled ? null : now,
        },
      });
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          domain: "privacy",
          action: input.enabled ? "consent.granted" : "consent.revoked",
          resourceType: "privacy_preference",
          resourceId: preference.id,
          purpose: input.purpose,
          result: "succeeded",
          traceId: input.traceId,
          metadataJson: JSON.stringify({ fields, policyVersion: POLICY_VERSION }),
        },
      });
      return preference;
    });
    return privacyView(record);
  }

  async createDataRequest(input: Parameters<UorStudentIdentityRepository["createDataRequest"]>[0]) {
    const scope = [...new Set(input.scope)].sort();
    const isExport = input.type === "export";
    const retentions = isExport
      ? []
      : [
        { category: "functional_product_data", retained: false, reason: null },
        { category: "external_provider_secrets", retained: false, reason: null },
        { category: "audit_and_legal_evidence", retained: true, reason: "legal_security_retention" },
      ];
    const now = new Date();
    const request = await this.db.$transaction(async (tx) => {
      const row = await tx.uorStudentDataRequest.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          type: isExport ? "EXPORT" : "DELETE",
          status: isExport ? "COMPLETED" : "PENDING",
          scopeJson: JSON.stringify(scope),
          retentionJson: JSON.stringify(retentions),
          resultJson: isExport ? JSON.stringify({ ready: true, generatedAt: now.toISOString() }) : null,
          startedAt: isExport ? now : null,
          completedAt: isExport ? now : null,
        },
      });
      await tx.uorStudentAuditEvent.create({
        data: {
          studentId: input.student.id,
          institutionCode: input.student.institutionCode,
          domain: "privacy",
          action: `data_request.${input.type}.created`,
          resourceType: "data_request",
          resourceId: row.id,
          purpose: input.type === "export" ? "data_portability" : "data_erasure",
          result: isExport ? "completed" : "pending",
          traceId: input.traceId,
          metadataJson: JSON.stringify({ scope }),
        },
      });
      return row;
    });
    return dataRequestView(request);
  }

  async getDataRequest(student: UorStudentIdentity, id: string) {
    const row = await this.db.uorStudentDataRequest.findFirst({
      where: { id, studentId: student.id, institutionCode: student.institutionCode },
    });
    return row ? dataRequestView(row) : null;
  }

  async getExportPayload(student: UorStudentIdentity, id: string) {
    const request = await this.db.uorStudentDataRequest.findFirst({
      where: { id, studentId: student.id, institutionCode: student.institutionCode, type: "EXPORT", status: "COMPLETED" },
    });
    if (!request) return null;
    const scope = parseJson<string[]>(request.scopeJson, []);
    const [profile, privacy, snapshots, syncJobs] = await Promise.all([
      this.getProfile(student),
      this.listPrivacy(student),
      scope.includes("provider_snapshots")
        ? this.db.secretariaSnapshot.findMany({
          where: { studentId: student.id },
          select: { domain: true, snapshotVersion: true, coverage: true, observedAt: true, itemCount: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
        : Promise.resolve([]),
      scope.includes("sync_history")
        ? this.db.uorStudentSyncJob.findMany({
          where: { studentId: student.id, institutionCode: student.institutionCode },
          select: { id: true, provider: true, operation: true, status: true, reason: true, createdAt: true, finishedAt: true, lastErrorCode: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        })
        : Promise.resolve([]),
    ]);
    return {
      exportId: request.id,
      generatedAt: request.completedAt?.toISOString() ?? request.updatedAt.toISOString(),
      institutionCode: student.institutionCode,
      scope,
      ...(scope.includes("profile") ? { profile } : {}),
      ...(scope.includes("privacy") ? { privacy } : {}),
      ...(scope.includes("provider_snapshots") ? { providerSnapshots: snapshots } : {}),
      ...(scope.includes("sync_history") ? { syncHistory: syncJobs } : {}),
    };
  }
}
