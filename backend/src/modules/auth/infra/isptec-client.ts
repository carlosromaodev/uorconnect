import { Headers } from "undici";
import { type StudentProfile } from "../domain/student";
import { normalizeStudentName } from "../domain/student-format";

const ISPTEC_LOGIN_URL =
  process.env.ISPTEC_LOGIN_URL ??
  "https://portal.isptec.co.ao/projetos/nucleo/uteis/login.php?&tid=0&lid=0&pid=24&arq_ret=R5QT1WSRQBMCVQVPFFQSF99MCT5RT44Q9WRW0RBM0FMM5QQ4R4CV59RWRF1F5SWCW0";
const ISPTEC_GROUP_SELECT_URL =
  process.env.ISPTEC_GROUP_SELECT_URL ??
  "https://portal.isptec.co.ao/projetos/nucleo/uteis/grupo_selecionar.php?&tid=0&lid=0&pid=24&arq_ret=R5QT1WSRQBMCVQVPFFQSF99MCT5RT44Q9WRW0RBM0FMM5QQ4R4CV59RWRF1F5SWCW0&arq_ret_natural=&tid=0&lid=0&pid=24";
const ISPTEC_PORTAL_HOME_URL =
  process.env.ISPTEC_PORTAL_HOME_URL ??
  "https://portal.isptec.co.ao/projetos/portal_online/index.php?&tid=0&lid=0&pid=24";
const ISPTEC_FETCH_TIMEOUT_MS = Number(process.env.ISPTEC_FETCH_TIMEOUT_MS ?? 25_000);

export type IsptecResult =
  | { success: true; profile: StudentProfile }
  | { success: false; reason: string };

type IsptecPage = {
  status: number;
  url: string;
  body: string;
  cookieHeader: string;
  location: string;
};

