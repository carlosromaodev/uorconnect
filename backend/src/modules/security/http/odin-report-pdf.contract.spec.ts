import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("ODIN security PDF report", () => {
  it("renders a complete branded ODIN report without exposing Gemini branding", () => {
    const report = source("src/modules/security/http/odin-report-pdf.ts");

    expect(report).toContain("Relatório de Segurança ODIN");
    expect(report).toContain("ODIN-DOSSIER");
    expect(report).toContain("PAGE 1 — Capa Operacional");
    expect(report).toContain("PAGE 2 — Fila de Triagem");
    expect(report).toContain("ACÇÃO IMEDIATA");
    expect(report).toContain("INVESTIGAR 24H");
    expect(report).toContain("PODE ESPERAR");
    expect(report).toContain("BASE DE DADOS FRÁGIL");
    expect(report).toContain("Motor de Integridade de Dados");
    expect(report).toContain("Prova Matemática");
    expect(report).toContain("Análise Contextual");
    expect(report).toContain("buildForensicQueue");
    expect(report).toContain("UOR CONNECT");
    expect(report).toContain("ODIN");
    expect(report).toContain("PAGE 3 — Dossiê Individual");
    expect(report).toContain("PAGE 4 — Utilizadores");
    expect(report).toContain("PAGE 5 — Dispositivos");
    expect(report).toContain("PAGE 6 — Projetos e Eventos");
    expect(report).toContain("PAGE 7 — Dossiê CIA");
    expect(report).toContain("PAGE 10 — Comentários e leitura final");
    expect(report).toContain("Mapa de Dispositivos e Identidades");
    expect(report).toContain("Dados inválidos ou incompletos");
    expect(report).toContain("Primeira conta observada");
    expect(report).toContain("Horários de login");
    expect(report).toContain("firstLoginAt");
    expect(report).toContain("lastLoginAt");
    expect(report).toContain("Tempo login→voto");
    expect(report).toContain("Índice de fraude contextual");
    expect(report).toContain("Dispositivos associados a expositores");
    expect(report).toContain("Telefone emprestado");
    expect(report).toContain("Trocas de conta");
    expect(report).toContain("Votos para o próprio projeto");
    expect(report).toContain("buildExhibitorDeviceSignals");
    expect(report).toContain("buildOdinReportInvestigationContext");
    expect(report).toContain("border-label border-label--left");
    expect(report).toContain("border-label border-label--right");
    expect(report).toContain("renderPdfFromHtml");
    expect(report).toContain("buildOdinSecurityReportSnapshot");
    expect(report).not.toContain("Gemini");
    expect(report).not.toContain("gemini");
  });

  it("exposes queued PDF endpoints behind the ODIN SECURITY routes", () => {
    const routes = source("src/modules/security/http/odin.routes.ts");
    const report = source("src/modules/security/http/odin-report-pdf.ts");
    const api = source("../frontend/src/lib/api.ts");
    const admin = source("../frontend/src/components/admin/AdminOdinTab.tsx");

    expect(routes).toContain('adminApp.post("/odin/report/pdf-jobs"');
    expect(routes).toContain('adminApp.get("/odin/report/pdf-jobs/:id"');
    expect(routes).toContain('adminApp.get("/odin/report/pdf-jobs/:id/file"');
    expect(`${routes}\n${report}`).toContain("security.odin.report");
    expect(routes).toContain("generateOdinSecurityReportPdf");

    expect(api).toContain("createSecurityReportPdfJob");
    expect(api).toContain("getSecurityReportPdfJob");
    expect(api).toContain("downloadSecurityReportPdfJobFile");
    expect(admin).toContain("Baixar relatório de segurança");
    expect(admin).toContain("handleDownloadSecurityReport");
  });
});
