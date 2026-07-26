import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UorStudentApp from "./UorStudentApp";
import { UorStudentApiError, uorStudentApi } from "./api";

vi.mock("@/lib/api", () => ({
  api: { auth: { logout: vi.fn().mockResolvedValue({ success: true }) } },
}));

const provider = {
  provider: "secretaria" as const,
  status: "connected" as const,
  connected: true,
  credentialStored: true,
  actionRequired: "none" as const,
  retryable: false,
  lastAuthenticatedAt: "2026-07-26T08:00:00.000Z",
  lastSuccessfulSyncAt: "2026-07-26T08:00:00.000Z",
};

function renderStudent(initialEntry = "/estudante") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/estudante/*" element={<UorStudentApp />} />
          <Route path="/estudante-login" element={<div>Entrada privada</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UOR Student private application", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects an unauthenticated deep link to the dedicated login", async () => {
    vi.spyOn(uorStudentApi, "session").mockRejectedValue(new UorStudentApiError(401, "STUDENT_SESSION_REQUIRED", "Sessão necessária."));

    renderStudent("/estudante/financas");

    expect(await screen.findByText("Entrada privada")).toBeInTheDocument();
  });

  it("renders the own shell and student dashboard for a valid session", async () => {
    vi.spyOn(uorStudentApi, "session").mockResolvedValue({
      active: true,
      profileId: "profile-opaque",
      institutionCode: "uor",
      providers: [provider],
    });
    vi.spyOn(uorStudentApi, "today").mockResolvedValue({
      identity: {
        institutionCode: "uor",
        studentNumber: "20240000",
        displayName: "Ana Estudante",
        course: "Engenharia Informática",
        classCode: "EI-4",
        academicYear: "2025/2026",
        academicPeriod: "2.º semestre",
        provenance: { source: "secretaria_uor", observedAt: "2026-07-26T08:00:00.000Z", coverage: "exact", stale: false },
      },
      priorities: [],
      academic: { enrollments: 6, grades: 5, exams: 2, attendance: 10, provenance: { source: "secretaria_uor", observedAt: "2026-07-26T08:00:00.000Z", coverage: "exact", stale: false } },
      learning: { courses: 6, materials: 12, provenance: { source: "moodle", observedAt: "2026-07-26T08:00:00.000Z", coverage: "exact", stale: false } },
      finance: { charges: 2, references: 1, payments: 8, receipts: 8, provenance: { source: "secretaria_uor", observedAt: "2026-07-26T08:00:00.000Z", coverage: "exact", stale: false } },
      agenda: { officialExams: 2, moodleDeadlines: null, provenance: { source: "secretaria_uor", observedAt: "2026-07-26T08:00:00.000Z", coverage: "exact", stale: false } },
      providers: [provider],
    });

    renderStudent();

    expect(await screen.findByRole("heading", { name: "Olá, Ana." })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação UOR Estudante" })).toBeInTheDocument();
    expect(screen.getByText("Secretaria e Moodle, sem botão para atualizar.")).toBeInTheDocument();
    await waitFor(() => expect(uorStudentApi.today).toHaveBeenCalledOnce());
  });
});
