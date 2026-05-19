import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(path.join(__dirname, "auth.routes.ts"), "utf8");

describe("institutional student lookup contract", () => {
  it("does not strip the ISPTEC institutional prefix when looking up a student by number", () => {
    expect(routesSource).toContain("function normalizeInstitutionalStudentLookup");
    expect(routesSource).toContain("return raw ? `ISPTEC-${raw}` : trimmed.toUpperCase();");
    expect(routesSource).toContain("const studentNumber = normalizeInstitutionalStudentLookup(request.params.studentNumber);");
    expect(routesSource).not.toContain("const studentNumber = request.params.studentNumber.replace(/\\\\D/g, \"\");");
  });
});
