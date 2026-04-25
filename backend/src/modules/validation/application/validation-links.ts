import type { Env } from "../../../config/env";

const DEFAULT_PUBLIC_APP_URL = "https://uorconnect.space";
const DEFAULT_PUBLIC_API_PREFIX = "/api";

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getPublicAppBaseUrl(env: Env) {
  return env.PUBLIC_APP_URL ? stripTrailingSlash(env.PUBLIC_APP_URL) : DEFAULT_PUBLIC_APP_URL;
}

export function getPublicApiBaseUrl(env: Env) {
  return env.PUBLIC_API_URL ? stripTrailingSlash(env.PUBLIC_API_URL) : DEFAULT_PUBLIC_API_PREFIX;
}

export function buildValidationUrl(env: Env, token: string) {
  return `${getPublicAppBaseUrl(env)}/validar/${encodeURIComponent(token)}`;
}

export function buildValidationQrUrl(env: Env, token: string) {
  return `${getPublicApiBaseUrl(env)}/validation/${encodeURIComponent(token)}/qr.svg`;
}

export function extractValidationToken(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;

  const lastSegment = (() => {
    try {
      const parsed = new URL(raw);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length > 0) return parts.at(-1) ?? raw;

      const hashParts = parsed.hash.replace(/^#/, "").split(/[/?#]/).filter(Boolean);
      return hashParts.at(-1) ?? raw;
    } catch {
      const withoutHash = raw.split("#").at(-1) ?? raw;
      const parts = withoutHash.split(/[/?#]/).filter(Boolean);
      return parts.at(-1) ?? raw;
    }
  })();

  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}
