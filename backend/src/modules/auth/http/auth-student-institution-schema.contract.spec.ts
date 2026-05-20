import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("student institution schema contract", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("keeps studentNumber visible while making uniqueness institution-scoped", () => {
    expect(schema).toContain("institutionCode   String");
    expect(schema).toContain("studentNumber     String");
    expect(schema).not.toContain("studentNumber     String             @unique");
    expect(schema).toContain("@@unique([institutionCode, studentNumber])");
    expect(schema).toContain("@@index([studentNumber])");
  });

  it("does not relate team memberships through a globally unique studentNumber", () => {
    expect(schema).toContain("studentId              Int?");
    expect(schema).toContain("@relation(fields: [studentId], references: [id]");
    expect(schema).not.toContain("@relation(fields: [studentNumber], references: [studentNumber]");
  });
});
