export type SubmissionKind = "projeto" | "negocio" | "produto";

export type SubmissionFormState = {
  leaderName: string;
  phoneDigits: string;
  academicCourse: string;
  name: string;
  description: string;
  area: string;
  advisor: string;
  organizationName: string;
  stage: string;
  category: string;
  productType: string;
  priceAverage: string;
  repoUrl: string;
  websiteUrl: string;
  observations: string;
  agreeRules: boolean;
  paymentConfirmed: boolean;
  paymentProof: string;
  paymentProofName: string;
  members: string[];
  needs: string[];
};

export type SubmissionFieldKey = Exclude<keyof SubmissionFormState, "paymentProofName" | "needs">;
export type SubmissionErrors = Partial<Record<SubmissionFieldKey, string>>;

export const emptyFormState: SubmissionFormState = {
  leaderName: "",
  phoneDigits: "",
  academicCourse: "",
  name: "",
  description: "",
  area: "",
  advisor: "",
  organizationName: "",
  stage: "",
  category: "",
  productType: "",
  priceAverage: "",
  repoUrl: "",
  websiteUrl: "",
  observations: "",
  agreeRules: false,
  paymentConfirmed: false,
  paymentProof: "",
  paymentProofName: "",
  members: [],
  needs: [],
};

const LETTERS_ONLY_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/u;
const NINE_DIGIT_PHONE_REGEX = /^9\d{8}$/;
const PROOF_VALUE_REGEX = /^(data:|https?:\/\/)/;

export const VALIDATION_BANNER_MESSAGE = "⚠ Corrija os erros assinalados antes de continuar";
export const VALID_FIELD_ARIA_LABEL = "Campo válido";

function isLettersOnly(value: string) {
  return LETTERS_ONLY_REGEX.test(value);
}

function isPositiveNumber(value: string) {
  return /^\d+(?:[.,]\d+)?$/.test(value);
}

function isValidAbsoluteUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeSubmissionPhoneDigits(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("002449")) return digits.slice(5, 14);
  if (digits.startsWith("2449")) return digits.slice(3, 12);
  if (digits.startsWith("9")) return digits.slice(0, 9);
  return digits.slice(-9);
}

export function extractSubmissionPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("002449")) return digits.slice(5, 14);
  if (digits.startsWith("2449")) return digits.slice(3, 12);
  if (digits.startsWith("244")) return digits.slice(3, 12);
  if (digits.startsWith("9")) return digits.slice(0, 9);
  return digits.slice(-9);
}

export function formatSubmissionPhone(digits: string) {
  const normalized = normalizeSubmissionPhoneDigits(digits);
  if (!normalized) return "";
  if (normalized.length < 9) {
    return `+244 ${normalized}`;
  }

  return `+244 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)}`;
}

export function isValidSubmissionPhoneDigits(value: string) {
  return NINE_DIGIT_PHONE_REGEX.test(normalizeSubmissionPhoneDigits(value));
}

export function getDescriptionCounterTone(length: number) {
  if (length >= 490) return "danger";
  if (length >= 400) return "warning";
  return "muted";
}

const sharedVisibleFields: SubmissionFieldKey[] = [
  "leaderName",
  "academicCourse",
  "phoneDigits",
  "name",
  "description",
  "area",
  "repoUrl",
  "websiteUrl",
  "observations",
  "members",
  "paymentProof",
  "paymentConfirmed",
  "agreeRules",
];

const variantVisibleFields: Record<SubmissionKind, SubmissionFieldKey[]> = {
  projeto: ["advisor"],
  negocio: ["organizationName", "stage"],
  produto: ["organizationName", "category", "productType", "priceAverage"],
};

export function getVisibleSubmissionFields(kind: SubmissionKind) {
  return [...sharedVisibleFields, ...variantVisibleFields[kind]];
}

