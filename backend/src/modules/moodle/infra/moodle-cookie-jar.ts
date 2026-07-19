export type MoodleSameSite = "Strict" | "Lax" | "None";

export type MoodleCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: string | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: MoodleSameSite | null;
};

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const COOKIE_VALUE_PATTERN = /^[\u0021-\u003A\u003C-\u007E]*$/;

export type MoodleCookieClock = () => Date;

function normalizeCookieDomain(value: string): string {
  return value.trim().replace(/^\./, "").toLowerCase();
}

function defaultCookiePath(pathname: string): string {
  if (!pathname.startsWith("/") || pathname === "/") return "/";
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : pathname.slice(0, lastSlash);
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith("/") || requestPath.charAt(cookiePath.length) === "/";
}

function sameSiteValue(raw: string): MoodleSameSite | null {
  const value = raw.toLowerCase();
  if (value === "strict") return "Strict";
  if (value === "lax") return "Lax";
  if (value === "none") return "None";
  return null;
}

/** Handles a combined Set-Cookie header without splitting the comma in Expires. */
export function splitSetCookieHeader(header: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < header.length; index += 1) {
    if (header[index] !== ",") continue;
    const remainder = header.slice(index + 1);
    if (!/^\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+\s*=/.test(remainder)) continue;
    parts.push(header.slice(start, index).trim());
    start = index + 1;
  }
  const tail = header.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

export function responseSetCookies(headers: Headers): string[] {
  const extended = headers as Headers & { getSetCookie?: () => string[] };
  const values = extended.getSetCookie?.() ?? [];
  if (values.length > 0) return values;
  const combined = headers.get("set-cookie");
  return combined ? splitSetCookieHeader(combined) : [];
}

export class MoodleCookieJar {
  readonly #host: string;
  readonly #clock: MoodleCookieClock;
  readonly #cookies = new Map<string, MoodleCookie>();

  constructor(baseUrl: URL, initial: readonly MoodleCookie[] = [], clock: MoodleCookieClock = () => new Date()) {
    this.#host = baseUrl.hostname.toLowerCase();
    this.#clock = clock;
    for (const cookie of initial) this.#restore(cookie);
    this.#removeExpired();
  }

  static fromJSON(baseUrl: URL, cookies: readonly MoodleCookie[], clock?: MoodleCookieClock): MoodleCookieJar {
    return new MoodleCookieJar(baseUrl, cookies, clock);
  }

  updateFromResponse(requestUrl: URL, headers: Headers): void {
    if (requestUrl.hostname.toLowerCase() !== this.#host) return;
    for (const header of responseSetCookies(headers)) this.setFromHeader(header, requestUrl);
  }

  setFromHeader(header: string, requestUrl: URL): void {
    if (requestUrl.hostname.toLowerCase() !== this.#host) return;
    const segments = header.split(";");
    const first = segments.shift()?.trim() ?? "";
    const separator = first.indexOf("=");
    if (separator <= 0) return;

    const name = first.slice(0, separator).trim();
    const value = first.slice(separator + 1).trim();
    if (!COOKIE_NAME_PATTERN.test(name) || !COOKIE_VALUE_PATTERN.test(value)) return;

    let domain = this.#host;
    let path = defaultCookiePath(requestUrl.pathname);
    let expires: string | null = null;
    let maxAge: number | null = null;
    let secure = false;
    let httpOnly = false;
    let sameSite: MoodleSameSite | null = null;

    for (const rawAttribute of segments) {
      const attribute = rawAttribute.trim();
      const attributeSeparator = attribute.indexOf("=");
      const rawName = (attributeSeparator < 0 ? attribute : attribute.slice(0, attributeSeparator)).trim().toLowerCase();
      const rawValue = attributeSeparator < 0 ? "" : attribute.slice(attributeSeparator + 1).trim();

      if (rawName === "domain") {
        domain = normalizeCookieDomain(rawValue);
      } else if (rawName === "path" && rawValue.startsWith("/")) {
        path = rawValue;
      } else if (rawName === "expires") {
        const date = new Date(rawValue);
        if (!Number.isNaN(date.getTime())) expires = date.toISOString();
      } else if (rawName === "max-age" && /^-?\d+$/.test(rawValue)) {
        maxAge = Number(rawValue);
      } else if (rawName === "secure") {
        secure = true;
      } else if (rawName === "httponly") {
        httpOnly = true;
      } else if (rawName === "samesite") {
        sameSite = sameSiteValue(rawValue);
      }
    }

    // The Moodle adapter intentionally accepts only the configured exact host.
    if (domain !== this.#host || (sameSite === "None" && !secure)) return;
    const key = this.#key(name, domain, path);
    if (maxAge !== null) {
      if (maxAge <= 0) {
        this.#cookies.delete(key);
        return;
      }
      expires = new Date(this.#clock().getTime() + maxAge * 1_000).toISOString();
    }
    if (expires !== null && new Date(expires).getTime() <= this.#clock().getTime()) {
      this.#cookies.delete(key);
      return;
    }

    this.#cookies.set(key, { name, value, domain, path, expires, secure, httpOnly, sameSite });
  }

  headerFor(url: URL): string {
    if (url.hostname.toLowerCase() !== this.#host) return "";
    this.#removeExpired();
    return [...this.#cookies.values()]
      .filter((cookie) => (!cookie.secure || url.protocol === "https:") && pathMatches(url.pathname, cookie.path))
      .sort((left, right) => right.path.length - left.path.length || left.name.localeCompare(right.name))
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  }

  toJSON(): MoodleCookie[] {
    this.#removeExpired();
    return [...this.#cookies.values()]
      .sort((left, right) => left.domain.localeCompare(right.domain)
        || left.path.localeCompare(right.path)
        || left.name.localeCompare(right.name))
      .map((cookie) => ({ ...cookie }));
  }

  clear(): void {
    this.#cookies.clear();
  }

  #restore(cookie: MoodleCookie): void {
    if (
      !COOKIE_NAME_PATTERN.test(cookie.name)
      || !COOKIE_VALUE_PATTERN.test(cookie.value)
      || normalizeCookieDomain(cookie.domain) !== this.#host
      || !cookie.path.startsWith("/")
      || (cookie.expires !== null && Number.isNaN(new Date(cookie.expires).getTime()))
      || (cookie.sameSite === "None" && !cookie.secure)
    ) return;
    this.#cookies.set(this.#key(cookie.name, this.#host, cookie.path), {
      ...cookie,
      domain: this.#host,
      expires: cookie.expires === null ? null : new Date(cookie.expires).toISOString(),
    });
  }

  #removeExpired(): void {
    const now = this.#clock().getTime();
    for (const [key, cookie] of this.#cookies) {
      if (cookie.expires !== null && new Date(cookie.expires).getTime() <= now) this.#cookies.delete(key);
    }
  }

  #key(name: string, domain: string, path: string): string {
    return `${name}\u0000${domain}\u0000${path}`;
  }
}
