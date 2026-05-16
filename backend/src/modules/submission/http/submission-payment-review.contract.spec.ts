import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRoutesSource() {
  return readFileSync(path.join(__dirname, "submission.routes.ts"), "utf8");
}

describe("submission payment review route contract", () => {
  it("accepts empty admin payment notes sent as null by the frontend", () => {
    const source = readRoutesSource();

    expect(source).toContain("note: z.string().trim().max(400).nullable().optional()");
  });
});
