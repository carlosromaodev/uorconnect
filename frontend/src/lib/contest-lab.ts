import { useEffect, useMemo, useState } from "react";
import { challengeContestConfig, challengeItems } from "@/data/challenges";

const CONTEST_PREFIX = "/desafios";
const CONTEST_LAB_HOST = "laboratorio.uorconnect.space";
const SAAS_SHOWCASE_HOST = "agendar.uorconnect.space";
const PRIMARY_PORTAL_HOST = "uorconnect.space";
const CONTEST_LAB_BRAND_ASSET = "/logouorlabratoriowite.png";
const DEDICATED_CONTEST_RUNTIME = (import.meta.env.VITE_APP_RUNTIME as string | undefined)?.trim().toLowerCase() === "laboratorio";
const challengeSlugs = new Set(challengeItems.map((item) => item.slug));
const contestStaticPaths = new Set(["/", "/login", "/admin", "/lobby", "/arena", "/ranking", "/regras"]);

function getBrowserLocation() {
  if (typeof window === "undefined") return null;
  return window.location;
}

function splitPath(path: string) {
  const match = path.match(/^([^?#]*)(.*)$/);
  return {
    pathname: match?.[1] || path,
    suffix: match?.[2] || "",
  };
}

function normalizePathname(pathname: string) {
  if (!pathname) return "/";
  if (pathname !== "/" && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function normalizeContestBasePath(pathname?: string) {
  const rawPath = pathname?.trim();
  if (!rawPath || rawPath === "/") return "/";

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash !== "/" && withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

const DEDICATED_CONTEST_BASE_PATH = normalizeContestBasePath(import.meta.env.VITE_LAB_BASE_PATH as string | undefined);

function stripDedicatedContestBasePath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);

  if (!DEDICATED_CONTEST_RUNTIME || DEDICATED_CONTEST_BASE_PATH === "/") {
    return normalizedPath;
  }

  if (normalizedPath === DEDICATED_CONTEST_BASE_PATH) {
    return "/";
  }

  if (normalizedPath.startsWith(`${DEDICATED_CONTEST_BASE_PATH}/`)) {
    return normalizePathname(normalizedPath.slice(DEDICATED_CONTEST_BASE_PATH.length));
  }

  return normalizedPath;
}

function applyDedicatedContestBasePath(path: string) {
  const canonicalPath = toContestLabPath(path);

  if (!DEDICATED_CONTEST_RUNTIME || DEDICATED_CONTEST_BASE_PATH === "/") {
    return canonicalPath;
  }

  if (canonicalPath === "/") {
    return DEDICATED_CONTEST_BASE_PATH;
  }

  return `${DEDICATED_CONTEST_BASE_PATH}${canonicalPath}`;
}

export function isContestLabHost(hostname = getBrowserLocation()?.hostname ?? "") {
  return DEDICATED_CONTEST_RUNTIME || hostname.trim().toLowerCase() === CONTEST_LAB_HOST;
}

export function isSaasShowcaseHost(hostname = getBrowserLocation()?.hostname ?? "") {
  return hostname.trim().toLowerCase() === SAAS_SHOWCASE_HOST;
}

function getContestAwarePathname(pathname = getBrowserLocation()?.pathname ?? "/") {
  return stripDedicatedContestBasePath(pathname);
}

function isContestDynamicPath(pathname: string) {
  const submitMatch = pathname.match(/^\/([^/]+)\/submeter$/);
  if (submitMatch) {
    return challengeSlugs.has(submitMatch[1]);
  }

  const detailMatch = pathname.match(/^\/([^/]+)$/);
  if (detailMatch) {
    return challengeSlugs.has(detailMatch[1]);
  }

  return false;
}

function isContestCanonicalPath(pathname: string) {
  return contestStaticPaths.has(pathname) || isContestDynamicPath(pathname);
}

function toContestCanonicalPath(path: string) {
  const { pathname, suffix } = splitPath(path);
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === CONTEST_PREFIX) return { pathname: "/", suffix };
  if (normalizedPath === `${CONTEST_PREFIX}/login`) return { pathname: "/login", suffix };
  if (normalizedPath === `${CONTEST_PREFIX}/admin`) return { pathname: "/admin", suffix };
  if (normalizedPath === `${CONTEST_PREFIX}/lobby`) return { pathname: "/lobby", suffix };
  if (normalizedPath === `${CONTEST_PREFIX}/arena`) return { pathname: "/arena", suffix };
  if (normalizedPath === `${CONTEST_PREFIX}/ranking`) return { pathname: "/ranking", suffix };
  if (normalizedPath === `${CONTEST_PREFIX}/regras`) return { pathname: "/regras", suffix };

  const prefixedSubmitMatch = normalizedPath.match(/^\/desafios\/([^/]+)\/submeter$/);
  if (prefixedSubmitMatch) return { pathname: `/${prefixedSubmitMatch[1]}/submeter`, suffix };

  const prefixedDetailMatch = normalizedPath.match(/^\/desafios\/([^/]+)$/);
  if (prefixedDetailMatch) return { pathname: `/${prefixedDetailMatch[1]}`, suffix };

  return { pathname: normalizedPath, suffix };
}

function toPrimaryContestPath(path: string) {
  const canonical = toContestCanonicalPath(path);

  if (!isContestCanonicalPath(canonical.pathname)) {
    return `${canonical.pathname}${canonical.suffix}`;
  }

  if (canonical.pathname === "/") {
    return `${CONTEST_PREFIX}${canonical.suffix}`;
  }

  return `${CONTEST_PREFIX}${canonical.pathname}${canonical.suffix}`;
}

export function getAuthOrigin(
  hostname = getBrowserLocation()?.hostname ?? "",
  pathname = getContestAwarePathname(),
) {
  return isContestLabHost(hostname) || isContestRoutePath(pathname, hostname) ? "laboratorio" : "uorconnect";
}

export function getContestBrandAsset(
  hostname = getBrowserLocation()?.hostname ?? "",
  pathname = getContestAwarePathname(),
) {
  return isContestLabHost(hostname) || isContestRoutePath(pathname, hostname) ? CONTEST_LAB_BRAND_ASSET : "/logoworconnect.png";
}

export function getContestBrandName(
  hostname = getBrowserLocation()?.hostname ?? "",
  pathname = getContestAwarePathname(),
) {
  return isContestLabHost(hostname) || isContestRoutePath(pathname, hostname) ? "UOR Connect Laboratorio" : "UOR Connect";
}

export function toContestLabPath(path: string) {
  const canonical = toContestCanonicalPath(path);
  return `${canonical.pathname}${canonical.suffix}`;
}

export function isContestRoutePath(pathname: string, hostname = getBrowserLocation()?.hostname ?? "") {
  const normalizedPath = getContestAwarePathname(pathname);

  if (normalizedPath === CONTEST_PREFIX || normalizedPath.startsWith(`${CONTEST_PREFIX}/`)) {
    return true;
  }

  if (!isContestLabHost(hostname)) {
    return false;
  }

  return isContestCanonicalPath(normalizedPath);
}

export function isContestContext(
  pathname = getContestAwarePathname(),
  hostname = getBrowserLocation()?.hostname ?? "",
  redirectPath?: string | null,
) {
  if (isContestLabHost(hostname) || isContestRoutePath(pathname, hostname)) {
    return true;
  }

  if (!redirectPath) {
    return false;
  }

  const normalizedRedirect = normalizePathname(redirectPath);
  return normalizedRedirect.startsWith(`${CONTEST_PREFIX}/`);
}

export function getContestLinkPath(path: string, hostname = getBrowserLocation()?.hostname ?? "") {
  if (isContestLabHost(hostname)) {
    return DEDICATED_CONTEST_RUNTIME ? applyDedicatedContestBasePath(path) : toContestLabPath(path);
  }

  return toPrimaryContestPath(path);
}

export function getContestLoginHref(
  redirectPath = "/",
  hostname = getBrowserLocation()?.hostname ?? "",
) {
  const loginPath = getContestLinkPath("/login", hostname);
  const nextPath = getContestLinkPath(redirectPath, hostname);
  return `${loginPath}?redirect=${encodeURIComponent(nextPath)}`;
}

export function getContestAbsoluteUrl(path: string, location = getBrowserLocation()) {
  const canonicalPath = toContestLabPath(path);

  if (!location) {
    return `https://${CONTEST_LAB_HOST}${canonicalPath}`;
  }

  if (DEDICATED_CONTEST_RUNTIME) {
    return `${location.origin}${applyDedicatedContestBasePath(path)}`;
  }

  const hostname = location.hostname.trim().toLowerCase();
  const localhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (localhost) {
    return `${location.protocol}//${location.hostname}:8081${canonicalPath}`;
  }

  if (hostname === PRIMARY_PORTAL_HOST || hostname === `www.${PRIMARY_PORTAL_HOST}` || hostname === CONTEST_LAB_HOST) {
    return `${location.protocol}//${CONTEST_LAB_HOST}${canonicalPath}`;
  }

  return `${location.origin}${path}`;
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

  if (isContestLabHost(location.hostname) || isSaasShowcaseHost(location.hostname)) {
    return `${location.protocol}//${PRIMARY_PORTAL_HOST}${path}`;
  }

  return path;
}

export type ContestRuntimePhase = "scheduled" | "running" | "finished";

function getContestTimes() {
  const startsAt = new Date(challengeContestConfig.scheduledStartAt).getTime();
  const endsAt = startsAt + challengeContestConfig.durationMinutes * 60 * 1000;
  return { startsAt, endsAt };
}

export function getContestRuntimePhase(nowMs = Date.now()): ContestRuntimePhase {
  const { startsAt, endsAt } = getContestTimes();
  if (nowMs < startsAt) return "scheduled";
  if (nowMs >= endsAt) return "finished";
  return "running";
}

export function formatContestClock(totalMs: number) {
  const safeMs = Math.max(0, totalMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function useContestClock(mode?: ContestRuntimePhase) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const { startsAt, endsAt } = getContestTimes();
    const runtimePhase = mode ?? getContestRuntimePhase(nowMs);
    const targetMs = runtimePhase === "scheduled" ? startsAt : endsAt;
    const remainingMs = Math.max(0, targetMs - nowMs);

    return {
      nowMs,
      runtimePhase,
      startsAt,
      endsAt,
      remainingMs,
      display: formatContestClock(remainingMs),
      label: runtimePhase === "scheduled"
        ? "Contagem para o início"
        : runtimePhase === "running"
          ? "Tempo restante"
          : "Concurso encerrado",
    };
  }, [mode, nowMs]);
}
