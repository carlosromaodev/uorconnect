import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../config/env";

type SameSite = "Strict" | "Lax" | "None";

type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
};

function isIpLike(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function toBaseDomain(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost") || isIpLike(normalized)) {
    return null;
  }

  if (normalized.endsWith(".vercel.app")) {
    return null;
  }

  const segments = normalized.split(".").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  return `.${segments.slice(-2).join(".")}`;
}

function preferredOrigin(env: Env) {
  if (env.PUBLIC_APP_URL) return env.PUBLIC_APP_URL;
  if (env.PUBLIC_API_URL) return env.PUBLIC_API_URL;

  const firstOrigin = env.CORS_ORIGIN
    .split(",")
    .map((value) => value.trim())
    .find((value) => value.startsWith("http://") || value.startsWith("https://"));

  return firstOrigin ?? null;
}

export function resolveSharedCookieDomain(env: Env) {
  const origin = preferredOrigin(env);
  if (!origin) return null;

  try {
    return toBaseDomain(new URL(origin).hostname);
  } catch {
    return null;
  }
}

export function shouldUseSecureCookies(env: Env) {
  if (env.NODE_ENV === "production") return true;
  const origin = preferredOrigin(env);
  return origin ? origin.startsWith("https://") : false;
}

export function parseCookieHeader(value?: string | null) {
  const result: Record<string, string> = {};
  if (!value) return result;

  for (const chunk of value.split(";")) {
    const [namePart, ...rest] = chunk.split("=");
    const name = namePart?.trim();
    if (!name) continue;
    result[name] = decodeURIComponent(rest.join("=").trim());
  }

  return result;
}

export function getCookie(request: FastifyRequest, name: string) {
  return parseCookieHeader(request.headers.cookie)[name] ?? null;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path ?? "/"}`);

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  return parts.join("; ");
}

export function appendCookie(reply: FastifyReply, cookie: string) {
  const current = reply.getHeader("Set-Cookie");

  if (!current) {
    reply.header("Set-Cookie", cookie);
    return;
  }

  if (Array.isArray(current)) {
    reply.header("Set-Cookie", [...current, cookie]);
    return;
  }

  reply.header("Set-Cookie", [String(current), cookie]);
}

export function clearCookie(
  reply: FastifyReply,
  name: string,
  options: Pick<CookieOptions, "path" | "domain" | "httpOnly" | "secure" | "sameSite"> = {}
) {
  appendCookie(reply, serializeCookie(name, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0)
  }));
}
