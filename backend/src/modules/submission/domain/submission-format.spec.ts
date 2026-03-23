import { describe, expect, it } from "vitest";
import { countTeamMembers, normalizeTeamMembersInput } from "./submission-format";

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
});
