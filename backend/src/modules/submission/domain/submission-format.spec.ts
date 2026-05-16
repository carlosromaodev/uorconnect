import { describe, expect, it } from "vitest";
import {
  countTeamMembers,
  MAX_TEAM_MEMBERS,
  normalizeTeamMembersInput,
} from "./submission-format";

describe("submission-format", () => {
  it("conta membros a partir dos nomes submetidos", () => {
    expect(countTeamMembers(["Ana", "Bruno", "Carla"])).toBe(3);
    expect(countTeamMembers("Ana, Bruno\nCarla")).toBe(3);
  });

  it("normaliza nomes duplicados e espaços antes de contar", () => {
    const members = normalizeTeamMembersInput([" Ana  ", "Bruno", "ana", ""]);

    expect(members).toEqual(["Ana", "Bruno"]);
    expect(countTeamMembers(members)).toBe(2);
  });

  it("permite equipas com ate 17 membros normalizados", () => {
    const rawMembers = Array.from(
      { length: 18 },
      (_, index) => `Membro ${index + 1}`,
    );
    const members = normalizeTeamMembersInput(rawMembers);

    expect(MAX_TEAM_MEMBERS).toBe(17);
    expect(members).toHaveLength(17);
    expect(members.at(-1)).toBe("Membro 17");
  });
});
