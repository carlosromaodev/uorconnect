import { createHash } from "node:crypto";
import type { SecretariaAuthenticatedSession, SecretariaCredentials, SecretariaGateway } from "../domain/gateway";
import { SecretariaError } from "../domain/errors";
import type {
  SecretariaAddress,
  SecretariaContactDetails,
  SecretariaContactDetailsPatch,
  SecretariaCommandResult,
  SecretariaDataset,
  SecretariaDocument,
  SecretariaExamRegistrationCancellation,
  SecretariaGradeReviewSubmission,
  SecretariaPaymentReferenceResult,
  SecretariaPaymentSelection,
  SecretariaPhoto,
  SecretariaProfile,
  SecretariaReceiptDetail,
  SecretariaSession,
} from "../domain/models";

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
  "finance.tuition": { stage: "DIFTasks", path: "/netpa/DIFTasks?_PR_=1&_AP_=9&_MD_=1&_SR_=173&_ST_=1", description: "Extrato de propinas" },
  "finance.debts": { stage: "DIFTasks", path: "/netpa/DIFTasks?_PR_=1&_AP_=9&_MD_=1&_SR_=176&_ST_=1", description: "Valores em dívida" },
  "finance.payments": { stage: "DIFTasks", path: "/netpa/DIFTasks?_PR_=1&_AP_=9&_MD_=1&_SR_=173&_ST_=1", description: "Histórico de pagamentos" },
  "finance.receipts": { stage: "DIFTasks", path: "/netpa/DIFTasks?_PR_=1&_AP_=9&_MD_=1&_SR_=173&_ST_=1", description: "Comprovativos imprimíveis de itens pagos" },
  "process.examRegistrations": { stage: "ConsultaInscricaoEpocas", path: "/netpa/ajax/consultainscricaoepocas/listaInscricoesEpocas", description: "Inscrições em épocas" },
  "process.gradeReviews": { stage: "ListaPedidosRevisaoNotasAluno", path: "/netpa/ajax/listapedidosrevisaonotasaluno/pedidosrevisao", description: "Pedidos de revisão" },
  "process.applications": { stage: "CandidaturasExistentes", path: "/netpa/ajax/candidaturasexistentes/historicoCandidaturas", description: "Candidaturas" },
  "process.advancedTraining": { stage: "MinhasFormacoesAvancadas", path: "/netpa/ajax/minhasformacoesavancadas/formacaoavancada", description: "Formações avançadas" },
  "process.internships": { stage: "MeusEstagios", path: "/netpa/ajax/meusestagios/estagios", description: "Estágios" },
  "process.activities": { stage: "AtividadesExtraCurricularesAluno", path: "/netpa/ajax/atividadesextracurricularesaluno/atividadesCurriculares", description: "Atividades extracurriculares" },
  "process.languages": { stage: "CompetenciasLinguisticasAluno", path: "/netpa/ajax/competenciaslinguisticasaluno/competenciaLinguistica", description: "Competências linguísticas" },
  "directory.courses": { stage: "CursosDiretorioPublico", path: "/netpa/ajax/cursosdiretoriopublico/cursos", description: "Diretório institucional de cursos" },
};

// netPA rejects non-browser user agents before rendering protected forms.
// Keep this value versioned and covered by live contract checks.
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeHtml(value: string): string {
  const namedEntities: Record<string, string> = {
    aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä",
    eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
    iacute: "í", igrave: "ì", icirc: "î", iuml: "ï",
    oacute: "ó", ograve: "ò", ocirc: "ô", otilde: "õ", ouml: "ö",
    uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü", ccedil: "ç",
    ordm: "º", ordf: "ª", ndash: "–", mdash: "—", euro: "€",
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&([a-z]+);/gi, (entity, name: string) => {
      const decoded = namedEntities[name.toLowerCase()];
      if (!decoded) return entity;
      return name[0] === name[0].toUpperCase() ? decoded.toUpperCase() : decoded;
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attributes(markup: string) {
  const result: Record<string, string> = {};
  const pattern = /([^\s=<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of markup.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (key === "input" || key === "select" || key === "textarea" || key === "option" || key.startsWith("/")) continue;
    result[key] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function formMarkup(html: string, id: string) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<form[^>]+(?:id|name)=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/form>`, "i"))?.[1] ?? null;
}

function formPayload(html: string, id: string) {
  const markup = formMarkup(html, id);
  if (!markup) throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O formulário de dados pessoais deixou de estar disponível.", 502, false, "contact_support");
  const payload = new URLSearchParams();
  for (const match of markup.matchAll(/<input\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const name = attrs.name;
    const type = (attrs.type ?? "text").toLowerCase();
    if (!name || "disabled" in attrs || ["file", "button", "submit", "reset", "image"].includes(type)) continue;
    if (["checkbox", "radio"].includes(type) && !("checked" in attrs)) continue;
    payload.append(name, attrs.value ?? (type === "checkbox" ? "on" : ""));
  }
  for (const match of markup.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    const attrs = attributes(match[1]);
    if (attrs.name && !("disabled" in attrs)) payload.append(attrs.name, decodeHtml(match[2]));
  }
  for (const match of markup.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const selectAttrs = attributes(match[1]);
    if (!selectAttrs.name || "disabled" in selectAttrs) continue;
    const options = [...match[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)]
      .map((option) => ({ attrs: attributes(option[1]), text: decodeHtml(option[2]) }));
    const selected = options.filter((option) => "selected" in option.attrs);
    for (const option of selected.length ? selected : options.slice(0, 1)) payload.append(selectAttrs.name, option.attrs.value ?? option.text);
  }
  return payload;
}

function checkedInputValue(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const match of html.matchAll(new RegExp(`<input[^>]+name=["']${escaped}["'][^>]*>`, "gi"))) {
    const attrs = attributes(match[0]);
    if ("checked" in attrs) return attrs.value ?? null;
  }
  return null;
}

function addressFromHtml(html: string, prefix: "Principal" | "Secundaria"): SecretariaAddress {
  const field = (name: string) => inputValueByName(html, name);
  return {
    line1: field(`morada${prefix}`),
    country: field(`paisMorada${prefix}Desc`),
    postalCode: field(`codPostMorada${prefix}`),
    postalSuffix: field(`subPostMorada${prefix}`),
    district: field(`fregMorada${prefix}distDesc`),
    municipality: field(`fregMorada${prefix}conDesc`),
    parish: field(`fregMorada${prefix}fregDesc`),
    foreignCountry: field(`fregMorada${prefix}estrangeiraDesc`),
  };
}

function contactDetailsFromHtml(html: string): SecretariaContactDetails {
  if (!formMarkup(html, "boletimForm")) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato de dados pessoais da Secretaria mudou.", 502, false, "contact_support");
  }
  const mailing = checkedInputValue(html, "moradaCorreio");
  return {
    email: inputValueByName(html, "email"),
    phone: inputValueByName(html, "telefonePrincipal"),
    mobile: inputValueByName(html, "telemovel"),
    primaryAddress: addressFromHtml(html, "Principal"),
    secondaryAddress: addressFromHtml(html, "Secundaria"),
    mailingAddress: mailing === "P" ? "PRIMARY" : mailing === "S" ? "SECONDARY" : null,
    editableFields: ["email", "phone", "mobile", "primaryAddressLine", "secondaryAddressLine", "mailingAddress"],
    observedAt: new Date().toISOString(),
  };
}

function normalizedContactHash(details: SecretariaContactDetails) {
  const { observedAt: _observedAt, editableFields: _editableFields, ...stable } = details;
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function photoLocationFromHtml(html: string) {
  const candidates = [...html.matchAll(/<img\b[^>]*\bsrc=["'][^"']*PhotoLoader\?[^"']+["'][^>]*>/gi)]
    .map((match) => ({ markup: match[0], attrs: attributes(match[0]) }));
  const selected = candidates.find((candidate) => /fotoactual/i.test(candidate.attrs.alt ?? "")) ?? candidates[0];
  if (!selected?.attrs.src) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "A Secretaria não disponibilizou uma fotografia para este perfil.", 404);
  const url = new URL(selected.attrs.src, "http://secretaria.invalid/netpa/");
  const unexpectedKeys = [...url.searchParams.keys()].filter((key) => !["codAluno", "codCurso"].includes(key) && !/^\d{6,}$/.test(key));
  if (url.pathname !== "/netpa/PhotoLoader" || !url.searchParams.get("codAluno") || !url.searchParams.get("codCurso") || unexpectedKeys.length) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato da fotografia da Secretaria mudou.", 502, false, "contact_support");
  }
  const safe = new URL("/netpa/PhotoLoader", "http://secretaria.invalid");
  safe.searchParams.set("codAluno", url.searchParams.get("codAluno")!);
  safe.searchParams.set("codCurso", url.searchParams.get("codCurso")!);
  return `${safe.pathname}${safe.search}`;
}

function detectedImageType(bytes: Buffer): SecretariaPhoto["contentType"] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  return null;
}

function photoFormPayload(html: string) {
  const form = formMarkup(html, "atualizarFotografia");
  const input = form?.match(/<input\b[^>]*\bname=["']photo["'][^>]*>/i)?.[0];
  const inputAttributes = input ? attributes(input) : {};
  const payload = formPayload(html, "atualizarFotografia");
  if (
    !form
    || inputAttributes.type?.toLowerCase() !== "file"
    || inputAttributes.accept?.toLowerCase() !== "image/jpeg"
    || payload.get("_formsubmitstage")?.toLowerCase() !== "atualizarfotografia"
    || payload.get("_formsubmitname") !== "atualizarFotografia"
    || payload.get("_formfieldnames") !== "photo"
  ) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato de atualização da fotografia mudou.", 502, false, "contact_support");
  }
  return payload;
}

function visibleText(html: string) {
  return decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " "));
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

function inputValueByName(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const input = html.match(new RegExp(`<input[^>]+name=["']${escaped}["'][^>]*>`, "i"))?.[0];
  if (!input) return null;
  return decodeHtml(input.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? "");
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
  if (typeof value === "string") {
    if (/javascript\s*:|\bon(?:click|load|error)\s*=|<script\b/i.test(value)) return null;
    return decodeHtml(value);
  }
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = normalizeKey(rawKey);
    if (
      !key
      || key === "id"
      || key === "rownum"
      || key.startsWith("__")
      || /(password|cookie|token|sess)/i.test(key)
      || /^(?:cd|code|codigo)?Aluno$/i.test(key)
      || /(?:^|_)(?:id)?Individuo$/i.test(key)
      || /^individuo/i.test(key)
      || /^(?:individuo)?(?:Name|Nome)Completo$/i.test(key)
      || /(?:nm|nome)Completo/i.test(key)
      || /^(?:nomeAluno|identificacao)$/i.test(key)
      || /(?:acessoListaAlunos|paginaUc|linkUrl|href)/i.test(key)
      || /^(?:businessId|id.*financeira|detalheCalc)$/i.test(key)
      || /^id[A-Z]/.test(key)
      || /^(?:registerId|workflowInstanceId)$/i.test(key)
      || /(?:accao|acao|acoes|operacao|selection|seleccao).*calc$/i.test(key)
    ) continue;
    const normalized = normalizeValue(rawValue);
    if (normalized !== null) result[key] = normalized;
  }
  return result;
}

function rawPayload(payload: unknown): { items: Array<Record<string, unknown>>; total: number } {
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const rawItems = Array.isArray(payload)
    ? payload
    : ["result", "data", "rows", "items"].map((key) => object[key]).find(Array.isArray) ?? [];
  const items = rawItems.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value)));
  return { items, total: typeof object.total === "number" ? object.total : items.length };
}

function unwrapPayload(payload: unknown): { items: Array<Record<string, unknown>>; total: number } {
  const raw = rawPayload(payload);
  const items = raw.items
    .map((value) => normalizeValue(value))
    .filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value)));
  return { items, total: raw.total };
}

