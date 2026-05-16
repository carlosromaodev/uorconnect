import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("auth session contract", () => {
  it("uses the same public session hint cookie name as the backend", () => {
    const frontendApi = source("./api.ts");
    const backendAuthRoutes = source("../../../backend/src/modules/auth/http/auth.routes.ts");

    expect(frontendApi).toContain('const SESSION_HINT_COOKIE = "uor_session_hint"');
    expect(backendAuthRoutes).toContain('const SESSION_HINT_COOKIE = "uor_session_hint"');
  });

  it("does not send admin as an auth origin from the admin login screen", () => {
    const adminLoginPage = source("../pages/AdminLoginPage.tsx");

    expect(adminLoginPage).toContain('api.auth.login(normalized, password, "uorconnect")');
    expect(adminLoginPage).not.toContain('api.auth.login(normalized, password, "admin")');
  });
});
