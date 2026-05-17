import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission.routes.ts"),
  "utf8",
);

describe("admin submissions paged contract", () => {
  it("accepts large admin batches used by obligations and credential screens", () => {
    expect(routesSource).toContain("adminSubmissionQuerySchema");
    expect(routesSource).toContain("limit: z.coerce.number().int().min(10).max(500).default(50)");
    expect(routesSource).toContain('adminApp.get("/paged"');
  });
});
