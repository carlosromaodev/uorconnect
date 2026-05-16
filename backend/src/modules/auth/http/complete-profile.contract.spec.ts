import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function completeProfileRouteSource(authRoutes: string) {
  const routeStart = authRoutes.indexOf('protectedApp.post(\n      "/complete-profile"');
  const nextRouteStart = authRoutes.indexOf('protectedApp.get(\n      "/me/pass.pdf"', routeStart);

  expect(routeStart).toBeGreaterThanOrEqual(0);
  expect(nextRouteStart).toBeGreaterThan(routeStart);

  return authRoutes.slice(routeStart, nextRouteStart);
}

describe("complete profile route contract", () => {
  it("updates only the student profile and never publishes operational credentials", () => {
    const authRoutes = source("src/modules/auth/http/auth.routes.ts");
    const route = completeProfileRouteSource(authRoutes);

    expect(route).toContain("studentRepository.updateProfile");
    expect(route).toContain("upsertStudentProfileExtra");
    expect(route).not.toContain("eventTeamCredential");
    expect(route).not.toMatch(/status:\s*["']PROFILE_READY["']/);
  });

  it("keeps operational credential publishing in dedicated claim flows", () => {
    const teamCredentialRoutes = source("src/modules/team-credentials/http/team-credentials.routes.ts");

    expect(teamCredentialRoutes).toContain('protectedApp.post("/invitations/:token/nucleus-claim"');
    expect(teamCredentialRoutes).toContain('protectedApp.post("/invitations/:token/expositor-claim"');
    expect(teamCredentialRoutes).toContain('status: "PROFILE_READY" as const');
  });
});
