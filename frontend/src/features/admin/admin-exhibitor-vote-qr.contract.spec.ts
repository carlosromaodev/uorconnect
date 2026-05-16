import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin exhibitor vote QR", () => {
  it("lets the organization generate vote QR codes from the exhibitor voting panel", () => {
    const source = readSource("src/features/admin/AdminWorkspace.tsx");

    expect(source).toContain("createQrDataUrl");
    expect(source).toContain("handleOpenExhibitorVoteQr");
    expect(source).toContain("QR de voto");
    expect(source).toContain("source=exhibitor_qr");
    expect(source).toContain("downloadExhibitorVoteQr");
    expect(source).toContain("Copiar link de voto");
  });
});
