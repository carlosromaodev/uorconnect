import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

const {
  agendaLiveMock,
  activityFeedMock,
  liveChatMock,
  submissionsMineMock,
  enrollmentsMineMock,
  getTokenMock,
  getSessionStudentMock,
  setTokenMock,
  isAuthErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  agendaLiveMock: vi.fn(),
  activityFeedMock: vi.fn(),
  liveChatMock: vi.fn(),
  submissionsMineMock: vi.fn(),
  enrollmentsMineMock: vi.fn(),
  getTokenMock: vi.fn(),
  getSessionStudentMock: vi.fn(),
  setTokenMock: vi.fn(),
  isAuthErrorMock: vi.fn(() => false),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
  toast: {
    success: toastSuccessMock,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./SearchDialog", () => ({
  default: () => null,
}));

vi.mock("@/lib/contest-lab", () => ({
  getSaasShowcaseHref: () => "/",
}));

vi.mock("@/lib/api", () => ({
  api: {
    agenda: {
      live: agendaLiveMock,
    },
    interactions: {
      activityFeed: activityFeedMock,
      liveChat: liveChatMock,
    },
    submissions: {
      mine: submissionsMineMock,
    },
    courses: {
      enrollmentsMine: enrollmentsMineMock,
    },
  },
  getToken: getTokenMock,
  getSessionStudent: getSessionStudentMock,
  setToken: setTokenMock,
  isAuthError: isAuthErrorMock,
}));

describe("Navbar notification center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getTokenMock.mockReturnValue(null);
    getSessionStudentMock.mockReturnValue(null);
    agendaLiveMock.mockResolvedValue({
      current: {
        id: 1,
        day: "DAY1",
        date: "2026-04-04T00:00:00.000Z",
        startTime: "10:00",
        endTime: "11:00",
        title: "Painel de IA Aplicada",
        local: "Auditório Principal",
        speaker: "Equipa UOR",
        description: "Sessão principal",
        type: "PANEL",
        theme: "IA",
      },
      next: {
        id: 2,
        day: "DAY1",
        date: "2026-04-04T00:00:00.000Z",
        startTime: "11:15",
        endTime: "12:00",
        title: "Workshop de Produto",
        local: "Sala 2",
        speaker: "Mentores",
        description: "Próxima sessão",
        type: "WORKSHOP",
        theme: "Produto",
      },
      mode: "AGENDA",
      source: "agenda",
    });
    activityFeedMock.mockResolvedValue([
      {
        id: "comment-1",
        type: "comment",
        message: "Excelente proposta para validação.",
        actorName: "Ana Silva",
        actorCourse: "Engenharia Informática",
        actorCourseColor: null,
        subject: "Projeto Atlas",
        createdAt: "2026-04-04T10:05:00.000Z",
      },
    ]);
    liveChatMock.mockResolvedValue([
      {
        id: 7,
        content: "Estamos a acompanhar o painel em direto.",
        createdAt: "2026-04-04T10:06:00.000Z",
        studentName: "Bruno Costa",
        course: "Direito",
        courseColor: null,
      },
    ]);
    submissionsMineMock.mockResolvedValue([]);
    enrollmentsMineMock.mockResolvedValue([]);
  });

  it("abre o centro de notificações com dados públicos mesmo sem sessão", async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /centro de notificações/i }));

    expect(await screen.findByText("Notificações")).toBeInTheDocument();
    expect(await screen.findByText("Painel de IA Aplicada")).toBeInTheDocument();
    expect(await screen.findByText("Workshop de Produto")).toBeInTheDocument();
    expect(screen.getByText(/Entra para ver aprovações/i)).toBeInTheDocument();
  });

  it("mostra candidaturas e cursos do utilizador autenticado no centro", async () => {
    getTokenMock.mockReturnValue("token-demo");
    submissionsMineMock.mockResolvedValue([
      {
        id: 11,
        referenceCode: "SUB-11",
        name: "Projeto Aurora",
        status: "APPROVED",
        statusLabel: "Aprovado",
        type: "PROJECT",
        typeLabel: "Projeto",
        createdAt: "2026-04-03T09:00:00.000Z",
        detailPath: "/projeto/projeto-aurora-11",
        bannerUrl: null,
        receiptPath: "/submissoes/11",
      },
    ]);
    enrollmentsMineMock.mockResolvedValue([
      {
        id: 22,
        courseId: 3,
        courseName: "Curso de Produto",
        companyName: "UOR Labs",
        referenceCode: "CUR-22",
        paymentStatus: "CONFIRMED",
        statusLabel: "Confirmado",
        enrolledAt: "2026-04-03T15:30:00.000Z",
        receiptPath: "/cursos/inscricoes/22",
        ticketPath: null,
        paymentProofPath: null,
      },
    ]);

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(submissionsMineMock).toHaveBeenCalled();
      expect(enrollmentsMineMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /centro de notificações/i }));

    expect(await screen.findByText("Projeto Aurora")).toBeInTheDocument();
    expect(await screen.findByText("Curso de Produto")).toBeInTheDocument();
  });

  it("mantém a navbar sincronizada quando há token sem perfil local", async () => {
    getTokenMock.mockReturnValue("token-demo");
    getSessionStudentMock.mockReturnValue(null);

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(submissionsMineMock).toHaveBeenCalled();
      expect(enrollmentsMineMock).toHaveBeenCalled();
    });

    expect(screen.queryByRole("link", { name: /^Entrar$/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /minha área/i }).every((link) => (
      link.getAttribute("href") === "/minha-area"
    ))).toBe(true);
  });

  it("não reemite anúncio de aprovação já visualizado", async () => {
    getTokenMock.mockReturnValue("token-demo");
    window.localStorage.setItem("uor-approved-submissions-announced", JSON.stringify([11]));
    submissionsMineMock.mockResolvedValue([
      {
        id: 11,
        referenceCode: "SUB-11",
        name: "Projeto Aurora",
        status: "APPROVED",
        statusLabel: "Aprovado",
        type: "PROJECT",
        typeLabel: "Projeto",
        createdAt: "2026-04-03T09:00:00.000Z",
        detailPath: "/projeto/projeto-aurora-11",
        bannerUrl: null,
        receiptPath: "/submissoes/11",
      },
    ]);

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(submissionsMineMock).toHaveBeenCalled();
    });

    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
