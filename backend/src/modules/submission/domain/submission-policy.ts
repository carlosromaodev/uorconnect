import type { SubmissionType } from "./submission";

function normalizeText(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeSubmissionType(type: SubmissionType, area?: string | null): SubmissionType {
  const normalizedArea = normalizeText(area);

  if (type === "PROJECT" && (normalizedArea === "negócio" || normalizedArea === "negocio")) {
    return "BUSINESS";
  }

  if (type === "PROJECT" && normalizedArea === "produto") {
    return "PRODUCT";
  }

  return type;
}

export function isCompetitionEligible(type: SubmissionType, area?: string | null) {
  return normalizeSubmissionType(type, area) === "PROJECT";
}

export function getSubmissionTypeLabel(type: SubmissionType, area?: string | null) {
  const normalizedType = normalizeSubmissionType(type, area);

  if (normalizedType === "BUSINESS") return "Negócio";
  if (normalizedType === "PRODUCT") return "Produto";
  return "Projeto";
}
