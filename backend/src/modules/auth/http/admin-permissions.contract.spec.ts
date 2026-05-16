import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("admin permission route contracts", () => {
  it("declares permissions on security administration routes", () => {
    const authRoutes = source("src/modules/auth/http/auth.routes.ts");

    expect(authRoutes).toContain("requireAdminPermission([\"SECURITY\"]");
    expect(authRoutes).toContain("requireAdminPermission([\"SECURITY\"], \"ALL\")");
  });

  it("declares permissions on sensitive certificate routes", () => {
    const certificatesRoutes = source("src/modules/certificates/http/certificates.routes.ts");

    expect(certificatesRoutes).toContain("requireAdminPermission([\"CERTIFICATES\"])");
    expect(certificatesRoutes).toContain("requireAdminPermission([\"ATTENDANCE\", \"CERTIFICATES\"], \"ALL\")");
  });
});
