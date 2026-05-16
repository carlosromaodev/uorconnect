import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(resolve(__dirname, "../../", path), "utf8");
}

describe("TypeScript safety contracts", () => {
  it("does not use z.any or prisma as any in critical backend routes", () => {
    const criticalFiles = [
      "src/modules/passport/http/passport.routes.ts",
      "src/modules/analytics/http/analytics.routes.ts",
      "src/modules/interactions/http/interactions.routes.ts",
    ];

    for (const file of criticalFiles) {
      const source = readProjectFile(file);
      expect(source, `${file} should avoid z.any()`).not.toMatch(/\bz\.any\s*\(/);
      expect(source, `${file} should avoid Prisma casts to any`).not.toMatch(/prisma\s+as\s+any/);
    }
  });
});
