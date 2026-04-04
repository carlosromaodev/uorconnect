import { describe, expect, it } from "vitest";
import {
  emptyFormState,
  extractSubmissionPhoneDigits,
  formatSubmissionPhone,
  getDescriptionCounterTone,
  getVisibleSubmissionFields,
  normalizeSubmissionPhoneDigits,
  validateSubmissionField,
  validateSubmissionForm,
  type SubmissionFormState,
} from "./submission-form.validation";

function buildBaseForm(): SubmissionFormState {
  return {
    ...emptyFormState,
    leaderName: "Carlos Silva",
    phoneDigits: "923456789",
    academicCourse: "Eng. Telecomunicações",
    name: "Projeto Alpha",
    description: "",
    area: "Tecnologia",
    paymentProof: "data:application/pdf;base64,ZmFrZQ==",
    paymentConfirmed: true,
    agreeRules: true,
    members: ["Maria Silva"],
  };
}

describe("submission-form.validation", () => {
  it("normaliza, extrai e formata o telefone de Angola", () => {
    expect(normalizeSubmissionPhoneDigits("")).toBe("");
    expect(normalizeSubmissionPhoneDigits("00244 923 456 789")).toBe("923456789");
    expect(normalizeSubmissionPhoneDigits("244923456789")).toBe("923456789");
    expect(normalizeSubmissionPhoneDigits("+244 923 456 789")).toBe("923456789");
    expect(normalizeSubmissionPhoneDigits("551923456789")).toBe("923456789");
    expect(extractSubmissionPhoneDigits("")).toBe("");
    expect(extractSubmissionPhoneDigits("244923456789")).toBe("923456789");
    expect(extractSubmissionPhoneDigits("923456789")).toBe("923456789");
    expect(extractSubmissionPhoneDigits("923 456 789")).toBe("923456789");
    expect(extractSubmissionPhoneDigits("551923456789")).toBe("923456789");
    expect(formatSubmissionPhone("")).toBe("");
    expect(formatSubmissionPhone("92345")).toBe("+244 92345");
    expect(formatSubmissionPhone("923456789")).toBe("+244 923 456 789");
  });

  it("resolve os thresholds do contador de descrição", () => {
    expect(getDescriptionCounterTone(120)).toBe("muted");
    expect(getDescriptionCounterTone(400)).toBe("warning");
    expect(getDescriptionCounterTone(490)).toBe("danger");
  });

  it("lista os campos visíveis por variante", () => {
    expect(getVisibleSubmissionFields("projeto")).toContain("advisor");
    expect(getVisibleSubmissionFields("negocio")).toContain("organizationName");
    expect(getVisibleSubmissionFields("negocio")).toContain("stage");
    expect(getVisibleSubmissionFields("produto")).toContain("category");
    expect(getVisibleSubmissionFields("produto")).toContain("productType");
    expect(getVisibleSubmissionFields("produto")).toContain("priceAverage");
  });

  it("trata descrição vazia como válida e exige 10+ caracteres quando preenchida", () => {
    const form = buildBaseForm();

    expect(validateSubmissionField("projeto", form, "description")).toBeNull();
    expect(validateSubmissionField("projeto", { ...form, description: "curta" }, "description")).toBe("⚠ Descrição deve ter entre 10 e 500 caracteres");
    expect(validateSubmissionField("projeto", { ...form, description: "a".repeat(500) }, "description")).toBeNull();
  });

  it("aplica a regra de letras apenas a nome completo e nome da candidatura", () => {
    const form = buildBaseForm();

    expect(validateSubmissionField("projeto", { ...form, leaderName: "Carlos 9" }, "leaderName")).toBe("⚠ Nome deve ter entre 3 e 100 letras");
    expect(validateSubmissionField("projeto", { ...form, name: "Projeto 9" }, "name")).toBe("⚠ Nome deve ter entre 3 e 100 letras");
  });

  it("valida campos comuns opcionais e obrigatórios", () => {
    const form = buildBaseForm();

    expect(validateSubmissionField("projeto", { ...form, phoneDigits: "123" }, "phoneDigits")).toBe("⚠ Número de telefone inválido");
    expect(validateSubmissionField("projeto", { ...form, repoUrl: "nota-url" }, "repoUrl")).toBe("⚠ Use um link válido");
    expect(validateSubmissionField("projeto", { ...form, repoUrl: "https://example.com/repo" }, "repoUrl")).toBeNull();
    expect(validateSubmissionField("projeto", { ...form, websiteUrl: "nota-url" }, "websiteUrl")).toBe("⚠ Use um link válido");
    expect(validateSubmissionField("projeto", { ...form, websiteUrl: "https://example.com" }, "websiteUrl")).toBeNull();
    expect(validateSubmissionField("projeto", { ...form, observations: "a".repeat(501) }, "observations")).toBe("⚠ Observações não podem exceder 500 caracteres");
    expect(validateSubmissionField("projeto", { ...form, members: [] }, "members")).toBe("⚠ Adicione pelo menos um membro");
    expect(validateSubmissionField("projeto", { ...form, members: ["A", "B"] }, "members")).toBe("⚠ Adicione pelo menos um membro");
    expect(validateSubmissionField("projeto", { ...form, members: ["1", "2", "3", "4", "5", "6"] }, "members")).toBe("⚠ Máximo de 5 membros");
    expect(validateSubmissionField("projeto", { ...form, paymentProof: "" }, "paymentProof")).toBe("⚠ Anexe o comprovativo do pagamento");
    expect(validateSubmissionField("projeto", { ...form, paymentProof: "https://example.com/proof.pdf" }, "paymentProof")).toBeNull();
    expect(validateSubmissionField("projeto", { ...form, paymentConfirmed: false }, "paymentConfirmed")).toBe("⚠ É necessário confirmar o pagamento");
    expect(validateSubmissionField("projeto", { ...form, agreeRules: false }, "agreeRules")).toBe("⚠ É necessário aceitar os termos");
  });

  it("ignora validações que não pertencem à variante actual", () => {
    const form = buildBaseForm();

    expect(validateSubmissionField("negocio", { ...form, advisor: "" }, "advisor")).toBeNull();
    expect(validateSubmissionField("projeto", { ...form, organizationName: "" }, "organizationName")).toBeNull();
    expect(validateSubmissionField("projeto", { ...form, stage: "" }, "stage")).toBeNull();
    expect(validateSubmissionField("negocio", { ...form, category: "" }, "category")).toBeNull();
    expect(validateSubmissionField("negocio", { ...form, productType: "" }, "productType")).toBeNull();
    expect(validateSubmissionField("negocio", { ...form, priceAverage: "" }, "priceAverage")).toBeNull();
  });

  it("exige docente orientador na variante projeto", () => {
    const form = buildBaseForm();
    expect(validateSubmissionForm("projeto", form)).toEqual({ advisor: "⚠ Informe o docente orientador" });
    expect(validateSubmissionForm("projeto", { ...form, advisor: "Professor Silva" })).toEqual({});
  });

  it("exige entidade e estágio na variante negócio", () => {
    const form = buildBaseForm();
    expect(validateSubmissionForm("negocio", form)).toEqual({
      organizationName: "⚠ Informe a entidade responsável",
      stage: "⚠ Seleccione uma opção válida",
    });
    expect(validateSubmissionForm("negocio", { ...form, organizationName: "Startup Aurora", stage: "MVP" })).toEqual({});
  });

  it("exige entidade, categoria, tipo e preço positivo na variante produto", () => {
    const form = buildBaseForm();
    expect(validateSubmissionForm("produto", { ...form, priceAverage: "abc" })).toEqual({
      organizationName: "⚠ Informe a entidade responsável",
      category: "⚠ Seleccione uma opção válida",
      productType: "⚠ Seleccione uma opção válida",
      priceAverage: "⚠ Valor deve ser um número positivo",
    });
    expect(validateSubmissionForm("produto", {
      ...form,
      organizationName: "Laboratório Central",
      category: "Hardware",
      productType: "Físico",
      priceAverage: "25000",
      area: "Hardware",
    })).toEqual({});
  });
});
