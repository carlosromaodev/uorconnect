const SAAS_SHOWCASE_HOST = (import.meta.env.VITE_SAAS_SHOWCASE_HOST as string | undefined)?.trim() || "agendar.uorconnect.space";
const ADMIN_APP_HOST = (import.meta.env.VITE_ADMIN_APP_HOST as string | undefined)?.trim() || "admin.uorconnect.space";
const PRIMARY_PORTAL_HOST = (import.meta.env.VITE_PRIMARY_PORTAL_HOST as string | undefined)?.trim() || "uorconnect.space";

function getBrowserLocation() {
  if (typeof window === "undefined") return null;
  return window.location;
}

export function isSaasShowcaseHost(hostname = getBrowserLocation()?.hostname ?? "") {
  return hostname.trim().toLowerCase() === SAAS_SHOWCASE_HOST;
}

export function isAdminAppHost(hostname = getBrowserLocation()?.hostname ?? "") {
  return hostname.trim().toLowerCase() === ADMIN_APP_HOST;
}

export function getSaasShowcaseHref(path = "/", location = getBrowserLocation()) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!location) {
    return `https://${SAAS_SHOWCASE_HOST}${normalizedPath}`;
  }

  if (isSaasShowcaseHost(location.hostname)) {
    return `${location.origin}${normalizedPath}`;
  }

  return `https://${SAAS_SHOWCASE_HOST}${normalizedPath}`;
}

export function getPrimaryPortalHref(path = "/", location = getBrowserLocation()) {
  if (!location) {
    return `https://${PRIMARY_PORTAL_HOST}${path}`;
  }

  const hostname = location.hostname.trim().toLowerCase();
  const localhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (localhost) {
    return `${location.protocol}//${location.hostname}:8082${path}`;
  }

  if (isSaasShowcaseHost(location.hostname)) {
    return `${location.protocol}//${PRIMARY_PORTAL_HOST}${path}`;
  }

  return path;
}
