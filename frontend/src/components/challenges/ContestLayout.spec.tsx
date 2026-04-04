import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContestLayout } from "./ContestLayout";

const { contestMeMock, authMeMock, getSessionStudentMock, getTokenMock, getContestBrandAssetMock, getPrimaryPortalHrefMock, isContestContextMock, isContestLabHostMock, useContestClockMock } = vi.hoisted(() => ({
  contestMeMock: vi.fn(),
  authMeMock: vi.fn(),
  getSessionStudentMock: vi.fn(),
  getTokenMock: vi.fn(),
  getContestBrandAssetMock: vi.fn(),
  getPrimaryPortalHrefMock: vi.fn(),
  isContestContextMock: vi.fn(),
  isContestLabHostMock: vi.fn(),
  useContestClockMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    contest: {
      me: contestMeMock,
    },
    auth: {
      me: authMeMock,
    },
  },
  getSessionStudent: getSessionStudentMock,
  getToken: getTokenMock,
}));

vi.mock("@/lib/contest-lab", () => ({
  getContestBrandAsset: getContestBrandAssetMock,
  getPrimaryPortalHref: getPrimaryPortalHrefMock,
  isContestContext: isContestContextMock,
  isContestLabHost: isContestLabHostMock,
  useContestClock: useContestClockMock,
}));

describe("ContestLayout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?boot=intro");

    getTokenMock.mockReturnValue("token");
    getSessionStudentMock.mockReturnValue({
      name: "Ana Silva",
      course: "Engenharia Informática",
    });
    contestMeMock.mockResolvedValue({
      name: "Ana Silva",
      course: "Engenharia Informática",
    });
    authMeMock.mockResolvedValue(null);
    getContestBrandAssetMock.mockReturnValue("/logouorlabratoriowite.png");
    getPrimaryPortalHrefMock.mockReturnValue("/");
    isContestContextMock.mockReturnValue(true);
    isContestLabHostMock.mockReturnValue(true);
    useContestClockMock.mockReturnValue({
      label: "Contagem para o início",
      display: "00:10:00",
      runtimePhase: "scheduled",
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("mostra o boot compacto e remove o parâmetro boot quando termina", async () => {
    render(
      <MemoryRouter initialEntries={["/?boot=intro"]}>
        <ContestLayout title="Arena">
          <div>Conteúdo</div>
        </ContestLayout>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("contest-boot-intro")).toBeInTheDocument();
    expect(screen.getByText("Bem-vindo, Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("Engenharia Informática")).toBeInTheDocument();
    expect(screen.getByTestId("contest-boot-progress")).toBeInTheDocument();
    expect(screen.getAllByTestId("contest-boot-line")).toHaveLength(3);
    expect(screen.queryByText("Intro animation do laboratório antes do ambiente técnico ficar disponível.")).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2200);
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(220);
      await Promise.resolve();
    });

    expect(screen.queryByTestId("contest-boot-intro")).not.toBeInTheDocument();

    expect(window.location.search).toBe("");
  });
});
