import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("student institution schema contract", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const studentModel = schema.match(/model Student \{[\s\S]*?\n\}/)?.[0] ?? "";

  it("keeps studentNumber visible while making uniqueness institution-scoped", () => {
    expect(studentModel).toMatch(/institutionCode\s+String/);
    expect(studentModel).toMatch(/studentNumber\s+String/);
    expect(studentModel).not.toMatch(/studentNumber\s+String\s+@unique/);
    expect(studentModel).toContain("@@unique([institutionCode, studentNumber])");
    expect(studentModel).toContain("@@index([studentNumber])");
  });

  it("does not relate team memberships through a globally unique studentNumber", () => {
    expect(schema).toContain("studentId              Int?");
    expect(schema).toContain("@relation(fields: [studentId], references: [id]");
    expect(schema).not.toContain("@relation(fields: [studentNumber], references: [studentNumber]");
  });
});
