import { createHash } from "node:crypto";
import type { SecretariaAuthenticatedSession, SecretariaCredentials, SecretariaGateway } from "../domain/gateway";
import { SecretariaError } from "../domain/errors";
import type { SecretariaDataset, SecretariaProfile, SecretariaSession } from "../domain/models";

type DatasetContract = { stage: string; path: string; description: string; params?: Record<string, string> };

const enrollmentParams = {
  cdLectivoFilter: "null",
  periodoFilter: "null",
  anoCurricular: "null",
  estadoFilter: "null",
  disciplinaFilter: "null",
  group: JSON.stringify([{ property: "CD_LECTIVO", direction: "desc" }]),
  sort: JSON.stringify([{ property: "CD_LECTIVO", direction: "DESC" }]),
};

export const SECRETARIA_DATASETS: Record<string, DatasetContract> = {
  "academic.overview": { stage: "situacaodealuno", path: "/netpa/ajax/situacaodealuno/tabelaTotais", description: "Resumo académico e curricular" },
  "academic.history": { stage: "situacaodealuno", path: "/netpa/ajax/situacaodealuno/tabelaHistoricos", description: "Histórico curricular" },
  "academic.enrollments": { stage: "ConsultaNotasAluno", path: "/netpa/ajax/consultanotasaluno/inscricoes", description: "Inscrições e unidades curriculares", params: enrollmentParams },
  "academic.grades": { stage: "ConsultaNotasAluno", path: "/netpa/ajax/consultanotasaluno/inscricoes", description: "Notas oficiais", params: enrollmentParams },
  "academic.credits": { stage: "ConsultaNotasAluno", path: "/netpa/ajax/consultanotasaluno/listaTotaisECTS", description: "Totais de créditos" },
  "academic.progression": { stage: "situacaodealuno", path: "/netpa/ajax/situacaodealuno/tabelaRegrasPassagemAno", description: "Regras de progressão" },
  "academic.classes": { stage: "ListarAulasAluno", path: "/netpa/ajax/listaraulasaluno/aulas", description: "Aulas e sumários" },
  "academic.exams": { stage: "CalendarioExamesAluno", path: "/netpa/ajax/calendarioexamesaluno/exams", description: "Calendário de exames" },
  "academic.absences": { stage: "ConsultaFaltasAlunos", path: "/netpa/ajax/consultafaltasalunos/faltasAlunosPorDisciplina", description: "Faltas" },
  "academic.attendance": { stage: "ConsultaPresencasAlunos", path: "/netpa/ajax/consultapresencasalunos/presencasAlunos", description: "Presenças" },
  "finance.overview": { stage: "stepseleccionaritemsconta", path: "/netpa/ajax/stepseleccionaritemsconta/pagamentos", description: "Situação financeira" },
  "finance.charges": { stage: "stepseleccionaritemsconta", path: "/netpa/ajax/stepseleccionaritemsconta/pagamentos", description: "Cobranças" },
  "finance.references": { stage: "stepseleccionaritemsconta", path: "/netpa/ajax/stepseleccionaritemsconta/pagamentos", description: "Referências oficiais" },
  "finance.payments": { stage: "stepseleccionaritemsconta", path: "/netpa/ajax/stepseleccionaritemsconta/pagamentos", description: "Pagamentos registados" },
  "process.examRegistrations": { stage: "ConsultaInscricaoEpocas", path: "/netpa/ajax/consultainscricaoepocas/listaInscricoesEpocas", description: "Inscrições em épocas" },
  "process.gradeReviews": { stage: "ListaPedidosRevisaoNotasAluno", path: "/netpa/ajax/listapedidosrevisaonotasaluno/pedidosrevisao", description: "Pedidos de revisão" },
  "process.applications": { stage: "CandidaturasExistentes", path: "/netpa/ajax/candidaturasexistentes/historicoCandidaturas", description: "Candidaturas" },
  "process.advancedTraining": { stage: "MinhasFormacoesAvancadas", path: "/netpa/ajax/minhasformacoesavancadas/formacaoavancada", description: "Formações avançadas" },
  "process.internships": { stage: "MeusEstagios", path: "/netpa/ajax/meusestagios/estagios", description: "Estágios" },
  "process.activities": { stage: "AtividadesExtraCurricularesAluno", path: "/netpa/ajax/atividadesextracurricularesaluno/atividadesCurriculares", description: "Atividades extracurriculares" },
  "process.languages": { stage: "CompetenciasLinguisticasAluno", path: "/netpa/ajax/competenciaslinguisticasaluno/competenciaLinguistica", description: "Competências linguísticas" },
};

