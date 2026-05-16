import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { StudentProfile, SubmissionConfig } from "@/lib/api";
import type { SubmissionKind } from "./submission-form.validation";

export const mockNavigate = vi.fn();
export const toastError = vi.fn();
export const toastSuccess = vi.fn();
export const toastInfo = vi.fn();
export const mockSyncStudentProfileIfNeeded = vi.fn();

export const apiMocks = {
  auth: {
    me: vi.fn(),
  },
  submissions: {
    config: vi.fn(),
    create: vi.fn(),
    updateOwn: vi.fn(),
    receipt: vi.fn(),
  },
};

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
    info: toastInfo,
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
    info: toastInfo,
  },
}));

vi.mock("@/lib/student-profile", () => ({
  syncStudentProfileIfNeeded: mockSyncStudentProfileIfNeeded,
}));

vi.mock("@/lib/student-documents", () => ({
  toAbsoluteAssetUrl: (value?: string | null) => value ?? null,
}));

vi.mock("@/lib/auth-routing", () => ({
  buildRoutePath: vi.fn(() => "/submeter"),
  redirectToStudentLogin: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
        me: apiMocks.auth.me,
      },
      submissions: {
        ...actual.api.submissions,
        config: apiMocks.submissions.config,
        create: apiMocks.submissions.create,
        updateOwn: apiMocks.submissions.updateOwn,
        receipt: apiMocks.submissions.receipt,
      },
    },
    setToken: vi.fn(),
  };
});

const { ApiError } = await import("@/lib/api");
const { VALID_FIELD_ARIA_LABEL, VALIDATION_BANNER_MESSAGE } = await import("./submission-form.validation");
const { default: Submeter } = await import("./Submeter");

const defaultConfig: SubmissionConfig = {
  key: "default",
  isOpen: true,
  iban: "AO006 0055 0000 3295 0561 10379",
  accountName: "Universidade Óscar Ribas",
  paymentAmount: "3.500 Kz",
  paymentInstructions: "Confirma a transferência antes de finalizar a candidatura.",
  projectCommunityUrl: null,
  businessCommunityUrl: null,
  productCommunityUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const baseStudent: StudentProfile = {
  id: 7,
  studentNumber: "20260001",
  name: "Carlos Silva",
  email: "carlos@uor.ao",
  course: "Eng. Telecomunicações",
  birthDate: null,
  nationality: null,
  phone: "+244 923 456 789",
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL() {
    this.result = "data:application/pdf;base64,ZmFrZQ==";
    this.onload?.({ target: this } as ProgressEvent<FileReader>);
  }
}

export function resetSubmissionMocks() {
  mockNavigate.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
  toastInfo.mockReset();
  mockSyncStudentProfileIfNeeded.mockReset();
  apiMocks.auth.me.mockReset();
  apiMocks.submissions.config.mockReset();
  apiMocks.submissions.create.mockReset();
  apiMocks.submissions.updateOwn.mockReset();
  apiMocks.submissions.receipt.mockReset();

  apiMocks.auth.me.mockResolvedValue(baseStudent);
  apiMocks.submissions.config.mockResolvedValue(defaultConfig);
  apiMocks.submissions.create.mockResolvedValue({
    referenceCode: "UOR-2026-0001",
    status: "PENDING",
    id: 501,
    communityUrl: null,
    boardingPassPath: "/submissions/501/boarding-pass.pdf",
    paymentProofPath: "/submissions/501/payment-proof",
    receiptPath: "/submissoes/501",
  });
  apiMocks.submissions.updateOwn.mockResolvedValue({
    id: 501,
    referenceCode: "UOR-2026-0001",
    name: "Projeto Alpha",
    description: "",
    status: "PENDING",
    statusLabel: "Em análise",
    type: "PROJECT",
    typeLabel: "Projeto",
    area: "Tecnologia",
    course: "Eng. Telecomunicações",
    stage: null,
    category: null,
    productType: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: "Maria Silva",
    membersList: ["Maria Silva"],
    teamSize: 1,
    leaderName: "Carlos Silva",
    leaderPhone: "+244 923 456 789",
    leaderEmail: null,
    needs: [],
    observations: null,
    repoUrl: null,
    websiteUrl: null,
    primaryColor: "#FD8305",
    secondaryColor: "#223D42",
    bannerUrl: null,
    communityUrl: null,
    boardingPassPath: "/submissions/501/boarding-pass.pdf",
    exhibitorPdfPath: null,
    paymentProofPath: "/submissions/501/payment-proof",
    receiptPath: "/submissoes/501",
    detailPath: "/projeto/projeto-alpha-501",
    canEdit: true,
  });
  apiMocks.submissions.receipt.mockResolvedValue(null);
  mockSyncStudentProfileIfNeeded.mockResolvedValue(baseStudent);

  Object.defineProperty(window, "FileReader", {
    writable: true,
    value: MockFileReader,
  });
}

function variantCardName(kind: SubmissionKind) {
  if (kind === "negocio") return /Expor Negócio/i;
  if (kind === "produto") return /Expor Produto/i;
  return /Expor Projeto/i;
}

export async function renderSubmissionVariant(kind: SubmissionKind) {
  render(
    <MemoryRouter initialEntries={["/submeter"]}>
      <Routes>
        <Route path="/submeter" element={<Submeter />} />
      </Routes>
    </MemoryRouter>,
  );

  const card = await screen.findByRole("button", { name: variantCardName(kind) });
  fireEvent.click(card);

  await screen.findByLabelText("Nome completo");
}

export async function chooseSelectOption(placeholder: RegExp | string, optionText: string) {
  let trigger: HTMLElement;

  try {
    trigger = screen.getByRole("combobox", { name: placeholder });
  } catch {
    trigger = screen.getByLabelText(placeholder);
  }

  fireEvent.focus(trigger);
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

  let option: HTMLElement;

  try {
    option = await screen.findByRole("option", { name: optionText });
  } catch {
    option = await screen.findByText(optionText);
  }

  fireEvent.click(option);
  fireEvent.blur(trigger);
  await waitFor(() => expect(trigger).toHaveTextContent(optionText));
}

export async function uploadPaymentProof() {
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();

  fireEvent.change(fileInput!, {
    target: {
      files: [new File(["fake"], "proof.pdf", { type: "application/pdf" })],
    },
  });

  await waitFor(() => {
    expect(screen.getAllByText("proof.pdf").length).toBeGreaterThan(0);
  });
}

export function addMember(member = "Maria Silva") {
  fireEvent.change(screen.getByPlaceholderText("Adicionar membro"), {
    target: { value: member },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/i }));
}

