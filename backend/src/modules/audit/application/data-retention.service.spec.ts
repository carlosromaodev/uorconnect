import { describe, expect, it } from "vitest";
import { buildRetentionCutoffs, getRetentionPolicy } from "./data-retention.service";
import type { Env } from "../../../config/env";

const env = {
  AUDIT_LOG_RETENTION_DAYS: 730,
  CREDENTIAL_VALIDATION_LOG_RETENTION_DAYS: 365,
  EXPIRED_CREDENTIAL_RETENTION_DAYS: 180,
} as Env;

describe("data retention policy", () => {
  it("lê os períodos de retenção do ambiente", () => {
    expect(getRetentionPolicy(env)).toEqual({
      auditLogRetentionDays: 730,
      credentialValidationLogRetentionDays: 365,
      expiredCredentialRetentionDays: 180,
    });
  });

  it("calcula cutoffs consistentes por número de dias", () => {
    const cutoffs = buildRetentionCutoffs(getRetentionPolicy(env), new Date("2026-05-08T00:00:00.000Z"));

    expect(cutoffs.auditLogsBefore.toISOString()).toBe("2024-05-08T00:00:00.000Z");
    expect(cutoffs.credentialValidationLogsBefore.toISOString()).toBe("2025-05-08T00:00:00.000Z");
    expect(cutoffs.expiredCredentialsBefore.toISOString()).toBe("2025-11-09T00:00:00.000Z");
  });
});
