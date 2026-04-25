import { Headers } from "undici";
import { type StudentProfile } from "../domain/student";
import { normalizeCourse, normalizeStudentName } from "../domain/student-format";

// Endpoints/stage usados pela secretaria (Boletim da Matrícula contém os dados do aluno)
const LOGIN_URL = "http://secretaria.uor.edu.ao/netpa/page?stage=loginstage";
const TARGET_STAGE = "BoletimMatricula";

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
  return fetch(url, {
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

export async function loginSecretaria(studentNumber: string, password: string): Promise<SecretariaResult> {
  try {
    // 1) GET inicial para obter cookies de sessão
    const initResp = await fetch(LOGIN_URL, {
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

    const loginResp = await fetch(LOGIN_URL, {
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
        // Extrai campos principais do HTML da secretaria
        const profile = extractProfile(followBody);
        return { success: true, profile };
      }

      if (hasRedirect && !hasLoginForm(followBody)) {
        hasAuthenticatedSessionHint = true;
      }

      lastFollowReason = `step:follow missing target content url:${candidateUrl}`;
    }

    if (hasAuthenticatedSessionHint) {
      // Login aparentemente válido, mas sem página de perfil estável.
      // Mantemos o acesso e sincronizamos o perfil numa próxima sessão bem-sucedida.
      return { success: true, profile: {} };
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
    name,
    email,
    course,
    birthDate,
    nationality,
    phone
  };
}
