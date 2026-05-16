import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("@/lib/api", () => ({
  getToken: vi.fn(),
}));

const { getToken } = await import("@/lib/api");

describe("ProtectedRoute", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(getToken).mockReset();
  });

  it("renderiza o conteúdo quando existe token", () => {
    vi.mocked(getToken).mockReturnValue("token");

    render(
      <MemoryRouter initialEntries={["/minha-area"]}>
        <Routes>
          <Route
            path="/minha-area"
            element={
              <ProtectedRoute>
                <div>Conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Conteúdo protegido")).toBeInTheDocument();
  });

  it("redireciona para login e guarda a rota pretendida quando não há token", () => {
    vi.mocked(getToken).mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/submeter?editar=4"]}>
        <Routes>
          <Route
            path="/submeter"
            element={
              <ProtectedRoute>
                <div>Conteúdo protegido</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Página de login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Página de login")).toBeInTheDocument();
    expect(sessionStorage.getItem("uor_intended_route")).toBe("/submeter?editar=4");
  });

  it("aceita um caminho de login customizado para contextos isolados", () => {
    vi.mocked(getToken).mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/desafios/lobby"]}>
        <Routes>
          <Route
            path="/desafios/lobby"
            element={
              <ProtectedRoute loginPath="/desafios/login">
                <div>Conteúdo protegido do desafio</div>
              </ProtectedRoute>
            }
          />
          <Route path="/desafios/login" element={<div>Login do desafio</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login do desafio")).toBeInTheDocument();
    expect(sessionStorage.getItem("uor_intended_route")).toBe("/desafios/lobby");
  });
});
