import type {
  MoodleGateway,
  MoodleGatewayAuthenticatedSession,
  MoodleGatewayCourse,
  MoodleGatewayCourseList,
  MoodleGatewayCourseContent,
  MoodleGatewayCredentials,
  MoodleGatewayProfile,
  MoodleGatewaySession,
  MoodleGatewaySessionValidation,
  MoodleGatewayStreamLocator,
  MoodleGatewayStreamRequest,
  MoodleGatewayStreamResult,
} from "../domain/gateway";
import { MoodleGatewayFailure } from "../domain/gateway";
import { MoodleCookieJar } from "./moodle-cookie-jar";
import {
  canonicalPluginFilePath,
  extractMoodleSesskey,
  extractPluginFilePath,
  hasMoodleAuthenticationFailure,
  isMoodleLoginPage,
  parseMoodleCourseAjaxResponse,
  parseMoodleCourseFormatAjaxResponse,
  parseMoodleCourseHtml,
  parseMoodleCoursesHtml,
  parseMoodleLoginForm,
  parseMoodleProfile,
} from "./moodle-html.parser";

export type MoodleHttpFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type WebSessionMoodleGatewayOptions = {
  baseUrl: string | URL;
  fetch?: MoodleHttpFetch;
  timeoutMs?: number;
  maxTextResponseBytes?: number;
  maxDownloadBytes?: number;
  downloadStreamTimeoutMs?: number;
  sessionIdleTtlMs?: number;
  authenticationBudgetMs?: number;
  now?: () => Date;
};

type AdapterResponse = { response: Response; url: URL; deadlineAt: number };

const NUMERIC_KEY = /^\d+$/;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_TEXT_LIMIT = 5 * 1024 * 1024;
const DEFAULT_DOWNLOAD_LIMIT = 100 * 1024 * 1024;
const DEFAULT_DOWNLOAD_STREAM_TIMEOUT_MS = 60_000;
const DEFAULT_SESSION_TTL_MS = 30 * 60_000;
const DEFAULT_AUTHENTICATION_BUDGET_MS = 60_000;
const AJAX_PAGE_SIZE = 100;
const MAX_AJAX_PAGES = 20;

const PASSIVE_MIME_BY_EXTENSION: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  mp3: ["audio/mpeg"],
  mp4: ["video/mp4"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};

function safeInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function responseLength(response: Response): number | null {
  const value = response.headers.get("content-length");
  if (value === null || !/^\d+$/.test(value)) return null;
  return safeInteger(value);
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function isJsonContentType(value: string): boolean {
  return /(?:^|\/)json(?:;|$)|\+json(?:;|$)/i.test(value);
}

function isHtmlContentType(value: string): boolean {
  return /text\/html|application\/xhtml\+xml/i.test(value);
}

function allowedPath(pathname: string): boolean {
  return pathname === "/"
    || pathname === "/home"
    || pathname === "/home/"
    || pathname === "/my"
    || pathname === "/my/"
    || pathname === "/my/courses.php"
    || pathname === "/login/index.php"
    || pathname === "/login/logout.php"
    || pathname === "/user/profile.php"
    || pathname === "/course/view.php"
    || pathname === "/lib/ajax/service.php"
    || pathname === "/mod/resource/view.php"
    || pathname.startsWith("/pluginfile.php/");
}

function sessionCookieExpiry(cookies: MoodleGatewaySession["cookies"]): number | null {
  // A short-lived preference cookie must not make the MoodleSession look expired.
  const sessionCookies = cookies.filter((cookie) => cookie.name.toLowerCase() === "moodlesession");
  const expiries = sessionCookies
    .map((cookie) => cookie.expires === null ? null : new Date(cookie.expires).getTime())
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return expiries.length > 0 ? Math.min(...expiries) : null;
}

function sanitizeFilename(value: string): string {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 180);
  return sanitized || "material";
}

function contentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const encoded = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^['"]|['"]$/g, ""));
    } catch {
      return null;
    }
  }
  return header.match(/filename\s*=\s*"([^"]+)"/i)?.[1]
    ?? header.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim()
    ?? null;
}

