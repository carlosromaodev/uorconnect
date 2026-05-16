import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission.routes.ts"),
  "utf8",
);

const teamSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission-team.ts"),
  "utf8",
);

describe("admin submission team member editing contract", () => {
  it("exposes a protected admin endpoint to update group members", () => {
    expect(routesSource).toContain('adminApp.patch("/:id/team/members"');
    expect(routesSource).toContain('config: requireAdminPermission(["SUBMISSIONS"])');
    expect(routesSource).toContain("replaceSubmissionTeamMembers(");
    expect(routesSource).toContain("submission.team_members_update");
  });

  it("replaces the stored member list and clears stale member records", () => {
    expect(teamSource).toContain("export async function replaceSubmissionTeamMembers");
    expect(teamSource).toContain("normalizedName: { notIn: Array.from(normalizedNames) }");
    expect(teamSource).toContain("teamSize: normalizedMembers.length");
    expect(teamSource).toContain("stringifyTeamMembers(normalizedMembers)");
  });

  it("allows admin confirmation only through a reserved secretaria identity", () => {
    expect(routesSource).toContain('adminApp.post("/:id/team/members/:memberId/confirm"');
    expect(routesSource).toContain("adminConfirmSubmissionTeamMember");
    expect(teamSource).toContain("export async function adminConfirmSubmissionTeamMember");
    expect(teamSource).toContain("isStudentEligibleForTeamConfirmation");
    expect(teamSource).toContain("expectedStudentNumber");
  });

  it("allows admin to confirm external team members by creating local credentials", () => {
    expect(routesSource).toContain('adminApp.post("/:id/team/members/:memberId/confirm-external"');
    expect(routesSource).toContain("adminConfirmExternalSubmissionTeamMember");
    expect(teamSource).toContain("export async function adminConfirmExternalSubmissionTeamMember");
    expect(teamSource).toContain("temporaryPassword");
    expect(teamSource).toContain("EXTERNAL_TEAM_MEMBER");
  });
});
