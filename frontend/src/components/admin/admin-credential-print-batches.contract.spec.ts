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
    expect(adminSecurityTab).toContain('const shouldSyncExpositors = category === "EXPOSITOR" && includePending');
    expect(adminSecurityTab).toContain("await api.teamCredentials.importExpositors()");
    expect(adminSecurityTab).toContain("category: shouldSyncExpositors ? category : undefined");
    expect(adminSecurityTab).toContain("ids: shouldSyncExpositors ? undefined");
    expect(adminSecurityTab).toContain("Sincronizar e baixar");
    expect(apiSource).toContain("syncSiteGuests");
    expect(apiSource).toContain("/team-credentials/admin/sync-site-guests");
  });

  it("downloads economical 4-up A4 pass batches with lamination settings", () => {
    expect(apiSource).toContain("TeamCredentialPassLayout");
    expect(apiSource).toContain("laminationMarginMm");
    expect(apiSource).toContain("duplexMode");
    expect(apiSource).toContain("calibration");
    expect(adminSecurityTab).toContain("4 por pagina");
    expect(adminSecurityTab).toContain("plastificacao");
    expect(adminSecurityTab).toContain("downloadPassCalibration");
    expect(adminSecurityTab).toContain('layout: "a4-4up"');
    expect(adminSecurityTab).toContain("laminationMarginMm: passLaminationMarginMm");
  });
});
