import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import {
  ApiError,
  apiMocks,
  expectInitialNeutralState,
  expectSuccessfulSubmission,
  expectValidationBanner,
  fillCommonValidSubmissionFields,
  renderSubmissionVariant,
  resetSubmissionMocks,
  submitSubmissionForm,
  toastError,
} from "./Submeter.variant-test-utils";

beforeEach(() => {
  resetSubmissionMocks();
});

it("renderiza a variante de negócio com os campos exclusivos esperados", async () => {
  await renderSubmissionVariant("negocio");

  expect(screen.getByLabelText("Entidade responsável")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /Estágio do negócio/i })).toBeInTheDocument();
  expect(screen.getByText("Dados da candidatura")).toBeInTheDocument();
  expect(screen.queryByLabelText("Docente orientador")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: /Categoria do produto/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
});

it("arranca em estado neutro na variante de negócio", async () => {
  await renderSubmissionVariant("negocio");
  expectInitialNeutralState();
});

it("valida submissão inválida e mostra feedback global", async () => {
  await renderSubmissionVariant("negocio");

  const organization = screen.getByLabelText("Entidade responsável");
  fireEvent.change(organization, { target: { value: "" } });
  fireEvent.blur(organization);

  submitSubmissionForm();

  expectValidationBanner();
});

it("permite submissão válida na variante de negócio com descrição vazia", async () => {
  await renderSubmissionVariant("negocio");

  await fillCommonValidSubmissionFields("negocio");
  submitSubmissionForm();

  await expectSuccessfulSubmission();
  expect(apiMocks.submissions.create).toHaveBeenCalledWith(
    expect.objectContaining({
      description: undefined,
      type: "BUSINESS",
      stage: "MVP",
      area: "Tecnologia",
    }),
  );
});

it("mostra a mensagem específica do backend para erro permanente", async () => {
  apiMocks.submissions.create.mockRejectedValueOnce(new ApiError(400, "Área inválida para a candidatura."));

  await renderSubmissionVariant("negocio");
  await fillCommonValidSubmissionFields("negocio");
  submitSubmissionForm();

  await waitFor(() => {
    expect(toastError).toHaveBeenCalledWith("Área inválida para a candidatura.");
  });
});
