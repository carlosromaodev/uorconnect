function normalizePath(path = "/") {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function getWindowLocation() {
  if (typeof window === "undefined") return undefined;
  return window.location;
}

function isLocalHostname(hostname?: string | null) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export function getPrimaryPortalHref(path = "/", location = getWindowLocation()) {
  const normalizedPath = normalizePath(path);

  if (!location) {
    return `https://uorconnect.space${normalizedPath}`;
  }

  if (isLocalHostname(location.hostname)) {
    return `${location.protocol}//${location.hostname}:8080${normalizedPath}`;
  }

  return `https://uorconnect.space${normalizedPath}`;
}
