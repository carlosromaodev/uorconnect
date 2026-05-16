import { describe, expect, it } from "vitest";
import { renderQrSvg } from "./qr";

describe("QR rendering", () => {
  it("can render QR codes with a transparent light area", async () => {
    const svg = await renderQrSvg("https://uorconnect.space", 280, {
      transparentBackground: true,
    });

    expect(svg).not.toContain('fill="#ffffff"');
    expect(svg).not.toContain('d="M0 0h');
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
  });
});
