import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");

describe("admin passport surprise batch UI contract", () => {
  it("lets admins create numbered surprise QR batches with dynamic conversion rules", () => {
    const source = readFileSync(
      path.join(repoRoot, "frontend/src/components/admin/AdminPassportTab.tsx"),
      "utf8",
    );

    expect(source).toContain("Lote de QR surpresa");
    expect(source).toContain("Quantidade");
    expect(source).toContain("QR #001");
    expect(source).toContain("Após X perdas");
    expect(source).toContain("Dinâmico universal");
    expect(source).toContain("Peso +");
    expect(source).toContain("Página explicativa a cada 3 páginas");
    expect(source).toContain("Baixar lote");
  });

  it("types and calls the batch endpoints from the API client", () => {
    const apiSource = readFileSync(
      path.join(repoRoot, "frontend/src/lib/api.ts"),
      "utf8",
    );

    expect(apiSource).toContain("DigitalPassportSurpriseQrBatchInput");
    expect(apiSource).toContain("UNIVERSAL_DYNAMIC");
    expect(apiSource).toContain("lossAdjustment");
    expect(apiSource).toContain("NEUTRAL_HINT");
    expect(apiSource).toContain("createSurpriseQrBatch");
    expect(apiSource).toContain("surpriseQrBatchPdf");
  });
});