function paymentSelection(record: Record<string, unknown>): SecretariaPaymentSelection | null {
  const markup = String(record.seleccaoPagamentoCalc ?? record.SELECCAO_PAGAMENTO_CALC ?? "");
  const match = markup.match(/toogleItem\s*\(\s*this\s*,\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*,\s*(['"])(.*?)\5\s*\)/i);
  if (!match) return null;
  const values = [match[2], match[4], match[6]].map((value) => decodeHtml(value).trim());
  if (values.some((value) => !value || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value))) return null;
  return { id: values[0], idFinanceira: values[1], inputId: values[2] };
}

function paymentDocumentPath(record: Record<string, unknown>) {
  const markup = String(record.referenciaMBCalc ?? record.REFERENCIA_MB_CALC ?? "");
  const href = markup.match(/href\s*=\s*(["'])(.*?)\1/i)?.[2] ?? markup.match(/(doc\?stage=StepSeleccionarItemsConta[^\s"'<>]+)/i)?.[1];
  if (!href) {
    const idFinanceira = String(record.idFinanceira ?? record.ID_FINANCEIRA ?? "").trim();
    const reference = String(record.referencia ?? record.REFERENCIA ?? "").trim();
    if (!idFinanceira || !reference || reference === "-" || idFinanceira.length > 256 || reference.length > 256 || /[\u0000-\u001f\u007f]/.test(`${idFinanceira}${reference}`)) return null;
    const fallback = new URL("/netpa/doc", "http://secretaria.invalid");
    fallback.searchParams.set("stage", "StepSeleccionarItemsConta");
    fallback.searchParams.set("_event", "docDocumentoPagamentoReferencias");
    fallback.searchParams.set("idFinanceiraRefMB", idFinanceira);
    fallback.searchParams.set("numberReferenciaRefMB", reference);
    return `${fallback.pathname}${fallback.search}`;
  }
  const decoded = decodeHtml(href);
  const url = new URL(decoded, "http://secretaria.invalid/netpa/");
  const allowed = new Set(["stage", "_event", "idFinanceiraRefMB", "numberReferenciaRefMB"]);
  if (
    url.pathname !== "/netpa/doc"
    || url.searchParams.get("stage")?.toLowerCase() !== "stepseleccionaritemsconta"
    || url.searchParams.get("_event") !== "docDocumentoPagamentoReferencias"
    || !url.searchParams.get("idFinanceiraRefMB")
    || !url.searchParams.get("numberReferenciaRefMB")
    || [...url.searchParams.keys()].some((key) => !allowed.has(key))
  ) return null;
  return `${url.pathname}${url.search}`;
}

type PaymentReferenceCandidates = (selection: SecretariaPaymentSelection) => string[];
type ReceiptReferenceCandidates = (value: { item: string; academicYear: string | null }) => string[];
type ExamRegistrationReferenceCandidates = (id: string) => string[];
type GradeReviewReferenceCandidates = (id: string) => string[];

function normalizePaymentRecord(record: Record<string, unknown>, paymentReferenceCandidates: PaymentReferenceCandidates): Record<string, unknown> {
  const normalized = normalizeValue(record) as Record<string, unknown>;
  const paymentReference = [record.referenciaMBCalc, record.REFERENCIA_MB_CALC, record.referencia, record.REFERENCIA]
    .map((value) => decodeHtml(String(value ?? "")).trim())
    .find((value) => value.length > 0 && value !== "-") ?? "";
  delete normalized.id;
  delete normalized.idNumberConta;
  delete normalized.idItemConta;
  delete normalized.idFinanceira;
  delete normalized.inputId;
  delete normalized.seleccaoPagamentoCalc;
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === "string") normalized[key] = decodeHtml(value);
  }
  const selection = paymentSelection(record);
  if (selection) normalized.chargeRef = paymentReferenceCandidates(selection)[0];
  if (paymentReference && paymentReference !== "-") normalized.paymentReference = paymentReference;
  return normalized;
}

function normalizePaymentPayload(payload: unknown, paymentReferenceCandidates: PaymentReferenceCandidates) {
  const raw = rawPayload(payload);
  const items = raw.items
    .map((value) => normalizePaymentRecord(value, paymentReferenceCandidates));
  return { items, total: raw.total };
}

function isoPortalDate(value: string) {
  const match = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value || null;
}

function numericAmount(value: string) {
  const normalized = value.replace(/\s*KZ\s*/i, "").replace(/,/g, "").trim();
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function htmlRows(html: string) {
  type Row = { start: number; cells: string[] };
  const rows: Array<{ markup: string; cells: string[] }> = [];
  const rowStack: Row[] = [];
  const cellStack: Array<{ row: Row; text: string[] }> = [];
  for (const token of html.matchAll(/<[^>]*>|[^<]+/g)) {
    const value = token[0];
    if (/^<tr\b/i.test(value)) {
      rowStack.push({ start: token.index, cells: [] });
    } else if (/^<\/tr\b/i.test(value)) {
      const row = rowStack.pop();
      if (row) rows.push({ markup: html.slice(row.start, token.index + value.length), cells: row.cells });
    } else if (/^<t[hd]\b/i.test(value)) {
      const row = rowStack.at(-1);
      if (row) cellStack.push({ row, text: [] });
    } else if (/^<\/t[hd]\b/i.test(value)) {
      const cell = cellStack.pop();
      if (cell) cell.row.cells.push(decodeHtml(cell.text.join(" ")));
    } else if (!value.startsWith("<")) {
      for (const cell of cellStack) cell.text.push(value);
    }
  }
  return rows;
}

function selectedAcademicYear(html: string) {
  const select = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)]
    .find((match) => attributes(match[1]).name?.toLowerCase() === "anolectivo");
  if (!select) return null;
  const options = [...select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)]
    .map((option) => ({ attrs: attributes(option[1]), text: decodeHtml(option[2]) }));
  const selected = options.find((option) => "selected" in option.attrs) ?? options[0];
  return selected?.text || selected?.attrs.value || null;
}

function tuitionLedgerFromHtml(html: string, receiptReferenceCandidates: ReceiptReferenceCandidates) {
  const rows = htmlRows(html);
  const headers = new Set(rows.flatMap((row) => row.cells.map((cell) => normalizeKey(cell))));
  if (!["descricao", "dtVencimento", "refMb", "valor", "dtPagamento", "pago", "divida", "multa"].every((header) => headers.has(header))) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato do extrato de propinas mudou.", 502, false, "contact_support");
  }
  const academicYear = selectedAcademicYear(html);
  const items = rows.flatMap(({ markup, cells }) => {
    const action = markup.match(/Propinas_columnClick\(\s*(['"])(.*?)\1\s*,\s*(['"])info\3[^)]*itemPago=([SN])/i);
    if (!action || cells.length < 9) return [];
    const internalItem = decodeHtml(action[2]).trim();
    if (!internalItem || internalItem.length > 128 || /[\u0000-\u001f\u007f]/.test(internalItem)) return [];
    const paidAmount = cells[6] ?? "";
    const debtAmount = cells[7] ?? "";
    const paymentDate = isoPortalDate(cells[5] ?? "");
    const paid = action[4].toUpperCase() === "S" || numericAmount(paidAmount) > 0 || Boolean(paymentDate);
    const debt = numericAmount(debtAmount);
    const status = paid && debt === 0 ? "PAID" : paid && debt > 0 ? "PARTIAL" : debt > 0 ? "OUTSTANDING" : "PENDING";
    const receiptRef = paid ? receiptReferenceCandidates({ item: internalItem, academicYear })[0] : null;
    return [{
      academicYear,
      description: cells[1] || null,
      dueDate: isoPortalDate(cells[2] ?? ""),
      paymentReference: cells[3] || null,
      amount: cells[4] || null,
      paymentDate,
      paidAmount: paidAmount || null,
      debtAmount: debtAmount || null,
      penaltyAmount: cells[8] || null,
      status,
      ...(receiptRef ? { receiptRef } : {}),
    }];
  });
  return { items, total: items.length };
}

function debtLedgerFromHtml(html: string) {
  const rows = htmlRows(html);
  const headers = new Set(rows.flatMap((row) => row.cells.map((cell) => normalizeKey(cell))));
  const headerContract = ["descricao", "tipo", "dtVencimento", "total", "pago", "totalDivida"].every((header) => headers.has(header));
  const formContract = ["Items_FORM_descricao", "Items_FORM_tipo", "Items_FORM_dataVencimento", "Items_FORM_total", "Items_FORM_totalPago", "Items_FORM_totalDivida"].every((field) => html.includes(field));
  if (!headerContract && !formContract) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato dos valores em dívida mudou.", 502, false, "contact_support");
  }
  const items = rows.flatMap(({ cells }) => {
    if (cells.length !== 6 || !cells[0] || /^(Descrição|Total\s+Dívida)/i.test(cells[0])) return [];
    const paid = numericAmount(cells[4]);
    const debt = numericAmount(cells[5]);
    if (!paid && !debt && !numericAmount(cells[3])) return [];
    return [{
      description: cells[0],
      type: cells[1] || null,
      dueDate: isoPortalDate(cells[2] ?? ""),
      amount: cells[3] || null,
      paidAmount: cells[4] || null,
      debtAmount: cells[5] || null,
      status: debt > 0 && paid > 0 ? "PARTIAL" : debt > 0 ? "OUTSTANDING" : "PAID",
    }];
  });
  return { items, total: items.length };
}

function receiptFieldsFromHtml(html: string): Record<string, string | boolean | null> {
  if (!/Detalhe\s+Item\s+Conta/i.test(visibleText(html))) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato do comprovativo de pagamento mudou.", 502, false, "contact_support");
  }
  const aliases: Record<string, string> = {
    descricao: "description", dtVencimento: "dueDate", facturado: "invoiced", pago: "paid",
    tipoItem: "itemType", quantidade: "quantity", valor: "amount", acrescimo: "surcharge",
    desconto: "discount", iva: "vat", totalDivida: "debtAmount", modalidade: "modality",
    anulado: "voided", prestacao: "installment", observacoes: "notes",
  };
  const fields: Record<string, string | boolean | null> = {};
  const pairs = htmlRows(html).filter(({ cells }) => cells.length === 2).map(({ cells }) => cells);
  for (const match of html.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>\s*<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
    pairs.push([decodeHtml(match[1]), decodeHtml(match[2])]);
  }
  for (const cells of pairs) {
    const key = normalizeKey(cells[0].replace(/:$/, ""));
    const target = aliases[key];
    if (!target) continue;
    const value = cells[1] || null;
    fields[target] = /^(invoiced|paid|voided)$/.test(target) && value ? /^sim$/i.test(value) : target === "dueDate" && value ? isoPortalDate(value) : value;
  }
  if (fields.paid === undefined) {
    const paidState = visibleText(html).match(/\bPago\s+(Sim|Não|Nao)\b/i)?.[1];
    if (paidState) fields.paid = /^sim$/i.test(paidState);
  }
  if (!fields.description || fields.paid !== true) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O comprovativo devolvido não identifica inequivocamente um item pago.", 502, false, "contact_support");
  }
  return fields;
}

function examRegistrationId(record: Record<string, unknown>): string | null {
  const value = record.id ?? record.ID;
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim() || String(value).length > 256) return null;
  const id = String(value).trim();
  return /[\u0000-\u001f\u007f]/.test(id) ? null : id;
}

function examRegistrationAction(record: Record<string, unknown>) {
  return String(record.accaoCalc ?? record.ACCAO_CALC ?? "");
}

function normalizeExamRegistrationRecord(record: Record<string, unknown>, candidates: ExamRegistrationReferenceCandidates) {
  const id = examRegistrationId(record);
  if (!id) return null;
  const normalized = normalizeValue(record) as Record<string, unknown>;
  delete normalized.id;
  delete normalized.accaoCalc;
  delete normalized.operacao;
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === "string") normalized[key] = decodeHtml(value);
  }
  normalized.registrationRef = candidates(id)[0];
  normalized.canCancel = /\banular\s*\(/i.test(examRegistrationAction(record));
  return normalized;
}

