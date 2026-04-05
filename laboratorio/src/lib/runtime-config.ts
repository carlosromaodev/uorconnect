const ABSOLUTE_URL_RE = /^https?:\/\//i;

type LocationLike = Pick<Location, "hostname" | "origin">;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizePathSegment(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function isLocalHostname(hostname?: string | null) {
  if (!hostname) return false;

  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0";
}

function getWindowLocation(): LocationLike | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location;
}

export function resolveApiBase(
  explicitBase = import.meta.env.VITE_API_BASE_URL as string | undefined,
  currentLocation = getWindowLocation(),
) {
  const normalized = explicitBase?.trim();
  if (!normalized) {
    return "/api";
  }

  if (ABSOLUTE_URL_RE.test(normalized)) {
    if (currentLocation && isLocalHostname(currentLocation.hostname)) {
      try {
        const target = new URL(normalized);
        if (!isLocalHostname(target.hostname)) {
          return "/api";
        }
      } catch {
        return "/api";
      }
    }

    return trimTrailingSlash(normalized);
  }

  return normalizePathSegment(trimTrailingSlash(normalized));
}

export function resolveApiRequestUrl(
  path: string,
  explicitBase = import.meta.env.VITE_API_BASE_URL as string | undefined,
  currentLocation = getWindowLocation(),
) {
  const apiBase = resolveApiBase(explicitBase, currentLocation);
  return `${apiBase}${normalizePathSegment(path)}`;
}
