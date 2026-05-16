import { describe, expect, it } from "vitest";
import {
  buildCourseEnrollmentLegend,
  buildSubmissionLegend,
  formatDateTime,
  toAbsoluteAssetUrl,
} from "./student-documents";

describe("student document helpers", () => {
  it("resolve URLs absolutas e preserva data URLs", () => {
    expect(toAbsoluteAssetUrl("/submissions/4/boarding-pass.pdf")).toBe("http://localhost:3000/submissions/4/boarding-pass.pdf");
    expect(toAbsoluteAssetUrl("data:application/pdf;base64,AAA")).toBe("data:application/pdf;base64,AAA");
    expect(toAbsoluteAssetUrl("https://api.uorconnect.space/file.pdf")).toBe("https://api.uorconnect.space/file.pdf");
  });

  it("formata datas para leitura humana", () => {
    const result = formatDateTime("2026-03-28T15:45:00.000Z");
    expect(result).toContain("2026");
    expect(result).toMatch(/28|29/);
  });

  it("gera legenda de submissão com campos opcionais e links absolutos", () => {
    const result = buildSubmissionLegend({
      id: 4,
      referenceCode: "UOR-2026-0004",
      name: "Projeto Campus",
      description: "Dashboard inteligente",
      status: "PENDING",
      statusLabel: "Em análise",
      type: "PROJECT",
      typeLabel: "Projeto",
      area: "Tecnologia",
      course: "Engenharia Informática",
      stage: null,
      category: null,
      productType: null,
      createdAt: "2026-03-28T10:00:00.000Z",
      updatedAt: "2026-03-28T11:00:00.000Z",
      members: "Ana, Bruno",
      membersList: ["Ana", "Bruno"],
      teamSize: 2,
      leaderName: "Ana",
      leaderPhone: "+244 912345678",
      leaderEmail: "ana@example.com",
      needs: ["Tomada elétrica"],
      observations: null,
      repoUrl: null,
      websiteUrl: null,
      primaryColor: "#FD8305",
      secondaryColor: "#223D42",
      bannerUrl: null,
      communityUrl: "https://chat.whatsapp.com/demo",
      boardingPassPath: "/submissions/4/boarding-pass.pdf",
      exhibitorPdfPath: null,
      paymentProofPath: "/submissions/4/payment-proof",
      receiptPath: "/submissoes/4",
      detailPath: "/projeto/projeto-campus-4",
      canEdit: true,
    });

    expect(result).toContain("Referência: UOR-2026-0004");
    expect(result).toContain("Talão: http://localhost:3000/submissions/4/boarding-pass.pdf");
    expect(result).toContain("Comprovativo: http://localhost:3000/submissions/4/payment-proof");
    expect(result).toContain("Comunidade: https://chat.whatsapp.com/demo");
  });

  it("gera legenda da inscrição com número de estudante, PDF e comprovativo", () => {
    const result = buildCourseEnrollmentLegend({
      id: 7,
      courseId: 3,
      courseName: "React",
      courseDescription: "Curso completo",
      companyName: "Parceiro Tech",
      companyCategory: "Tecnologia",
      communityUrl: "https://chat.whatsapp.com/curso",
      referenceCode: "CUR-3-0007",
      studentNumber: "20240099",
      fullName: "Bruno Costa",
      email: "bruno@example.com",
      studentCourse: "Engenharia Informática",
      phone: "+244 923456789",
      paymentPhone: "+244 923456789",
      paymentStatus: "PENDING",
      statusLabel: "Em análise",
      paymentSubmittedAt: "2026-03-28T10:00:00.000Z",
      paymentProofPath: "/courses/enrollments/7/payment-proof",
      ticketPath: "/courses/enrollments/7/ticket.pdf",
      whatsAppRedirectUrl: "https://wa.me/244923456789",
      enrolledAt: "2026-03-28T10:00:00.000Z",
      receiptPath: "/cursos/inscricoes/7",
    });

    expect(result).toContain("Número de estudante: 20240099");
    expect(result).toContain("Talão: http://localhost:3000/courses/enrollments/7/ticket.pdf");
    expect(result).toContain("Comprovativo: http://localhost:3000/courses/enrollments/7/payment-proof");
  });
});
