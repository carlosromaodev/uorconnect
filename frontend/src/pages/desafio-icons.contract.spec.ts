import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMinhaArea() {
  return readFileSync(join(process.cwd(), "src/pages/MinhaArea.tsx"), "utf8");
}

function readCss() {
  return readFileSync(join(process.cwd(), "src/index.css"), "utf8");
}

describe("desafio activity icons", () => {
  it("uses specific icons instead of star/sparkles in the challenge journey", () => {
    const source = readMinhaArea();

    expect(source).not.toContain("  Star,");
    expect(source).not.toContain("  Sparkles,");
    expect(source).not.toContain("<Star");
    expect(source).not.toContain("<Sparkles");
    expect(source).toContain("icon: UserPlus");
    expect(source).toContain("passportBadgeIconFor");
    expect(source).toContain("const BadgeIcon = badge.icon");
  });

  it("makes the accept invite button match the manual button treatment in green", () => {
    const css = readCss();
    const joinButtonStart = css.indexOf(".desafio-hero__join-btn {");
    const joinButtonEnd = css.indexOf(".desafio-hero__join-btn:hover", joinButtonStart);
    const joinButtonCss = css.slice(joinButtonStart, joinButtonEnd);

    expect(joinButtonStart).toBeGreaterThan(-1);
    expect(joinButtonCss).toContain("h-10");
    expect(joinButtonCss).toContain("border");
    expect(joinButtonCss).toContain("text-xs font-bold");
    expect(joinButtonCss).toContain("rgb(16 185 129 / 0.1)");
    expect(joinButtonCss).toContain("rgb(52 211 153 / 0.4)");
  });
});
