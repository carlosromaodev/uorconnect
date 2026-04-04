import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { HomeFeatureGate } from "./HomeFeatureGate";
import { defaultHomeSocialConfig } from "@/lib/home-content";

vi.mock("@/lib/api", () => ({
  api: {
    homeContent: {
      list: vi.fn(),
    },
  },
}));

const { api } = await import("@/lib/api");

describe("HomeFeatureGate", () => {
  beforeEach(() => {
    vi.mocked(api.homeContent.list).mockReset();
  });

  it("renderiza o conteúdo quando o acesso público está ativo", async () => {
    vi.mocked(api.homeContent.list).mockResolvedValue({
      courses: [],
      panelTopics: [],
      socialConfig: {
        ...defaultHomeSocialConfig,
        courseEnrollmentEnabled: true,
      },
    });

    render(
      <MemoryRouter>
        <HomeFeatureGate
          feature="courseEnrollmentEnabled"
          title="Inscrições fechadas"
          description="Descrição"
          ctaLabel="Voltar"
          ctaTo="/cursos"
        >
          <div>Fluxo disponível</div>
        </HomeFeatureGate>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Fluxo disponível")).toBeInTheDocument();
    });
  });

  it("mostra o estado bloqueado quando a flag está desativada", async () => {
    vi.mocked(api.homeContent.list).mockResolvedValue({
      courses: [],
      panelTopics: [],
      socialConfig: {
        ...defaultHomeSocialConfig,
        courseEnrollmentEnabled: false,
      },
    });

    render(
      <MemoryRouter>
        <HomeFeatureGate
          feature="courseEnrollmentEnabled"
          title="Inscrições fechadas"
          description="Descrição de bloqueio"
          ctaLabel="Voltar aos cursos"
          ctaTo="/cursos"
        >
          <div>Fluxo disponível</div>
        </HomeFeatureGate>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Inscrições fechadas")).toBeInTheDocument();
    });
    expect(screen.getByText("Descrição de bloqueio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar aos cursos" })).toHaveAttribute("href", "/cursos");
  });
});
