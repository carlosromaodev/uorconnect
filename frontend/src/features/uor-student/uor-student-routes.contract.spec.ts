import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("UOR Student route boundary", () => {
  it("keeps login outside the private namespace and mounts the own product shell", () => {
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

    expect(app).toContain('<Route path="/estudante-login" element={<UorStudentLogin />} />');
    expect(app).toContain('<Route path="/estudante/*" element={<UorStudentApp />} />');
    expect(app).not.toContain('product="student"');
    expect(app).toContain("!studentProductRoute");
  });
});
