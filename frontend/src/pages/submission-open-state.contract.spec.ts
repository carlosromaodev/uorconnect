import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("submission open state contract", () => {
  it("permite encerrar ou reabrir candidaturas diretamente no status da admin", () => {
    const source = readSource("../features/admin/AdminWorkspace.tsx");

    expect(source).toContain("handleSubmissionOpenStateUpdate");
    expect(source).toContain("submission-config-open-state");
    expect(source).toContain("Encerrar candidaturas");
    expect(source).toContain("Reabrir candidaturas");
    expect(source).toContain("Conectado aos botões Submeter expositor");
  });

  it("desativa a escolha e o envio do expositor quando candidaturas estao fechadas", () => {
    const source = readSource("Submeter.tsx");

    expect(source).toContain("if (!config.isOpen && !isEditMode)");
    expect(source).toContain("disabled={!config.isOpen && !isEditMode}");
    expect(source).toContain(
      "disabled={saving || proofReading || editingLocked || (!config.isOpen && !isEditMode)}",
    );
    expect(source).toContain("As candidaturas estão fechadas neste momento.");
  });

  it("desativa os CTAs publicos de submeter expositor quando a config fecha", () => {
    const indexSource = readSource("Index.tsx");
    const minhaAreaSource = readSource("MinhaArea.tsx");

    expect(indexSource).toContain("api.submissions.config()");
    expect(indexSource).toContain("submissionsAreOpen");
    expect(indexSource).toContain("Candidaturas encerradas");
    expect(minhaAreaSource).toContain("api.submissions.config()");
    expect(minhaAreaSource).toContain("submissionsOpen");
    expect(minhaAreaSource).toContain("Candidaturas encerradas");
  });
});
