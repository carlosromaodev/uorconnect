import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  buildRoutePath,
  clearIntendedRoute,
  consumeIntendedRoute,
  getIntendedRoute,
  getSafeRedirectPath,
  redirectToStudentLogin,
  storeIntendedRoute,
} from "./auth-routing";

describe("auth routing helpers", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("monta a rota completa com pathname, search e hash", () => {
    expect(buildRoutePath("/cursos", "?tab=1", "#top")).toBe("/cursos?tab=1#top");
  });

  it("guarda, lê e consome a intended route", () => {
    storeIntendedRoute("/submeter?editar=3");

    expect(getIntendedRoute()).toBe("/submeter?editar=3");
    expect(consumeIntendedRoute("/")).toBe("/submeter?editar=3");
    expect(getIntendedRoute()).toBeNull();
  });

  it("ignora rotas externas ou inseguras", () => {
    storeIntendedRoute("https://evil.example");
    expect(getIntendedRoute()).toBeNull();
    expect(getSafeRedirectPath("//evil.example", "/login")).toBe("/login");
    expect(getSafeRedirectPath("/minha-area", "/login")).toBe("/minha-area");
  });

  it("limpa a intended route explicitamente", () => {
    storeIntendedRoute("/minha-area");
    clearIntendedRoute();
    expect(getIntendedRoute()).toBeNull();
  });

  it("redireciona para login e preserva a rota pretendida", () => {
    const navigate = vi.fn();

    redirectToStudentLogin(navigate, "/cursos/4/inscricao");

    expect(getIntendedRoute()).toBe("/cursos/4/inscricao");
    expect(navigate).toHaveBeenCalledWith("/login?redirect=%2Fcursos%2F4%2Finscricao", {
      replace: false,
      state: undefined,
    });
  });
});
