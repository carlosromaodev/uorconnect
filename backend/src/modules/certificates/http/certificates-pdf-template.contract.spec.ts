import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCertificateHtml } from "./certificates.routes";

const sourcePath = path.resolve(process.cwd(), "src/modules/certificates/http/certificates.routes.ts");

describe("certificate PDF template", () => {
  it("renders the official UOR certificate structure from the printed reference", () => {
    const html = buildCertificateHtml({
      logoDataUri: null,
      title: "Jornada Março Mulher",
      recipientName: "Erika Dihara da Silva P. G. Fernandes",
      recipientNumber: "20240001",
      recipientCourse: "Engenharia Informática e Comunicações",
      code: "UOR-2026-CERT-ABC12345",
      issuedAt: new Date("2026-03-31T10:00:00.000Z"),
      institutionName: "Universidade Óscar Ribas",
      organizerName: "Departamento de Ensino e Investigação",
      authorityTitle: "A Decana",
      authorityName: "Prof. Doutora Cristina de Oliveira",
    });

    expect(html).toContain("A Faculdade de Ciências Sociais e Humanas da Universidade Óscar Ribas certifica que");
    expect(html).toContain("CERTIFICADO");
    expect(html).toContain("Erika Dihara da Silva P. G. Fernandes");
    expect(html).toContain("Prof. Doutor André Pedro Neto");
    expect(html).toContain("Prof. Doutora Cristina de Oliveira");
    expect(html).toContain("@page { size: A4 landscape; margin: 0; }");
    expect(html).toContain("GAC/DEI/PDI UÓR/2026-CERT-ABC12345");
  });

  it("uses the official UOR logo and prints without browser footer margins", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("frontend/public/logo-uor.png");
    expect(source).toContain("loadCertificateLogoDataUri()");
    expect(source).toContain("displayHeaderFooter: false");
    expect(source).toContain('margin: { top: "0", right: "0", bottom: "0", left: "0" }');
  });
});
