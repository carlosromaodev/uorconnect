import { describe, expect, it } from "vitest";
import { profileCompletion } from "./profile-completion.service";

const baseStudent = {
  studentNumber: "20240001",
  name: "Maria Silva",
  email: "maria@uor.ao",
  phone: "+244923000000",
  profileCompletedAt: new Date("2026-05-08T10:00:00.000Z"),
};

const baseMember = {
  team: "Núcleo",
  role: "Membro",
  accessLevel: "Operacional",
  organization: "Universidade Oscar Ribas",
};

describe("profileCompletion", () => {
  it("mantem fotografia opcional no perfil basico do estudante comum", () => {
    const completion = profileCompletion("BASIC", {
      student: { ...baseStudent, avatarUrl: null },
    });

    expect(completion.ready).toBe(true);
    expect(completion.missingRequiredFields).not.toContainEqual(
      expect.objectContaining({ key: "avatarUrl" }),
    );
  });

  it("exige fotografia para admin, equipa e expositor", () => {
    for (const context of ["ADMIN_READY", "TEAM_READY", "EXPOSITOR_READY"] as const) {
      const completion = profileCompletion(context, {
        student: { ...baseStudent, avatarUrl: null },
        member: { ...baseMember, photoUrl: null },
      });

      expect(completion.ready).toBe(false);
      expect(completion.missingRequiredFields).toContainEqual(
        expect.objectContaining({ key: "photoUrl" }),
      );
    }
  });
});
