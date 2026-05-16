export const PAYMENT_STATUSES = [
  "SUBMITTED_BY_USER",
  "PENDING_REVIEW",
  "CONFIRMED_BY_ADMIN",
  "REJECTED",
  "CANCELED",
] as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export function normalizePaymentStatus(value?: string | null): PaymentStatus {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "CONFIRMED" || normalized === "APPROVED" || normalized === "CONFIRMED_BY_ADMIN") {
    return "CONFIRMED_BY_ADMIN";
  }
  if (normalized === "PENDING" || normalized === "PENDING_REVIEW") return "PENDING_REVIEW";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "CANCELED" || normalized === "CANCELLED") return "CANCELED";
  return "SUBMITTED_BY_USER";
}

export function isPaymentConfirmedByAdmin(value?: string | null) {
  return normalizePaymentStatus(value) === "CONFIRMED_BY_ADMIN";
}

export function paymentStatusLabel(value?: string | null, hasProof = true) {
  const status = normalizePaymentStatus(value);
  if (status === "CONFIRMED_BY_ADMIN") return "Confirmado pela equipa";
  if (status === "REJECTED") return "Rejeitado";
  if (status === "CANCELED") return "Cancelado";
  if (status === "PENDING_REVIEW") return "Em análise financeira";
  return hasProof ? "Submetido pelo utilizador" : "Pendente de comprovativo";
}

export function buildPaymentTimeline(input: {
  status?: string | null;
  submittedAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
}) {
  const status = normalizePaymentStatus(input.status);
  const submittedAt = input.submittedAt
    ? new Date(input.submittedAt).toISOString()
    : null;
  const reviewedAt = input.reviewedAt
    ? new Date(input.reviewedAt).toISOString()
    : null;

  return [
    {
      key: "SUBMITTED_BY_USER",
      label: "Comprovativo submetido pelo utilizador",
      status: submittedAt ? "done" : "pending",
      at: submittedAt,
      by: null,
      note: null,
    },
    {
      key: "PENDING_REVIEW",
      label: "Aguardando revisão financeira",
      status: status === "PENDING_REVIEW" ? "current" : submittedAt ? "done" : "pending",
      at: submittedAt,
      by: null,
      note: null,
    },
    {
      key: status,
      label: paymentStatusLabel(status),
      status: reviewedAt || ["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(status) ? "done" : "pending",
      at: reviewedAt,
      by: input.reviewedBy ?? null,
      note: input.reviewNote ?? null,
    },
  ];
}
