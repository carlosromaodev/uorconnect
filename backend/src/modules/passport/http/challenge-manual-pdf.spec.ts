import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveChallengeManualEventInfo } from "./challenge-manual-pdf";

const source = readFileSync(path.join(__dirname, "challenge-manual-pdf.ts"), "utf8");

function countOccurrences(value: string) {
  return (source.match(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
}

describe("challenge manual PDF", () => {
  it("uses safe event defaults when the runtime config is incomplete", () => {
    expect(resolveChallengeManualEventInfo({})).toEqual({
      eventName: "UOR Connect",
      eventDate: "Data a confirmar",
      eventLocation: "Universidade Óscar Ribas",
    });

    expect(
      resolveChallengeManualEventInfo({
        UORCONNECT_EVENT_NAME: "  Feira de Projetos  ",
        UORCONNECT_EVENT_DATE: "  12 de maio  ",
        UORCONNECT_EVENT_LOCATION: "  Campus principal  ",
      }),
    ).toEqual({
      eventName: "Feira de Projetos",
      eventDate: "12 de maio",
      eventLocation: "Campus principal",
    });
  });

  it("documents norms, allowed actions and important stages in the existing manual layout", () => {
    expect(source).toContain("Página <strong>5</strong> de <strong>5</strong>");
    expect(source).toContain("O que deves fazer");
    expect(source).toContain("O que podes fazer");
    expect(source).toContain("O que não deves fazer");
    expect(source).toContain("Se algo falhar");
    expect(source).toContain("Dúvidas rápidas");
    expect(source).toContain("QR do stand");
    expect(source).toContain("QR do expositor");
    expect(source).toContain("QR surpresa não substitui");
    expect(source).toContain("O QR surpresa só revela o efeito depois do scan");
    expect(source).not.toContain("QR de risco");
    expect(source).not.toContain("pontos comuns");
    expect(source).not.toContain("pontos raros");
    expect(source).not.toContain("saldo bónus");
    expect(source).not.toContain("pontos bónus");
  });

  it("keeps the manual organized by topic without repeating the same guidance", () => {
    expect(source).toContain("PAGE 1 — Visão Geral");
    expect(source).toContain("PAGE 2 — Pontuação e Tipos de QR");
    expect(source).toContain("PAGE 3 — Regras, Mapa e Prémio");
    expect(source).toContain("PAGE 4 — Normas e Suporte");
    expect(source).toContain("PAGE 5 — Casos de Dúvida");

    expect(source).toContain("Sequência base da jornada");
    expect(source).toContain("Validação, ranking e segurança");
    expect(source).toContain("Quando pedir apoio");
    expect(source).toContain("Casos que mais geram dúvida");

    expect(countOccurrences("qualquer ordem")).toBeLessThanOrEqual(1);
    expect(countOccurrences("espera a página confirmar o resultado")).toBe(1);
    expect(countOccurrences("QR do stand e QR do expositor")).toBe(1);
  });
});
