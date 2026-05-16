import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/pages/TeamInvitation.tsx"),
  "utf8",
);

describe("team invitation authentication", () => {
  it("uses only secretaria login for member confirmation", () => {
    expect(source).toContain("<StudentLoginForm");
    expect(source).toContain("allowConventional={false}");
    expect(source).toContain("Entrar pela Secretaria");
  });
});
