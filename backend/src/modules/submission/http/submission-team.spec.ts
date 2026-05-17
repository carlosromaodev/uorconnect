import { describe, expect, it } from "vitest";
import {
  buildMemberJourneyLabel,
  buildSubmissionTeamMemberView,
  buildSubmissionMemberStudentNumberReservation,
  canShareSubmissionTeamInvite,
  isStudentAllowedForSubmissionMember,
  isStudentNameCompatibleWithSubmissionMember,
  isStudentEligibleForTeamConfirmation,
  isSubmissionTeamConfirmationRequired,
  normalizeExpectedStudentNumber,
  removeSubmissionTeamMemberFromList,
} from "./submission-team";

describe("submission team confirmation rules", () => {
  it("does not require member confirmation after a submission is rejected", () => {
    expect(
      isSubmissionTeamConfirmationRequired({
        status: "REJECTED",
        members: ["Ana Responsavel", "Bruno Membro"],
        leaderName: "Ana Responsavel",
      }),
    ).toBe(false);
  });

  it("requires confirmation only when there are non-responsible members", () => {
    expect(
      isSubmissionTeamConfirmationRequired({
        status: "APPROVED",
        members: ["Ana Responsavel"],
        leaderName: "Ana Responsavel",
      }),
    ).toBe(false);

    expect(
      isSubmissionTeamConfirmationRequired({
        status: "APPROVED",
        members: ["Ana Responsavel", "Bruno Membro"],
        leaderName: "Ana Responsavel",
      }),
    ).toBe(true);
  });

  it("labels rejected or individual projects without blocking the flow", () => {
    expect(buildMemberJourneyLabel({ total: 2, confirmed: 0, required: false })).toBe("Confirmação dispensada");
    expect(buildMemberJourneyLabel({ total: 1, confirmed: 1, required: false })).toBe("Equipa individual");
  });

  it("accepts harmless spelling and particle differences between selected name and logged student", () => {
    expect(isStudentNameCompatibleWithSubmissionMember("Danilo de Carvalho", "Danilo Carvalho")).toBe(true);
    expect(isStudentNameCompatibleWithSubmissionMember("Ivan Van Dunem", "Ivan Van-Duném")).toBe(true);
    expect(isStudentNameCompatibleWithSubmissionMember("Mário Antônio", "Mário António")).toBe(true);
    expect(isStudentNameCompatibleWithSubmissionMember("Moibilson Quipaca", "Moibison Quipaca")).toBe(true);
  });

  it("rejects confirmation when the selected team slot belongs to another identity", () => {
    expect(isStudentNameCompatibleWithSubmissionMember("Ivan Van Dunem", "Danilo Carvalho")).toBe(false);
    expect(isStudentNameCompatibleWithSubmissionMember("Danilo de Carvalho", "Ivan Van-Duném")).toBe(false);
    expect(isStudentNameCompatibleWithSubmissionMember("Esdras Gomes", "Moibilson Quipaca")).toBe(false);
  });

  it("uses the expected student number as the strongest identity gate", () => {
    expect(normalizeExpectedStudentNumber(" 2025 0108 ")).toBe("20250108");
    expect(
      isStudentAllowedForSubmissionMember(
        { name: "Ivan Van Dunem", expectedStudentNumber: "20250108" },
        { studentNumber: "20250108", name: "Danilo de Carvalho" },
      ),
    ).toBe(true);
    expect(
      isStudentAllowedForSubmissionMember(
        { name: "Ivan Van Dunem", expectedStudentNumber: "20250108" },
        { studentNumber: "20250109", name: "Ivan Van-Duném" },
      ),
    ).toBe(false);
  });

  it("blocks the shared invite until every pending member has a student number", () => {
    expect(
      canShareSubmissionTeamInvite({
        confirmationRequired: true,
        members: [
          { isResponsible: true, confirmed: true },
          { isResponsible: false, confirmed: false, expectedStudentNumber: null },
        ],
      }),
    ).toBe(false);

    expect(
      canShareSubmissionTeamInvite({
        confirmationRequired: true,
        members: [
          { isResponsible: true, confirmed: true },
          { isResponsible: false, confirmed: false, expectedStudentNumber: "20250108" },
        ],
      }),
    ).toBe(true);
  });

  it("reserves an existing student number without confirming presence before login", () => {
    expect(
      buildSubmissionMemberStudentNumberReservation({
        expectedStudentNumber: "20250108",
        submissionCourse: "Engenharia Informática",
        confirmedAt: null,
        student: {
          id: 42,
          studentNumber: "20250108",
          name: "Ivan Van-Duném",
          course: "Engenharia Informática",
          phone: "+244900000000",
          academicSyncedAt: new Date("2026-05-12T10:00:00.000Z"),
        },
      }),
    ).toMatchObject({
      expectedStudentNumber: "20250108",
      studentId: 42,
      studentNumber: "20250108",
      studentName: "Ivan Van-Duném",
      confirmedAt: null,
    });
  });

  it("does not use conventional profile data while reserving a member number", () => {
    expect(
      buildSubmissionMemberStudentNumberReservation({
        expectedStudentNumber: "900000001",
        submissionCourse: "Engenharia Informática",
        confirmedAt: null,
        student: {
          id: 77,
          studentNumber: "900000001",
          name: "Cadastro por SMS",
          course: "Curso declarado",
          phone: "+244900000001",
          academicSyncedAt: null,
        },
      }),
    ).toMatchObject({
      expectedStudentNumber: "900000001",
      studentId: null,
      studentNumber: null,
      studentName: null,
      studentCourse: null,
      confirmedAt: null,
    });
  });

  it("only accepts secretaria-synced students for team confirmation", () => {
    expect(
      isStudentEligibleForTeamConfirmation({
        studentNumber: "20250108",
        academicSyncedAt: new Date("2026-05-12T10:00:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isStudentEligibleForTeamConfirmation({
        studentNumber: "900000001",
        academicSyncedAt: null,
      }),
    ).toBe(false);
  });

  it("removes a non-responsible member without allowing the responsible member to be removed", () => {
    expect(
      removeSubmissionTeamMemberFromList({
        members: ["Ana Responsavel", "Bruno Membro", "Carla Membro"],
        memberName: "Bruno Membro",
        leaderName: "Ana Responsavel",
      }),
    ).toEqual(["Ana Responsavel", "Carla Membro"]);

    expect(() =>
      removeSubmissionTeamMemberFromList({
        members: ["Ana Responsavel", "Bruno Membro"],
        memberName: "Ana Responsavel",
        leaderName: "Ana Responsavel",
      }),
    ).toThrow("O responsável não pode ser removido da equipa.");
  });

  it("serializes confirmed members with the full team member contract", () => {
    expect(
      buildSubmissionTeamMemberView({
        id: 12,
        name: "Membro Externo",
        confirmedAt: new Date("2026-05-17T08:15:00.000Z"),
        expectedStudentNumber: "800000000001",
        studentNumber: "800000000001",
        studentName: "Membro Externo",
        studentCourse: "Outra instituição",
        isExternal: true,
        externalOrganization: "Instituto Médio Teste",
        externalReason: "Membro externo comunicado à organização.",
        exceptionApprovedAt: new Date("2026-05-16T12:00:00.000Z"),
      }),
    ).toEqual({
      id: 12,
      name: "Membro Externo",
      confirmed: true,
      confirmedAt: "2026-05-17T08:15:00.000Z",
      expectedStudentNumber: "800000000001",
      studentNumber: "800000000001",
      studentName: "Membro Externo",
      studentCourse: "Outra instituição",
      isExternal: true,
      externalOrganization: "Instituto Médio Teste",
      externalReason: "Membro externo comunicado à organização.",
      exceptionApprovedAt: "2026-05-16T12:00:00.000Z",
      role: "MEMBRO",
      roleLabel: "Membro",
      isResponsible: false,
    });
  });
});
