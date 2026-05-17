import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../..");

describe("passport surprise QR batch and dynamic rules contract", () => {
  it("stores printed codes, batch identity and dynamic rules in Prisma", () => {
    const schema = readFileSync(
      path.join(repoRoot, "backend/prisma/schema.prisma"),
      "utf8",
    );

    expect(schema).toContain("displayCode");
    expect(schema).toContain("batchCode");
    expect(schema).toContain("dynamicRulesJson");
    expect(schema).toContain("printedAt");
    expect(schema).toContain("model PassportPointRecovery");
  });

  it("implements batch creation, dynamic effect resolution and recovery constants", () => {
    const service = readFileSync(
      path.join(repoRoot, "backend/src/modules/passport/application/passport.service.ts"),
      "utf8",
    );

    expect(service).toContain("PASSPORT_SURPRISE_POINTS_CAP");
    expect(service).toContain("PASSPORT_RECOVERY_PRICE_KZ");
    expect(service).toContain("PASSPORT_RECOVERY_POINTS");
    expect(service).toContain("createPassportSurpriseQrBatch");
    expect(service).toContain("resolveDynamicSurpriseEffect");
    expect(service).toContain("convertAfterLosses");
  });

  it("exposes admin routes for numbered batch creation and PDF download", () => {
    const routes = readFileSync(
      path.join(repoRoot, "backend/src/modules/passport/http/passport.routes.ts"),
      "utf8",
    );

    expect(routes).toContain("/admin/surprise-qrs/batch");
    expect(routes).toContain("/admin/surprise-qrs/batch/:batchCode/pdf");
    expect(routes).toContain("displayCode");
    expect(routes).toContain("dynamicRules");
    expect(routes).toContain("qr-page");
    expect(routes).toContain("qr-poster");
    expect(routes).toContain("QR gigante");
    expect(routes).toContain("renderQrDataUri(buildValidationUrl(env, surprise.qrAction.token), 1000)");
    expect(routes).toContain("Passaporte Digital UOR Connect");
  });
});