export async function fillCommonValidSubmissionFields(kind: SubmissionKind) {
  fireEvent.change(screen.getByLabelText("Nome da candidatura"), { target: { value: "Projeto Alpha" } });
  fireEvent.blur(screen.getByLabelText("Nome da candidatura"));

  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "" } });
  fireEvent.blur(screen.getByLabelText("Descrição"));

  if (kind === "projeto") {
    await chooseSelectOption(/Área principal/i, "Tecnologia");
    fireEvent.change(screen.getByLabelText("Docente orientador"), { target: { value: "Professor Silva" } });
    fireEvent.blur(screen.getByLabelText("Docente orientador"));
  }

  if (kind === "negocio") {
    await chooseSelectOption(/Área principal/i, "Tecnologia");
    fireEvent.change(screen.getByLabelText("Entidade responsável"), { target: { value: "Startup Aurora" } });
    fireEvent.blur(screen.getByLabelText("Entidade responsável"));
    await chooseSelectOption(/Estágio do negócio/i, "MVP");
  }

  if (kind === "produto") {
    await chooseSelectOption(/Área principal/i, "Hardware");
    fireEvent.change(screen.getByLabelText("Entidade responsável"), { target: { value: "Centro de Inovação" } });
    fireEvent.blur(screen.getByLabelText("Entidade responsável"));
    await chooseSelectOption(/Categoria do produto/i, "Hardware");
    await chooseSelectOption(/Tipo do produto/i, "Físico");
    fireEvent.change(screen.getByLabelText("Média de preço estimado"), { target: { value: "25000" } });
    fireEvent.blur(screen.getByLabelText("Média de preço estimado"));
  }

  addMember();
  await uploadPaymentProof();

  const paymentConfirmed = screen.getByRole("checkbox", { name: /Confirmo que já fiz a transferência/i });
  fireEvent.click(paymentConfirmed);
  await waitFor(() => expect(paymentConfirmed).toHaveAttribute("data-state", "checked"));

  const agreeRules = screen.getByRole("checkbox", { name: /Li as regras da exposição/i });
  fireEvent.click(agreeRules);
  await waitFor(() => expect(agreeRules).toHaveAttribute("data-state", "checked"));
}

export function submitSubmissionForm() {
  fireEvent.click(screen.getByRole("button", { name: /Submeter e abrir recibo|Atualizar e voltar ao recibo/i }));
}

export function expectInitialNeutralState() {
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Submeter e abrir recibo/i })).toBeVisible();
  expect(screen.queryByLabelText(VALID_FIELD_ARIA_LABEL)).not.toBeInTheDocument();
}

export function expectValidationBanner() {
  expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Revê os campos destacados/i));
}

export function expectSuccessfulSubmission() {
  return waitFor(() => {
    expect(apiMocks.submissions.create).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/submissoes/501");
  });
}

export { ApiError, VALID_FIELD_ARIA_LABEL, VALIDATION_BANNER_MESSAGE, baseStudent, defaultConfig, describe };
