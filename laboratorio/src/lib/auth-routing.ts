const INTENDED_ROUTE_KEY = "uor_laboratorio_intended_route";

function isSafeInternalRoute(value?: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function buildRoutePath(pathname: string, search = "", hash = "") {
  return `${pathname}${search}${hash}`;
}

export function storeIntendedRoute(path: string) {
  if (typeof sessionStorage === "undefined" || !isSafeInternalRoute(path)) return;
  sessionStorage.setItem(INTENDED_ROUTE_KEY, path);
}

export function getSafeRedirectPath(candidate?: string | null, fallback = "/") {
  return isSafeInternalRoute(candidate) ? String(candidate) : fallback;
}
