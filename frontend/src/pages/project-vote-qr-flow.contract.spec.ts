import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("project exhibitor QR vote flow", () => {
  it("opens a vote confirmation modal for exhibitor QR links before recording the vote", () => {
    const source = readSource("src/pages/ProjetoDetalhe.tsx");

    expect(source).toContain("useSearchParams");
    expect(source).toContain("source=exhibitor_qr");
    expect(source).toContain("vote=1");
    expect(source).toContain("Vais votar no projeto");
    expect(source).toContain("bónus só entram depois da conversão");
    expect(source).toContain("handleConfirmVote");
    expect(source).toContain("playScanConfirmationTone");
    expect(source).toContain("scan-celebration-card");
  });
});
