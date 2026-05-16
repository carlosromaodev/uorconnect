import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "team-credentials.routes.ts"), "utf8");

describe("team credential pass front layout contract", () => {
  it("renders the front QR as a tonal watermark in every credential pass renderer", () => {
    expect(source).toContain("front-site-qr-watermark");
    expect(source).toContain('<img src="${params.frontQrDataUri}" alt="${escapeHtml(params.frontQrLabel)}" />');
    expect(source).toContain('<img src="${item.frontQrDataUri}" alt="${escapeHtml(item.frontQrLabel)}" />');
    expect(source).toContain("filter:brightness(0) invert(1)");
    expect(source).toContain("opacity:.105");
    expect(source).not.toContain("front-site-qr-box");
  });

  it("keeps the category ghost complete at the right edge and increases name area readability", () => {
    expect(source).toContain("right:4mm;bottom:8mm;width:auto");
    expect(source).toContain("white-space:nowrap");
    expect(source).toContain(".pname{font-size:16.8px");
    expect(source).toContain(".pmeta{margin-top:1.7mm;font-size:9.8px");
  });
});
