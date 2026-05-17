import { describe, expect, it } from "vitest";
import { api } from "./api";

describe("team credential print helpers", () => {
  it("gera URL de passe em modo preto e branco com frente e verso", () => {
    const url = new URL(api.teamCredentials.passPdfUrl("membro-demo", {
      printMode: "black-white",
      side: "both",
      marginMm: 14,
      bleedMm: 4,
    }));

    expect(url.pathname).toContain("/team-credentials/members/membro-demo/pass.pdf");
    expect(url.searchParams.get("printMode")).toBe("black-white");
    expect(url.searchParams.get("side")).toBe("both");
    expect(url.searchParams.get("marginMm")).toBe("14");
    expect(url.searchParams.get("bleedMm")).toBe("4");
  });

  it("gera URL de lote A4 com ids e modo preto e branco", () => {
    const url = new URL(api.teamCredentials.passBatchPdfUrl({
      ids: [10, 20],
      printMode: "black-white",
      side: "both",
      layout: "a4-2up-landscape",
      marginMm: 16,
      bleedMm: 3,
      limit: 2,
    }));

    expect(url.pathname).toContain("/team-credentials/admin/members/pass-batch.pdf");
    expect(url.searchParams.get("ids")).toBe("10,20");
    expect(url.searchParams.get("printMode")).toBe("black-white");
    expect(url.searchParams.get("side")).toBe("both");
    expect(url.searchParams.get("layout")).toBe("a4-2up-landscape");
    expect(url.searchParams.get("marginMm")).toBe("16");
    expect(url.searchParams.get("bleedMm")).toBe("3");
    expect(url.searchParams.get("limit")).toBe("2");
  });
});
