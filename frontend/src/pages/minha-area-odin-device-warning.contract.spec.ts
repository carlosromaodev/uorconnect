import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Minha Área ODIN exhibitor device warnings", () => {
  it("surfaces ODIN warnings when an exhibitor device votes outside its own project", () => {
    const api = source("src/lib/api.ts");
    const minhaArea = source("src/pages/MinhaArea.tsx");

    expect(api).toContain("odinExhibitorDeviceWarning");
    expect(minhaArea).toContain("Aviso ODIN");
    expect(minhaArea).toContain("dispositivo associado a expositor");
    expect(minhaArea).toContain("possível suspensão");
  });
});
