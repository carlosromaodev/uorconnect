import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readCss() {
  return readFileSync(join(process.cwd(), "src/index.css"), "utf8");
}

describe("desafio mobile responsiveness", () => {
  it("keeps passport challenge layout readable on narrow screens", () => {
    const css = readCss();
    const mobileRulesStart = css.indexOf("@media (max-width: 480px)");

    expect(mobileRulesStart).toBeGreaterThan(-1);

    const mobileRules = css.slice(mobileRulesStart);

    expect(mobileRules).toContain(".desafio-hero__flight-info");
    expect(mobileRules).toContain(".desafio-telemetry");
    expect(mobileRules).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(mobileRules).toContain(".desafio-mission");
    expect(mobileRules).toContain("grid-template-columns: 24px 34px minmax(0, 1fr);");
    expect(mobileRules).toContain(".desafio-journey__summary-row");
    expect(mobileRules).toContain(".desafio-hero__cta > *");
    expect(mobileRules).toContain("@media (max-width: 360px)");
    expect(mobileRules).toContain(".desafio-journey__summary-item");
  });

  it("contains wide challenge blocks instead of leaking horizontal overflow", () => {
    const css = readCss();
    const page = readFileSync(join(process.cwd(), "src/pages/MinhaArea.tsx"), "utf8");

    expect(page).toContain('className="desafio-tab-panel');
    expect(page).toContain('className="desafio-main-grid"');
    expect(page).toContain('className="desafio-secondary-grid"');
    expect(css).toContain(".desafio-tab-panel");
    expect(css).toContain("overflow-x: hidden;");
    expect(css).toContain(".desafio-main-grid > *");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(css).toContain(".desafio-scanner__scan-btn");
    expect(css).toContain("white-space: normal;");
  });
});
