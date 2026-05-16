import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("trainer routes contract", () => {
  it("separates public registration, admin review and trainer dashboard endpoints", () => {
    const source = readSource("src/modules/trainers/http/trainers.routes.ts");

    expect(source).toContain('"/registration/context"');
    expect(source).toContain('"/registration/request-code"');
    expect(source).toContain('"/registration/verify-code"');
    expect(source).toContain('"/registration/submit"');
    expect(source).toContain('"/admin/requests"');
    expect(source).toContain('"/admin/requests/:id/approve"');
    expect(source).toContain('"/admin/requests/:id/reject"');
    expect(source).toContain('"/me/dashboard"');
  });

  it("keeps trainers outside the general admin and limits dashboard data to aggregates", () => {
    const trainerSource = readSource("src/modules/trainers/http/trainers.routes.ts");
    const adminMiddlewareSource = readSource("src/modules/auth/http/admin.middleware.ts");

    expect(adminMiddlewareSource).toContain('payload.role === "trainer"');
    expect(adminMiddlewareSource).toContain("Access denied");
    expect(trainerSource).toContain("buildTrainerDashboardPayload");
    expect(trainerSource).toContain("paymentStatus: true");
    expect(trainerSource).not.toContain("studentName: true");
    expect(trainerSource).not.toContain("paymentProof: true");
    expect(trainerSource).not.toContain("studentEmail: true");
  });
});