function examRegistrationHash(record: Record<string, unknown>) {
  const id = examRegistrationId(record);
  return NetpaSecretariaGateway.normalizedHash({ id, record: normalizeValue(record), canCancel: /\banular\s*\(/i.test(examRegistrationAction(record)) });
}

function gradeReviewId(record: Record<string, unknown>): string | null {
  const value = record.id ?? record.ID;
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim() || String(value).length > 512) return null;
  const id = String(value).trim();
  return /[\u0000-\u001f\u007f]/.test(id) ? null : id;
}

function gradeReviewAction(record: Record<string, unknown>) {
  const markup = String(record.accaoCalc ?? record.ACCAO_CALC ?? "");
  if (/\befectuarPedidoRevisaoNota\s*\(/i.test(markup)) return "SUBMIT_REVIEW" as const;
  if (/\befectuarPedidoReapreciacao\s*\(/i.test(markup)) return "SUBMIT_RECONSIDERATION" as const;
  if (/\befectuarPedidoCopiaProva\s*\(/i.test(markup)) return "REQUEST_PROOF_COPY" as const;
  return null;
}

function normalizeGradeReviewRecord(record: Record<string, unknown>, candidates: GradeReviewReferenceCandidates) {
  const id = gradeReviewId(record);
  if (!id) return null;
  const normalized = normalizeValue(record) as Record<string, unknown>;
  delete normalized.id;
  delete normalized.accaoCalc;
  delete normalized.justificacaoPedidoTemp;
  delete normalized.justificacaoReapreciacaoTemp;
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === "string") normalized[key] = decodeHtml(value);
  }
  normalized.reviewRef = candidates(id)[0];
  normalized.availableAction = gradeReviewAction(record);
  normalized.canSubmitReview = gradeReviewAction(record) === "SUBMIT_REVIEW";
  return normalized;
}

function gradeReviewHash(record: Record<string, unknown>) {
  return NetpaSecretariaGateway.normalizedHash({
    id: gradeReviewId(record),
    record: normalizeValue(record),
    availableAction: gradeReviewAction(record),
  });
}

export class NetpaSecretariaGateway implements SecretariaGateway {
  readonly #baseUrl: URL;
  readonly #circuits = new Map<string, { failures: number; openUntil: number }>();

  constructor(private readonly options: {
    baseUrl: string;
    timeoutMs: number;
    maxResponseBytes: number;
    paymentReferenceCandidates: PaymentReferenceCandidates;
    receiptReferenceCandidates: ReceiptReferenceCandidates;
    examRegistrationReferenceCandidates: ExamRegistrationReferenceCandidates;
    gradeReviewReferenceCandidates: GradeReviewReferenceCandidates;
  }) {
    this.#baseUrl = new URL(options.baseUrl);
  }

  async #bufferRequest(path: string, init: RequestInit = {}): Promise<{ response: Response; bytes: Buffer }> {
    const url = new URL(path, this.#baseUrl);
    if (url.origin !== this.#baseUrl.origin) throw new SecretariaError("SECRETARIA_UNSAFE_REDIRECT", "A Secretaria devolveu um destino não permitido.", 502);
    const circuitKey = `${init.method ?? "GET"}:${url.pathname}`;
    const circuit = this.#circuits.get(circuitKey);
    if (circuit && circuit.openUntil > Date.now()) {
      throw new SecretariaError("SECRETARIA_CIRCUIT_OPEN", "Esta capacidade da Secretaria está temporariamente isolada após falhas consecutivas.", 503, true);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
      if (response.status >= 500) this.#recordCircuitFailure(circuitKey);
      else this.#circuits.delete(circuitKey);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > this.options.maxResponseBytes) {
        bytes.fill(0);
        throw new SecretariaError("SECRETARIA_RESPONSE_TOO_LARGE", "A resposta da Secretaria excede o limite permitido.", 502);
      }
      return { response, bytes };
    } catch (error) {
      if (error instanceof SecretariaError) throw error;
      this.#recordCircuitFailure(circuitKey);
      const timeoutFailure = error instanceof Error && error.name === "AbortError";
      throw new SecretariaError("SECRETARIA_UNAVAILABLE", timeoutFailure ? "A Secretaria excedeu o tempo limite." : "A Secretaria está temporariamente indisponível.", 503, true, "none", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  #recordCircuitFailure(key: string) {
    const previous = this.#circuits.get(key);
    const failures = (previous?.openUntil && previous.openUntil <= Date.now() ? 0 : previous?.failures ?? 0) + 1;
    this.#circuits.set(key, { failures, openUntil: failures >= 5 ? Date.now() + 30_000 : 0 });
  }

  async #request(path: string, init: RequestInit = {}): Promise<{ response: Response; text: string }> {
    const result = await this.#bufferRequest(path, init);
    try {
      const contentType = result.response.headers.get("content-type") ?? "";
      const htmlHead = result.bytes.subarray(0, Math.min(result.bytes.length, 4096)).toString("latin1");
      const declaredCharset = contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]
        ?? htmlHead.match(/charset\s*=\s*["']?([^;\s"'>]+)/i)?.[1]
        ?? "utf-8";
      const legacyWestern = /^(?:iso-8859-1|latin1|windows-1252|cp1252)$/i.test(declaredCharset);
      const text = legacyWestern ? new TextDecoder("windows-1252").decode(result.bytes) : result.bytes.toString("utf8");
      return { response: result.response, text };
    } finally {
      result.bytes.fill(0);
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

  async #jsonRequest(session: SecretariaSession, path: string, referer: string, init: RequestInit = {}) {
    const result = await this.#request(path, {
      ...init,
      headers: { ...this.#headers(session, true), Referer: new URL(referer, this.#baseUrl).toString(), ...(init.headers ?? {}) },
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou uma etapa do pedido.", 503, true);
    try {
      return JSON.parse(result.text) as unknown;
    } catch (error) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria devolveu uma resposta incompatível.", 502, false, "contact_support", { cause: error });
    }
  }

  async #wizardPost(session: SecretariaSession, stage: string, fields: Record<string, string>) {
    const path = `/netpa/page?stage=${encodeURIComponent(stage)}`;
    let result = await this.#request(path, {
      method: "POST",
      headers: { ...this.#headers(session), "Content-Type": "application/x-www-form-urlencoded", Referer: new URL(path, this.#baseUrl).toString() },
      body: new URLSearchParams(fields).toString(),
    });
    mergeSetCookies(session.cookies, result.response.headers);
    const location = result.response.headers.get("location");
    if (location && result.response.status >= 300 && result.response.status < 400) {
      const target = new URL(location, this.#baseUrl);
      if (target.origin !== this.#baseUrl.origin) throw new SecretariaError("SECRETARIA_UNSAFE_REDIRECT", "A Secretaria devolveu um destino não permitido.", 502);
      result = await this.#request(`${target.pathname}${target.search}`, { headers: this.#headers(session) });
      mergeSetCookies(session.cookies, result.response.headers);
    }
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou uma etapa do pedido.", 503, true);
    return result.text;
  }

  async #paymentPayload(session: SecretariaSession, stage: string, endpoint: string) {
    const stagePath = `/netpa/page?stage=${encodeURIComponent(stage)}&submitaction=null`;
    const page = await this.#request(stagePath, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, page.response.headers);
    if (authFailure(page.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (page.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível abrir o fluxo financeiro.", 503, true);
    const url = new URL(endpoint, this.#baseUrl);
    url.searchParams.set("_dc", String(Date.now()));
    url.searchParams.set("page", "1");
    url.searchParams.set("start", "0");
    url.searchParams.set("limit", "500");
    const payload = await this.#jsonRequest(session, `${url.pathname}${url.search}`, stagePath);
    return rawPayload(payload);
  }

  async #financialPage(session: SecretariaSession, path: string, description: string) {
    const summaryPath = "/netpa/page?stage=SituacaoFinanceira&submitaction=null";
    const summary = await this.#request(summaryPath, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, summary.response.headers);
    if (authFailure(summary.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (summary.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível abrir a situação financeira.", 503, true);
    const result = await this.#request(path, {
      headers: { ...this.#headers(session), Referer: new URL(summaryPath, this.#baseUrl).toString() },
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", `Não foi possível consultar ${description}.`, 503, true);
    return result.text;
  }

  #resolvePaymentSelections(rows: Array<Record<string, unknown>>, chargeRefs: string[]) {
    const available = new Map<string, SecretariaPaymentSelection>();
    for (const row of rows) {
      const selection = paymentSelection(row);
      if (selection) {
        for (const reference of this.options.paymentReferenceCandidates(selection)) available.set(reference, selection);
      }
    }
    const selections = chargeRefs.map((chargeRef) => available.get(chargeRef));
    if (selections.some((selection) => !selection)) {
      throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "Um item financeiro já não está disponível para gerar referência.", 404);
    }
    return selections as SecretariaPaymentSelection[];
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

  async #personalDataPage(session: SecretariaSession) {
    const path = "/netpa/page?stage=BoletimMatricula";
    const page = await this.#request(path, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, page.response.headers);
    if (authFailure(page.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (page.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível consultar os dados pessoais da Secretaria.", 503, true);
    return page.text;
  }

  async getContactDetails(session: SecretariaSession): Promise<SecretariaContactDetails> {
    return contactDetailsFromHtml(await this.#personalDataPage(session));
  }

  async #photoPage(session: SecretariaSession) {
    const path = "/netpa/page?stage=AtualizarFotografia";
    const page = await this.#request(path, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, page.response.headers);
    if (authFailure(page.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (page.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível abrir a fotografia da Secretaria.", 503, true);
    return page.text;
  }

  async #photoFromPage(session: SecretariaSession, html: string): Promise<SecretariaPhoto> {
    const result = await this.#bufferRequest(photoLocationFromHtml(html), { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, result.response.headers);
    if (result.response.status >= 400) {
      result.bytes.fill(0);
      throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível obter a fotografia da Secretaria.", 503, true);
    }
    const contentType = detectedImageType(result.bytes);
    if (!contentType) {
      const text = result.bytes.toString("utf8");
      result.bytes.fill(0);
      if (authFailure(text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria devolveu um conteúdo de fotografia incompatível.", 502, false, "contact_support");
    }
    return {
      body: result.bytes,
      contentType,
      contentLength: result.bytes.length,
      sha256: createHash("sha256").update(result.bytes).digest("hex"),
    };
  }

  async getPhoto(session: SecretariaSession): Promise<SecretariaPhoto> {
    return this.#photoFromPage(session, await this.#photoPage(session));
  }

  async preparePhoto(session: SecretariaSession) {
    const html = await this.#photoPage(session);
    photoFormPayload(html);
    const current = await this.#photoFromPage(session, html);
    try {
      return { preconditionHash: current.sha256 };
    } finally {
      current.body.fill(0);
    }
  }

  async updatePhoto(session: SecretariaSession, jpeg: Buffer, preconditionHash: string) {
    const html = await this.#photoPage(session);
    const urlEncoded = photoFormPayload(html);
    const current = await this.#photoFromPage(session, html);
    try {
      if (current.sha256 !== preconditionHash) {
        throw new SecretariaError("SECRETARIA_PRECONDITION_FAILED", "A fotografia mudou depois da preparação; revê e prepara novamente.", 409);
      }
    } finally {
      current.body.fill(0);
    }

    const multipart = new FormData();
    for (const [key, value] of urlEncoded) multipart.append(key, value);
    multipart.set("_formsubmitstage", "atualizarfotografia");
    multipart.set("_formsubmitname", "atualizarFotografia");
    multipart.set("submitAction", "");
    multipart.set("photo", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "profile-photo.jpg");

    const path = "/netpa/page?stage=atualizarfotografia";
    let result = await this.#request(path, {
      method: "POST",
      headers: { ...this.#headers(session), Referer: new URL("/netpa/page?stage=AtualizarFotografia", this.#baseUrl).toString() },
      body: multipart,
    });
    mergeSetCookies(session.cookies, result.response.headers);
    const location = result.response.headers.get("location");
    if (location && result.response.status >= 300 && result.response.status < 400) {
      const target = new URL(location, this.#baseUrl);
      if (target.origin !== this.#baseUrl.origin) throw new SecretariaError("SECRETARIA_UNSAFE_REDIRECT", "A Secretaria devolveu um destino não permitido.", 502);
      result = await this.#request(`${target.pathname}${target.search}`, { headers: this.#headers(session) });
      mergeSetCookies(session.cookies, result.response.headers);
    }
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou o pedido de fotografia.", 503, true);

    const text = visibleText(result.text);
    if (/erro|inválid|invalido|não foi possível|nao foi possivel/i.test(text)) {
      throw new SecretariaError("SECRETARIA_VALIDATION_FAILED", "A Secretaria recusou a fotografia submetida.", 422);
    }
    const successMessage = /(?:pedido|fotografia).{0,140}(?:efetuad[oa]|submetid[oa]|registad[oa]).{0,100}sucesso|sucesso.{0,100}(?:pedido|fotografia)/i.test(text);
    let changed = false;
    try {
      const official = await this.getPhoto(session);
      changed = official.sha256 !== preconditionHash;
      official.body.fill(0);
    } catch {
      // The submission response may be authoritative even while the image
      // projection is temporarily unavailable.
    }
    if (!changed && !successMessage) {
      throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria não confirmou de forma inequívoca o pedido de fotografia.", 502, true);
    }
    return {
      items: [{ outcome: changed ? "PHOTO_UPDATED" : "PHOTO_CHANGE_REQUEST_SUBMITTED", sha256: createHash("sha256").update(jpeg).digest("hex"), contentType: "image/jpeg", size: jpeg.length }],
      observedAt: new Date().toISOString(),
    };
  }

  async getConsents(session: SecretariaSession): Promise<SecretariaDataset> {
    const path = "/netpa/page?stage=myconsents";
    const page = await this.#request(path, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, page.response.headers);
    if (authFailure(page.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (page.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível consultar os consentimentos da Secretaria.", 503, true);
    const text = visibleText(page.text);
    if (!/sem consentimentos/i.test(text) || !/não existem consentimentos disponíveis/i.test(text)) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria apresentou um contrato de consentimento ainda não reconhecido.", 502, false, "contact_support");
    }
    return { domain: "privacy.consents", items: [], total: 0, observedAt: new Date().toISOString(), coverage: "live" };
  }

  async prepareContactDetails(session: SecretariaSession, patch: SecretariaContactDetailsPatch) {
    const current = contactDetailsFromHtml(await this.#personalDataPage(session));
    const currentValues: Record<keyof SecretariaContactDetailsPatch, string | null> = {
      email: current.email,
      phone: current.phone,
      mobile: current.mobile,
      primaryAddressLine: current.primaryAddress.line1,
      secondaryAddressLine: current.secondaryAddress.line1,
      mailingAddress: current.mailingAddress,
    };
    const changed = Object.entries(patch).some(([key, value]) => (currentValues[key as keyof SecretariaContactDetailsPatch] ?? "") !== (value ?? ""));
    if (!changed) throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "O pedido não altera nenhum dado de contacto.", 422);
    return { patch, preconditionHash: normalizedContactHash(current) };
  }

  async updateContactDetails(session: SecretariaSession, patch: SecretariaContactDetailsPatch, preconditionHash: string) {
    const html = await this.#personalDataPage(session);
    const current = contactDetailsFromHtml(html);
    if (normalizedContactHash(current) !== preconditionHash) {
      throw new SecretariaError("SECRETARIA_PRECONDITION_FAILED", "Os dados de contacto mudaram depois da preparação; revê e prepara novamente.", 409);
    }
    const payload = formPayload(html, "boletimForm");
    const mapping: Array<[keyof SecretariaContactDetailsPatch, string]> = [
      ["email", "email"],
      ["phone", "telefonePrincipal"],
      ["mobile", "telemovel"],
      ["primaryAddressLine", "moradaPrincipal"],
      ["secondaryAddressLine", "moradaSecundaria"],
    ];
    for (const [key, field] of mapping) {
      if (key in patch) payload.set(field, String(patch[key] ?? ""));
    }
    if (patch.mailingAddress) payload.set("moradaCorreio", patch.mailingAddress === "PRIMARY" ? "P" : "S");
    payload.set("_formsubmitstage", "boletimmatricula");
    payload.set("_formsubmitname", "boletimForm");
    payload.set("submitAction", "");

    const path = "/netpa/ajax?stage=boletimmatricula";
    const result = await this.#request(path, {
      method: "POST",
      headers: {
        ...this.#headers(session, true),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: new URL("/netpa/page?stage=BoletimMatricula", this.#baseUrl).toString(),
      },
      body: payload.toString(),
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou o pedido de alteração de contactos.", 503, true);
    let response: { success?: unknown; parameterErrors?: unknown };
    try {
      response = JSON.parse(result.text) as { success?: unknown; parameterErrors?: unknown };
    } catch (error) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A resposta da alteração de contactos não é compatível.", 502, false, "contact_support", { cause: error });
    }
    if (response.success !== true) {
      if (response.parameterErrors && typeof response.parameterErrors === "object") {
        throw new SecretariaError("SECRETARIA_VALIDATION_FAILED", "A Secretaria recusou o pedido porque existem campos obrigatórios em falta ou inválidos.", 422);
      }
      throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria não confirmou a submissão da alteração de contactos.", 502, true);
    }
    return {
      items: [{ outcome: "CHANGE_REQUEST_SUBMITTED", changedFields: Object.keys(patch).sort() }],
      observedAt: new Date().toISOString(),
    };
  }

  async prepareContactDetailsCancellation(session: SecretariaSession) {
    const html = await this.#personalDataPage(session);
    if (!/ajax\/boletimmatricula\/cancelarPedido/i.test(html) || !/function\s+cancelarPedidoRequestfunc\s*\(/i.test(html)) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato de cancelamento do pedido cadastral mudou.", 502, false, "contact_support");
    }
    return { preconditionHash: normalizedContactHash(contactDetailsFromHtml(html)) };
  }

  async cancelContactDetailsChangeRequest(session: SecretariaSession, preconditionHash: string) {
    const html = await this.#personalDataPage(session);
    if (normalizedContactHash(contactDetailsFromHtml(html)) !== preconditionHash) {
      throw new SecretariaError("SECRETARIA_PRECONDITION_FAILED", "Os dados cadastrais mudaram depois da preparação; revê e prepara novamente.", 409);
    }
    if (!/ajax\/boletimmatricula\/cancelarPedido/i.test(html) || !/function\s+cancelarPedidoRequestfunc\s*\(/i.test(html)) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato de cancelamento do pedido cadastral mudou.", 502, false, "contact_support");
    }
    const path = "/netpa/ajax/boletimmatricula/cancelarPedido";
    const result = await this.#request(path, {
      method: "POST",
      headers: {
        ...this.#headers(session, true),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: new URL("/netpa/page?stage=BoletimMatricula", this.#baseUrl).toString(),
      },
      body: "",
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou o cancelamento do pedido cadastral.", 503, true);
    let response: { success?: unknown; result?: unknown };
    try { response = JSON.parse(result.text) as { success?: unknown; result?: unknown }; }
    catch (error) { throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria devolveu uma resposta ambígua ao cancelamento cadastral.", 502, true, "none", { cause: error }); }
    if (response.success !== true || response.result !== "success") {
      throw new SecretariaError("SECRETARIA_VALIDATION_FAILED", "A Secretaria recusou o cancelamento do pedido cadastral.", 422);
    }
    return { items: [{ outcome: "CONTACT_CHANGE_REQUEST_CANCELLED" }], observedAt: new Date().toISOString() };
  }

  async getDataset(session: SecretariaSession, domain: string): Promise<SecretariaDataset> {
    if (["finance.tuition", "finance.payments", "finance.receipts"].includes(domain)) {
      const path = SECRETARIA_DATASETS[domain].path;
      const html = await this.#financialPage(session, path, SECRETARIA_DATASETS[domain].description);
      const ledger = tuitionLedgerFromHtml(html, this.options.receiptReferenceCandidates);
      const items = domain === "finance.tuition" ? ledger.items : ledger.items.filter((item) => item.status === "PAID");
      return { domain, items, total: items.length, observedAt: new Date().toISOString(), coverage: "live" };
    }
    if (domain === "finance.debts") {
      const contract = SECRETARIA_DATASETS[domain];
      const html = await this.#financialPage(session, contract.path, contract.description);
      const ledger = debtLedgerFromHtml(html);
      return { domain, ...ledger, observedAt: new Date().toISOString(), coverage: "live" };
    }
    if (domain === "process.examRegistrations") {
      const rows = await this.#examRegistrationRows(session);
      const items = rows
        .map((record) => normalizeExamRegistrationRecord(record, this.options.examRegistrationReferenceCandidates))
        .filter((record): record is Record<string, unknown> => Boolean(record));
      return { domain, items, total: items.length, observedAt: new Date().toISOString(), coverage: "live" };
    }
    if (domain === "process.gradeReviews") {
      const rows = await this.#gradeReviewRows(session);
      const items = rows
        .map((record) => normalizeGradeReviewRecord(record, this.options.gradeReviewReferenceCandidates))
        .filter((record): record is Record<string, unknown> => Boolean(record));
      return { domain, items, total: items.length, observedAt: new Date().toISOString(), coverage: "live" };
    }
    const contract = SECRETARIA_DATASETS[domain];
    if (!contract) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "O conjunto de dados solicitado não existe.", 404);
    const stagePath = `/netpa/page?stage=${encodeURIComponent(contract.stage)}&submitaction=null`;
    const stage = await this.#request(stagePath, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, stage.response.headers);
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
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", `Não foi possível consultar ${contract.description}.`, 503, true);
    let payload: unknown;
    try {
      payload = JSON.parse(result.text);
    } catch (error) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", `A resposta de ${contract.description} não é compatível.`, 502, false, "contact_support", { cause: error });
    }
    let normalized = domain.startsWith("finance.") ? normalizePaymentPayload(payload, this.options.paymentReferenceCandidates) : unwrapPayload(payload);
    if (domain === "finance.references") {
      normalized = {
        items: normalized.items.filter((item) => {
          const value = Object.entries(item).find(([key]) => /(?:referencia.*mb|paymentReference)/i.test(key))?.[1];
          return typeof value === "string" && value.replace(/\s+/g, "").length > 3 && value.trim() !== "-";
        }),
        total: 0,
      };
      normalized.total = normalized.items.length;
    } else if (domain === "finance.overview") {
      const referenceCount = normalized.items.filter((item) => Object.entries(item).some(([key, value]) => /(?:referencia.*mb|paymentReference)/i.test(key) && typeof value === "string" && value.replace(/\s+/g, "").length > 3 && value.trim() !== "-")).length;
      normalized = { items: [{ outstandingItemCount: normalized.items.length, paymentReferenceCount: referenceCount }], total: 1 };
    }
    return { domain, ...normalized, observedAt: new Date().toISOString(), coverage: "live" };
  }

  async getPaymentReferenceDocument(session: SecretariaSession, chargeRef: string): Promise<SecretariaDocument> {
    const payload = await this.#paymentPayload(session, "stepseleccionaritemsconta", "/netpa/ajax/stepseleccionaritemsconta/pagamentos");
    const [selection] = this.#resolvePaymentSelections(payload.items, [chargeRef]);
    const row = payload.items.find((candidate) => {
      const current = paymentSelection(candidate);
      return current?.id === selection.id && current.idFinanceira === selection.idFinanceira && current.inputId === selection.inputId;
    });
    const path = row ? paymentDocumentPath(row) : null;
    if (!path) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "O documento da referência ainda não está disponível.", 404);
    const result = await this.#bufferRequest(path, {
      headers: { ...this.#headers(session), Accept: "application/pdf" , Referer: new URL("/netpa/page?stage=stepseleccionaritemsconta", this.#baseUrl).toString() },
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (result.response.status >= 400) {
      result.bytes.fill(0);
      throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível obter o documento da referência.", 503, true);
    }
    if (result.bytes.length < 5 || result.bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      const text = result.bytes.toString("utf8");
      result.bytes.fill(0);
      if (authFailure(text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria devolveu um documento financeiro incompatível.", 502, false, "contact_support");
    }
    return {
      body: result.bytes,
      contentType: "application/pdf",
      contentLength: result.bytes.length,
      sha256: createHash("sha256").update(result.bytes).digest("hex"),
      filename: "referencia-pagamento-secretaria.pdf",
    };
  }

  async getReceipt(session: SecretariaSession, receiptRef: string): Promise<SecretariaReceiptDetail> {
    const ledgerPath = SECRETARIA_DATASETS["finance.receipts"].path;
    const ledgerHtml = await this.#financialPage(session, ledgerPath, "os comprovativos de pagamento");
    const academicYear = selectedAcademicYear(ledgerHtml);
    const candidate = htmlRows(ledgerHtml).map(({ markup }) => {
      const action = markup.match(/Propinas_columnClick\(\s*(['"])(.*?)\1\s*,\s*(['"])info\3[^)]*itemPago=S/i);
      const item = action ? decodeHtml(action[2]).trim() : "";
      return item ? { item, refs: this.options.receiptReferenceCandidates({ item, academicYear }) } : null;
    }).find((value) => value?.refs.includes(receiptRef));
    if (!candidate) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "O comprovativo já não está disponível.", 404);
    const result = await this.#request("/netpa/DIFTasks", {
      method: "POST",
      headers: {
        ...this.#headers(session),
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: new URL(ledgerPath, this.#baseUrl).toString(),
      },
      body: new URLSearchParams({ DIFTasks: "", _AP_: "9", _MD_: "1", _SR_: "163", _ST_: "5", item: candidate.item }).toString(),
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível consultar o comprovativo.", 503, true);
    return {
      receiptRef,
      documentKind: "PAYMENT_ITEM_DETAIL",
      officialFiscalReceipt: false,
      fields: receiptFieldsFromHtml(result.text),
      observedAt: new Date().toISOString(),
    };
  }

  async #examRegistrationRows(session: SecretariaSession, requireCancellationContract = false) {
    const stagePath = "/netpa/page?stage=ConsultaInscricaoEpocas&submitaction=null";
    const stage = await this.#request(stagePath, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, stage.response.headers);
    if (authFailure(stage.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (stage.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível abrir as inscrições em épocas.", 503, true);
    if (requireCancellationContract && (!/ajax\/consultainscricaoepocas\/anulaInscricaoEpoca/i.test(stage.text) || !/function\s+anular\s*\(/i.test(stage.text))) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato de cancelamento de inscrição em época mudou.", 502, false, "contact_support");
    }
    const path = `/netpa/ajax/consultainscricaoepocas/listaInscricoesEpocas?_dc=${Date.now()}&page=1&start=0&limit=500`;
    const payload = await this.#jsonRequest(session, path, stagePath);
    const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    if (object.success !== true || !Array.isArray(object.result)) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A lista de inscrições em épocas devolveu um contrato incompatível.", 502, false, "contact_support");
    }
    return rawPayload(payload).items;
  }

  #resolveExamRegistration(rows: Array<Record<string, unknown>>, registrationRef: string) {
    for (const record of rows) {
      const id = examRegistrationId(record);
      if (id && this.options.examRegistrationReferenceCandidates(id).includes(registrationRef)) return { id, record };
    }
    throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "A inscrição em época já não está disponível.", 404);
  }

  async prepareExamRegistrationCancellation(session: SecretariaSession, registrationRef: string): Promise<SecretariaExamRegistrationCancellation> {
    const resolved = this.#resolveExamRegistration(await this.#examRegistrationRows(session, true), registrationRef);
    if (!/\banular\s*\(/i.test(examRegistrationAction(resolved.record))) {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "A inscrição não pode ser anulada no estado atual.", 409);
    }
    return { registrationRef, preconditionHash: examRegistrationHash(resolved.record) };
  }

  async verifyExamRegistrationCancellation(session: SecretariaSession, registrationRef: string): Promise<SecretariaCommandResult | null> {
    const rows = await this.#examRegistrationRows(session);
    let resolved: { id: string; record: Record<string, unknown> } | null = null;
    try {
      resolved = this.#resolveExamRegistration(rows, registrationRef);
    } catch (error) {
      if (error instanceof SecretariaError && error.code === "SECRETARIA_RESOURCE_NOT_FOUND") {
        return { items: [{ outcome: "EXAM_REGISTRATION_CANCELLED", registrationRef }], observedAt: new Date().toISOString() };
      }
      throw error;
    }
    const status = String(resolved.record.DsStaInscExame ?? resolved.record.estadoCalc ?? "");
    if (!/\banular\s*\(/i.test(examRegistrationAction(resolved.record)) && /anulad|cancelad/i.test(status)) {
      return { items: [{ outcome: "EXAM_REGISTRATION_CANCELLED", registrationRef }], observedAt: new Date().toISOString() };
    }
    return null;
  }

  async cancelExamRegistration(session: SecretariaSession, cancellation: SecretariaExamRegistrationCancellation): Promise<SecretariaCommandResult> {
    const resolved = this.#resolveExamRegistration(await this.#examRegistrationRows(session, true), cancellation.registrationRef);
    if (examRegistrationHash(resolved.record) !== cancellation.preconditionHash) {
      throw new SecretariaError("SECRETARIA_PRECONDITION_FAILED", "A inscrição mudou depois da preparação; revê e prepara novamente.", 409);
    }
    if (!/\banular\s*\(/i.test(examRegistrationAction(resolved.record))) {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "A inscrição não pode ser anulada no estado atual.", 409);
    }
    const path = "/netpa/ajax/consultainscricaoepocas/anulaInscricaoEpoca";
    const result = await this.#request(path, {
      method: "POST",
      headers: {
        ...this.#headers(session, true),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Referer: new URL("/netpa/page?stage=ConsultaInscricaoEpocas", this.#baseUrl).toString(),
      },
      body: new URLSearchParams({ id: resolved.id }).toString(),
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou o cancelamento da inscrição.", 503, true);
    let response: { success?: unknown; message?: unknown };
    try {
      response = JSON.parse(result.text) as { success?: unknown; message?: unknown };
    } catch (error) {
      throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria devolveu uma resposta ambígua ao cancelamento.", 502, true, "none", { cause: error });
    }
    if (response.success !== true) throw new SecretariaError("SECRETARIA_VALIDATION_FAILED", "A Secretaria recusou o cancelamento da inscrição.", 422);
    const verified = await this.verifyExamRegistrationCancellation(session, cancellation.registrationRef);
    if (!verified) throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria aceitou o pedido, mas a anulação ainda não foi confirmada na leitura oficial.", 502, true);
    return verified;
  }

  async #gradeReviewRows(session: SecretariaSession, requireSubmissionContract = false) {
    const stagePath = "/netpa/page?stage=ListaPedidosRevisaoNotasAluno&submitaction=null";
    const stage = await this.#request(stagePath, { headers: this.#headers(session) });
    mergeSetCookies(session.cookies, stage.response.headers);
    if (authFailure(stage.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (stage.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "Não foi possível abrir os pedidos de revisão de nota.", 503, true);
    if (requireSubmissionContract && (
      !/autoSync\s*:\s*true/i.test(stage.text)
      || !/url\s*:\s*["']ajax\/listapedidosrevisaonotasaluno\/pedidosrevisao["']/i.test(stage.text)
      || !/name\s*:\s*["']justificacaoPedidoTemp["']/i.test(stage.text)
      || !/record\.set\s*\(\s*["']justificacaoPedidoTemp["']/i.test(stage.text)
      || !/justificacaoPedirRevisao[^\n]{0,400}?\.length\s*>\s*16000/i.test(stage.text)
    )) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O contrato de submissão de revisão de nota mudou.", 502, false, "contact_support");
    }
    const url = new URL("/netpa/ajax/listapedidosrevisaonotasaluno/pedidosrevisao", this.#baseUrl);
    url.searchParams.set("_dc", String(Date.now()));
    url.searchParams.set("page", "1");
    url.searchParams.set("start", "0");
    url.searchParams.set("limit", "500");
    url.searchParams.set("limpar", "false");
    const payload = await this.#jsonRequest(session, `${url.pathname}${url.search}`, stagePath);
    const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    if (object.success !== true || !Array.isArray(object.result)) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A lista de revisões de nota devolveu um contrato incompatível.", 502, false, "contact_support");
    }
    return rawPayload(payload).items;
  }

  #resolveGradeReview(rows: Array<Record<string, unknown>>, reviewRef: string) {
    for (const record of rows) {
      const id = gradeReviewId(record);
      if (id && this.options.gradeReviewReferenceCandidates(id).includes(reviewRef)) return { id, record };
    }
    throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "A avaliação já não está disponível no fluxo de revisão.", 404);
  }

  async prepareGradeReview(session: SecretariaSession, reviewRef: string, operation: SecretariaGradeReviewSubmission["operation"], justification: string): Promise<SecretariaGradeReviewSubmission> {
    const normalizedJustification = justification.trim();
    if ((operation !== "PROOF_COPY" && !normalizedJustification) || normalizedJustification.length > 16_000) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A justificação deve ter entre 1 e 16000 caracteres para revisão ou reapreciação.", 422);
    }
    const resolved = this.#resolveGradeReview(await this.#gradeReviewRows(session, true), reviewRef);
    const expectedAction = operation === "REVIEW" ? "SUBMIT_REVIEW" : operation === "PROOF_COPY" ? "REQUEST_PROOF_COPY" : "SUBMIT_RECONSIDERATION";
    if (gradeReviewAction(resolved.record) !== expectedAction) {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "A operação de revisão não pode ser submetida no estado atual.", 409);
    }
    return { reviewRef, operation, justification: normalizedJustification, preconditionHash: gradeReviewHash(resolved.record) };
  }

  async verifyGradeReview(session: SecretariaSession, reviewRef: string, operation: SecretariaGradeReviewSubmission["operation"] = "REVIEW"): Promise<SecretariaCommandResult | null> {
    const resolved = this.#resolveGradeReview(await this.#gradeReviewRows(session), reviewRef);
    const state = decodeHtml(String(resolved.record.descEstadoCalc ?? resolved.record.DESC_ESTADO_CALC ?? ""));
    const expectedAction = operation === "REVIEW" ? "SUBMIT_REVIEW" : operation === "PROOF_COPY" ? "REQUEST_PROOF_COPY" : "SUBMIT_RECONSIDERATION";
    if (gradeReviewAction(resolved.record) === expectedAction || !state || state === "-") return null;
    const requestNumber = decodeHtml(String(resolved.record.numberPedidoCalc ?? resolved.record.NUMBER_PEDIDO_CALC ?? "")) || null;
    return {
      items: [{ outcome: operation === "REVIEW" ? "GRADE_REVIEW_SUBMITTED" : operation === "PROOF_COPY" ? "GRADE_PROOF_COPY_REQUESTED" : "GRADE_RECONSIDERATION_SUBMITTED", reviewRef, state, requestNumber }],
      observedAt: new Date().toISOString(),
    };
  }

  async submitGradeReview(session: SecretariaSession, submission: SecretariaGradeReviewSubmission): Promise<SecretariaCommandResult> {
    const resolved = this.#resolveGradeReview(await this.#gradeReviewRows(session, true), submission.reviewRef);
    if (gradeReviewHash(resolved.record) !== submission.preconditionHash) {
      throw new SecretariaError("SECRETARIA_PRECONDITION_FAILED", "A avaliação mudou depois da preparação; revê e prepara novamente.", 409);
    }
    const expectedAction = submission.operation === "REVIEW" ? "SUBMIT_REVIEW" : submission.operation === "PROOF_COPY" ? "REQUEST_PROOF_COPY" : "SUBMIT_RECONSIDERATION";
    if (gradeReviewAction(resolved.record) !== expectedAction) {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "A operação de revisão não pode ser submetida no estado atual.", 409);
    }
    const path = `/netpa/ajax/listapedidosrevisaonotasaluno/pedidosrevisao/${encodeURIComponent(resolved.id)}`;
    const result = await this.#request(path, {
      method: "PUT",
      headers: {
        ...this.#headers(session, true),
        "Content-Type": "application/json",
        Referer: new URL("/netpa/page?stage=ListaPedidosRevisaoNotasAluno", this.#baseUrl).toString(),
      },
      body: JSON.stringify(submission.operation === "RECONSIDERATION"
        ? { id: resolved.id, justificacaoReapreciacaoTemp: submission.justification }
        : { id: resolved.id, justificacaoPedidoTemp: submission.operation === "PROOF_COPY" ? "#pedidocopia#" : submission.justification }),
    });
    mergeSetCookies(session.cookies, result.response.headers);
    if (authFailure(result.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
    if (result.response.status >= 400) throw new SecretariaError("SECRETARIA_UNAVAILABLE", "A Secretaria rejeitou a submissão da revisão de nota.", 503, true);
    let response: { success?: unknown };
    try {
      response = JSON.parse(result.text) as { success?: unknown };
    } catch (error) {
      throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria devolveu uma resposta ambígua à revisão de nota.", 502, true, "none", { cause: error });
    }
    if (response.success !== true) throw new SecretariaError("SECRETARIA_VALIDATION_FAILED", "A Secretaria recusou a revisão de nota.", 422);
    const verified = await this.verifyGradeReview(session, submission.reviewRef, submission.operation);
    if (!verified) throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria aceitou o pedido, mas o novo estado ainda não foi confirmado na leitura oficial.", 502, true);
    return verified;
  }

  async preparePaymentReference(session: SecretariaSession, chargeRefs: string[]) {
    const unique = [...new Set(chargeRefs)];
    if (unique.length !== chargeRefs.length) throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "Os itens financeiros não podem estar repetidos.", 422);
    const payload = await this.#paymentPayload(session, "stepseleccionaritemsconta", "/netpa/ajax/stepseleccionaritemsconta/pagamentos");
    this.#resolvePaymentSelections(payload.items, unique);
    return { chargeRefs: unique };
  }

  async generatePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult> {
    const payload = await this.#paymentPayload(session, "stepseleccionaritemsconta", "/netpa/ajax/stepseleccionaritemsconta/pagamentos");
    const selections = this.#resolvePaymentSelections(payload.items, chargeRefs);
    const initialStage = "/netpa/page?stage=stepseleccionaritemsconta&submitaction=null";
    for (const selection of selections) {
      const added = await this.#request("/netpa/ajax/stepseleccionaritemsconta/addItem", {
        method: "POST",
        headers: {
          ...this.#headers(session, true),
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Referer: new URL(initialStage, this.#baseUrl).toString(),
        },
        body: new URLSearchParams(selection).toString(),
      });
      mergeSetCookies(session.cookies, added.response.headers);
      if (authFailure(added.text)) throw new SecretariaError("SECRETARIA_REAUTH_REQUIRED", "A sessão da Secretaria expirou.", 409, true, "reauthenticate");
      if (added.response.status >= 400 || /(?:success|sucesso)\s*["']?\s*:\s*false/i.test(added.text)) {
        throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria não aceitou a seleção do item financeiro.", 502, false, "contact_support");
      }
    }

    const typePage = await this.#wizardPost(session, "stepseleccionaritemsconta", {
      _formsubmitstage: "stepseleccionaritemsconta",
      _formsubmitname: "wizPagamentos",
      _formfieldnames: "",
      _wiz_step: "1",
      customSubmit: "",
      submitAction: "Item(s) a Pagar",
    });
    if (inputValueByName(typePage, "_formsubmitstage") !== "stepseleccionartipopagamento") {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O fluxo financeiro da Secretaria mudou antes da escolha do método.", 502, false, "contact_support");
    }

    const confirmationPage = await this.#wizardPost(session, "stepseleccionartipopagamento", {
      _formsubmitstage: "stepseleccionartipopagamento",
      _formsubmitname: "wizPagamentos",
      _formfieldnames: "tipoPagamento,nrTelefoneMBWay",
      _wiz_step: "2",
      customSubmit: "",
      tipoPagamento: "REFERENCIAS_MB",
      nrTelefoneMBWay: "",
      submitAction: "Seguinte",
    });
    if (inputValueByName(confirmationPage, "_formsubmitstage") !== "stepconfirmarpagamento") {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "O fluxo financeiro da Secretaria mudou antes da confirmação.", 502, false, "contact_support");
    }

    const summaryUrl = new URL("/netpa/ajax/stepconfirmarpagamento/pagamentos", this.#baseUrl);
    summaryUrl.searchParams.set("_dc", String(Date.now()));
    summaryUrl.searchParams.set("page", "1");
    summaryUrl.searchParams.set("start", "0");
    summaryUrl.searchParams.set("limit", "500");
    const summaryPayload = await this.#jsonRequest(
      session,
      `${summaryUrl.pathname}${summaryUrl.search}`,
      "/netpa/page?stage=stepconfirmarpagamento",
    );
    const summary = rawPayload(summaryPayload);
    if (summary.items.length !== chargeRefs.length) {
      throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "A Secretaria devolveu uma confirmação financeira inconsistente.", 502, false, "contact_support");
    }

    const finalPage = await this.#wizardPost(session, "stepconfirmarpagamento", {
      _formsubmitstage: "stepconfirmarpagamento",
      _formsubmitname: "wizPagamentos",
      _formfieldnames: "",
      _wiz_step: "3",
      customSubmit: "",
      submitAction: "Confirmar",
    });
    const outcomeText = visibleText(finalPage);
    if (inputValueByName(finalPage, "_formsubmitstage") !== "stepresultadopagamento" || !/\bsucesso\b/i.test(outcomeText) || /\berro\b/i.test(outcomeText)) {
      throw new SecretariaError("SECRETARIA_COMMAND_OUTCOME_UNKNOWN", "A Secretaria não confirmou de forma inequívoca a geração da referência.", 502, true);
    }

    return {
      items: summary.items.map((row, index) => ({ ...normalizePaymentRecord(row, this.options.paymentReferenceCandidates), chargeRef: chargeRefs[index] })),
      observedAt: new Date().toISOString(),
    };
  }

  async verifyPaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult | null> {
    const payload = await this.#paymentPayload(session, "stepseleccionaritemsconta", "/netpa/ajax/stepseleccionaritemsconta/pagamentos");
    const byRef = new Map<string, Record<string, unknown>>();
    for (const row of payload.items) {
      const selection = paymentSelection(row);
      if (selection) {
        for (const reference of this.options.paymentReferenceCandidates(selection)) byRef.set(reference, row);
      }
    }
    const matched = chargeRefs.map((chargeRef) => byRef.get(chargeRef));
    if (matched.some((row) => !row)) return null;
    const normalized = (matched as Array<Record<string, unknown>>).map((row, index) => ({
      ...normalizePaymentRecord(row, this.options.paymentReferenceCandidates),
      chargeRef: chargeRefs[index],
    }));
    const referencePresent = normalized.every((row) => {
      return Object.entries(row).some(([key, rawValue]) => {
        if (!/(?:referencia.*mb|paymentReference)/i.test(key)) return false;
        const value = String(rawValue ?? "").replace(/\s+/g, "").trim();
        return value.length > 3 && value !== "-";
      });
    });
    if (!referencePresent) return null;
    return { items: normalized, observedAt: new Date().toISOString() };
  }

  async logout(session: SecretariaSession): Promise<void> {
    await this.#request("/netpa/page?stage=logoutstage", { headers: this.#headers(session) }).catch(() => undefined);
  }

  static normalizedHash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
