import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("formadores public flow", () => {
  it("registers dedicated routes for cadastro and painel do formador", () => {
    const appSource = readSource("../App.tsx");

    expect(appSource).toContain('const FormadorCadastro = lazy');
    expect(appSource).toContain('const FormadorPainel = lazy');
    expect(appSource).toContain('path="/formadores/cadastro"');
    expect(appSource).toContain('path="/formadores/painel"');
  });

  it("keeps the trainer dashboard aggregate-only and free of sensitive student fields", () => {
    const dashboardSource = readSource("./FormadorPainel.tsx");

    expect(dashboardSource).toContain("totalEnrollments");
    expect(dashboardSource).toContain("confirmedPayments");
    expect(dashboardSource).not.toContain("studentName");
    expect(dashboardSource).not.toContain("paymentProof");
    expect(dashboardSource).not.toContain("studentEmail");
  });

  it("uses SMS verification before profile submission", () => {
    const registrationSource = readSource("./FormadorCadastro.tsx");

    expect(registrationSource).toContain("requestCode");
    expect(registrationSource).toContain("verifyCode");
    expect(registrationSource).toContain("submit");
    expect(registrationSource.indexOf("verifyCode")).toBeLessThan(
      registrationSource.indexOf("submit"),
    );
  });

  it("exposes the trainer registration link from the admin trainers tab", () => {
    const adminTrainersSource = readSource("../components/admin/AdminTrainersTab.tsx");

    expect(adminTrainersSource).toContain("Adicionar formador via link");
    expect(adminTrainersSource).toContain("/formadores/cadastro");
    expect(adminTrainersSource).toContain("handleCopyRegistrationLink");
  });
});
