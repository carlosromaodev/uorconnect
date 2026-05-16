export const canonicalCredentialStatuses = [
  "DRAFT",
  "INVITED",
  "ISSUED",
  "PROFILE_READY",
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "DISABLED",
] as const;

export type CanonicalCredentialStatus = typeof canonicalCredentialStatuses[number];

type LifecycleCredential = {
  status?: string | null;
  issuedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  revokedAt?: Date | string | null;
  invitationExpiresAt?: Date | string | null;
};

function asTime(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

export function normalizeCredentialStatus(credential: LifecycleCredential): CanonicalCredentialStatus {
  const rawStatus = credential.status?.trim().toUpperCase();

  if (rawStatus === "DISABLED") return "DISABLED";
  if (rawStatus === "REVOKED" || credential.revokedAt) return "REVOKED";

  const invitationExpiresAt = asTime(credential.invitationExpiresAt);
  if (rawStatus === "INVITED" && invitationExpiresAt !== null && invitationExpiresAt < Date.now()) return "EXPIRED";

  const expiresAt = asTime(credential.expiresAt);
  if (expiresAt !== null && expiresAt < Date.now()) return "EXPIRED";

  if (rawStatus === "PROFILE_READY") return "PROFILE_READY";
  if (rawStatus === "ACTIVE") return "ACTIVE";
  if (rawStatus === "ISSUED") return "ISSUED";
  if (rawStatus === "INVITED") return "INVITED";
  if (rawStatus === "DRAFT") return "DRAFT";

  return credential.issuedAt ? "ISSUED" : "DRAFT";
}

export function credentialStatusLabel(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "DRAFT") return "Rascunho";
  if (normalized === "INVITED") return "Convite aberto";
  if (normalized === "ISSUED") return "Emitida";
  if (normalized === "PROFILE_READY") return "Perfil pronto";
  if (normalized === "ACTIVE") return "Ativa";
  if (normalized === "EXPIRED") return "Expirada";
  if (normalized === "REVOKED") return "Revogada";
  if (normalized === "DISABLED") return "Desativada";
  return "Estado desconhecido";
}

export function isCredentialPubliclyValid(credential: LifecycleCredential) {
  const status = normalizeCredentialStatus(credential);
  return status === "PROFILE_READY" || status === "ACTIVE" || status === "ISSUED";
}

export function isCredentialOperationallyUsable(credential: LifecycleCredential) {
  const status = normalizeCredentialStatus(credential);
  return status !== "DISABLED" && status !== "REVOKED" && status !== "EXPIRED";
}
