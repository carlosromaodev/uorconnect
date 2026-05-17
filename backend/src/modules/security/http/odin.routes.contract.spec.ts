import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("ODIN admin security routes contract", () => {
  it("exposes ODIN behind the security permission with audited exclusion actions", () => {
    const routes = source("src/modules/security/http/odin.routes.ts");
    const registry = source("src/core/routes/index.ts");

    expect(registry).toContain("odinRoutes");
    expect(registry).toContain('prefix: "/security"');
    expect(routes).toContain('adminApp.get("/odin/overview"');
    expect(routes).toContain('adminApp.post("/odin/students/:studentId/exclude"');
    expect(routes).toContain('setDefaultAdminPermission(adminApp, ["SECURITY"])');
    expect(routes).toContain("recordOdinStudentExclusion");
    expect(routes).toContain("recordAdminAudit");
  });

  it("records ODIN events on login and project votes using the persistent device cookie", () => {
    const authRoutes = source("src/modules/auth/http/auth.routes.ts");
    const interactionRoutes = source("src/modules/interactions/http/interactions.routes.ts");

    expect(authRoutes).toContain("recordOdinEvent");
    expect(authRoutes).toContain("resolveOdinDeviceIdFromRequest");
    expect(authRoutes).not.toContain("clearCookie(reply, DEVICE_COOKIE");
    expect(interactionRoutes).toContain('eventType: "PROJECT_VOTE"');
    expect(interactionRoutes).toContain('targetType: "Submission"');
  });
});
