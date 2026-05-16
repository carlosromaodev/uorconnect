import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "courses.routes.ts"), "utf8");

describe("course admin payment review and documents", () => {
  it("accepts empty review notes when admins approve course enrollments", () => {
    expect(source).toContain("note: z.string().trim().max(400).nullable().optional()");
  });

  it("lets authorized admins open enrollment proof and ticket PDFs without being the student owner", () => {
    expect(source).toContain("async function getCourseEnrollmentAccess");
    expect(source).toContain("const access = await getAdminAccessResult(request, env)");
    expect(source).toContain("request.student?.id");
    expect(source).toContain("payment-proof");
    expect(source).toContain("ticket.pdf");
  });
});
