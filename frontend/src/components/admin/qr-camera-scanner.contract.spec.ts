import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readScannerSource() {
  return readFileSync(join(process.cwd(), "src/components/admin/QrCameraScanner.tsx"), "utf8");
}

describe("QrCameraScanner leitura robusta", () => {
  it("usa foco/resolucao melhores e fallback nativo para QR de baixo contraste", () => {
    const source = readScannerSource();

    expect(source).toContain("BarcodeDetector");
    expect(source).toContain("startBarcodeDetectorFallback");
    expect(source).toContain("focusMode");
    expect(source).toContain("width: { ideal: 1920 }");
    expect(source).toContain("height: { ideal: 1080 }");
    expect(source).toContain("capture=\"environment\"");
    expect(source).toContain("decodeFromImageElement");
    expect(source).toContain("Aproxima o QR");
  });
});