export function validateSubmissionField(
  kind: SubmissionKind,
  form: SubmissionFormState,
  field: SubmissionFieldKey,
): string | null {
  const leaderName = form.leaderName.trim();
  const academicCourse = form.academicCourse.trim();
  const name = form.name.trim();
  const description = form.description.trim();
  const area = form.area.trim();
  const advisor = form.advisor.trim();
  const organizationName = form.organizationName.trim();
  const stage = form.stage.trim();
  const category = form.category.trim();
  const productType = form.productType.trim();
  const priceAverage = form.priceAverage.trim();
  const repoUrl = form.repoUrl.trim();
  const websiteUrl = form.websiteUrl.trim();
  const observations = form.observations.trim();

  switch (field) {
    case "leaderName":
      if (!leaderName || leaderName.length < 3 || leaderName.length > 100 || !isLettersOnly(leaderName)) {
        return "⚠ Nome deve ter entre 3 e 100 letras";
      }
      return null;

    case "academicCourse":
      return academicCourse ? null : "⚠ Seleccione uma opção válida";

    case "phoneDigits":
      return isValidSubmissionPhoneDigits(form.phoneDigits) ? null : "⚠ Número de telefone inválido";

    case "name":
      if (!name || name.length < 3 || name.length > 100 || !isLettersOnly(name)) {
        return "⚠ Nome deve ter entre 3 e 100 letras";
      }
      return null;

    case "description":
      if (!description) return null;
      if (description.length < 10 || description.length > 500) {
        return "⚠ Descrição deve ter entre 10 e 500 caracteres";
      }
      return null;

    case "area":
      return area ? null : "⚠ Seleccione uma opção válida";

    case "advisor":
      if (kind !== "projeto") return null;
      return advisor.length >= 3 ? null : "⚠ Informe o docente orientador";

    case "organizationName":
      if (kind === "projeto") return null;
      return organizationName.length >= 3 ? null : "⚠ Informe a entidade responsável";

    case "stage":
      if (kind !== "negocio") return null;
      return stage ? null : "⚠ Seleccione uma opção válida";

    case "category":
      if (kind !== "produto") return null;
      return category ? null : "⚠ Seleccione uma opção válida";

    case "productType":
      if (kind !== "produto") return null;
      return productType ? null : "⚠ Seleccione uma opção válida";

    case "priceAverage":
      if (kind !== "produto" || !priceAverage) return null;
      return isPositiveNumber(priceAverage) ? null : "⚠ Valor deve ser um número positivo";

    case "repoUrl":
      if (!repoUrl) return null;
      return isValidAbsoluteUrl(repoUrl) ? null : "⚠ Use um link válido";

    case "websiteUrl":
      if (!websiteUrl) return null;
      return isValidAbsoluteUrl(websiteUrl) ? null : "⚠ Use um link válido";

    case "observations":
      return observations.length <= 500 ? null : "⚠ Observações não podem exceder 500 caracteres";

    case "members":
      if (form.members.length === 0) return "⚠ Adicione pelo menos um membro";
      if (form.members.length > 5) return "⚠ Máximo de 5 membros";
      if (form.members.some((member) => member.trim().length < 2)) return "⚠ Adicione pelo menos um membro";
      return null;

    case "paymentProof":
      return PROOF_VALUE_REGEX.test(form.paymentProof) ? null : "⚠ Anexe o comprovativo do pagamento";

    case "paymentConfirmed":
      return form.paymentConfirmed ? null : "⚠ É necessário confirmar o pagamento";

    case "agreeRules":
      return form.agreeRules ? null : "⚠ É necessário aceitar os termos";
  }
}

export function validateSubmissionForm(kind: SubmissionKind, form: SubmissionFormState) {
  return getVisibleSubmissionFields(kind).reduce<SubmissionErrors>((acc, field) => {
    const error = validateSubmissionField(kind, form, field);
    if (error) {
      acc[field] = error;
    }
    return acc;
  }, {});
}