function fileNameFromUrl(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).at(-1) ?? "material";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function validatePassiveFile(contentTypeHeader: string | null, rawFilename: string): {
  contentType: string;
  filename: string;
} {
  const contentType = (contentTypeHeader ?? "").split(";", 1)[0].trim().toLowerCase();
  const filename = sanitizeFilename(rawFilename);
  const extension = filename.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase() ?? "";
  const allowedMimeTypes = PASSIVE_MIME_BY_EXTENSION[extension];
  if (!allowedMimeTypes?.includes(contentType)) {
    throw new MoodleGatewayFailure("MOODLE_MATERIAL_UNSUPPORTED");
  }
  return { contentType, filename };
}

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (timeoutMs <= 0) throw new MoodleGatewayFailure("MOODLE_UNAVAILABLE");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new MoodleGatewayFailure("MOODLE_UNAVAILABLE")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function limitedStream(
  body: ReadableStream<Uint8Array>,
  maximumBytes: number,
  idleTimeoutMs: number,
  maximumDurationMs: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let received = 0;
  const deadlineAt = Date.now() + maximumDurationMs;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await readStreamChunk(
          reader,
          Math.min(idleTimeoutMs, deadlineAt - Date.now()),
        );
        if (result.done) {
          controller.close();
          return;
        }
        received += result.value.byteLength;
        if (received > maximumBytes) {
          await reader.cancel();
          controller.error(new MoodleGatewayFailure("MOODLE_RESPONSE_TOO_LARGE"));
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        await reader.cancel(error).catch(() => undefined);
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

export class WebSessionMoodleGateway implements MoodleGateway {
  readonly #baseUrl: URL;
  readonly #fetch: MoodleHttpFetch;
  readonly #timeoutMs: number;
  readonly #maxTextResponseBytes: number;
  readonly #maxDownloadBytes: number;
  readonly #downloadStreamTimeoutMs: number;
  readonly #sessionIdleTtlMs: number;
  readonly #authenticationBudgetMs: number;
  readonly #now: () => Date;

  constructor(options: WebSessionMoodleGatewayOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (
      baseUrl.protocol !== "https:"
      || baseUrl.username
      || baseUrl.password
      || baseUrl.search
      || baseUrl.hash
    ) throw new MoodleGatewayFailure("MOODLE_CONFIGURATION_INVALID");
    baseUrl.pathname = "/";
    this.#baseUrl = baseUrl;
    this.#fetch = options.fetch ?? fetch;
    this.#timeoutMs = this.#positiveOption(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    this.#maxTextResponseBytes = this.#positiveOption(options.maxTextResponseBytes, DEFAULT_TEXT_LIMIT);
    this.#maxDownloadBytes = this.#positiveOption(options.maxDownloadBytes, DEFAULT_DOWNLOAD_LIMIT);
    this.#downloadStreamTimeoutMs = this.#positiveOption(
      options.downloadStreamTimeoutMs,
      DEFAULT_DOWNLOAD_STREAM_TIMEOUT_MS,
    );
    this.#sessionIdleTtlMs = this.#positiveOption(options.sessionIdleTtlMs, DEFAULT_SESSION_TTL_MS);
    this.#authenticationBudgetMs = this.#positiveOption(
      options.authenticationBudgetMs,
      DEFAULT_AUTHENTICATION_BUDGET_MS,
    );
    this.#now = options.now ?? (() => new Date());
  }

  async authenticate(credentials: MoodleGatewayCredentials): Promise<MoodleGatewayAuthenticatedSession> {
    const operation = new AbortController();
    const timeout = setTimeout(() => operation.abort(), this.#authenticationBudgetMs);
    try {
      return await this.#authenticateWithinBudget(credentials, operation.signal);
    } catch (error) {
      if (operation.signal.aborted && !(error instanceof MoodleGatewayFailure)) {
        throw new MoodleGatewayFailure("MOODLE_UNAVAILABLE", { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async #authenticateWithinBudget(
    credentials: MoodleGatewayCredentials,
    operationSignal: AbortSignal,
  ): Promise<MoodleGatewayAuthenticatedSession> {
    if (
      !credentials.username.trim()
      || !credentials.password
      || credentials.username.length > 160
      || credentials.password.length > 1_024
    ) throw new MoodleGatewayFailure("MOODLE_AUTH_FAILED");

    const jar = new MoodleCookieJar(this.#baseUrl, [], this.#now);
    const entry = await this.#request("/login/index.php", { method: "GET" }, jar, 5, operationSignal);
    const entryHtml = await this.#readHtml(entry);
    const form = parseMoodleLoginForm(entryHtml);
    if (!form) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    const action = this.#sameOriginUrl(form.action, entry.url);
    if (action.pathname !== "/login/index.php") throw new MoodleGatewayFailure("MOODLE_UNSAFE_REDIRECT");

    const body = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
      ...(form.loginToken ? { logintoken: form.loginToken } : {}),
    });
    let authenticated = await this.#request(action, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }, jar, 5, operationSignal);
    let authenticatedHtml = await this.#readHtml(authenticated);
    if (hasMoodleAuthenticationFailure(authenticatedHtml) || isMoodleLoginPage(authenticatedHtml, authenticated.url.pathname)) {
      throw new MoodleGatewayFailure("MOODLE_AUTH_FAILED");
    }

    if (!this.#looksAuthenticated(authenticatedHtml)) {
      authenticated = await this.#request("/my/", { method: "GET" }, jar, 5, operationSignal);
      authenticatedHtml = await this.#readHtml(authenticated);
      if (hasMoodleAuthenticationFailure(authenticatedHtml)
        || isMoodleLoginPage(authenticatedHtml, authenticated.url.pathname)
        || !this.#looksAuthenticated(authenticatedHtml)) {
        throw new MoodleGatewayFailure("MOODLE_AUTH_FAILED");
      }
    }

    const sesskey = extractMoodleSesskey(authenticatedHtml);
    const profileResponse = await this.#request("/user/profile.php", { method: "GET" }, jar, 5, operationSignal);
    const profileHtml = await this.#readProtectedHtml(profileResponse);
    const profile = parseMoodleProfile(profileHtml);
    const cookies = jar.toJSON();
    if (cookies.length === 0) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    const now = this.#now();
    const cookieExpiry = sessionCookieExpiry(cookies);
    const expiresAt = new Date(Math.min(
      now.getTime() + this.#sessionIdleTtlMs,
      cookieExpiry ?? Number.POSITIVE_INFINITY,
    )).toISOString();

    return {
      profile,
      session: {
        cookies,
        sesskey: sesskey ?? extractMoodleSesskey(profileHtml),
        authenticatedAt: now.toISOString(),
        expiresAt,
      },
    };
  }

  async validateSession(session: MoodleGatewaySession): Promise<MoodleGatewaySessionValidation> {
    const jar = this.#sessionJar(session);
    const response = await this.#request("/my/", { method: "GET" }, jar);
    const html = await this.#readHtml(response);
    if (isMoodleLoginPage(html, response.url.pathname) || !this.#looksAuthenticated(html)) {
      return { valid: false, reason: "expired" };
    }
    this.#refreshSession(session, jar, html);
    return { valid: true, session, profile: null };
  }

  async getProfile(session: MoodleGatewaySession): Promise<MoodleGatewayProfile> {
    const jar = this.#sessionJar(session);
    const response = await this.#request("/user/profile.php", { method: "GET" }, jar);
    const html = await this.#readProtectedHtml(response);
    this.#refreshSession(session, jar, html);
    return parseMoodleProfile(html);
  }

  async listCourses(session: MoodleGatewaySession): Promise<MoodleGatewayCourseList> {
    const jar = this.#sessionJar(session);
    if (session.sesskey) {
      try {
        const courses = await this.#listCoursesAjax(session.sesskey, jar);
        this.#refreshSession(session, jar);
        return courses;
      } catch (error) {
        if (error instanceof MoodleGatewayFailure && error.code === "MOODLE_SESSION_EXPIRED") throw error;
        if (!(error instanceof MoodleGatewayFailure) || error.code !== "MOODLE_UPSTREAM_CHANGED") throw error;
      }
    }

    const response = await this.#request("/my/courses.php", { method: "GET" }, jar);
    const html = await this.#readProtectedHtml(response);
    this.#refreshSession(session, jar, html);
    return {
      courses: parseMoodleCoursesHtml(html),
      complete: false,
      source: "html",
    };
  }

  async getCourse(session: MoodleGatewaySession, courseExternalKey: string): Promise<MoodleGatewayCourse> {
    return (await this.getCourseContent(session, courseExternalKey)).course;
  }

  async getCourseContent(
    session: MoodleGatewaySession,
    courseExternalKey: string,
  ): Promise<MoodleGatewayCourseContent> {
    this.#assertNumericKey(courseExternalKey);
    const jar = this.#sessionJar(session);
    const response = await this.#request(`/course/view.php?id=${courseExternalKey}`, { method: "GET" }, jar);
    const html = await this.#readProtectedHtml(response);
    const fallback = parseMoodleCourseHtml(html, courseExternalKey);

    if (session.sesskey) {
      try {
        const state = await this.#callAjax(
          "core_courseformat_get_state",
          { courseid: Number(courseExternalKey) },
          session.sesskey,
          jar,
        );
        const structured = parseMoodleCourseFormatAjaxResponse(state, courseExternalKey);
        if (structured) {
          this.#refreshSession(session, jar, html);
          return { course: fallback.course, ...structured, source: "ajax" };
        }
      } catch (error) {
        if (error instanceof MoodleGatewayFailure && error.code === "MOODLE_SESSION_EXPIRED") throw error;
        if (!(error instanceof MoodleGatewayFailure) || error.code !== "MOODLE_UPSTREAM_CHANGED") throw error;
      }
    }
    this.#refreshSession(session, jar, html);
    return { ...fallback, complete: false, source: "html" };
  }

  async logout(session: MoodleGatewaySession): Promise<void> {
    const jar = this.#sessionJar(session);
    try {
      if (session.sesskey) {
        await this.#request(`/login/logout.php?sesskey=${encodeURIComponent(session.sesskey)}`, { method: "GET" }, jar, 3);
      }
    } catch {
      // Upstream logout is best effort; local deletion is authoritative.
    } finally {
      jar.clear();
      session.cookies = [];
      session.sesskey = null;
      session.expiresAt = null;
    }
  }

  async openStream(
    session: MoodleGatewaySession,
    locator: MoodleGatewayStreamLocator,
    request: MoodleGatewayStreamRequest = {},
  ): Promise<MoodleGatewayStreamResult> {
    const range = request.range;
    if (range !== undefined && !/^bytes=(?:\d+-\d*|\d*-\d+)$/.test(range)) {
      throw new MoodleGatewayFailure("MOODLE_MATERIAL_UNSUPPORTED");
    }
    const jar = this.#sessionJar(session);
    let path: string;
    if (locator.kind === "course-module") {
      if (locator.moduleType !== "resource") throw new MoodleGatewayFailure("MOODLE_MATERIAL_UNSUPPORTED");
      this.#assertNumericKey(locator.courseModuleKey);
      path = `/mod/resource/view.php?id=${locator.courseModuleKey}`;
    } else {
      const canonical = canonicalPluginFilePath(locator.path, this.#baseUrl);
      if (!canonical || canonical !== locator.path) throw new MoodleGatewayFailure("MOODLE_MATERIAL_UNSUPPORTED");
      path = canonical;
    }

    const headers = range ? { range } : undefined;
    let upstream = await this.#request(path, { method: "GET", headers }, jar, 3);
    let contentType = upstream.response.headers.get("content-type") ?? "";
    if (isHtmlContentType(contentType)) {
      const html = await this.#readProtectedHtml(upstream);
      const pluginPath = extractPluginFilePath(html, this.#baseUrl);
      if (!pluginPath) throw new MoodleGatewayFailure("MOODLE_MATERIAL_UNSUPPORTED");
      upstream = await this.#request(pluginPath, { method: "GET", headers }, jar, 3);
      contentType = upstream.response.headers.get("content-type") ?? "";
    }
    if (upstream.response.status !== 200 && upstream.response.status !== 206) {
      this.#throwForStatus(upstream.response.status);
      throw new MoodleGatewayFailure("MOODLE_MATERIAL_UNSUPPORTED");
    }
    const contentLength = responseLength(upstream.response);
    if (contentLength !== null && contentLength > this.#maxDownloadBytes) {
      throw new MoodleGatewayFailure("MOODLE_RESPONSE_TOO_LARGE");
    }
    const contentRange = upstream.response.headers.get("content-range");
    if (upstream.response.status === 206 && !contentRange) {
      throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    }
    const rawFilename = contentDispositionFilename(upstream.response.headers.get("content-disposition"))
      ?? fileNameFromUrl(upstream.url);
    const safeFile = validatePassiveFile(contentType, rawFilename);
    if (!upstream.response.body) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    this.#refreshSession(session, jar);
    return {
      body: limitedStream(
        upstream.response.body,
        this.#maxDownloadBytes,
        this.#timeoutMs,
        this.#downloadStreamTimeoutMs,
      ),
      status: upstream.response.status as 200 | 206,
      contentType: safeFile.contentType,
      contentLength,
      contentRange,
      filename: safeFile.filename,
    };
  }

  async #listCoursesAjax(sesskey: string, jar: MoodleCookieJar): Promise<MoodleGatewayCourseList> {
    const courses = new Map<string, MoodleGatewayCourse>();
    let offset = 0;
    let complete = false;
    for (let page = 0; page < MAX_AJAX_PAGES; page += 1) {
      const raw = await this.#callAjax(
        "core_course_get_enrolled_courses_by_timeline_classification",
        {
          offset,
          limit: AJAX_PAGE_SIZE,
          classification: "all",
          sort: "fullname",
          customfieldname: "",
          customfieldvalue: "",
          requiredfields: [
            "id", "fullname", "shortname", "coursecategory", "summary", "startdate", "enddate",
            "hasprogress", "progress", "visible", "hidden", "isfavourite",
          ],
        },
        sesskey,
        jar,
      );
      const parsed = parseMoodleCourseAjaxResponse(raw);
      for (const course of parsed.courses) courses.set(course.externalKey, course);
      if (parsed.nextOffset === null || parsed.nextOffset <= offset || parsed.courses.length === 0) {
        complete = true;
        break;
      }
      offset = parsed.nextOffset;
    }
    return { courses: [...courses.values()], complete, source: "ajax" };
  }

  async #callAjax(
    methodName: string,
    args: Record<string, unknown>,
    sesskey: string,
    jar: MoodleCookieJar,
  ): Promise<unknown> {
    if (!/^[A-Za-z0-9_-]{4,128}$/.test(sesskey)) throw new MoodleGatewayFailure("MOODLE_SESSION_EXPIRED");
    if (!/^core_[a-z0-9_]+$/.test(methodName)) throw new MoodleGatewayFailure("MOODLE_CONFIGURATION_INVALID");
    const path = `/lib/ajax/service.php?sesskey=${encodeURIComponent(sesskey)}&info=${encodeURIComponent(methodName)}`;
    const adapterResponse = await this.#request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ index: 0, methodname: methodName, args }]),
    }, jar);
    const contentType = adapterResponse.response.headers.get("content-type") ?? "";
    if (isHtmlContentType(contentType)) {
      const html = await this.#readHtml(adapterResponse);
      if (isMoodleLoginPage(html, adapterResponse.url.pathname)) {
        throw new MoodleGatewayFailure("MOODLE_SESSION_EXPIRED");
      }
      throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    }
    if (!isJsonContentType(contentType)) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    const text = await this.#readText(adapterResponse, this.#maxTextResponseBytes);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED", { cause: error });
    }
  }

  async #request(
    input: string | URL,
    init: RequestInit,
    jar: MoodleCookieJar,
    maxRedirects = 5,
    operationSignal?: AbortSignal,
  ): Promise<AdapterResponse> {
    let url = input instanceof URL ? this.#sameOriginUrl(input, this.#baseUrl) : this.#sameOriginUrl(input, this.#baseUrl);
    let method = (init.method ?? "GET").toUpperCase();
    let body = init.body;
    let headers = new Headers(init.headers);

    for (let redirects = 0; ; redirects += 1) {
      if (!allowedPath(url.pathname)) throw new MoodleGatewayFailure("MOODLE_UNSAFE_REDIRECT");
      const cookie = jar.headerFor(url);
      if (cookie) headers.set("cookie", cookie);
      else headers.delete("cookie");
      headers.set("accept-language", "pt-PT,pt;q=0.9,en;q=0.7");
      headers.set("user-agent", "UORConnect-Moodle-Integration/1.0");

      if (operationSignal?.aborted) throw new MoodleGatewayFailure("MOODLE_UNAVAILABLE");
      const controller = new AbortController();
      const deadlineAt = Date.now() + this.#timeoutMs;
      const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
      let response: Response;
      try {
        response = await this.#fetch(url, {
          method,
          body,
          headers,
          redirect: "manual",
          signal: operationSignal
            ? AbortSignal.any([controller.signal, operationSignal])
            : controller.signal,
        });
      } catch (error) {
        if (error instanceof MoodleGatewayFailure) throw error;
        throw new MoodleGatewayFailure("MOODLE_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timeout);
      }
      jar.updateFromResponse(url, response.headers);

      if (!isRedirect(response.status)) {
        this.#throwForStatus(response.status);
        return { response, url, deadlineAt };
      }
      if (redirects >= maxRedirects) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
      const location = response.headers.get("location");
      if (!location) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
      await response.body?.cancel().catch(() => undefined);
      url = this.#sameOriginUrl(location, url);

      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
        headers = new Headers(headers);
        headers.delete("content-type");
        headers.delete("content-length");
      }
    }
  }

  #sameOriginUrl(input: string | URL, relativeTo: URL): URL {
    let url: URL;
    try {
      url = input instanceof URL ? new URL(input.href) : new URL(input, relativeTo);
    } catch (error) {
      throw new MoodleGatewayFailure("MOODLE_UNSAFE_REDIRECT", { cause: error });
    }
    if (url.protocol !== "https:" || url.origin !== this.#baseUrl.origin || url.username || url.password || url.hash) {
      throw new MoodleGatewayFailure("MOODLE_UNSAFE_REDIRECT");
    }
    return url;
  }

  async #readHtml(adapterResponse: AdapterResponse): Promise<string> {
    const contentType = adapterResponse.response.headers.get("content-type") ?? "";
    if (!isHtmlContentType(contentType)) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    return this.#readText(adapterResponse, this.#maxTextResponseBytes);
  }

  async #readProtectedHtml(adapterResponse: AdapterResponse): Promise<string> {
    const html = await this.#readHtml(adapterResponse);
    if (isMoodleLoginPage(html, adapterResponse.url.pathname)) {
      throw new MoodleGatewayFailure("MOODLE_SESSION_EXPIRED");
    }
    return html;
  }

  async #readText(adapterResponse: AdapterResponse, maximumBytes: number): Promise<string> {
    const { response } = adapterResponse;
    const declaredLength = responseLength(response);
    if (declaredLength !== null && declaredLength > maximumBytes) {
      throw new MoodleGatewayFailure("MOODLE_RESPONSE_TOO_LARGE");
    }
    if (!response.body) return "";
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let received = 0;
    let buffer: Buffer | null = null;
    try {
      while (true) {
        const remaining = adapterResponse.deadlineAt - Date.now();
        const result = await readStreamChunk(reader, remaining);
        if (result.done) break;
        const chunk = Buffer.from(result.value);
        received += chunk.byteLength;
        if (received > maximumBytes) {
          chunk.fill(0);
          await reader.cancel().catch(() => undefined);
          throw new MoodleGatewayFailure("MOODLE_RESPONSE_TOO_LARGE");
        }
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks, received);
      const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1]?.trim() ?? "utf-8";
      try {
        return new TextDecoder(charset).decode(buffer);
      } catch {
        return new TextDecoder("utf-8").decode(buffer);
      }
    } finally {
      for (const chunk of chunks) chunk.fill(0);
      buffer?.fill(0);
      reader.releaseLock();
    }
  }

  #looksAuthenticated(html: string): boolean {
    return extractMoodleSesskey(html) !== null
      || /\/login\/logout\.php/i.test(html)
      || /\bdata-region\s*=\s*["']user-menu["']/i.test(html);
  }

  #sessionJar(session: MoodleGatewaySession): MoodleCookieJar {
    return MoodleCookieJar.fromJSON(this.#baseUrl, session.cookies, this.#now);
  }

  #refreshSession(session: MoodleGatewaySession, jar: MoodleCookieJar, html?: string): void {
    session.cookies = jar.toJSON();
    session.sesskey = (html ? extractMoodleSesskey(html) : null) ?? session.sesskey;
    const now = this.#now().getTime();
    const expiry = sessionCookieExpiry(session.cookies);
    session.expiresAt = new Date(Math.min(now + this.#sessionIdleTtlMs, expiry ?? Number.POSITIVE_INFINITY)).toISOString();
  }

  #throwForStatus(status: number): void {
    if (status >= 500 || status === 408 || status === 429) {
      throw new MoodleGatewayFailure("MOODLE_UNAVAILABLE");
    }
    if (status === 401) throw new MoodleGatewayFailure("MOODLE_SESSION_EXPIRED");
    if (status === 403) throw new MoodleGatewayFailure("MOODLE_PERMISSION_DENIED");
    if (status === 404) throw new MoodleGatewayFailure("MOODLE_RESOURCE_NOT_FOUND");
    if (status < 200 || status >= 400) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
  }

  #assertNumericKey(value: string): void {
    if (!NUMERIC_KEY.test(value)) throw new MoodleGatewayFailure("MOODLE_RESOURCE_NOT_FOUND");
  }

  #positiveOption(value: number | undefined, fallback: number): number {
    const selected = value ?? fallback;
    if (!Number.isSafeInteger(selected) || selected <= 0) {
      throw new MoodleGatewayFailure("MOODLE_CONFIGURATION_INVALID");
    }
    return selected;
  }
}
