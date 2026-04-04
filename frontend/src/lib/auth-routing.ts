import type { NavigateFunction, To } from "react-router-dom";

const INTENDED_ROUTE_KEY = "uor_intended_route";

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

export function getIntendedRoute() {
  if (typeof sessionStorage === "undefined") return null;
  const stored = sessionStorage.getItem(INTENDED_ROUTE_KEY);
  return isSafeInternalRoute(stored) ? stored : null;
}

export function consumeIntendedRoute(fallback = "/") {
  const stored = getIntendedRoute();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(INTENDED_ROUTE_KEY);
  }
  return stored ?? fallback;
}

export function clearIntendedRoute() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(INTENDED_ROUTE_KEY);
}

export function getSafeRedirectPath(candidate?: string | null, fallback = "/") {
  return isSafeInternalRoute(candidate) ? String(candidate) : fallback;
}

export function redirectToStudentLogin(
  navigate: NavigateFunction,
  intendedPath: string,
  options?: { replace?: boolean; state?: { from?: To } }
) {
  const safeIntendedPath = getSafeRedirectPath(intendedPath, "/");
  storeIntendedRoute(safeIntendedPath);
  navigate(`/login?redirect=${encodeURIComponent(safeIntendedPath)}`, {
    replace: options?.replace ?? false,
    state: options?.state,
  });
}
