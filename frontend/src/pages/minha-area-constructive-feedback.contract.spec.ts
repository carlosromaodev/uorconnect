import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMinhaAreaSource() {
  return readFileSync(join(process.cwd(), "src/pages/MinhaArea.tsx"), "utf8");
}

describe("Minha Area constructive feedback passport mission", () => {
  it("connects the Digital Passport map to project QR constructive feedback", () => {
    const source = readMinhaAreaSource();

    expect(source).toContain("constructive-feedback");
    expect(source).toContain("PROJECT_CONSTRUCTIVE_FEEDBACK");
    expect(source).toContain("Escanear QR e fazer crítica");
    expect(source).toContain("constructiveFeedbackScannerOpen");
    expect(source).toContain("handleConstructiveFeedbackQrRead");
    expect(source).toContain("api.passport.constructiveFeedback");
    expect(source).toContain("Crítica construtiva");
    expect(source).toContain("showScanCelebration");
  });
});
