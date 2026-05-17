import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("project detail modal scroll behavior", () => {
  it("keeps compact project details fully scrollable on short mobile screens", () => {
    const source = readSource("src/pages/Projetos.tsx");

    expect(source).toContain("project-detail-dialog");
    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
    expect(source).toContain("overflow-y-auto");
    expect(source).toContain("overscroll-contain");
    expect(source).toContain("lg:h-[92vh]");
    expect(source).toContain("lg:overflow-hidden");
    expect(source).toContain("lg:flex-1 lg:overflow-y-auto");
  });
});
