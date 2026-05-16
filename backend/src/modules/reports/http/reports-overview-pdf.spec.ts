import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "reports.routes.ts"), "utf8");

describe("admin overview PDF report", () => {
  it("uses the same paged visual system as the challenge manual and exhibitor PDFs", () => {
    expect(source).toContain("Relatório Geral da Administração");
    expect(source).toContain("PAGE 1 — Crescimento e Finanças");
    expect(source).toContain("PAGE 2 — Financeiro e Categorias");
    expect(source).toContain("buildCourseSummaryPage");
    expect(source).toContain("buildSubmissionDetailPages");
    expect(source).toContain("buildRejectedSubmissionSummaryPage");
    expect(source).toContain("buildSubmissionInteractionPages");
    expect(source).toContain("rejectedSubmissions");
    expect(source).toContain("courseSummaries");

    expect(source).toContain("@page { size: A4; margin: 0; }");
    expect(source).toContain(".page { width: 210mm; min-height: 297mm;");
    expect(source).toContain(".page::before");
    expect(source).toContain("class=\"chart-card\"");
    expect(source).toContain("class=\"header\"");
    expect(source).toContain("class=\"doc-kicker\"");
    expect(source).toContain("class=\"section-card\"");
    expect(source).toContain("class=\"score-table\"");
    expect(source).toContain("class=\"rule-card\"");
    expect(source).toContain("class=\"page-footer\"");
  });

  it("renders the PDF without Chromium header/footer chrome or external page margins", () => {
    expect(source).toContain("preferCssPageSize: true");
    expect(source).toContain("displayHeaderFooter: false");
    expect(source).toContain('margin: { top: "0", right: "0", bottom: "0", left: "0" }');
  });

  it("uses the report calculation layer and excludes deleted submissions", () => {
    expect(source).toContain("calculateOverviewReportMetrics");
    expect(source).toContain("buildBarChartRows");
    expect(source).toContain("parseReportMoney");
    expect(source).toContain("deletedAt: null");
    expect(source).not.toContain("parseCurrencyAmount");
  });
});
