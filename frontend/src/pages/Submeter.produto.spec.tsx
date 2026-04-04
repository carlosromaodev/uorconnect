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

it("renderiza a variante de produto com os campos exclusivos esperados", async () => {
  await renderSubmissionVariant("produto");

  expect(screen.getByLabelText("Entidade responsável")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /Categoria do produto/i })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /Tipo do produto/i })).toBeInTheDocument();
  expect(screen.getByLabelText("Média de preço estimado")).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: /Estágio do negócio/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Docente orientador")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
});

it("arranca em estado neutro na variante de produto", async () => {
  await renderSubmissionVariant("produto");
  expectInitialNeutralState();
});

it("valida o campo numérico de preço e o submit inválido mostra o banner global", async () => {
  await renderSubmissionVariant("produto");

  const priceAverage = screen.getByLabelText("Média de preço estimado");
  fireEvent.change(priceAverage, { target: { value: "abc" } });
  fireEvent.blur(priceAverage);

  expect(priceAverage).toHaveAttribute("aria-invalid", "true");

  submitSubmissionForm();

  expectValidationBanner();
  expect(priceAverage).toHaveAttribute("aria-invalid", "true");
});

it("permite submissão válida na variante de produto com descrição vazia", async () => {
  await renderSubmissionVariant("produto");

  await fillCommonValidSubmissionFields("produto");
  submitSubmissionForm();

  await expectSuccessfulSubmission();
  expect(apiMocks.submissions.create).toHaveBeenCalledWith(
    expect.objectContaining({
      description: undefined,
      type: "PRODUCT",
      category: "Hardware",
      productType: "Físico",
      area: "Hardware",
    }),
  );
});

it("classifica erro temporário de API sem expor detalhes técnicos", async () => {
  apiMocks.submissions.create.mockRejectedValueOnce(new ApiError(503, "database unavailable"));

  await renderSubmissionVariant("produto");
  await fillCommonValidSubmissionFields("produto");
  submitSubmissionForm();

  await waitFor(() => {
    expect(toastError).toHaveBeenCalled();
  });
});
