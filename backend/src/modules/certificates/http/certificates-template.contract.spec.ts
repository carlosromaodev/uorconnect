import { describe, expect, it } from "vitest";
import { buildCertificateHtml, certificateTemplates } from "./certificates.routes";

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
  rectorTitle: "O Decano",
  rectorName: "Prof. Doutor Diosnorides Carbonell Torreblanca",
};

describe("certificate visual template contract", () => {
  it("renders the photographic-style certificate layout with the template background", () => {
    const html = buildCertificateHtml(baseParams);

    expect(html).toContain("@page");
    expect(html).toContain("size: A4 landscape");
    expect(html).toContain("background-image: url(data:image/png;base64,template)");
    expect(html).toContain("bottom-detail-gold");
    expect(html).toContain("rgba(205, 164, 73, 0.32)");
    expect(html).toContain("display: none");
    expect(html).toContain("Erika Dihara da Silva P. G. Fernandes");
    expect(html).toContain("Jornada Marco Mulher");
    expect(html).toContain("Luanda, 31 de março de 2026.");
    expect(html).toContain("Prof. Doutor Diosnorides Carbonell Torreblanca");
    expect(html).toContain("A Decana");
    expect(html).toContain("Prof. Doutora Cristina de Oliveira");
    expect(html).not.toContain("UOR-2026-PART-TESTE");
    expect(html).not.toContain("Validação em:");
    expect(html).not.toContain("https://uorconnect.space/validar/teste");
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

  it("accepts certificate-specific signature labels and names", () => {
    const html = buildCertificateHtml({
      ...baseParams,
      title: "Vencedor do Concurso de Programação",
      organizerName: "Departamento de Engenharia Informática e Comunicação",
      authorityTitle: "A Coordenadora do Curso",
      authorityName: "Eng. Responsável da Feira",
      rectorTitle: "O Magnífico Reitor",
      rectorName: "Prof. Doutor Nome Editável",
    });

    expect(html).toContain("O Magnífico Reitor");
    expect(html).toContain("Prof. Doutor Nome Editável");
    expect(html).toContain("A Coordenadora do Curso");
    expect(html).toContain("Eng. Responsável da Feira");
  });

  it("exposes all workshop distinction templates in the admin catalogue", () => {
    expect(certificateTemplates.map((template) => template.type)).toEqual(expect.arrayContaining([
      "JURY_SELECTED_BEST_PROJECT",
      "STUDENT_VOTED_BEST_PROJECT",
      "PROJECT_WINNER_1ST_PLACE",
      "PROJECT_WINNER_2ND_PLACE",
      "PROJECT_WINNER_3RD_PLACE",
      "WORKSHOP_REVELATION_PROJECT",
      "WORKSHOP_BEST_IDEA",
      "PROGRAMMING_CONTEST_WINNER",
      "PHYSICS_CONTEST_WINNER",
      "FAIR_OUTSTANDING_PARTICIPATION",
    ]));
  });

  it("renders the official 3rd edition wording for project and contest awards", () => {
    const projectHtml = buildCertificateHtml({
      ...baseParams,
      type: "PROJECT_WINNER_1ST_PLACE",
      title: "Projeto Vencedor do Workshop 1.º Lugar",
      recipientName: "Projeto:",
    });
    const programmingHtml = buildCertificateHtml({
      ...baseParams,
      type: "PROGRAMMING_CONTEST_WINNER",
      title: "Vencedor do Concurso de Programação",
      recipientName: "Estudante:",
    });

    expect(projectHtml).toContain("3.ª Edição do Workshop Alusivo ao Dia das Telecomunicações e da Sociedade da Informação");
    expect(projectHtml).toContain("Da Sala de Aulas ao Mercado de Trabalho");
    expect(projectHtml).toContain("Projeto Vencedor do Workshop 1.º Lugar");
    expect(projectHtml).toContain("rigor conceptual");
    expect(programmingHtml).toContain("Vencedor do Concurso de Programação");
    expect(programmingHtml).toContain("raciocínio lógico");
  });
});
