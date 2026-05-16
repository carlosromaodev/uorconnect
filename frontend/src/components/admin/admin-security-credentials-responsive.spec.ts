import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("AdminSecurityTab credentials responsiveness", () => {
  it("keeps credential panels and member actions inside narrow admin columns", () => {
    const source = readSource("./AdminSecurityTab.tsx");

    expect(source).toContain(
      "grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]",
    );
    expect(source).toContain(
      "rounded-2xl border p-4 min-w-0",
    );
    expect(source).toContain(
      "rounded-2xl border border-border/60 p-4 min-w-0 overflow-hidden",
    );
    expect(source).toContain(
      "flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between",
    );
    expect(source).toContain(
      "grid w-full min-w-0 grid-cols-2 gap-2 min-[430px]:grid-cols-3 2xl:w-[520px]",
    );
    expect(source).not.toContain(
      "grid w-full grid-cols-2 gap-2 min-[430px]:grid-cols-3 xl:w-[520px]",
    );
  });
});
