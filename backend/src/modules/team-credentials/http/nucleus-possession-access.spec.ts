import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isStudentEligibleForNucleusPossession } from "./team-credentials.routes";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("nucleus possession access", () => {
  it("accepts students with a current academic sync", () => {
    expect(
      isStudentEligibleForNucleusPossession({
        studentNumber: "20260001",
        academicSyncedAt: new Date("2026-05-12T08:00:00.000Z"),
        registrationSource: null,
      }),
    ).toBe(true);
  });

  it("accepts legacy Secretaria sessions even when the sync date is missing", () => {
    expect(
      isStudentEligibleForNucleusPossession({
        studentNumber: "20260002",
        academicSyncedAt: null,
        registrationSource: "SECRETARIA",
      }),
    ).toBe(true);
  });

  it("rejects conventional SMS sessions that only declared UOR manually", () => {
    expect(
      isStudentEligibleForNucleusPossession({
        studentNumber: "90000001",
        academicSyncedAt: null,
        registrationSource: "CONVENTIONAL_SMS",
      }),
    ).toBe(false);
  });

  it("keeps approved possession requests connected to admin permissions", () => {
    const routes = source("src/modules/team-credentials/http/team-credentials.routes.ts");
    const middleware = source("src/modules/auth/http/admin.middleware.ts");

    expect(routes).toContain("team_membership_claim.approve");
    expect(routes).toContain("status: \"ACTIVE\"");
    expect(routes).toContain("source: \"NUCLEO_CLAIM\"");
    expect(middleware).toContain("activeMemberships.find((item) => isNucleusMembershipWithAdminAccess(item))");
    expect(middleware).toContain("if (member.category === \"NUCLEO\") return nucleusBaseAdminPermissions");
  });
});
