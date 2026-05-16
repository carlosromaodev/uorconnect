import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth login provider contract", () => {
  it("accepts ISPTEC as an academic login provider", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/auth/http/auth.routes.ts"),
      "utf8",
    );

    expect(source).toContain('provider: z.enum(["uor", "isptec"])');
    expect(source).toContain('identifierType: z.enum(["studentNumber", "username"])');
    expect(source).toContain("normalizeLoginIdentifier");
    expect(source).toContain("provider: request.body.provider");
    expect(source).toContain("identifierType: request.body.identifierType");
  });

  it("keeps conventional SMS login disabled so new access is only academic", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/auth/http/auth.routes.ts"),
      "utf8",
    );

    const registerRoute = source.slice(
      source.indexOf('"/conventional/register"'),
      source.indexOf('"/conventional/verify"'),
    );
    const verifyRoute = source.slice(
      source.indexOf('"/conventional/verify"'),
      source.indexOf('"/jury/login"'),
    );

    expect(registerRoute).toContain("CONVENTIONAL_SMS_DISABLED_MESSAGE");
    expect(registerRoute).toContain("reply.code(410)");
    expect(registerRoute).not.toContain("studentAccessCode.create");
    expect(verifyRoute).toContain("CONVENTIONAL_SMS_DISABLED_MESSAGE");
    expect(verifyRoute).toContain("reply.code(410)");
    expect(verifyRoute).not.toContain("studentAccessCode.findFirst");
  });
});
