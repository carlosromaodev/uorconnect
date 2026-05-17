import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../..");

describe("normal QR action PDF contract", () => {
  it("exposes a reusable normal QR PDF renderer with the surprise QR visual language", () => {
    const renderer = readFileSync(
      path.join(repoRoot, "backend/src/modules/qr-actions/http/normal-qr-pdf.ts"),
      "utf8",
    );

    expect(renderer).toContain("renderNormalQrPdf");
    expect(renderer).toContain("buildValidationUrl(env, params.token)");
    expect(renderer).toContain("renderQrDataUri(validationUrl, 1000)");
    expect(renderer).toContain("QR Operacional");
    expect(renderer).toContain("Escaneia na Minha Área");
    expect(renderer).toContain(".qr-wrap");
    expect(renderer).toContain("renderPdfFromHtml");
  });

  it("adds PDF download routes for attendance QR actions and passport mission QR actions", () => {
    const attendanceRoutes = readFileSync(
      path.join(repoRoot, "backend/src/modules/attendance/http/attendance.routes.ts"),
      "utf8",
    );
    const passportRoutes = readFileSync(
      path.join(repoRoot, "backend/src/modules/passport/http/passport.routes.ts"),
      "utf8",
    );

    expect(attendanceRoutes).toContain("/admin/qr-actions/:id/pdf");
    expect(attendanceRoutes).toContain("renderNormalQrPdf(opts.env");
    expect(attendanceRoutes).toContain("qr-action-");
    expect(passportRoutes).toContain("/admin/mission-qrs/:id/pdf");
    expect(passportRoutes).toContain("renderNormalQrPdf(opts.env");
    expect(passportRoutes).toContain("qr-etapa-");
  });
});
