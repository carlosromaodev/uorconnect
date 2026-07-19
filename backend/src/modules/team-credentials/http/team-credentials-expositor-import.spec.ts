import { describe, expect, it } from "vitest";

import { buildExpositorCredentialImportCandidates } from "./team-credentials.routes";

describe("expositor credential import", () => {
  it("prepara credenciais para o responsável e todos os membros listados", () => {
    const candidates = buildExpositorCredentialImportCandidates(
      {
        id: 12,
        referenceCode: "UOR-012",
        name: "Sistema de filas",
        type: "PROJECT",
        area: "Telecom",
        course: "Engenharia Informática",
        leaderName: "Ana Líder",
        studentNumberSnapshot: "20240001",
        student: {
          studentNumber: "20240001",
          name: "Ana Líder",
          phone: "923000001",
          course: "Engenharia Informática",
        },
      },
      [
        {
          id: 31,
          name: "Bruno Membro",
          expectedStudentNumber: "20240002",
          studentNumber: null,
          studentName: null,
          studentCourse: null,
          studentPhone: null,
        },
        {
          id: 32,
          name: "Carla Membro",
          expectedStudentNumber: null,
          studentNumber: null,
          studentName: null,
          studentCourse: null,
          studentPhone: null,
        },
      ],
    );

    expect(candidates).toEqual([
      expect.objectContaining({ source: "leader", name: "Ana Líder", studentNumber: "20240001" }),
      expect.objectContaining({ source: "member", name: "Bruno Membro", studentNumber: "20240002" }),
      expect.objectContaining({ source: "member", name: "Carla Membro", studentNumber: null }),
    ]);
  });

  it("não duplica o responsável quando ele também aparece na lista de membros", () => {
    const candidates = buildExpositorCredentialImportCandidates(
      {
        id: 14,
        referenceCode: "UOR-014",
        name: "Rede inteligente",
        type: "PROJECT",
        area: "Telecom",
        leaderName: "Dário Responsável",
        studentNumberSnapshot: "20240010",
        student: { studentNumber: "20240010", name: "Dário Responsável" },
      },
      [
        {
          id: 41,
          name: "Dário Responsável",
          expectedStudentNumber: "20240010",
          studentNumber: "20240010",
          studentName: "Dário Responsável",
        },
      ],
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ source: "leader", studentNumber: "20240010" });
  });
});
