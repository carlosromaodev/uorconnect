import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("EventoTab sponsor image upload", () => {
  it("allows admins to upload a sponsor logo image instead of only pasting URLs", () => {
    const component = readSource("src/components/admin/EventoTab.tsx");

    expect(component).toContain("readCompressedImageFileAsDataUrl");
    expect(component).toContain("handleSponsorLogoFile");
    expect(component).toContain('api.media.uploadDataUrl(dataUrl, "home-sponsors"');
    expect(component).toContain('type="file"');
    expect(component).toContain('accept="image/*"');
    expect(component).toContain("Carregar imagem");
  });
});
