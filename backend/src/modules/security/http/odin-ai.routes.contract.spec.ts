import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("ODIN 2.0 Gemini AI contract", () => {
  it("stores AI analyses and admin feedback for auditability", () => {
    const schema = source("prisma/schema.prisma");
    const deploySchema = source("prisma/schema.deploy.prisma");

    for (const prismaSchema of [schema, deploySchema]) {
      expect(prismaSchema).toContain("model OdinAiAnalysis");
      expect(prismaSchema).toContain("model OdinAiFeedback");
      expect(prismaSchema).toContain("fraudProbability");
      expect(prismaSchema).toContain("modelVersion");
      expect(prismaSchema).toContain("promptVersion");
      expect(prismaSchema).toContain("payloadHash");
    }
  });

  it("exposes analysis and feedback routes behind SECURITY permission", () => {
    const routes = source("src/modules/security/http/odin.routes.ts");

    expect(routes).toContain('adminApp.post("/odin/ai/analyze"');
    expect(routes).toContain('adminApp.get("/odin/ai/analyses"');
    expect(routes).toContain('adminApp.post("/odin/ai/analyses/:id/feedback"');
    expect(routes).toContain("runOdinAiCaseAnalysis");
    expect(routes).toContain("recordOdinAiFeedback");
    expect(routes).toContain('setDefaultAdminPermission(adminApp, ["SECURITY"])');
  });

  it("keeps Gemini configuration in environment variables only", () => {
    const envSource = source("src/config/env.ts");
    const example = source(".env.example");
    const routes = source("src/modules/security/http/odin.routes.ts");

    expect(envSource).toContain("GEMINI_API_KEY");
    expect(envSource).toContain("GEMINI_MODEL");
    expect(example).toContain("# GEMINI_API_KEY=");
    expect(example).toContain("GEMINI_MODEL=gemini-1.5-flash");
    expect(routes).not.toContain("AIza");
  });
});
