import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("admin students university filter contract", () => {
  it("accepts university and access type as paged students query filters", () => {
    const routes = source("src/modules/auth/http/auth.routes.ts");
    const repository = source("src/modules/auth/infra/student.repository.ts");
    const formatter = source("src/modules/auth/domain/student-format.ts");

    expect(routes).toContain("university: z.string().trim().max(140).optional()");
    expect(routes).toContain('accessType: z.enum(["OFFICIAL", "TEMPORARY", "all", "todos"]).optional()');
    expect(routes).toContain("accessType: z.enum([\"OFFICIAL\", \"TEMPORARY\"])");
    expect(repository).toContain("university?: string");
    expect(repository).toContain('accessType?: "OFFICIAL" | "TEMPORARY" | "all" | "todos"');
    expect(repository).toContain("const university = params.university?.trim();");
    expect(repository).toContain("const accessType = params.accessType;");
    expect(repository).toContain("...(university && university !== \"all\"");
    expect(repository).toContain("{ university }");
    expect(repository).toContain("buildStudentAccessWhere(accessType)");
    expect(formatter).toContain("resolveStudentAccessType");
    expect(formatter).toContain('return "OFFICIAL"');
    expect(formatter).toContain('return "TEMPORARY"');
  });
});
