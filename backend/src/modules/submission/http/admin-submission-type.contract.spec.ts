import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission.routes.ts"),
  "utf8",
);

describe("admin submission type editing contract", () => {
  it("exposes a protected endpoint to change the submission category", () => {
    expect(routesSource).toContain('adminApp.patch("/:id/type"');
    expect(routesSource).toContain('config: requireAdminPermission(["SUBMISSIONS"])');
    expect(routesSource).toContain('z.enum(["PROJECT", "BUSINESS", "PRODUCT"])');
    expect(routesSource).toContain("submission.update_type");
  });

  it("returns voting and award eligibility after the type change", () => {
    expect(routesSource).toContain("eligibleForAward");
    expect(routesSource).toContain("isCompetitionEligible(updated.type, updated.area)");
    expect(routesSource).toContain("normalizeSubmissionType(updated.type, updated.area)");
  });
});
