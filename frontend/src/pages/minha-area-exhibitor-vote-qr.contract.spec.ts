import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMinhaAreaSource() {
  return readFileSync(join(process.cwd(), "src/pages/MinhaArea.tsx"), "utf8");
}

function sliceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("Minha Area exhibitor vote QR", () => {
  it("lets approved project exhibitors generate a vote conversion QR", () => {
    const source = readMinhaAreaSource();

    expect(source).toContain("buildOwnedSubmissionVoteQrUrl");
    expect(source).toContain("selectedVoteQrSubmission");
    expect(source).toContain("Gerar QR de votação");
    expect(source).toContain("QR de conversão do projeto");
    expect(source).toContain("source\", \"exhibitor_qr");
    expect(source).toContain("vote\", \"1");
    expect(source).toContain("createQrDataUrl");
  });

  it("keeps the project vote conversion QR entry point in the home tab", () => {
    const source = readMinhaAreaSource();
    const homeContent = sliceBetween(
      source,
      '<TabsContent value="home"',
      '<TabsContent value="desafio"',
    );
    const submissionsContent = sliceBetween(
      source,
      '<TabsContent value="submissoes"',
      '<TabsContent value="inscricoes"',
    );

    expect(source).toContain("renderExhibitorVoteQrSection");
    expect(homeContent).toContain("renderExhibitorVoteQrSection()");
    expect(submissionsContent).not.toContain("Gerar QR de votação");
  });
});
