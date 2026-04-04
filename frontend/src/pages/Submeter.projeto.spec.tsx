import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import {
  apiMocks,
  expectInitialNeutralState,
  expectSuccessfulSubmission,
  expectValidationBanner,
  fillCommonValidSubmissionFields,
  renderSubmissionVariant,
  resetSubmissionMocks,
  submitSubmissionForm,
} from "./Submeter.variant-test-utils";

beforeEach(() => {
  resetSubmissionMocks();
});

it("renderiza a variante de projeto sem email e com secções esperadas", async () => {
  await renderSubmissionVariant("projeto");

  expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
  expect(screen.getByLabelText("Nome da candidatura")).toBeInTheDocument();
  expect(screen.getByLabelText("Descrição")).toBeInTheDocument();
  expect(screen.getByLabelText("Docente orientador")).toBeInTheDocument();
  expect(screen.getByText("Tudo dentro de limites consistentes")).toBeInTheDocument();
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Descrição")).not.toBeRequired();
  expect(screen.queryByLabelText("Entidade responsável")).not.toBeInTheDocument();
});

it("arranca em estado neutro", async () => {
  await renderSubmissionVariant("projeto");
  expectInitialNeutralState();
});

it("valida o nome completo por blur/change e aplica atributos de acessibilidade", async () => {
  await renderSubmissionVariant("projeto");

  const leaderName = screen.getByLabelText("Nome completo");
  expect(screen.queryByText(/Nome deve ter entre 3 e 100 letras/i)).not.toBeInTheDocument();

  fireEvent.change(leaderName, { target: { value: "" } });
  fireEvent.blur(leaderName);

  const error = await screen.findByText(/Nome deve ter entre 3 e 100/i);
  expect(error).toHaveAttribute("role", "alert");
  expect(leaderName).toHaveAttribute("aria-invalid", "true");
  expect(leaderName).toHaveAttribute("aria-describedby", "leaderName-error");
  expect(within(leaderName.closest(".space-y-2")!).getByRole("alert")).toHaveTextContent("⚠");

  fireEvent.change(leaderName, { target: { value: "Carlos Silva" } });

  await waitFor(() => {
    expect(screen.queryByText(/Nome deve ter entre 3 e 100 letras/i)).not.toBeInTheDocument();
  });

  expect(leaderName).toHaveAttribute("aria-invalid", "false");
});

it("mantém a descrição opcional e actualiza o contador por thresholds", async () => {
  await renderSubmissionVariant("projeto");

  const description = screen.getByLabelText("Descrição");

  fireEvent.change(description, { target: { value: "curta" } });
  fireEvent.blur(description);
  expect(await screen.findByText(/descrição.*10 caracteres|se preenchida, a descrição/i)).toBeInTheDocument();

  fireEvent.change(description, { target: { value: "a".repeat(400) } });
  expect(screen.getByText("400/500")).toBeInTheDocument();

  fireEvent.change(description, { target: { value: "a".repeat(490) } });
  expect(screen.getByText("490/500")).toBeInTheDocument();

  fireEvent.change(description, { target: { value: "" } });
  fireEvent.blur(description);

  await waitFor(() => {
    expect(screen.queryByText(/descrição.*10 caracteres|se preenchida, a descrição/i)).not.toBeInTheDocument();
  });
});

it("bloqueia a submissão inválida e mostra feedback global", async () => {
  await renderSubmissionVariant("projeto");

  submitSubmissionForm();

  expectValidationBanner();
});

it("permite submissão válida com descrição vazia", async () => {
  await renderSubmissionVariant("projeto");

  await fillCommonValidSubmissionFields("projeto");
  submitSubmissionForm();

  await expectSuccessfulSubmission();
  expect(apiMocks.submissions.create).toHaveBeenCalledWith(
    expect.objectContaining({
      description: undefined,
      leaderName: "Carlos Silva",
      leaderPhone: "+244 923456789",
      type: "PROJECT",
    }),
  );
});
