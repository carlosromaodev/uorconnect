import { describe, expect, it } from "vitest";
import { buildCertificateHtml } from "./certificates.routes";

const baseParams = {
  logoDataUri: null,
  templateBackgroundDataUri: "data:image/png;base64,template",
  type: "PARTICIPATION",
  title: "Jornada Marco Mulher",
  recipientName: "Erika Dihara da Silva P. G. Fernandes",
  recipientNumber: "20260001",
  recipientCourse: "Psicologia",
  code: "UOR-2026-PART-TESTE",
  issuedAt: new Date("2026-03-31T12:00:00.000Z"),
  institutionName: "Universidade Óscar Ribas",
  organizerName: "Faculdade de Ciências Sociais e Humanas",
  authorityTitle: "Vice-Reitora para os Assuntos Académicos",
  authorityName: "Prof. Doutora Maria de Fátima",
  validationUrl: "https://uorconnect.space/validar/teste",
};

describe("certificate visual template contract", () => {
  it("renders the photographic-style certificate layout with the template background", () => {
    const html = buildCertificateHtml(baseParams);

    expect(html).toContain("@page");
    expect(html).toContain("size: A4 landscape");
    expect(html).toContain("background-image: url(data:image/png;base64,template)");
    expect(html).toContain("display: none");
    expect(html).toContain("Erika Dihara da Silva P. G. Fernandes");
    expect(html).toContain("Jornada Marco Mulher");
    expect(html).toContain("Luanda, 31 de março de 2026.");
    expect(html).toContain("Prof. Doutor André Pedro Neto");
    expect(html).toContain("A Decana");
    expect(html).toContain("Prof. Doutora Cristina de Oliveira");
    expect(html).toContain("Validação em: https://uorconnect.space/validar/teste");
  });

  it("keeps a fallback border when the template image is unavailable", () => {
    const html = buildCertificateHtml({
      ...baseParams,
      templateBackgroundDataUri: null,
    });

    expect(html).not.toContain("background-image: url(data:image/png;base64,template)");
    expect(html).toContain("border: 2px solid #a0361a");
    expect(html).toContain("display: block");
  });
});
