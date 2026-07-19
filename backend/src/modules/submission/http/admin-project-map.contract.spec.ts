import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(
  path.join(process.cwd(), "src/modules/submission/http/submission.routes.ts"),
  "utf8",
);

describe("admin project map contract", () => {
  it("exposes an admin endpoint with project statistics and responsible year filtering", () => {
    expect(routesSource).toContain("projectMapQuerySchema");
    expect(routesSource).toContain('adminApp.get("/project-map"');
    expect(routesSource).toContain("responsibleYear");
    expect(routesSource).toContain("voteUniversities");
    expect(routesSource).toContain("voteCourses");
    expect(routesSource).toContain("voteClasses");
    expect(routesSource).toContain("memberStats");
  });
});
