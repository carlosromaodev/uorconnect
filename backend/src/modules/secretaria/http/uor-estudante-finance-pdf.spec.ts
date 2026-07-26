import { describe, expect, it } from "vitest";
import {
  UOR_ESTUDANTE_PALETTE,
  buildUorEstudantePaymentReferencesHtml,
  buildUorEstudanteReceiptHtml,
} from "./uor-estudante-finance-pdf";

describe("UOR Estudante finance PDF", () => {
  it("aplica a identidade e apresenta todos os dados da referência", () => {
    const html = buildUorEstudantePaymentReferencesHtml({
      student: { displayName: "Ana Teste", studentNumber: "20240000", course: "Direito", academicYear: "2025/2026" },
      references: [{ label: "Propina", entity: "00541", reference: "123 456 789", amount: "30 000,00 Kz", dueDate: "31 jul. 2026", state: "ACTIVE" }],
      generatedAt: "22 jul. 2026, 14:30",
      documentId: "UE-PAY-TEST",
      totalLabel: "30 000,00 Kz",
    });

    expect(html).toContain(UOR_ESTUDANTE_PALETTE.orange);
    expect(html).toContain(UOR_ESTUDANTE_PALETTE.paper);
    expect(html).toContain("Estudante");
    expect(html).toContain("by UOR Connect");
    expect(html).toContain("123 456 789");
    expect(html).toContain("Documento financeiro");
    expect(html).toContain("não substitui recibo fiscal");
  });

  it("escapa dados dinâmicos e mantém estados acessíveis por texto", () => {
    const html = buildUorEstudantePaymentReferencesHtml({
      student: { displayName: '<script>alert("x")</script>', studentNumber: "20240000", course: "Curso", academicYear: "2025/2026" },
      references: [{ label: "Recurso", entity: "00541", reference: "111", amount: "1 Kz", state: "EXPIRED" }],
      generatedAt: "agora",
      documentId: "teste",
    });

    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("Expirada");
  });

  it("adapta também o extrato financeiro existente à nova identidade", () => {
    const html = buildUorEstudanteReceiptHtml({ description: "Propina", paid: true, amount: "35 000,00 Kz" }, "22 jul. 2026", { studentNumber: "20240000" });
    expect(html).toContain("Detalhe de pagamento");
    expect(html).toContain("35 000,00 Kz");
    expect(html).toContain("UOR Estudante");
    expect(html).toContain("20240000");
  });

  it("recusa um documento sem referências", () => {
    expect(() => buildUorEstudantePaymentReferencesHtml({
      student: { displayName: "Ana", studentNumber: "1", course: "Curso", academicYear: "2025/2026" },
      references: [],
      generatedAt: "agora",
      documentId: "teste",
    })).toThrow("pelo menos uma referência");
  });

  it("pagina listas extensas sem perder a identificação do estudante", () => {
    const references = Array.from({ length: 5 }, (_, index) => ({
      label: `Pagamento ${index + 1}`,
      entity: "00541",
      reference: `100 000 00${index}`,
      amount: "1 000,00 Kz",
      state: "ACTIVE" as const,
    }));
    const html = buildUorEstudantePaymentReferencesHtml({
      student: { displayName: "Ana", studentNumber: "20240000", course: "Curso", academicYear: "2025/2026" },
      references,
      generatedAt: "agora",
      documentId: "teste",
    });

    expect(html.match(/<main class="sheet">/g)).toHaveLength(3);
    expect(html).toContain("1 / 3");
    expect(html).toContain("3 / 3");
    expect(html.match(/N.º de estudante/g)).toHaveLength(3);
  });
});
