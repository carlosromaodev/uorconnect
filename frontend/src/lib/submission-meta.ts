export type NormalizedSubmissionType = "PROJECT" | "BUSINESS" | "PRODUCT";

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeSubmissionType(type?: string, area?: string | null): NormalizedSubmissionType {
  const normalizedArea = normalizeText(area);

  if (type === "PROJECT" && (normalizedArea === "negócio" || normalizedArea === "negocio")) {
    return "BUSINESS";
  }

  if (type === "PROJECT" && normalizedArea === "produto") {
    return "PRODUCT";
  }

  if (type === "BUSINESS" || type === "PRODUCT") return type;
  return "PROJECT";
}

export function canVoteSubmission(type?: string, area?: string | null, canVote?: boolean) {
  if (typeof canVote === "boolean") return canVote;
  return normalizeSubmissionType(type, area) === "PROJECT";
}

export function eligibleForAward(type?: string, area?: string | null, value?: boolean) {
  if (typeof value === "boolean") return value;
  return normalizeSubmissionType(type, area) === "PROJECT";
}

export function getSubmissionTypeLabel(type?: string, area?: string | null) {
  const normalizedType = normalizeSubmissionType(type, area);
  if (normalizedType === "BUSINESS") return "Negócio";
  if (normalizedType === "PRODUCT") return "Produto";
  return "Projeto";
}

export function getSubmissionAreaLabel(area?: string | null, type?: string) {
  const trimmed = (area ?? "").trim();
  const normalizedType = normalizeSubmissionType(type, area);

  if (trimmed) {
    if (normalizedType === "BUSINESS" && /^(negócio|negocio)$/i.test(trimmed)) return "Área de negócio";
    if (normalizedType === "PRODUCT" && /^produto$/i.test(trimmed)) return "Categoria do produto";
    return trimmed;
  }

  if (normalizedType === "BUSINESS") return "Área de negócio";
  if (normalizedType === "PRODUCT") return "Categoria do produto";
  return "Projeto";
}

export function getSubmissionAudienceCopy(type?: string, area?: string | null) {
  const normalizedType = normalizeSubmissionType(type, area);

  if (normalizedType === "PROJECT") {
    return "Participa na votação pública e concorre ao prémio oficial da feira.";
  }

  return "Exposição institucional: não entra na votação pública nem no prémio. Concorre a vaga gratuita na próxima feira.";
}
