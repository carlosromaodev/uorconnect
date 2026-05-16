import { describe, expect, it } from "vitest";
import { getMissingImagePlaceholder } from "./missing-media-placeholder";

describe("missing media placeholder", () => {
  it("builds a safe SVG placeholder for missing public image files", () => {
    const placeholder = getMissingImagePlaceholder("/media/files/credential-photos/2026/05/photo.webp");

    expect(placeholder).not.toBeNull();
    expect(placeholder?.mimeType).toBe("image/svg+xml; charset=utf-8");
    expect(placeholder?.body).toContain("<svg");
    expect(placeholder?.body).toContain("Imagem indisponivel");
  });

  it("does not create placeholders for non-image files", () => {
    expect(getMissingImagePlaceholder("/media/files/course-payment-proofs/2026/05/proof.pdf")).toBeNull();
  });
});