async function fetchIsptec(input: string | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ISPTEC_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`isptec timeout after ${ISPTEC_FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractCookieHeader(res: Response): string {
  const getSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (getSetCookie.length > 0) {
    return getSetCookie.map((cookie) => cookie.split(";")[0]).join("; ");
  }

  const raw = (res.headers as unknown as Headers & { raw?: () => Record<string, string[]> }).raw?.();
  const setCookies = raw?.["set-cookie"] ?? [];
  if (setCookies.length === 0) {
    const single = res.headers.get("set-cookie");
    return single ? single.split(";")[0] : "";
  }
  return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function mergeCookies(...cookieHeaders: string[]) {
  const parts = cookieHeaders
    .filter(Boolean)
    .flatMap((cookie) => cookie.split(";"))
    .map((part) => part.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || value === undefined) continue;
    map.set(key, value);
  }
  return Array.from(map.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function readResponseText(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const charset = contentType.match(/charset=([^;]+)/i)?.[1]?.trim().replace(/^["']|["']$/g, "") || "utf-8";
  const buffer = await response.arrayBuffer();

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú");
}

function cleanText(value?: string | null): string | undefined {
  if (!value) return undefined;
  const text = decodeHtml(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = stripAccents(text).toLowerCase();
  if (!text || normalized === "-" || normalized === "null" || normalized === "undefined") {
    return undefined;
  }
  return text;
}

function stripTags(value: string) {
  return cleanText(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)?.trim();
}

function containsIsptecUiNoise(value: string) {
  const normalized = stripAccents(value).toLowerCase();
  return [
    "dados complementares",
    "senha para acesso",
    "senha atual",
    "nova senha",
    "confirme nova senha",
    "cancelar salvar",
    "login senha",
  ].some((marker) => normalized.includes(marker));
}

function cleanProfileField(value?: string | null, maxLength = 160) {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned.length > maxLength || containsIsptecUiNoise(cleaned)) {
    return undefined;
  }
  return cleaned;
}

function normalizeIsptecCourse(value?: string | null) {
  const cleaned = cleanProfileField(value);
  if (!cleaned) return undefined;
  const normalized = stripAccents(cleaned).toLowerCase();
  if (normalized === "isptec" || normalized === "academico") return undefined;
  return cleaned
    ?.replace(/^curso\s+de\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIsptecEmail(value?: string | null) {
  const cleaned = cleanText(value);
  const match = cleaned?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return match?.toLowerCase();
}

function normalizeIsptecPhone(value?: string | null) {
  const cleaned = cleanProfileField(value, 80);
  if (!cleaned) return undefined;
  const normalized = stripAccents(cleaned).toLowerCase();
  if (normalized.includes("sem telefone") || normalized.includes("sem telemovel")) {
    return undefined;
  }
  const match = cleaned.match(/(?:\+?244[\s.-]*)?9\d{2}[\s.-]*\d{3}[\s.-]*\d{3}/);
  if (!match) return undefined;
  const compact = match[0].replace(/[\s.-]/g, "");
  return compact.startsWith("244") ? `+${compact}` : compact;
}

function normalizeIsptecClassCode(value?: string | null) {
  const cleaned = cleanProfileField(value, 60)?.replace(/^turma\s*:?\s*/i, "");
  if (!cleaned) return undefined;
  const match = cleaned.match(/\b[A-Z]{2,}[A-Z0-9]*\d+[A-Z0-9_]*\b/i);
  return match?.[0].toUpperCase();
}

function readIsptecYearPeriod(value?: string | null) {
  const cleaned = cleanProfileField(value, 80);
  if (!cleaned) return {};

  const compactMatch = cleaned.match(/^\s*(\d{4})([12])\s*$/);
  if (compactMatch) {
    return { academicYear: compactMatch[1], academicPeriod: compactMatch[2] };
  }

  const separatedMatch = cleaned.match(/\b(\d{4})\s*(?:[\/.\-·]|ano\s*lectivo|ano\s*letivo)?\s*([12])?\b/i);
  if (!separatedMatch) return {};
  return {
    academicYear: separatedMatch[1],
    academicPeriod: separatedMatch[2],
  };
}

function normalizeIsptecCurricularYear(value?: string | null) {
  const cleaned = cleanProfileField(value, 40);
  if (!cleaned || /\b\d{4}\b/.test(cleaned)) return undefined;
  const match = cleaned.match(/\b([1-7])(?:[ºoaª])?(?:\s*ano)?\b/i);
  return match?.[1];
}

function readAttributes(tag: string) {
  const attrs = new Map<string, string>();
  const attrRegex = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(attrRegex)) {
    attrs.set(match[1].toLowerCase(), decodeHtml(match[3]));
  }
  return attrs;
}

function readFormHtml(html: string) {
  return html.match(/<form[\s\S]*?<\/form>/i)?.[0] ?? "";
}

function readFormAction(html: string, currentUrl: string) {
  const formMatch = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
  const action = formMatch?.[1]?.trim();
  return action ? new URL(action, currentUrl).toString() : currentUrl;
}

export function buildIsptecLoginForm(studentNumber: string, password: string) {
  return new URLSearchParams({
    codigo: studentNumber,
    senha: password,
    acao: "efetuar_login",
    cd_coligada_matriz: "",
    url_navegador: "",
  }).toString();
}

export function resolveIsptecFormAction(html: string, currentUrl = ISPTEC_LOGIN_URL) {
  return readFormAction(html, currentUrl);
}

export function resolveIsptecStudentGroupSelection(html: string, currentUrl = ISPTEC_GROUP_SELECT_URL) {
  if (!/name=["']cd_grupo["']/i.test(html) || !/define_grupo/i.test(html)) {
    return null;
  }

  const formHtml = readFormHtml(html);
  const formSource = formHtml || html;
  const optionMatches = Array.from(formSource.matchAll(/<option\b[^>]*value=["']?([^"'>\s]*)["']?[^>]*>([\s\S]*?)<\/option>/gi));
  const options = optionMatches
    .map((match) => ({
      value: cleanText(match[1]),
      text: stripTags(match[2]) ?? "",
    }))
    .filter((option) => option.value);
  const studentGroup = options.find((option) => stripAccents(option.text).toLowerCase().includes("estudante")) ?? options[0];
  if (!studentGroup.value) return null;

  const body = new URLSearchParams();
  const fieldMatches = formSource.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi);
  for (const match of fieldMatches) {
    const attrs = readAttributes(match[0]);
    const name = attrs.get("name");
    if (!name) continue;
    const type = attrs.get("type")?.toLowerCase();
    if (type === "submit" && name !== "btn-entrar") continue;
    body.set(name, attrs.get("value") ?? "");
  }

  body.set("acao", body.get("acao") || "define_grupo");
  body.set("cd_grupo", studentGroup.value);
  body.set("btn-entrar", body.get("btn-entrar") || "Entrar");

  return {
    url: readFormAction(formSource, currentUrl),
    body,
  };
}

export function resolveIsptecPersonalDataUrl(html: string, currentUrl = ISPTEC_PORTAL_HOME_URL) {
  const goUrlMatches = Array.from(html.matchAll(/goUrl\('([^']+)'\)/g));
  const personalPath = goUrlMatches
    .map((match) => match[1])
    .find((path) => path.includes("pessoas_cadastro") || path.includes("dados_pessoa"));

  return personalPath ? new URL(personalPath, currentUrl).toString() : null;
}

export function resolveIsptecAcademicContextUrl(html: string, currentUrl = ISPTEC_PORTAL_HOME_URL) {
  const goUrlMatches = Array.from(html.matchAll(/goUrl\('([^']+)'\)/g));
  const academicPath = goUrlMatches
    .map((match) => match[1])
    .find((path) => path.includes("notas_frequencias") || path.includes("diario_classes"));

  return academicPath ? new URL(academicPath, currentUrl).toString() : null;
}

export function extractIsptecAcademicContext(html: string): Pick<StudentProfile, "course" | "classCode" | "academicYear" | "academicPeriod"> {
  const text = stripTags(html) ?? "";
  const currentMatch = text.match(/(\d{4})\/([12])\s*-\s*Curso\s+de\s+(.+?)\s*-\s*([A-Z0-9_]+)\b/i);
  if (currentMatch) {
    return {
      academicYear: currentMatch[1],
      academicPeriod: currentMatch[2],
      course: normalizeIsptecCourse(currentMatch[3]),
      classCode: cleanText(currentMatch[4]),
    };
  }

  const historyMatch = text.match(/Hist[oó]rico\s*-\s*(.+?)\((\d{4})\/([12])\)/i);
  return {
    course: normalizeIsptecCourse(historyMatch?.[1]),
    academicYear: cleanText(historyMatch?.[2]),
    academicPeriod: cleanText(historyMatch?.[3]),
  };
}

function hasLoginForm(html: string) {
  return /name=["']codigo["']/i.test(html) && /name=["']senha["']/i.test(html);
}

function hasAuthFailureMarker(html: string) {
  const normalized = stripAccents(html).toLowerCase();
  return (
    normalized.includes("credenciais invalidas")
    || normalized.includes("usuario ou senha")
    || normalized.includes("utilizador ou senha")
    || normalized.includes("senha invalida")
    || normalized.includes("acesso negado")
    || normalized.includes("efetuar_login") && hasLoginForm(html)
  );
}

function hasAuthenticatedMarker(html: string) {
  const normalized = stripAccents(html).toLowerCase();
  return (
    normalized.includes("portal_online")
    || normalized.includes("dados pessoais")
    || normalized.includes("boletim")
    || normalized.includes("matricula")
    || normalized.includes("grupo_selecionar")
  );
}

function readInputValue(html: string, idOrName: string) {
  const tagRegex = /<(?:input|select|textarea)\b[^>]*>/gi;
  const normalizedTarget = idOrName.toLowerCase();

  for (const match of html.matchAll(tagRegex)) {
    const attrs = readAttributes(match[0]);
    const id = attrs.get("id")?.toLowerCase();
    const name = attrs.get("name")?.toLowerCase();
    if (id !== normalizedTarget && name !== normalizedTarget) continue;
    return cleanText(attrs.get("value"));
  }

  return undefined;
}

function readByLabel(html: string, labels: string[]) {
  const text = stripTags(html);
  if (!text) return undefined;

  for (const label of labels) {
    const labelPattern = stripAccents(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const normalizedText = stripAccents(text);
    const regex = new RegExp(`(?:^|\\s)${labelPattern}\\s*:?\\s+(.+?)(?=\\s+(?:Numero|Nº|N\\.º|Nome|Curso|E-mail|Email|Telefone|Telemovel|Nacionalidade|Data de nascimento|Nascimento|Turma|Ano)\\s*:?|$)`, "i");
    const match = regex.exec(normalizedText);
    if (!match?.[1]) continue;
    const originalStart = match.index + match[0].length - match[1].length;
    const originalValue = text.slice(originalStart, originalStart + match[1].length);
    const cleaned = cleanText(originalValue);
    if (cleaned) return cleaned;
  }

  return undefined;
}

function readEmail(html: string) {
  return normalizeIsptecEmail(html);
}

function readPhone(html: string) {
  return normalizeIsptecPhone(firstDefined(
    readByLabel(html, ["Telefone", "Telemóvel", "Telemovel", "Contacto", "Contato"]),
    stripTags(html)?.match(/(?:\+244\s*)?9\d{2}\s*\d{3}\s*\d{3}/)?.[0],
  ));
}

function readVisibleLines(html: string) {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|td|th|section|h[1-6]|label)>/gi, "\n")
    .replace(/<\s*(?:p|div|li|tr|td|th|section|h[1-6]|label)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(withBreaks)
    .split(/\n+/)
    .map((line) => cleanProfileField(line))
    .filter((line): line is string => Boolean(line));
}

function looksLikeIsptecCourse(value: string) {
  const normalized = stripAccents(value).toLowerCase();
  return /\b(engenharia|arquitectura|arquitetura|gestao|gestão|informatica|informática|comunicacoes|comunicações|electrotecnica|eletrotecnica|ciencias|ciências)\b/.test(normalized)
    && !normalized.includes("turma")
    && normalized !== "academico"
    && normalized !== "pessoal";
}

function readIsptecSummary(html: string) {
  const lines = readVisibleLines(html);
  const course = lines.map(normalizeIsptecCourse).find((line) => line && looksLikeIsptecCourse(line));
  const classCode = lines.map(normalizeIsptecClassCode).find(Boolean);
  const yearPeriod = lines.map(readIsptecYearPeriod).find((item) => item.academicYear) ?? {};
  const nationality = lines.find((line) => /^angolan[ao]$/i.test(stripAccents(line)));
  const birthDateText = lines
    .map((line) => line.match(/nascimento\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i)?.[1])
    .find(Boolean);

  return {
    course,
    classCode,
    academicYear: yearPeriod.academicYear,
    academicPeriod: yearPeriod.academicPeriod,
    nationality,
    birthDate: parseDate(birthDateText),
  };
}

export function extractIsptecProfile(html: string, _studentNumber: string): StudentProfile {
  const summary = readIsptecSummary(html);
  const name = normalizeStudentName(firstDefined(
    cleanProfileField(readInputValue(html, "nm_pessoa")),
    cleanProfileField(readInputValue(html, "nome")),
    cleanProfileField(readInputValue(html, "nome_aluno")),
    cleanProfileField(readInputValue(html, "ds_login")),
    cleanProfileField(readByLabel(html, ["Nome completo", "Nome"])),
  ));
  const course = normalizeIsptecCourse(firstDefined(
    readInputValue(html, "ds_curso_origem"),
    readInputValue(html, "curso"),
    readByLabel(html, ["Curso", "Curso do estudante"]),
    summary.course,
  ));
  const email = firstDefined(
    normalizeIsptecEmail(readInputValue(html, "ds_contato_04")),
    normalizeIsptecEmail(readInputValue(html, "email")),
    normalizeIsptecEmail(readByLabel(html, ["E-mail", "Email"])),
    readEmail(html),
  );
  const nationality = firstDefined(
    cleanProfileField(readInputValue(html, "ds_nacionalidade")),
    cleanProfileField(readInputValue(html, "nacionalidade")),
    cleanProfileField(readByLabel(html, ["Nacionalidade"])),
    cleanProfileField(summary.nationality),
  );
  const birthDate = parseDate(firstDefined(
    readInputValue(html, "dt_nascimento"),
    readInputValue(html, "data_nascimento"),
    readInputValue(html, "dataNascimento"),
    readByLabel(html, ["Data de nascimento", "Nascimento"]),
  )) ?? summary.birthDate;
  const phone = firstDefined(
    normalizeIsptecPhone(readInputValue(html, "ds_contato_03")),
    normalizeIsptecPhone(readInputValue(html, "telemovel")),
    normalizeIsptecPhone(readInputValue(html, "telemóvel")),
    readPhone(html),
  );
  const alternatePhone = firstDefined(
    normalizeIsptecPhone(readInputValue(html, "ds_contato_01")),
    normalizeIsptecPhone(readInputValue(html, "ds_contato_02")),
  );
  const yearPeriod = readIsptecYearPeriod(firstDefined(
    readInputValue(html, "nr_anosemestre_origem"),
    readByLabel(html, ["Ano letivo", "Ano lectivo"]),
    summary.academicYear && summary.academicPeriod ? `${summary.academicYear}/${summary.academicPeriod}` : summary.academicYear,
  ));

  return {
    name,
    email,
    course,
    birthDate,
    nationality,
    phone,
    alternatePhone: alternatePhone && alternatePhone !== phone ? alternatePhone : undefined,
    university: "ISPTEC",
    academicSyncedAt: new Date(),
    classCode: firstDefined(
      normalizeIsptecClassCode(readInputValue(html, "ds_turma_origem")),
      normalizeIsptecClassCode(readByLabel(html, ["Turma"])),
      normalizeIsptecClassCode(readInputValue(html, "turma")),
      summary.classCode,
    ),
    academicYear: yearPeriod.academicYear ?? summary.academicYear,
    academicPeriod: yearPeriod.academicPeriod ?? summary.academicPeriod,
    curricularYear: firstDefined(
      normalizeIsptecCurricularYear(readByLabel(html, ["Ano curricular", "Ano do curso"])),
      normalizeIsptecCurricularYear(readInputValue(html, "ano")),
    ),
  };
}

async function fetchHtmlWithCookies(url: string, cookie: string, referer: string): Promise<IsptecPage> {
  const response = await fetchIsptec(url, {
    method: "GET",
    headers: {
      Cookie: cookie,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      Referer: referer,
    },
    redirect: "manual",
  });
  const body = await readResponseText(response);
  return {
    status: response.status,
    url,
    body,
    cookieHeader: mergeCookies(cookie, extractCookieHeader(response)),
    location: response.headers.get("location") || "",
  };
}

async function postHtmlWithCookies(url: string, cookie: string, referer: string, body: URLSearchParams | string): Promise<IsptecPage> {
  const response = await fetchIsptec(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      Referer: referer,
    },
    body: body.toString(),
    redirect: "manual",
  });
  const responseBody = await readResponseText(response);
  return {
    status: response.status,
    url,
    body: responseBody,
    cookieHeader: mergeCookies(cookie, extractCookieHeader(response)),
    location: response.headers.get("location") || "",
  };
}

async function followIsptecRedirects(startUrl: string, cookie: string, referer: string, maxRedirects = 8): Promise<IsptecPage> {
  let currentUrl = startUrl;
  let currentCookie = cookie;
  let currentReferer = referer;
  let page: IsptecPage | null = null;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    page = await fetchHtmlWithCookies(currentUrl, currentCookie, currentReferer);
    currentCookie = page.cookieHeader;
    if (!page.location || page.status < 300 || page.status >= 400) {
      return page;
    }
    currentReferer = currentUrl;
    currentUrl = new URL(page.location, currentUrl).toString();
  }

  return page ?? {
    status: 0,
    url: startUrl,
    body: "",
    cookieHeader: cookie,
    location: "",
  };
}

async function tryLoadProfile(candidateUrl: string, cookie: string, referer: string, studentNumber: string) {
  let page = await followIsptecRedirects(candidateUrl, cookie, referer);

  if (page.status >= 400 || hasAuthFailureMarker(page.body)) {
    return { success: false as const, cookieHeader: page.cookieHeader, reason: `step:follow status ${page.status} url:${page.url}` };
  }

  const groupSelection = resolveIsptecStudentGroupSelection(page.body, page.url);
  if (groupSelection) {
    const groupPost = await postHtmlWithCookies(groupSelection.url, page.cookieHeader, page.url, groupSelection.body);
    page = groupPost.location
      ? await followIsptecRedirects(new URL(groupPost.location, groupSelection.url).toString(), groupPost.cookieHeader, groupSelection.url)
      : groupPost;
  }

  const portalPage = page;
  let profileBody = page.body;
  let cookieHeader = page.cookieHeader;
  const personalDataUrl = resolveIsptecPersonalDataUrl(page.body, page.url);
  if (personalDataUrl) {
    const personalPage = await followIsptecRedirects(personalDataUrl, page.cookieHeader, page.url);
    if (personalPage.status < 400 && !hasAuthFailureMarker(personalPage.body)) {
      profileBody = personalPage.body;
      cookieHeader = personalPage.cookieHeader;
    }
  }

  const academicContextUrl = resolveIsptecAcademicContextUrl(portalPage.body, portalPage.url);
  const academicPage = academicContextUrl
    ? await followIsptecRedirects(academicContextUrl, cookieHeader, portalPage.url).catch(() => null)
    : null;
  const academicContext = academicPage && academicPage.status < 400 && !hasAuthFailureMarker(academicPage.body)
    ? extractIsptecAcademicContext(academicPage.body)
    : {};
  cookieHeader = academicPage?.cookieHeader ?? cookieHeader;

  if ((hasAuthenticatedMarker(profileBody) || profileBody.includes("nm_pessoa") || Object.keys(academicContext).length > 0) && !hasLoginForm(profileBody)) {
    const profile = extractIsptecProfile(profileBody, studentNumber);
    for (const [key, value] of Object.entries(academicContext)) {
      if (value) {
        (profile as Record<string, unknown>)[key] = value;
      }
    }

    return {
      success: true as const,
      cookieHeader,
      profile,
      html: profileBody,
    };
  }

  return { success: false as const, cookieHeader, reason: `step:follow missing target content url:${page.url}` };
}

export async function loginIsptecPortal(studentNumber: string, password: string): Promise<IsptecResult> {
  try {
    const initResp = await fetchIsptec(ISPTEC_LOGIN_URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      },
      redirect: "manual",
    });
    const initBody = await readResponseText(initResp);
    if (initResp.status >= 400) {
      return { success: false, reason: `step:init status ${initResp.status}` };
    }

    const baseCookie = extractCookieHeader(initResp);
    const loginUrl = resolveIsptecFormAction(initBody, ISPTEC_LOGIN_URL);

    const loginResp = await fetchIsptec(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        Referer: ISPTEC_LOGIN_URL,
        ...(baseCookie ? { Cookie: baseCookie } : {}),
      },
      body: buildIsptecLoginForm(studentNumber, password),
      redirect: "manual",
    });
    const loginBody = await readResponseText(loginResp);
    const cookieHeader = mergeCookies(baseCookie, extractCookieHeader(loginResp));
    const location = loginResp.headers.get("location") || "";

    if (loginResp.status === 401 || hasAuthFailureMarker(loginBody)) {
      return {
        success: false,
        reason: `step:login invalid credentials status ${loginResp.status}`,
      };
    }
    if (loginResp.status >= 400) {
      return { success: false, reason: `step:login status ${loginResp.status}` };
    }

    const candidateUrls = Array.from(new Set([
      location ? new URL(location, loginUrl).toString() : "",
      ISPTEC_GROUP_SELECT_URL,
      ISPTEC_PORTAL_HOME_URL,
    ].filter(Boolean)));

    let currentCookie = cookieHeader;
    let lastReason = "step:follow no candidate succeeded";
    for (const candidateUrl of candidateUrls) {
      const profileResult = await tryLoadProfile(candidateUrl, currentCookie, loginUrl, studentNumber);
      currentCookie = profileResult.cookieHeader;
      if (profileResult.success) {
        if (profileResult.profile.name || profileResult.profile.course || profileResult.profile.email) {
          return { success: true, profile: profileResult.profile };
        }
      } else {
        lastReason = profileResult.reason;
      }
    }

    const portalResult = await tryLoadProfile(ISPTEC_PORTAL_HOME_URL, currentCookie, ISPTEC_GROUP_SELECT_URL, studentNumber);
    if (portalResult.success) {
      return { success: true, profile: portalResult.profile };
    }

    return { success: false, reason: portalResult.reason ?? lastReason };
  } catch (error) {
    return { success: false, reason: error instanceof Error ? error.message : "Unknown error" };
  }
}
