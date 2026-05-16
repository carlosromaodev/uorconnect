import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("Submeter expositor copy", () => {
  it("simplifica a submissao de projecto com limite de equipa ampliado", () => {
    const source = readSource("Submeter.tsx");
    const schema = readSource("submeter.schema.ts");
    const teamHelper = readSource("submeter-team.ts");

    expect(source).toContain("Nome do projecto");
    expect(source).toContain("Descrição do projecto");
    expect(source).toContain("memberInputPlaceholder");
    expect(source).toContain("Tu és o 1.º membro automaticamente");
    expect(teamHelper).toContain("MAX_SUBMISSION_TEAM_MEMBERS");
    expect(teamHelper).toContain("MAX_ADDITIONAL_TEAM_MEMBERS");
    expect(teamHelper).toContain("Adicionar nome do ${nextMemberNumber}.º membro");
    expect(source).toContain("Até 17 membros");
    expect(source).not.toContain("Nome da candidatura");
    expect(source).not.toContain("Representante da equipa");
    expect(schema).toContain("MAX_SUBMISSION_TEAM_MEMBERS");
  });
});
