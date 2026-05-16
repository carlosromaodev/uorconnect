import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("home passport prize cards", () => {
  it("keeps every digital passport prize visible on the home promo", () => {
    const page = readSource("src/pages/Index.tsx");

    expect(page).toContain("passportPrizeCards");
    expect(page).toContain("ChatGPT Pro");
    expect(page).toContain("Pagamento de 1 recurso");
    expect(page).toContain("Prime Video");
    expect(page).toContain("HBO Max");
    expect(page).toContain("Duolingo Super");
    expect(page).toContain("Certificado Top 3");
    expect(page).toContain("passport-prize-grid");
    expect(page).toContain("passport-prize-card");
  });
});
