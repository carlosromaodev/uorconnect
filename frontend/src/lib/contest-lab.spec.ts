import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthOrigin, getContestAbsoluteUrl, getContestLinkPath, getContestLoginHref, isContestContext, isContestRoutePath } from "./contest-lab";

describe("contest-lab routing helpers", () => {
  it("gera caminhos prefixados no portal principal", () => {
    expect(getContestLinkPath("/", "uorconnect.space")).toBe("/desafios");
    expect(getContestLinkPath("/login", "uorconnect.space")).toBe("/desafios/login");
    expect(getContestLinkPath("/admin", "uorconnect.space")).toBe("/desafios/admin");
    expect(getContestLinkPath("/lobby", "uorconnect.space")).toBe("/desafios/lobby");
    expect(getContestLinkPath("/ranking", "uorconnect.space")).toBe("/desafios/ranking");
    expect(getContestLinkPath("/ponte-das-decisoes", "uorconnect.space")).toBe("/desafios/ponte-das-decisoes");
    expect(getContestLinkPath("/ponte-das-decisoes/submeter", "uorconnect.space")).toBe("/desafios/ponte-das-decisoes/submeter");
  });

  it("mantém caminhos canónicos na app dedicada do laboratório", () => {
    expect(getContestLinkPath("/", "laboratorio.uorconnect.space")).toBe("/");
    expect(getContestLinkPath("/login", "laboratorio.uorconnect.space")).toBe("/login");
    expect(getContestLinkPath("/admin", "laboratorio.uorconnect.space")).toBe("/admin");
    expect(getContestLinkPath("/lobby", "laboratorio.uorconnect.space")).toBe("/lobby");
  });

  it("gera login href coerente com o contexto do laboratório", () => {
    expect(getContestLoginHref("/lobby", "uorconnect.space")).toBe("/desafios/login?redirect=%2Fdesafios%2Flobby");
    expect(getContestLoginHref("/admin", "laboratorio.uorconnect.space")).toBe("/login?redirect=%2Fadmin");
  });

  it("identifica experiência do laboratório por host ou rota", () => {
    expect(isContestRoutePath("/desafios/lobby", "uorconnect.space")).toBe(true);
    expect(isContestRoutePath("/lobby", "uorconnect.space")).toBe(false);
    expect(isContestRoutePath("/lobby", "laboratorio.uorconnect.space")).toBe(true);
    expect(isContestContext("/login", "uorconnect.space", "/desafios/admin")).toBe(true);
    expect(isContestContext("/login", "uorconnect.space", "/projetos")).toBe(false);
  });

  it("resolve a origem de autenticação correta", () => {
    expect(getAuthOrigin("uorconnect.space", "/login")).toBe("uorconnect");
    expect(getAuthOrigin("uorconnect.space", "/desafios/login")).toBe("laboratorio");
    expect(getAuthOrigin("laboratorio.uorconnect.space", "/login")).toBe("laboratorio");
  });

  it("resolve a app dedicada do laboratório para localhost no desenvolvimento", () => {
    expect(getContestAbsoluteUrl("/desafios/login", new URL("http://localhost:8080/desafios/login"))).toBe("http://localhost:8081/login");
  });

  it("resolve a rota do laboratório para o subdomínio dedicado em produção", () => {
    expect(getContestAbsoluteUrl("/login", new URL("https://uorconnect.space/login"))).toBe("https://laboratorio.uorconnect.space/login");
    expect(getContestAbsoluteUrl("/desafios/lobby", new URL("https://uorconnect.space/desafios/lobby"))).toBe("https://laboratorio.uorconnect.space/lobby");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("contest-lab dedicated runtime", () => {
  it("suporta app dedicada do laboratório com base configurável", async () => {
    vi.stubEnv("VITE_APP_RUNTIME", "laboratorio");
    vi.stubEnv("VITE_LAB_BASE_PATH", "/desafios");

    const module = await import("./contest-lab");

    expect(module.isContestLabHost("localhost")).toBe(true);
    expect(module.getContestLinkPath("/login", "localhost")).toBe("/desafios/login");
    expect(module.getContestLinkPath("/lobby", "localhost")).toBe("/desafios/lobby");
    expect(module.getContestLoginHref("/admin", "localhost")).toBe("/desafios/login?redirect=%2Fdesafios%2Fadmin");
    expect(module.isContestRoutePath("/desafios/login", "localhost")).toBe(true);
    expect(module.isContestRoutePath("/desafios/lobby", "localhost")).toBe(true);
    expect(module.getAuthOrigin("localhost", "/desafios/login")).toBe("laboratorio");
  });
});
