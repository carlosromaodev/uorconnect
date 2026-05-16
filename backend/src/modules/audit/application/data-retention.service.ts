import type { PrismaClient } from "@prisma/client";
import type { Env } from "../../../config/env";

const dayMs = 24 * 60 * 60 * 1000;

export type RetentionPolicy = {
  auditLogRetentionDays: number;
  credentialValidationLogRetentionDays: number;
  expiredCredentialRetentionDays: number;
};

export type RetentionCleanupResult = {
  policy: RetentionPolicy;
  cutoffs: {
    auditLogsBefore: string;
    credentialValidationLogsBefore: string;
    expiredCredentialsBefore: string;
  };
  deletedAuditLogs: number;
  deletedCredentialValidationLogs: number;
  minimizedExpiredCredentials: number;
};

export function getRetentionPolicy(env: Env): RetentionPolicy {
  return {
    auditLogRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
    credentialValidationLogRetentionDays: env.CREDENTIAL_VALIDATION_LOG_RETENTION_DAYS,
    expiredCredentialRetentionDays: env.EXPIRED_CREDENTIAL_RETENTION_DAYS,
  };
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * dayMs);
}

export function buildRetentionCutoffs(policy: RetentionPolicy, now = new Date()) {
  return {
    auditLogsBefore: daysAgo(now, policy.auditLogRetentionDays),
    credentialValidationLogsBefore: daysAgo(now, policy.credentialValidationLogRetentionDays),
    expiredCredentialsBefore: daysAgo(now, policy.expiredCredentialRetentionDays),
  };
}

export async function runDataRetentionCleanup(
  prisma: PrismaClient,
  env: Env,
  now = new Date(),
): Promise<RetentionCleanupResult> {
  const policy = getRetentionPolicy(env);
  const cutoffs = buildRetentionCutoffs(policy, now);

  const [auditLogs, validationLogs, expiredCredentials] = await Promise.all([
    prisma.adminAuditLog.deleteMany({
      where: { createdAt: { lt: cutoffs.auditLogsBefore } },
    }),
    prisma.credentialValidationLog.deleteMany({
      where: { createdAt: { lt: cutoffs.credentialValidationLogsBefore } },
    }),
    prisma.eventTeamCredential.updateMany({
      where: {
        OR: [
          { revokedAt: { lt: cutoffs.expiredCredentialsBefore } },
          { expiresAt: { lt: cutoffs.expiredCredentialsBefore } },
        ],
      },
      data: {
        status: "DISABLED",
        email: null,
        phone: null,
        address: null,
        bio: null,
        photoUrl: null,
        instagramUrl: null,
        facebookUrl: null,
        linkedinUrl: null,
        githubUrl: null,
        websiteUrl: null,
        consentPhotoCredential: false,
        consentPublicProfile: false,
        consentSocialLinks: false,
        consentSms: false,
        consentWhatsapp: false,
        notes: null,
      },
    }),
  ]);

  return {
    policy,
    cutoffs: {
      auditLogsBefore: cutoffs.auditLogsBefore.toISOString(),
      credentialValidationLogsBefore: cutoffs.credentialValidationLogsBefore.toISOString(),
      expiredCredentialsBefore: cutoffs.expiredCredentialsBefore.toISOString(),
    },
    deletedAuditLogs: auditLogs.count,
    deletedCredentialValidationLogs: validationLogs.count,
    minimizedExpiredCredentials: expiredCredentials.count,
  };
}
