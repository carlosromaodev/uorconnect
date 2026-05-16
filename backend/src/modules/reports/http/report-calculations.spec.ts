import { describe, expect, it } from "vitest";
import {
  buildBarChartRows,
  calculateOverviewReportMetrics,
  parseReportMoney,
  sumMoney,
} from "./report-calculations";

describe("overview report calculations", () => {
  it("parses AOA labels with thousands and decimal separators rigorously", () => {
    expect(parseReportMoney("25.000 Kz")).toBe(25000);
    expect(parseReportMoney("25,000 Kz")).toBe(25000);
    expect(parseReportMoney("25 000 AOA")).toBe(25000);
    expect(parseReportMoney("25.000,75 Kz")).toBe(25000.75);
    expect(parseReportMoney("25,000.75 AOA")).toBe(25000.75);
  });

  it("uses decimal arithmetic for financial sums", () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it("excludes rejected submissions from expected revenue and pending finance", () => {
    const metrics = calculateOverviewReportMetrics({
      submissions: [
        {
          statusLabel: "Aprovado",
          paymentConfirmed: true,
          expectedAmount: 25000,
          collectedAmount: 25000,
          likesCount: 2,
          votesCount: 1,
          commentsCount: 0,
        },
        {
          statusLabel: "Pendente",
          paymentConfirmed: false,
          expectedAmount: 25000,
          collectedAmount: 0,
          likesCount: 1,
          votesCount: 0,
          commentsCount: 0,
        },
        {
          statusLabel: "Recusado",
          paymentConfirmed: false,
          expectedAmount: 25000,
          collectedAmount: 0,
          likesCount: 9,
          votesCount: 9,
          commentsCount: 9,
        },
      ],
      courses: [
        {
          enrolledCount: 2,
          confirmedCount: 1,
          expectedTotal: 20000,
          totalCollected: 10000,
        },
      ],
    });

    expect(metrics.activeSubmissions).toBe(2);
    expect(metrics.rejectedSubmissions).toBe(1);
    expect(metrics.paidSubmissions).toBe(1);
    expect(metrics.pendingFinancialCount).toBe(1);
    expect(metrics.totalSubmissionExpected).toBe(50000);
    expect(metrics.totalSubmissionCollected).toBe(25000);
    expect(metrics.totalInteractions).toBe(4);
    expect(metrics.combinedExpected).toBe(70000);
    expect(metrics.combinedCollected).toBe(35000);
    expect(metrics.financialCoveragePercent).toBe(50);
  });

  it("scales chart bars against one coherent maximum", () => {
    const rows = buildBarChartRows([
      { label: "Previsto", amount: 70000, value: "70.000,00 Kz", color: "#223d42" },
      { label: "Arrecadado", amount: 35000, value: "35.000,00 Kz", color: "#fd8305" },
      { label: "Baixo", amount: 1, value: "1", color: "#4aa391" },
    ]);

    expect(rows.map((row) => row.percent)).toEqual([100, 50, 1]);
  });
});
