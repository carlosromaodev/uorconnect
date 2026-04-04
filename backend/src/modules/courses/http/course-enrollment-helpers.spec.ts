import { describe, expect, it } from "vitest";
import {
  buildEnrollmentReference,
  buildPaymentShareUrl,
  buildStudentEnrollmentListItem,
  buildStudentEnrollmentReceipt,
  buildWhatsAppUrl,
  getEnrollmentStatusLabel,
  normalizePhoneForWhatsApp,
  toAbsoluteUrl,
} from "./course-enrollment-helpers";

describe("course enrollment helpers", () => {
  it("normaliza contactos para WhatsApp", () => {
    expect(normalizePhoneForWhatsApp("+244 912 345 678")).toBe("244912345678");
    expect(normalizePhoneForWhatsApp("923456789")).toBe("244923456789");
    expect(normalizePhoneForWhatsApp("123")).toBeNull();
  });

  it("gera referência e labels de estado consistentes", () => {
    expect(buildEnrollmentReference(3, 7)).toBe("CUR-3-0007");
    expect(getEnrollmentStatusLabel("CONFIRMED", "/proof")).toBe("Confirmado");
    expect(getEnrollmentStatusLabel("PENDING", "/proof")).toBe("Em análise");
    expect(getEnrollmentStatusLabel("PENDING", null)).toBe("Pendente de comprovativo");
  });

  it("gera link de WhatsApp com primeiro nome e curso", () => {
    const result = buildWhatsAppUrl("+244 923 456 789", {
      courseName: "React Avançado",
      fullName: "Ana Silva",
    });

    expect(result).toContain("wa.me/244923456789");
    expect(result).toContain(encodeURIComponent("Olá Ana"));
    expect(result).toContain(encodeURIComponent("React Avançado"));
  });

  it("gera link de partilha com texto pronto e preserva URL não-WhatsApp", () => {
    const generated = buildPaymentShareUrl({
      courseName: "Node.js",
      fullName: "Bruno Costa",
      studentNumber: "20240099",
      paymentProofPath: "/courses/enrollments/4/payment-proof",
      ticketPath: "/courses/enrollments/4/ticket.pdf",
      publicApiBaseUrl: "https://api.uorconnect.space",
      publicAppUrl: "https://uorconnect.space",
    });

    expect(generated).toContain("https://wa.me/?text=");
    expect(generated).toContain(encodeURIComponent("PDF da inscrição: https://api.uorconnect.space/courses/enrollments/4/ticket.pdf"));

    const preserved = buildPaymentShareUrl({
      courseName: "Node.js",
      fullName: "Bruno Costa",
      studentNumber: "20240099",
      paymentProofPath: null,
      ticketPath: null,
      destinationUrl: "https://example.com/externo",
    });

    expect(preserved).toBe("https://example.com/externo");
  });

  it("constrói URLs absolutas e presenters do histórico/recibo", () => {
    expect(toAbsoluteUrl("https://api.uorconnect.space", "/foo/bar")).toBe("https://api.uorconnect.space/foo/bar");
    expect(toAbsoluteUrl(undefined, "/foo/bar")).toBe("/foo/bar");

    const listItem = buildStudentEnrollmentListItem({
      id: 11,
      courseId: 5,
      enrolledAt: "2026-03-28T10:00:00.000Z",
      paymentStatus: "PENDING",
      paymentProofPath: "/courses/enrollments/11/payment-proof",
      ticketPath: "/courses/enrollments/11/ticket.pdf",
      course: {
        name: "Segurança",
        companyName: "Parceiro Tech",
      },
    });

    expect(listItem).toEqual({
      id: 11,
      courseId: 5,
      courseName: "Segurança",
      companyName: "Parceiro Tech",
      referenceCode: "CUR-5-0011",
      paymentStatus: "PENDING",
      statusLabel: "Em análise",
      enrolledAt: "2026-03-28T10:00:00.000Z",
      receiptPath: "/cursos/inscricoes/11",
      ticketPath: "/courses/enrollments/11/ticket.pdf",
      paymentProofPath: "/courses/enrollments/11/payment-proof",
    });

    const receipt = buildStudentEnrollmentReceipt({
      id: 11,
      courseId: 5,
      studentNumber: "20240099",
      fullName: "Bruno Costa",
      email: "bruno@example.com",
      studentCourse: "Engenharia Informática",
      phone: "+244 923456789",
      paymentPhone: "+244 923456789",
      paymentStatus: "CONFIRMED",
      paymentSubmittedAt: "2026-03-28T10:05:00.000Z",
      paymentProofPath: "/courses/enrollments/11/payment-proof",
      ticketPath: "/courses/enrollments/11/ticket.pdf",
      whatsAppRedirectUrl: "https://wa.me/244923456789",
      enrolledAt: "2026-03-28T10:00:00.000Z",
      course: {
        name: "Segurança",
        description: "Curso intensivo",
        companyName: "Parceiro Tech",
        companyCategory: "Tecnologia",
        communityUrl: "https://chat.whatsapp.com/curso",
      },
    });

    expect(receipt.referenceCode).toBe("CUR-5-0011");
    expect(receipt.statusLabel).toBe("Confirmado");
    expect(receipt.receiptPath).toBe("/cursos/inscricoes/11");
    expect(receipt.communityUrl).toBe("https://chat.whatsapp.com/curso");
  });
});
