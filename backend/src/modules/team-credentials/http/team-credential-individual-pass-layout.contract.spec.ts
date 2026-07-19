import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routes = readFileSync(path.join(__dirname, "team-credentials.routes.ts"), "utf8");

describe("team credential individual pass layout contract", () => {
  it("renders individual member passes with the same 2-up A4 model used by batch printing", () => {
    expect(routes).toContain('layout: z.enum(credentialPassLayouts).optional().default("a4-2up-landscape")');
    expect(routes).toContain('duplexMode: z.enum(credentialPassDuplexModes).optional().default("short-edge")');
    expect(routes).toContain('options.layout === "single"');
    expect(routes).toContain("buildCredentialPassBatchHtml({");
    expect(routes).toContain("items: [{");
    expect(routes).toContain('filename="${fileName}"');
  });
});
