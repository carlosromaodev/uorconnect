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

describe("MinhaArea document tabs", () => {
  it("keeps the exhibitor round flow visible in the home tab", () => {
    const source = readMinhaAreaSource();
    const homeContent = sliceBetween(
      source,
      '<TabsContent value="home"',
      '<TabsContent value="desafio"',
    );

    expect(homeContent).toContain("renderExhibitorRoundFlow()");
  });

  it("moves certificates and passes out of the home tab into their own tabs", () => {
    const source = readMinhaAreaSource();
    const homeContent = sliceBetween(
      source,
      '<TabsContent value="home"',
      '<TabsContent value="desafio"',
    );

    expect(source).toContain('value="certificados"');
    expect(source).toContain("Certificado e Prémio");
    expect(source).toContain('value="passes"');
    expect(source).toContain(">Passe<");
    expect(source).toContain('<TabsContent value="certificados"');
    expect(source).toContain('<TabsContent value="passes"');
    expect(homeContent).not.toContain("renderCertificatesSection()");
    expect(homeContent).not.toContain("renderPassesSection()");
  });
});
