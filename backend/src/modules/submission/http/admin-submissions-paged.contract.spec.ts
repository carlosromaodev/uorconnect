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

  it("returns database status stats so approval counters do not depend on the loaded page", () => {
    expect(routesSource).toContain("statusCounts");
    expect(routesSource).toContain("stats: z.object");
    expect(routesSource).toContain("pending: z.number()");
    expect(routesSource).toContain("approved: z.number()");
    expect(routesSource).toContain("rejected: z.number()");
  });
});
