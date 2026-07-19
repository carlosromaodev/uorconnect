import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { humanizeAuditAction } from "./audit.routes";

const source = readFileSync(path.join(__dirname, "audit.routes.ts"), "utf8");

describe("admin audit readable presentation contract", () => {
  it("exposes actor names and readable action labels in audit responses and CSV", () => {
    expect(source).toContain("actorName: z.string().nullable()");
    expect(source).toContain("actionLabel: z.string()");
    expect(source).toContain("resolveAuditActorNames");
    expect(source).toContain("prisma.student.findMany");
    expect(source).toContain("prisma.juryMember.findMany");
    expect(source).toContain('"Nome do ator"');
    expect(source).toContain("row.actionLabel");
  });

  it("humanizes technical audit action codes into Portuguese labels", () => {
    expect(humanizeAuditAction("team_credential.print_batch_pdf")).toBe("PDF do lote de credenciais gerado");
    expect(humanizeAuditAction("projects.score_ranking_pdf_exported")).toBe("Ranking de pontuação exportado em PDF");
    expect(humanizeAuditAction("team_membership_claim.submit")).toBe("Solicitação de tomada de posse enviada");
    expect(humanizeAuditAction("custom.new_action")).toBe("Custom new action");
  });
});
