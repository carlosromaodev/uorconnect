import { describe, expect, it, vi } from "vitest";
import { runUorStudentLoginBootstrap } from "./auth.routes";

describe("runUorStudentLoginBootstrap", () => {
  it("liga a sessão institucional ao produto e passa o segredo apenas ao orquestrador", async () => {
    const bootstrap = vi.fn(async () => undefined);
    await runUorStudentLoginBootstrap({
      origin: "uor_estudante",
      provider: "uor",
      password: "segredo-secretaria",
      student: { id: 9, institutionCode: "UOR", studentNumber: "20260009" },
    }, bootstrap);
    expect(bootstrap).toHaveBeenCalledWith({
      student: { id: 9, institutionCode: "UOR", studentNumber: "20260009" },
      secretariaPassword: "segredo-secretaria",
    });
  });

  it("não ativa o produto para outro provedor ou outra origem", async () => {
    const bootstrap = vi.fn(async () => undefined);
    await runUorStudentLoginBootstrap({
      origin: "uorconnect",
      provider: "uor",
      password: "segredo",
      student: { id: 9, studentNumber: "20260009" },
    }, bootstrap);
    await runUorStudentLoginBootstrap({
      origin: "uor_estudante",
      provider: "isptec",
      password: "segredo",
      student: { id: 9, studentNumber: "20260009" },
    }, bootstrap);
    expect(bootstrap).not.toHaveBeenCalled();
  });
});
