import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminSecurityTab = readFileSync(path.join(__dirname, "AdminSecurityTab.tsx"), "utf8");
const apiSource = readFileSync(path.join(__dirname, "../../lib/api.ts"), "utf8");

describe("admin credential print batches UI contract", () => {
  it("exposes professional print lot controls in credentials admin", () => {
    expect(adminSecurityTab).toContain("Lotes de impressão");
    expect(adminSecurityTab).toContain("Passes nominais");
    expect(adminSecurityTab).toContain("Passes genéricos");
    expect(adminSecurityTab).toContain("Pré-visualizar lote");
    expect(adminSecurityTab).toContain("Criar lote");
    expect(adminSecurityTab).toContain("Baixar lote");
  });

  it("lets admin create guest, jury, staff and protocol passes with social links", () => {
    expect(adminSecurityTab).toContain("CONVIDADO");
    expect(adminSecurityTab).toContain("Instagram");
    expect(adminSecurityTab).toContain("LinkedIn");
    expect(adminSecurityTab).toContain("Website");
    expect(adminSecurityTab).toContain("Quantidade");
    expect(adminSecurityTab).toContain("Prefixo");
  });

  it("has API bindings for print batch creation, listing and PDF download", () => {
    expect(apiSource).toContain("CredentialPrintBatch");
    expect(apiSource).toContain("createPrintBatch");
    expect(apiSource).toContain("printBatches");
    expect(apiSource).toContain("downloadPrintBatch");
    expect(apiSource).toContain("/team-credentials/admin/print-batches");
  });

  it("connects site guests and exhibitors to batch credential printing", () => {
    expect(adminSecurityTab).toContain("Sincronizar convidados do site");
    expect(adminSecurityTab).toContain("Palestrantes do site");
    expect(adminSecurityTab).toContain("Todos os expositores");
    expect(adminSecurityTab).toContain("includePending");
    expect(apiSource).toContain("syncSiteGuests");
    expect(apiSource).toContain("/team-credentials/admin/sync-site-guests");
  });
});
