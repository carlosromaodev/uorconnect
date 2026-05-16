import { describe, expect, it } from "vitest";
import { normalizeStudentAreaTab } from "./student-area-tabs";

describe("normalizeStudentAreaTab", () => {
  it("keeps known student area tabs", () => {
    expect(normalizeStudentAreaTab("home")).toBe("home");
    expect(normalizeStudentAreaTab("desafio")).toBe("desafio");
    expect(normalizeStudentAreaTab("submissoes")).toBe("submissoes");
    expect(normalizeStudentAreaTab("inscricoes")).toBe("inscricoes");
    expect(normalizeStudentAreaTab("certificados")).toBe("certificados");
    expect(normalizeStudentAreaTab("passes")).toBe("passes");
  });

  it("uses home as the default area", () => {
    expect(normalizeStudentAreaTab(null)).toBe("home");
    expect(normalizeStudentAreaTab("")).toBe("home");
    expect(normalizeStudentAreaTab("carteira")).toBe("home");
  });
});
