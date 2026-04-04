import { describe, expect, it } from "vitest";
import {
  buildStudentSubmissionListItem,
  buildStudentSubmissionReceiptResponse,
  canStudentEditSubmission,
  getSubmissionStatusLabel,
} from "./student-submission-presenter";

const baseSubmission = {
  id: 14,
  referenceCode: "UOR-2026-0014",
  name: "Monitorização do campus",
  description: "Projeto com sensores, gateway e dashboard.",
  status: "PENDING",
  type: "PROJECT" as const,
  area: "Tecnologia",
  course: "Engenharia Informática e Comunicações",
  stage: null,
  category: null,
  productType: null,
  createdAt: new Date("2026-03-28T10:00:00.000Z"),
  updatedAt: new Date("2026-03-28T11:00:00.000Z"),
  members: ["Ana Silva", "Bruno Costa"],
  leaderName: "Ana Silva",
  leaderPhone: "+244 912345678",
  leaderEmail: "ana@example.com",
  needs: ["Tomada elétrica"],
  observations: "Docente orientador: Prof. Marta",
  repoUrl: "https://github.com/uor/demo",
  websiteUrl: "https://uorconnect.space/demo",
  primaryColor: "#FD8305",
  secondaryColor: "#223D42",
  bannerUrl: null,
};

describe("student submission presenter", () => {
  it("mapeia todos os estados para labels legíveis", () => {
    expect(getSubmissionStatusLabel("PENDING")).toBe("Em análise");
    expect(getSubmissionStatusLabel("APPROVED")).toBe("Aprovado");
    expect(getSubmissionStatusLabel("REJECTED")).toBe("Rejeitado");
    expect(getSubmissionStatusLabel("UNKNOWN")).toBe("Em análise");
  });

  it("permite edição apenas para submissões pendentes ou rejeitadas", () => {
    expect(canStudentEditSubmission("PENDING")).toBe(true);
    expect(canStudentEditSubmission("REJECTED")).toBe(true);
    expect(canStudentEditSubmission("APPROVED")).toBe(false);
  });

  it("gera recibo com paths canónicos, tipo normalizado e membros formatados", () => {
    const result = buildStudentSubmissionReceiptResponse(baseSubmission, {
      projectCommunityUrl: "https://chat.whatsapp.com/projetos",
    });

    expect(result.receiptPath).toBe("/submissoes/14");
    expect(result.detailPath).toBe("/projeto/monitorizacao-do-campus-14");
    expect(result.boardingPassPath).toBe("/submissions/14/boarding-pass.pdf");
    expect(result.communityUrl).toBe("https://chat.whatsapp.com/projetos");
    expect(result.type).toBe("PROJECT");
    expect(result.typeLabel).toBe("Projeto");
    expect(result.members).toBe("Ana Silva, Bruno Costa");
    expect(result.teamSize).toBe(2);
    expect(result.canEdit).toBe(true);
  });

  it("desativa edição no recibo quando a submissão foi aprovada", () => {
    const result = buildStudentSubmissionReceiptResponse(
      { ...baseSubmission, status: "APPROVED" },
      {}
    );

    expect(result.statusLabel).toBe("Aprovado");
    expect(result.canEdit).toBe(false);
    expect(result.communityUrl).toBeNull();
  });

  it("gera item compacto do histórico do estudante", () => {
    const result = buildStudentSubmissionListItem(baseSubmission);

    expect(result).toEqual({
      id: 14,
      referenceCode: "UOR-2026-0014",
      name: "Monitorização do campus",
      status: "PENDING",
      statusLabel: "Em análise",
      type: "PROJECT",
      typeLabel: "Projeto",
      createdAt: "2026-03-28T10:00:00.000Z",
      detailPath: "/projeto/monitorizacao-do-campus-14",
      bannerUrl: null,
      receiptPath: "/submissoes/14",
    });
  });
});
