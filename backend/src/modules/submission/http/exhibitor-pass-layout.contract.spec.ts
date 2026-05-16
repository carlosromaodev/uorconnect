import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "exhibitor-pdf.ts"), "utf8");

describe("exhibitor manual pass print contract", () => {
  it("renders exhibitor manual passes with the standard credential pass renderer", () => {
    expect(source).toContain("buildCredentialPassPrintContent");
    expect(source).toContain("notePrefix: \"UOR Connect · Manual do expositor\"");
    expect(source).toContain("CR-80 PVC");
    expect(source).not.toContain("Passe 9x14 cm");
    expect(source).not.toContain("Molde 10x15 cm");
  });

  it("uses the project QR on the front and the exhibitor challenge QR on the back", () => {
    expect(source).toContain("challengeUrl: string");
    expect(source).toContain("projectQrDataUri");
    expect(source).toContain("challengeQrDataUri");
    expect(source).toContain("resolveExhibitorPdfChallengeUrl");
    expect(source).toContain("renderQrDataUri(data.link, 720, { transparentBackground: true })");
    expect(source).toContain("renderQrDataUri(data.challengeUrl, 720, { transparentBackground: true })");
    expect(source).toContain("frontQrDataUri: params.projectQrDataUri");
    expect(source).toContain("backQrDataUri: params.challengeQrDataUri");
    expect(source).toContain('frontQrLabel: "Projeto do expositor"');
    expect(source).toContain('backQrLabel: "Desafio do expositor"');
  });

  it("documents the mandatory exhibitor challenge question using the current guide layout", () => {
    expect(source).toContain("Criar e submeter a pergunta do desafio");
    expect(source).toContain("Preparar uma pergunta ligada ao conteúdo real do projeto");
    expect(source).toContain("guide-section-challenge");
    expect(source).toContain("Pergunta do desafio");
    expect(source).toContain("QR do expositor");
    expect(source).toContain("pontuação do Passaporte Digital");
    expect(source).toContain("transforma a visita em aprendizagem ativa");
    expect(source).toContain("recebe pontos quando acertar dentro das tentativas definidas");
  });
});
