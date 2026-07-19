import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routes = readFileSync(path.join(__dirname, "team-credentials.routes.ts"), "utf8");
const schema = readFileSync(path.join(__dirname, "../../../../prisma/schema.prisma"), "utf8");
const sampleScript = readFileSync(path.join(__dirname, "../../../scripts/generate-sample-credential-passes.ts"), "utf8");

describe("team credential print batches contract", () => {
  it("supports guest credentials and persistent print batches", () => {
    expect(routes).toContain("\"CONVIDADO\"");
    expect(routes).toContain("CONVIDADO: { primary:");
    expect(routes).toContain("Convidado");
    expect(schema).toContain("model CredentialPrintBatch");
    expect(schema).toContain("model CredentialPrintBatchItem");
  });

  it("exposes admin endpoints for nominal and generic pass lots", () => {
    expect(routes).toContain("/admin/print-batches");
    expect(routes).toContain("/admin/print-batches/:id/pass.pdf");
    expect(routes).toContain("nominalItems");
    expect(routes).toContain("genericItems");
    expect(routes).toContain("PROFILE_READY");
    expect(routes).toContain("PRINT_BATCH_GENERIC");
    expect(routes).toContain("PRINT_BATCH_NOMINAL");
  });

  it("stores social links when admin creates printable credentials", () => {
    expect(routes).toContain("instagramUrl");
    expect(routes).toContain("linkedinUrl");
    expect(routes).toContain("websiteUrl");
    expect(routes).toContain("consentSocialLinks");
  });

  it("lets admin print registered exhibitor passes before full profile completion", () => {
    expect(routes).toContain("includePending");
    expect(routes).toContain("isCredentialPrintableForAdminBatch");
    expect(routes).toContain("isCredentialOperationallyUsable(member)");
    expect(routes).toContain("max(1000)");
    expect(routes).toContain("syncSubmissionTeamMembers(submission)");
    expect(routes).toContain("buildExpositorCredentialImportCandidates");
    expect(routes).toContain("expectedStudentNumber");
    expect(routes).toContain("EXPOSITOR_IMPORT_REFRESH");
  });

  it("syncs site speakers and guests into printable credentials", () => {
    expect(routes).toContain("/admin/sync-site-guests");
    expect(routes).toContain("prisma.speaker.findMany");
    expect(routes).toContain("source:speaker");
    expect(routes).toContain("category: \"PALESTRANTE\"");
    expect(routes).toContain("SPEAKER_SYNC");
  });

  it("supports readable 3-up A4 pass batches with lamination guides", () => {
    expect(routes).toContain("credentialPassLayouts");
    expect(routes).toContain("\"a4-3up\"");
    expect(routes).toContain("\"a4-4up\"");
    expect(routes).toContain("\"a4-2up-landscape\"");
    expect(routes).toContain("default(\"a4-2up-landscape\")");
    expect(routes).toContain("laminationMarginMm");
    expect(routes).toContain("credentialPassDuplexModes");
    expect(routes).toContain("\"long-edge\"");
    expect(routes).toContain('duplexMode: z.enum(credentialPassDuplexModes).optional().default("short-edge")');
    expect(routes).toContain("buildCredentialPassCalibrationHtml");
    expect(routes).toContain("Corte do passe");
    expect(routes).toContain("Corte plastificacao");
    expect(routes).toContain("layout-3up");
    expect(routes).toContain("layout-2up-landscape");
    expect(routes).toContain("@page{size:A4 landscape;margin:0}");
    expect(routes).toContain("2 por pagina");
    expect(routes).toContain("Duplex recomendado: short-edge em folha horizontal");
    expect(routes).toContain("backSlotOrder.map((sourceIndex) => chunk[sourceIndex] ?? null)");
    expect(sampleScript).toContain('duplexMode: args.layout === "a4-2up-landscape" ? "short-edge" : "long-edge"');
    expect(routes).toContain("3 por pagina");
  });
});
