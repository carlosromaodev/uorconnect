import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, StudentProfile } from "@/lib/api";

const {
  authMeMock,
  coursesListMock,
  enrollmentsMineMock,
  enrollMock,
  navigateMock,
  submissionConfigMock,
  syncStudentProfileIfNeededMock,
  toastErrorMock,
  toastInfoMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  authMeMock: vi.fn(),
  coursesListMock: vi.fn(),
  enrollmentsMineMock: vi.fn(),
  enrollMock: vi.fn(),
  navigateMock: vi.fn(),
  submissionConfigMock: vi.fn(),
  syncStudentProfileIfNeededMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: toastErrorMock,
    info: toastInfoMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/lib/auth-routing", () => ({
  buildRoutePath: vi.fn(() => "/cursos/9/inscricao"),
  redirectToStudentLogin: vi.fn(),
}));

vi.mock("@/lib/student-documents", () => ({
  toAbsoluteAssetUrl: (value?: string | null) => value ?? null,
}));

vi.mock("@/lib/student-profile", () => ({
  syncStudentProfileIfNeeded: syncStudentProfileIfNeededMock,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    api: {
      ...actual.api,
      auth: {
        ...actual.api.auth,
        me: authMeMock,
      },
      courses: {
        ...actual.api.courses,
        list: coursesListMock,
        enrollmentsMine: enrollmentsMineMock,
        enroll: enrollMock,
      },
      submissions: {
        ...actual.api.submissions,
        config: submissionConfigMock,
      },
    },
    isAuthError: vi.fn(() => false),
    setToken: vi.fn(),
  };
});

const { default: CursoInscricao } = await import("./CursoInscricao");

const paidCourse: Course = {
  id: 9,
  name: "Curso Premium de Produto",
  description: "Curso prático para validação de produto.",
  preview: null,
  communityUrl: null,
  companyName: "Parceiro UOR",
  companyCategory: "Tecnologia",
  companyLogoUrl: null,
  companyWebsite: null,
  companyInstagram: null,
  companyLinkedin: null,
  isPaid: true,
  priceLabel: "3.500 Kz",
  studentCount: 0,
  likesCount: 0,
  accentColor: "#FD8305",
  accentColorSecondary: "#223D42",
  courseColor: "#FD8305",
  sortOrder: 0,
  isPublished: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const student: StudentProfile = {
  id: 7,
  studentNumber: "20260001",
  name: "Carlos Silva",
  email: "carlos@uor.ao",
  course: "Engenharia Informática e Comunicações",
  birthDate: null,
  nationality: null,
  phone: "+244 923 456 789",
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

class ImmediateFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type || "application/pdf"};base64,ZmFrZQ==`;
    this.onload?.({ target: this } as ProgressEvent<FileReader>);
  }
}

class PendingFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type || "application/pdf"};base64,ZmFrZQ==`;
  }
}

function renderCourseEnrollment() {
  render(
    <MemoryRouter initialEntries={["/cursos/9/inscricao"]}>
      <Routes>
        <Route path="/cursos/:id/inscricao" element={<CursoInscricao />} />
      </Routes>
    </MemoryRouter>,
  );
}

function uploadProof(file = new File(["fake"], "proof.pdf", { type: "application/pdf" })) {
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();

  fireEvent.change(fileInput!, {
    target: {
      files: [file],
    },
  });
}

describe("CursoInscricao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coursesListMock.mockResolvedValue({
      courses: [paidCourse],
      topCourses: [paidCourse],
      preview: [paidCourse],
    });
    authMeMock.mockResolvedValue(student);
    enrollmentsMineMock.mockResolvedValue([]);
    submissionConfigMock.mockResolvedValue({
      key: "default",
      isOpen: true,
      iban: "AO06 0000 0000 0000 0000 0000 0",
      accountName: "Universidade Óscar Ribas",
      paymentAmount: "3.500 Kz",
      paymentInstructions: "Usa os mesmos dados de pagamento do expositor.",
      projectCommunityUrl: null,
      businessCommunityUrl: null,
      productCommunityUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    syncStudentProfileIfNeededMock.mockResolvedValue(student);
    enrollMock.mockResolvedValue({
      enrolled: true,
      enrollmentId: 31,
      communityUrl: null,
      studentCount: 1,
      paymentStatus: "PENDING",
      paymentProofPath: "/courses/enrollments/31/payment-proof",
      ticketPath: "/courses/enrollments/31/ticket.pdf",
      whatsAppRedirectUrl: null,
      receiptPath: "/cursos/inscricoes/31",
    });
    Object.defineProperty(window, "FileReader", {
      writable: true,
      value: ImmediateFileReader,
    });
  });

  it("mostra detalhes de pagamento do expositor e mantém upload do comprovativo", async () => {
    renderCourseEnrollment();

    expect(await screen.findByText("Transferência e comprovativo")).toBeInTheDocument();
    expect(screen.getByText("AO06 0000 0000 0000 0000 0000 0")).toBeInTheDocument();
    expect(screen.getByText("Universidade Óscar Ribas")).toBeInTheDocument();
    expect(screen.getAllByText("3.500 Kz").length).toBeGreaterThan(0);
    expect(screen.getByText("Usa os mesmos dados de pagamento do expositor.")).toBeInTheDocument();
    expect(screen.getByText("Selecionar PDF ou imagem do comprovativo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Telefone usado no pagamento")).not.toBeInTheDocument();
  });

  it("bloqueia o envio enquanto o comprovativo ainda está a carregar", async () => {
    Object.defineProperty(window, "FileReader", {
      writable: true,
      value: PendingFileReader,
    });

    renderCourseEnrollment();
    await screen.findByText("Transferência e comprovativo");

    uploadProof();

    expect(screen.getByText("A carregar o comprovativo selecionado...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A carregar comprovativo/i })).toBeDisabled();
  });

  it("envia o comprovativo sem pedir telefone de pagamento", async () => {
    renderCourseEnrollment();
    await screen.findByText("Transferência e comprovativo");

    uploadProof();

    await screen.findByText("Comprovativo carregado e pronto para envio.");

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e abrir recibo" }));

    await waitFor(() => {
      expect(enrollMock).toHaveBeenCalledWith(
        9,
        expect.objectContaining({
          paymentConfirmed: true,
          paymentProof: "data:application/pdf;base64,ZmFrZQ==",
        }),
      );
    });
    expect(enrollMock.mock.calls[0][1]).not.toHaveProperty("paymentPhone");
    expect(navigateMock).toHaveBeenCalledWith("/cursos/inscricoes/31");
  });
});