const USER_AGENT = "UOR-Estudante-Secretaria-Integration/1.0";

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inputValue(html: string, id: string): string | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const input = html.match(new RegExp(`<input[^>]+id=["']${escaped}["'][^>]*>`, "i"))?.[0];
  if (!input) return null;
  return decodeHtml(input.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "") || null;
}

function textById(html: string, id: string): string | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<[^>]+id=["']${escaped}["'][^>]*>([\\s\\S]*?)<\/[^>]+>`, "i"));
  return match ? decodeHtml(match[1]) || null : null;
}

function profileFromHtml(html: string): SecretariaProfile {
  const aluno = html.match(/<label[^>]*for=["']aluno["'][^>]*>[\s\S]*?<br[^>]*>\s*\[(\d+)\]\s*([^<]+)/i)
    ?? html.match(/\[(\d{5,})\]\s*([^<\r\n]{2,})/i);
  const studentNumber = aluno?.[1]?.trim() ?? "";
  const displayName = decodeHtml(aluno?.[2] ?? "") || inputValue(html, "nome") || inputValue(html, "nomeRO") || textById(html, "nomeAluno");
  const birth = inputValue(html, "dataNascimento");
  const birthMatch = birth?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return {
    studentNumber,
    displayName,
    email: inputValue(html, "email") || textById(html, "email"),
    course: inputValue(html, "curso") || inputValue(html, "cursoRO") || textById(html, "curso"),
    birthDate: birthMatch ? `${birthMatch[3]}-${birthMatch[2]}-${birthMatch[1]}` : null,
    nationality: inputValue(html, "nacionalidadeRO") || inputValue(html, "nacionalidade") || textById(html, "nacionalidadeRO"),
    phone: inputValue(html, "telefonePrincipal") || inputValue(html, "telemovel") || textById(html, "telefonePrincipal"),
  };
}

function authFailure(text: string) {
  const normalized = text.toLowerCase();
  return normalized.includes("notauthenticated")
    || normalized.includes("stage=loginstage")
    || normalized.includes("credenciais inválidas")
    || normalized.includes("credenciais invalidas")
    || normalized.includes("authentication failed")
    || /<form[^>]+name=["']login["']/i.test(text);
}

function cookieHeader(cookies: Record<string, string>) {
  return Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; ");
}

function mergeSetCookies(target: Record<string, string>, headers: Headers) {
  const values = typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
    ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : [headers.get("set-cookie") ?? ""].filter(Boolean);
  for (const value of values) {
    const first = value.split(";", 1)[0];
    const separator = first.indexOf("=");
    if (separator > 0) target[first.slice(0, separator).trim()] = first.slice(separator + 1).trim();
  }
}

function normalizeKey(key: string) {
  return key
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .replace(/_([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = normalizeKey(rawKey);
    if (!key || key === "id" || key === "rownum" || key.startsWith("__") || /(password|cookie|token|sess)/i.test(key)) continue;
    result[key] = normalizeValue(rawValue);
  }
  return result;
}

function unwrapPayload(payload: unknown): { items: Array<Record<string, unknown>>; total: number } {
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawItems = Array.isArray(payload)
    ? payload
    : ["result", "data", "rows", "items"].map((key) => object[key]).find(Array.isArray) ?? [];
  const items = rawItems
    .map((value) => normalizeValue(value))
    .filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value)));
  const total = typeof object.total === "number" ? object.total : items.length;
  return { items, total };
}

export class NetpaSecretariaGateway implements SecretariaGateway {
  readonly #baseUrl: URL;

  constructor(private readonly options: { baseUrl: string; timeoutMs: number; maxResponseBytes: number }) {
    this.#baseUrl = new URL(options.baseUrl);
  }

  async #request(path: string, init: RequestInit = {}): Promise<{ response: Response; text: string }> {
    const url = new URL(path, this.#baseUrl);
    if (url.origin !== this.#baseUrl.origin) throw new SecretariaError("SECRETARIA_UNSAFE_REDIRECT", "A Secretaria devolveu um destino não permitido.", 502);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
      const bytes = Buffer.from(await response.arrayBuffer());
      try {
        if (bytes.length > this.options.maxResponseBytes) throw new SecretariaError("SECRETARIA_RESPONSE_TOO_LARGE", "A resposta da Secretaria excede o limite permitido.", 502);
        return { response, text: bytes.toString("utf8") };
      } finally {
        bytes.fill(0);
      }
    } catch (error) {
      if (error instanceof SecretariaError) throw error;
      const timeoutFailure = error instanceof Error && error.name === "AbortError";
      throw new SecretariaError("SECRETARIA_UNAVAILABLE", timeoutFailure ? "A Secretaria excedeu o tempo limite." : "A Secretaria está temporariamente indisponível.", 503, true, "none", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  #headers(session?: SecretariaSession, json = false): Record<string, string> {
    return {
      "User-Agent": USER_AGENT,
      Accept: json ? "application/json,text/json,text/plain,*/*" : "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "pt-PT,pt;q=0.9",
      ...(json ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      ...(session ? { Cookie: cookieHeader(session.cookies) } : {}),
    };
  }

  async authenticate(credentials: SecretariaCredentials): Promise<SecretariaAuthenticatedSession> {
    const loginPath = "/netpa/page?stage=loginstage";
    const cookies: Record<string, string> = {};
    const initial = await this.#request(loginPath, { headers: this.#headers() });
    if (initial.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível iniciar a sessão da Secretaria.", 503, true);
    mergeSetCookies(cookies, initial.response.headers);

    const body = new URLSearchParams({
      _formsubmitstage: "loginstage",
      _formsubmitname: "login",
      _formfieldnames: "afterloginstageid,_user,_pass",
      afterloginstageid: "BoletimMatricula",
      _user: credentials.username,
      _pass: credentials.password,
      submitAction: "",
    });
    const login = await this.#request(loginPath, {
      method: "POST",
      headers: { ...this.#headers({ cookies, authenticatedAt: "" }), "Content-Type": "application/x-www-form-urlencoded", Referer: new URL(loginPath, this.#baseUrl).toString() },
      body: body.toString(),
    });
    mergeSetCookies(cookies, login.response.headers);
    if (login.response.status === 401 || authFailure(login.text)) {
      throw new SecretariaError("SECRETARIA_AUTH_FAILED", "As credenciais da Secretaria foram rejeitadas.", 401, false, "reauthenticate");
    }

    const location = login.response.headers.get("location");
    const target = location ? new URL(location, this.#baseUrl) : new URL("/netpa/page?stage=BoletimMatricula", this.#baseUrl);
    if (target.origin !== this.#baseUrl.origin) throw new SecretariaError("SECRETARIA_UNSAFE_REDIRECT", "A Secretaria devolveu um destino não permitido.", 502);
    const session: SecretariaSession = { cookies, authenticatedAt: new Date().toISOString() };
    const page = await this.#request(`${target.pathname}${target.search}`, { headers: this.#headers(session) });
    if (page.response.status >= 400 || authFailure(page.text)) throw new SecretariaError("SECRETARIA_AUTH_FAILED", "Não foi possível confirmar a sessão da Secretaria.", 401, false, "reauthenticate");
    const profile = profileFromHtml(page.text);
    if (!profile.studentNumber) {
      const fallback = await this.getProfile(session);
      const escapedUsername = credentials.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const exactIdentityMarker = new RegExp(`(?:\\[${escapedUsername}\\]|value=["']${escapedUsername}["'])`, "i");
      for (const stageName of ["PerfilHomeDisplay", "netpahome", "ConsultaNotasAluno"]) {
        if (fallback.studentNumber) break;
        const identityPage = await this.#request(`/netpa/page?stage=${stageName}`, { headers: this.#headers(session) });
        if (authFailure(identityPage.text)) continue;
        const identityProfile = profileFromHtml(identityPage.text);
        if (identityProfile.studentNumber) {
          fallback.studentNumber = identityProfile.studentNumber;
          fallback.displayName ??= identityProfile.displayName;
        } else if (exactIdentityMarker.test(identityPage.text)) {
          fallback.studentNumber = credentials.username;
        }
      }
      if (!fallback.studentNumber && exactIdentityMarker.test(page.text)) fallback.studentNumber = credentials.username;
      // Some netPA profiles do not render the academic number on any protected
      // page. In this provider `_user` is itself the account identifier; an
      // accepted login plus a separately validated protected session is the
      // fallback proof, while any rendered conflicting number is still rejected
      // by the application layer.
      if (!fallback.studentNumber && await this.validateSession(session)) fallback.studentNumber = credentials.username;
      if (!fallback.studentNumber) throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria não devolveu a identidade autenticada esperada.", 502, false, "contact_support");
      return { session, profile: fallback };
    }
    return { session, profile };
  }

  async validateSession(session: SecretariaSession): Promise<boolean> {
    const page = await this.#request("/netpa/page?stage=netpahome", { headers: this.#headers(session) });
    return page.response.status < 400 && !authFailure(page.text);
  }

  async getProfile(session: SecretariaSession): Promise<SecretariaProfile> {
    const page = await this.#request("/netpa/page?stage=BoletimMatricula", { headers: this.#headers(session) });
    if (authFailure(page.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (page.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível consultar o perfil da Secretaria.", 503, true);
    return profileFromHtml(page.text);
  }

  async getDataset(session: SecretariaSession, domain: string): Promise<SecretariaDataset> {
    const contract = SECRETARIA_DATASETS[domain];
    if (!contract) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "O conjunto de dados solicitado não existe.", 404);
    const stagePath = `/netpa/page?stage=${encodeURIComponent(contract.stage)}&submitaction=null`;
    const stage = await this.#request(stagePath, { headers: this.#headers(session) });
    if (authFailure(stage.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");

    const url = new URL(contract.path, this.#baseUrl);
    url.searchParams.set("_dc", String(Date.now()));
    url.searchParams.set("page", "1");
    url.searchParams.set("start", "0");
    url.searchParams.set("limit", "500");
    for (const [key, value] of Object.entries(contract.params ?? {})) url.searchParams.set(key, value);
    const result = await this.#request(`${url.pathname}${url.search}`, {
      headers: { ...this.#headers(session, true), Referer: new URL(stagePath, this.#baseUrl).toString() },
    });
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", `Não foi possível consultar ${contract.description}.`, 503, true);
    let payload: unknown;
    try {
      payload = JSON.parse(result.text);
    } catch (error) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", `A resposta de ${contract.description} não é compatível.`, 502, false, "contact_support", { cause: error });
    }
    const normalized = unwrapPayload(payload);
    return { domain, ...normalized, observedAt: new Date().toISOString(), coverage: "live" };
  }

  async logout(session: SecretariaSession): Promise<void> {
    await this.#request("/netpa/page?stage=logoutstage", { headers: this.#headers(session) }).catch(() => undefined);
  }

  static normalizedHash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
