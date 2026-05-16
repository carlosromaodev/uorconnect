import { Headers } from "undici";
import { type StudentProfile } from "../domain/student";
import { normalizeCourse, normalizeStudentName } from "../domain/student-format";

// Endpoints/stage usados pela secretaria (Boletim da Matrícula contém os dados do aluno).
// A etapa ConsultaNotasAluno é reaproveitada do protótipo apiUor para obter turma/contexto.
const BASE_URL = "http://secretaria.uor.edu.ao";
const LOGIN_URL = `${BASE_URL}/netpa/page?stage=loginstage`;
const TARGET_STAGE = "BoletimMatricula";
const SECRETARIA_FETCH_TIMEOUT_MS = Number(process.env.SECRETARIA_FETCH_TIMEOUT_MS ?? 25_000);

async function fetchSecretaria(input: string | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SECRETARIA_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`secretaria timeout after ${SECRETARIA_FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

type NormalizedRecord = Record<string, unknown>;

interface AcademicEnrollment {
  academicYear: string | null;
  period: string | null;
  curricularYear: string | null;
  subjectName: string | null;
  classCode: string | null;
  status: string | null;
}

export type SecretariaResult =
  | { success: true; profile: StudentProfile }
  | { success: false; reason: string };

function buildForm(studentNumber: string, password: string) {
  return new URLSearchParams({
    _formsubmitstage: "loginstage",
    _formsubmitname: "login",
    _formfieldnames: "afterloginstageid,_user,_pass",
    afterloginstageid: TARGET_STAGE,
    _user: studentNumber,
    _pass: password,
    submitAction: ""
  }).toString();
}

function extractCookieHeader(res: Response): string {
  const raw = (res.headers as unknown as Headers & { raw?: () => Record<string, string[]> }).raw?.();
  const setCookies = raw?.["set-cookie"] ?? [];
  if (setCookies.length === 0) {
    const single = res.headers.get("set-cookie");
    return single ? single.split(";")[0] : "";
  }
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(...cookieHeaders: string[]) {
  const parts = cookieHeaders
    .filter(Boolean)
    .flatMap((c) => c.split(";"))
    .map((s) => s.trim())
    .filter(Boolean);
  // dedup by name
  const map = new Map<string, string>();
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (!k || v === undefined) continue;
    map.set(k, v);
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function hasAuthFailureMarker(html: string) {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("notauthenticated")
    || normalized.includes("acesso negado")
    || normalized.includes("não tem acesso")
    || normalized.includes("nao tem acesso")
    || normalized.includes("credenciais inválidas")
    || normalized.includes("credenciais invalidas")
    || normalized.includes("utilizador inexistente")
    || (normalized.includes("autentica") && normalized.includes("falhada"))
    || normalized.includes("authentication failed")
  );
}

function hasLoginForm(html: string) {
  return /<form[^>]*name=["']login["']/i.test(html);
}

function hasProfilePageMarker(html: string) {
  const normalized = html.toLowerCase();

  if (
    normalized.includes("boletimmatricula")
    || normalized.includes("boletim de matricula")
    || normalized.includes("consulta de notas do aluno")
  ) {
    return true;
  }

  return (
    /id=["'](nome|nomeRO|curso|cursoRO|dataNascimento|nacionalidade|nacionalidadeRO|telefonePrincipal|telemovel)["']/i
      .test(html)
    || /for=["']aluno["']/i.test(html)
  );
}

async function fetchWithCookies(url: string, cookie: string) {
  // Requisição GET preservando cookies capturados no login manual que o site espera
  return fetchSecretaria(url, {
    method: "GET",
    headers: {
      Cookie: cookie,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      Referer: LOGIN_URL
    },
    redirect: "manual"
  });
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = stripAccents(text).toLowerCase();
  if (!text || normalized === "-" || normalized === "null" || normalized === "undefined" || normalized === "nbsp") {
    return null;
  }
  return text;
}

function normalizeFieldName(key: string): string {
  const cleaned = stripAccents(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const parts = cleaned.split("_").filter(Boolean);
  if (parts.length === 0) return key;
  return parts[0] + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

function normalizeRecord(record: unknown): NormalizedRecord {
  if (!record || typeof record !== "object") return {};
  const normalized: NormalizedRecord = {};
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (key.startsWith("__") || key === "id" || key === "ROWNUM") continue;
    normalized[normalizeFieldName(key)] = value;
  }
  return normalized;
}

function unwrapResult(rawData: unknown): unknown[] {
  if (Array.isArray(rawData)) return rawData;
  if (!rawData || typeof rawData !== "object") return [];
  const raw = rawData as Record<string, unknown>;
  for (const key of ["result", "data", "rows", "items"]) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }
  return [];
}

function read(record: NormalizedRecord, aliases: string[]): unknown {
  for (const alias of aliases) {
    const value = record[normalizeFieldName(alias)];
    if (cleanString(value) !== null || typeof value === "number" || typeof value === "boolean") return value;
  }
  return undefined;
}

function readString(record: NormalizedRecord, aliases: string[]): string | null {
  return cleanString(read(record, aliases));
}

function pickTableLayout(record: NormalizedRecord): Record<string, string> | null {
  const layouts = [
    {
      period: "col3",
      curricularYear: "col4",
      subject: "col5",
      classCode: "col6",
      status: "col8",
    },
    {
      period: "col4",
      curricularYear: "col5",
      subject: "col6",
      classCode: "col7",
      status: "col9",
    },
  ];

  for (const layout of layouts) {
    const subject = cleanString(record[layout.subject]);
    const status = cleanString(record[layout.status]);
    const period = cleanString(record[layout.period]);
    if (subject && (subject.includes("]") || status || period)) return layout;
  }

  return null;
}

function parseSubjectName(value: unknown): string | null {
  const subject = cleanString(value);
  if (!subject) return null;
  const bracketMatch = subject.match(/^\[[^\]]+\]\s*(.+)$/);
  return cleanString(bracketMatch?.[1]) ?? subject;
}

function mapConsultaNotasInscricoes(rawData: unknown): AcademicEnrollment[] {
  return unwrapResult(rawData)
    .map((rawItem) => {
      const record = normalizeRecord(rawItem);
      const tableLayout = pickTableLayout(record);
      const subjectValue = tableLayout
        ? record[tableLayout.subject]
        : read(record, [
          "disciplinaCalcField",
          "dsDiscip",
          "paginaUCCalcField",
          "disciplina",
          "nomeDisciplina",
          "dsDisciplina",
          "unidadeCurricular",
          "col5",
        ]);

      return {
        academicYear: readString(record, [
          "anoLectivoCalcField",
          "anoLectivo",
          "anoLetivo",
          "dsLectivo",
          "cdLectivo",
          "lectivo",
          "year",
          "col0",
        ]),
        period: tableLayout
          ? cleanString(record[tableLayout.period])
          : readString(record, ["dsDuracao", "periodo", "semestre", "dsPeriodo", "periodoFilter", "cdDuracao"]),
        curricularYear: tableLayout
          ? cleanString(record[tableLayout.curricularYear])
          : readString(record, ["CD_A_S_CUR", "cdASCur", "anoCurricular", "anoCur", "curricularYear", "yearCurricular"]),
        subjectName: readString(record, [
          "dsDiscip",
          "paginaUCCalcField",
          "disciplinaCalcField",
          "nomeDisciplina",
          "dsDisciplina",
          "disciplinaNome",
          "unidadeCurricular",
        ]) ?? parseSubjectName(subjectValue),
        classCode: tableLayout
          ? cleanString(record[tableLayout.classCode])
          : readString(record, ["turmasCalcField", "turma", "cdTurma", "codigoTurma", "nomeTurma", "dsTurma", "classCode"]),
        status: tableLayout
          ? cleanString(record[tableLayout.status])
          : readString(record, ["estadoCalcField", "estado", "estadoInscricao", "situacao", "status", "dsEstado", "estadoFilter"]),
      };
    })
    .filter((item) => Boolean(item.subjectName || item.classCode));
}

function uniqueSorted(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

function statusContains(status: string | null, text: string): boolean {
  return stripAccents(status ?? "").toLowerCase().includes(stripAccents(text).toLowerCase());
}

function academicYearScore(value: string | null): number {
  const text = value ?? "";
  const match = text.match(/20\d{2}/);
  if (match) return Number(match[0]);
  const compact = text.match(/^(\d{4})\d{2}$/);
  return compact ? Number(compact[1]) : 0;
}

function resolveCurrentAcademicYear(enrollments: AcademicEnrollment[]): string | null {
  const activeYears = uniqueSorted(enrollments
    .filter((item) => statusContains(item.status, "Inscrito"))
    .map((item) => item.academicYear));
  if (activeYears.length > 0) {
    return activeYears.sort((a, b) => academicYearScore(b) - academicYearScore(a))[0];
  }

  const years = uniqueSorted(enrollments.map((item) => item.academicYear));
  return years.sort((a, b) => academicYearScore(b) - academicYearScore(a))[0] ?? null;
}

function mostFrequent(values: Array<string | null>): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

function hasAjaxAuthFailure(data: unknown): boolean {
  const text = typeof data === "string" ? data.toLowerCase() : "";
  return text.includes("stage=loginstage")
    || text.includes("notauthenticated")
    || text.includes("autenticação")
    || text.includes("autenticacao")
    || text.includes("não tem acesso")
    || text.includes("nao tem acesso");
}

async function fetchJsonWithCookies(path: string, cookie: string, params: Record<string, string | number>) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetchSecretaria(url, {
    method: "GET",
    headers: {
      Cookie: cookie,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/json, application/json, text/plain, */*",
      Referer: `${BASE_URL}/netpa/page?stage=ConsultaNotasAluno`
    },
    redirect: "manual"
  });

  const text = await response.text();
  if (response.status >= 400 || hasAjaxAuthFailure(text)) {
    throw new Error(`consulta-notas status ${response.status}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function extractAcademicContext(cookieHeader: string): Promise<Partial<StudentProfile>> {
  const stageResponse = await fetchWithCookies(`${BASE_URL}/netpa/page?stage=ConsultaNotasAluno&submitaction=null`, cookieHeader);
  const stageHtml = await stageResponse.text();
  if (stageResponse.status >= 400 || hasAuthFailureMarker(stageHtml)) return {};

  const inscricoes = await fetchJsonWithCookies("/netpa/ajax/consultanotasaluno/inscricoes", cookieHeader, {
    _dc: Date.now(),
    limit: 200,
    page: 1,
    start: 0,
    cdLectivoFilter: "null",
    periodoFilter: "null",
    anoCurricular: "null",
    estadoFilter: "null",
    disciplinaFilter: "null",
    group: JSON.stringify([{ property: "CD_LECTIVO", direction: "desc" }]),
    sort: JSON.stringify([{ property: "CD_LECTIVO", direction: "DESC" }])
  });

  const enrollments = mapConsultaNotasInscricoes(inscricoes);
  const academicYear = resolveCurrentAcademicYear(enrollments);
  const currentEnrollments = enrollments.filter((item) => {
    if (academicYear && item.academicYear !== academicYear) return false;
    return statusContains(item.status, "Inscrito") || Boolean(item.classCode);
  });
  const usableEnrollments = currentEnrollments.length > 0 ? currentEnrollments : enrollments;

  return {
    classCode: mostFrequent(usableEnrollments.map((item) => item.classCode)),
    academicYear: academicYear ?? mostFrequent(usableEnrollments.map((item) => item.academicYear)),
    academicPeriod: mostFrequent(usableEnrollments.map((item) => item.period)),
    curricularYear: mostFrequent(usableEnrollments.map((item) => item.curricularYear)),
    academicSyncedAt: new Date()
  };
}

export async function loginSecretaria(studentNumber: string, password: string): Promise<SecretariaResult> {
  try {
    // 1) GET inicial para obter cookies de sessão
    const initResp = await fetchSecretaria(LOGIN_URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        Referer: LOGIN_URL
      },
      redirect: "manual"
    });
    if (initResp.status >= 400) {
      return { success: false, reason: `step:init status ${initResp.status}` };
    }

    const baseCookie = extractCookieHeader(initResp);
    if (!baseCookie) {
      return { success: false, reason: "step:init missing cookie" };
    }

    const loginResp = await fetchSecretaria(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        Referer: LOGIN_URL,
        Cookie: baseCookie
      },
      body: buildForm(studentNumber, password),
      redirect: "manual"
    });

    const loginBody = await loginResp.text();
    const unauthorized = loginResp.status === 401 || hasAuthFailureMarker(loginBody);
    const cookieHeader = mergeCookies(baseCookie, extractCookieHeader(loginResp));
    const location = loginResp.headers.get("location") || "";

    // Qualquer Location válido é um redirecionamento potencial de sessão
    const hasRedirect = location.trim().length > 0;
    const status200NoRedirect = loginResp.status === 200 && !hasRedirect;
    if (unauthorized) {
      return {
        success: false,
        reason: `step:login invalid credentials status ${loginResp.status} redirect:${location || "none"}`
      };
    }

    if (!hasRedirect && !status200NoRedirect) {
      return {
        success: false,
        reason: `step:login status ${loginResp.status} redirect:${location || "none"} cookie:${!!cookieHeader}`
      };
    }

    const directTargetUrl = `${LOGIN_URL.replace("loginstage", TARGET_STAGE)}`;
    const candidateUrls = Array.from(
      new Set(
        [
          hasRedirect ? new URL(location, LOGIN_URL).toString() : "",
          directTargetUrl,
        ].filter(Boolean)
      )
    );

    let lastFollowReason = "step:follow no candidate succeeded";
    let hasAuthenticatedSessionHint = false;

    for (const candidateUrl of candidateUrls) {
      const followResp = await fetchWithCookies(candidateUrl, cookieHeader);
      const followBody = await followResp.text();

      const followUnauthorized =
        followResp.status === 401 ||
        hasAuthFailureMarker(followBody);

      if (followUnauthorized || followResp.status >= 400) {
        lastFollowReason = `step:follow status ${followResp.status} unauthorized:${followUnauthorized} url:${candidateUrl}`;
        continue;
      }

      if (hasProfilePageMarker(followBody)) {
        const profile = extractProfile(followBody);
        const academicContext = await extractAcademicContext(cookieHeader).catch(() => ({}));
        return { success: true, profile: { ...profile, ...academicContext } };
      }

      if (hasRedirect && !hasLoginForm(followBody)) {
        hasAuthenticatedSessionHint = true;
      }

      lastFollowReason = `step:follow missing target content url:${candidateUrl}`;
    }

    if (hasAuthenticatedSessionHint) {
      // Login aparentemente válido, mas sem página de perfil estável.
      // Mantemos o acesso e sincronizamos o perfil numa próxima sessão bem-sucedida.
      const academicContext = await extractAcademicContext(cookieHeader).catch(() => ({}));
      return { success: true, profile: academicContext };
    }

    return { success: false, reason: lastFollowReason };
  } catch (err) {
    return { success: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

function extractValueByInputId(html: string, id: string): string | undefined {
  const regex = new RegExp(`<input[^>]*id=[\"']${id}[\"'][^>]*value=[\"']([^\"']*)[\"']`, "i");
  const match = regex.exec(html);
  return match?.[1]?.trim() || undefined;
}

function extractTextById(html: string, id: string): string | undefined {
  const regex = new RegExp(`<[^>]*id=[\"']${id}[\"'][^>]*>([^<]*)<`, "i");
  const match = regex.exec(html);
  return match?.[1]?.trim() || undefined;
}

function extractAlunoBlock(html: string): { number?: string; name?: string } {
  const regex = /<label[^>]*for=["']aluno["'][^>]*>\s*Aluno:\s*<\/label>\s*<br[^>]*>\s*\[(\d+)\]\s*([^<]+)/i;
  const match = regex.exec(html);
  if (!match) return {};
  return { number: match[1], name: match[2]?.trim() };
}

function extractTextAfterLabel(html: string, label: string): string | undefined {
  // Captura conteúdo logo após o label informado, até a próxima tag
  const regex = new RegExp(`${label}\\s*:<\\/label>\\s*<br[^>]*>\\s*([^<]+)`, "i");
  const match = regex.exec(html);
  return match?.[1]?.trim() || undefined;
}

function extractAltByImgId(html: string, imgId: string): string | undefined {
  const regex = new RegExp(`<img[^>]*id=[\"']${imgId}[\"'][^>]*alt=[\"']([^\"']+)[\"']`, "i");
  const match = regex.exec(html);
  return match?.[1]?.trim() || undefined;
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  const parts = normalized.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!parts) return undefined;
  const [, dd, mm, yyyy] = parts;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return isNaN(date.getTime()) ? undefined : date;
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((v) => v && v.trim().length > 0)?.trim();
}

function extractProfile(html: string): StudentProfile {
  const alunoBlock = extractAlunoBlock(html);

  const name = normalizeStudentName(
    firstDefined(
      alunoBlock.name,
      extractValueByInputId(html, "nome"),
      extractValueByInputId(html, "nomeRO"),
      extractTextById(html, "nomeAluno"),
      extractTextById(html, "studentName"),
      extractAltByImgId(html, "photo") // alt traz "[num] Nome"
    )
  );

  const email = firstDefined(
    extractValueByInputId(html, "email"),
    extractTextById(html, "email")
  );

  const course = normalizeCourse(
    firstDefined(
      extractValueByInputId(html, "curso"),
      extractValueByInputId(html, "cursoRO"),
      extractTextById(html, "curso"),
      extractTextById(html, "cursoRO"),
      extractTextAfterLabel(html, "Curso")
    )
  );

  const birthDate = parseDate(extractValueByInputId(html, "dataNascimento"));

  const nationality = firstDefined(
    extractValueByInputId(html, "nacionalidadeRO"),
    extractTextById(html, "nacionalidadeRO"),
    extractValueByInputId(html, "nacionalidade"),
    extractTextById(html, "nacionalidade")
  );

  const phone = firstDefined(
    extractValueByInputId(html, "telefonePrincipal"),
    extractValueByInputId(html, "telemovel"),
    extractTextById(html, "telefonePrincipal"),
    extractTextById(html, "telemovel")
  );

  return {
    studentNumber: alunoBlock.number,
    name,
    email,
    course,
    birthDate,
    nationality,
    phone
  };
}
