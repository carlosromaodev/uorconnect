import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("validation public/operational contract", () => {
  it("keeps operational validation authenticated and permissioned", () => {
    const validationRoutes = source("src/modules/validation/http/validation.routes.ts");

    expect(validationRoutes).toContain("operationalApp.register(authGuard");
    expect(validationRoutes).toContain("operationalApp.register(adminGuard)");
    expect(validationRoutes).toContain("operationalApp.get(\"/operational/:token\"");
    expect(validationRoutes).toContain("requireAdminPermission([\"ATTENDANCE\", \"CERTIFICATES\", \"SECURITY\"])");
  });

  it("keeps public validation payload minimized", () => {
    const validationRoutes = source("src/modules/validation/http/validation.routes.ts");

    expect(validationRoutes).toContain("recipientName: publicDisplayName(certificate.recipientName)");
    expect(validationRoutes).toContain("recipientNumber: publicMaskedIdentifier(certificate.recipientNumber)");
    expect(validationRoutes).toContain("recipientCourse: null");
    expect(validationRoutes).toContain("issuedByStudentNumber: null");
    expect(validationRoutes).toContain("studentNumber: publicMaskedIdentifier(credential.studentNumber)");
    expect(validationRoutes).toContain("studentCourse: null");
  });
});
