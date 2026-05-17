import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminAttendanceTab = readFileSync(path.join(__dirname, "AdminAttendanceTab.tsx"), "utf8");
const adminPassportTab = readFileSync(path.join(__dirname, "AdminPassportTab.tsx"), "utf8");
const apiSource = readFileSync(path.join(__dirname, "../../lib/api.ts"), "utf8");

describe("admin normal QR PDF download contract", () => {
  it("binds normal QR PDF downloads in the API client", () => {
    expect(apiSource).toContain("qrActionPdf");
    expect(apiSource).toContain("/attendance/admin/qr-actions/${id}/pdf");
    expect(apiSource).toContain("missionQrPdf");
    expect(apiSource).toContain("/passport/admin/mission-qrs/${id}/pdf");
  });

  it("lets admins download attendance/event QR actions as designed PDFs", () => {
    expect(adminAttendanceTab).toContain("handleDownloadQrActionPdf");
    expect(adminAttendanceTab).toContain("api.attendance.qrActionPdf");
    expect(adminAttendanceTab).toContain("Baixar PDF");
    expect(adminAttendanceTab).toContain("downloadingQrPdfId");
  });

  it("lets admins download passport mission QR actions as designed PDFs", () => {
    expect(adminPassportTab).toContain("handleDownloadMissionQrPdf");
    expect(adminPassportTab).toContain("api.passport.missionQrPdf");
    expect(adminPassportTab).toContain("Baixar PDF");
    expect(adminPassportTab).toContain("downloadingMissionQrId");
  });
});
