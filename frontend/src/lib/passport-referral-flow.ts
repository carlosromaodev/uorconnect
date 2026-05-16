const PASSPORT_REFERRAL_ACCEPTED_KEY = "uor_passport_referral_accepted";
const INTERNAL_URL_BASE = "https://uorconnect.local";

function isSafeInternalPath(path?: string | null) {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function toInternalUrl(path: string, fallback = "/minha-area?tab=desafio") {
  const safePath = isSafeInternalPath(path) ? path : fallback;
  return new URL(safePath, INTERNAL_URL_BASE);
}

function toPath(url: URL) {
  return `${url.pathname}${url.search}${url.hash}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readAcceptedCode() {
  try {
    return sessionStorage.getItem(PASSPORT_REFERRAL_ACCEPTED_KEY);
  } catch {
    return null;
  }
}

export function getPassportReferralCodeFromPath(path?: string | null) {
  if (!isSafeInternalPath(path)) return null;

  const url = toInternalUrl(String(path));
  const invitePathMatch = url.pathname.match(/^\/desafio\/convite\/([^/]+)$/);
  if (invitePathMatch?.[1]) {
    return safeDecode(invitePathMatch[1]).trim() || null;
  }

  return (
    url.searchParams.get("convite")?.trim() ||
    url.searchParams.get("ref")?.trim() ||
    null
  );
}

export function buildPassportReferralInvitePath(code: string) {
  return `/desafio/convite/${encodeURIComponent(code)}`;
}

export function buildPassportReferralAcceptedPath(path: string, code: string) {
  const url = toInternalUrl(path);
  url.pathname = "/minha-area";
  url.searchParams.set("tab", "desafio");
  url.searchParams.set("convite", code);
  url.searchParams.set("aceitarConvite", "1");
  url.searchParams.delete("ref");
  return toPath(url);
}

export function buildPassportReferralDeclinedPath(path: string) {
  void path;
  return "/projetos";
}

export function markPassportReferralAccepted(code: string) {
  try {
    sessionStorage.setItem(PASSPORT_REFERRAL_ACCEPTED_KEY, code);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}

export function hasPassportReferralAccepted(code: string) {
  return readAcceptedCode() === code;
}

export function consumePassportReferralAccepted(code: string) {
  const accepted = hasPassportReferralAccepted(code);
  if (accepted) clearPassportReferralAccepted();
  return accepted;
}

export function clearPassportReferralAccepted() {
  try {
    sessionStorage.removeItem(PASSPORT_REFERRAL_ACCEPTED_KEY);
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
}
