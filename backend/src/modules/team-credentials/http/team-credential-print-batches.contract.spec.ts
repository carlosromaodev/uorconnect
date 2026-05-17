import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routes = readFileSync(path.join(__dirname, "team-credentials.routes.ts"), "utf8");
const schema = readFileSync(path.join(__dirname, "../../../../prisma/schema.prisma"), "utf8");

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
  });

  it("syncs site speakers and guests into printable credentials", () => {
    expect(routes).toContain("/admin/sync-site-guests");
    expect(routes).toContain("prisma.speaker.findMany");
    expect(routes).toContain("source:speaker");
    expect(routes).toContain("category: \"PALESTRANTE\"");
    expect(routes).toContain("SPEAKER_SYNC");
  });
});
