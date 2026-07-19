import { z } from "zod";
import type {
  MoodleGatewayCourse,
  MoodleGatewayMaterial,
  MoodleGatewayMaterialType,
  MoodleGatewayModule,
  MoodleGatewayProfile,
  MoodleGatewaySection,
  MoodleGatewayStreamLocator,
} from "../domain/gateway";
import { MoodleGatewayFailure } from "../domain/gateway";

const NUMERIC_KEY = /^\d+$/;
const MAX_TEXT_LENGTH = 8_000;

const ajaxEnvelopeSchema = z.array(z.object({
  error: z.boolean().optional().default(false),
  data: z.unknown().optional(),
  exception: z.object({
    errorcode: z.string().optional(),
    message: z.string().optional(),
  }).passthrough().optional(),
}).passthrough()).min(1);

const ajaxCourseSchema = z.object({
  id: z.union([z.number(), z.string()]),
  fullname: z.string().min(1),
  shortname: z.string().optional().default(""),
  coursecategory: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  startdate: z.union([z.number(), z.string(), z.null()]).optional(),
  enddate: z.union([z.number(), z.string(), z.null()]).optional(),
  hasprogress: z.union([z.boolean(), z.number(), z.string()]).optional(),
  progress: z.union([z.number(), z.string(), z.null()]).optional(),
  visible: z.union([z.boolean(), z.number(), z.string()]).optional(),
  hidden: z.union([z.boolean(), z.number(), z.string()]).optional(),
  isfavourite: z.union([z.boolean(), z.number(), z.string()]).optional(),
}).passthrough();

const ajaxCourseListSchema = z.object({
  courses: z.array(ajaxCourseSchema),
  nextoffset: z.union([z.number(), z.string(), z.null()]).optional(),
}).passthrough();

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "©",
  gt: ">",
  hellip: "…",
  laquo: "«",
  lt: "<",
  nbsp: " ",
  quot: '"',
  raquo: "»",
};

const NOISE_PATTERNS = [
  /(?:^|\n)\s*saltar para (?:o )?conte[uú]do principal\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*skip to main content\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*p[aá]gina principal\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*[aá]rea pessoal\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*(?:menu de )?navega[cç][aã]o\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*administra[cç][aã]o\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*ativar modo de edi[cç][aã]o\s*(?=\n|$)/gimu,
  /(?:^|\n)\s*desativar modo de edi[cç][aã]o\s*(?=\n|$)/gimu,
  /marcar como conclu[ií]d[oa]/giu,
  /mais a[cç][oõ]es/giu,
];

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : " ";
    })
    .replace(/&([a-z]+);/gi, (match, entity: string) => ENTITY_MAP[entity.toLowerCase()] ?? match);
}

function removeUnsafeAndPeripheralHtml(value: string): string {
  return value
    .replace(/<!--(?:[\s\S]*?)-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(input|button|select|option|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(input|button|select|option|textarea)\b[^>]*\/?>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>|<\/div\s*>|<\/li\s*>|<\/h[1-6]\s*>/gi, "\n");
}

export function cleanMoodleText(value: string | null | undefined, maxLength = MAX_TEXT_LENGTH): string {
  if (!value) return "";
  let text = decodeHtml(removeUnsafeAndPeripheralHtml(value).replace(/<[^>]+>/g, " "))
    .replace(/https?:\/\/[^\s<>()]+/giu, " ")
    .replace(/[?&](?:sesskey|token|wstoken|password)=[^\s&]+/giu, " ");
  for (const pattern of NOISE_PATTERNS) text = text.replace(pattern, " ");
  return text
    .replace(/[\t\r ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizedLabel(value: string): string {
  return stripAccents(cleanMoodleText(value)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeMoodleStudentNumber(value: string): string | null {
  const normalized = value
    .normalize("NFKC")
    .replace(/^(?:n[uú]mero|number|matr[ií]cula|id)\s*[:#-]?\s*/iu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return normalized.length >= 4 && normalized.length <= 32 ? normalized : null;
}

function firstAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"))
    ?? tag.match(new RegExp(`\\b${escaped}\\s*=\\s*([^\\s>]+)`, "i"));
  return decodeHtml(match?.[2] ?? match?.[1] ?? "").trim() || null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "sim"].includes(normalized)) return true;
    if (["0", "false", "no", "não", "nao", ""].includes(normalized)) return false;
  }
  return fallback;
}

function unixDate(value: unknown): string | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const millis = numeric > 10_000_000_000 ? numeric : numeric * 1_000;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function progressValue(hasProgress: unknown, progress: unknown): Pick<MoodleGatewayCourse, "progressAvailable" | "progressPercent"> {
  const progressAvailable = toBoolean(hasProgress, false);
  if (!progressAvailable) return { progressAvailable: false, progressPercent: null };
  const numeric = typeof progress === "number" ? progress : Number(progress);
  return {
    progressAvailable: true,
    progressPercent: Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : null,
  };
}

function unwrapAjaxData(raw: unknown): unknown {
  const result = ajaxEnvelopeSchema.safeParse(raw);
  if (!result.success) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED", { cause: result.error });
  const first = result.data[0];
  if (first.error || first.exception) {
    const marker = `${first.exception?.errorcode ?? ""} ${first.exception?.message ?? ""}`.toLowerCase();
    if (/invalidsesskey|requirelogin|notloggedin|session/.test(marker)) {
      throw new MoodleGatewayFailure("MOODLE_SESSION_EXPIRED");
    }
    throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
  }
  return first.data;
}

export type MoodleLoginForm = {
  action: string;
  loginToken: string | null;
};

export function parseMoodleLoginForm(html: string): MoodleLoginForm | null {
  for (const match of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi)) {
    const form = match[0];
    if (!/<input\b[^>]*\bname\s*=\s*["']username["']/i.test(form)
      || !/<input\b[^>]*\bname\s*=\s*["']password["']/i.test(form)) continue;
    const openTag = form.match(/^<form\b[^>]*>/i)?.[0] ?? "";
    const tokenInput = form.match(/<input\b[^>]*\bname\s*=\s*["']logintoken["'][^>]*>/i)?.[0]
      ?? form.match(/<input\b[^>]*\bvalue\s*=\s*["'][^"']*["'][^>]*\bname\s*=\s*["']logintoken["'][^>]*>/i)?.[0];
    return {
      action: firstAttribute(openTag, "action") ?? "/login/index.php",
      loginToken: tokenInput ? firstAttribute(tokenInput, "value") : null,
    };
  }
  return null;
}

export function isMoodleLoginPage(html: string, finalPath = ""): boolean {
  if (parseMoodleLoginForm(html)) return true;
  const normalized = stripAccents(cleanMoodleText(html, 2_000)).toLowerCase();
  return /\b(login|entrar|iniciar sessao)\b/.test(normalized)
    && /\/login\/|\/home\/?$/.test(finalPath);
}

export function hasMoodleAuthenticationFailure(html: string): boolean {
  const normalized = stripAccents(cleanMoodleText(html, 3_000)).toLowerCase();
  return [
    "dados errados",
    "credenciais invalidas",
    "invalid login",
    "invalid username or password",
    "autenticacao falhou",
    "errorcode=3",
  ].some((marker) => normalized.includes(marker)) || /[?&]errorcode=\d+/.test(html);
}

export function extractMoodleSesskey(html: string): string | null {
  const candidates = [
    /["']sesskey["']\s*:\s*["']([^"']+)["']/i,
    /\bsesskey\s*=\s*["']([^"']+)["']/i,
    /[?&]sesskey=([A-Za-z0-9_-]+)/i,
  ];
  for (const pattern of candidates) {
    const value = html.match(pattern)?.[1];
    if (value && /^[A-Za-z0-9_-]{4,128}$/.test(value)) return value;
  }
  return null;
}

function labeledValues(html: string): Map<string, string> {
  const values = new Map<string, string>();
  const patterns = [
    /<dt\b[^>]*>([\s\S]*?)<\/dt\s*>\s*<dd\b[^>]*>([\s\S]*?)<\/dd\s*>/gi,
    /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)\s*>\s*<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi,
    /<div\b[^>]*class=["'][^"']*label[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>\s*<div\b[^>]*>([\s\S]*?)<\/div\s*>/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const label = normalizedLabel(match[1]);
      const value = cleanMoodleText(match[2], 500);
      if (label && value && !values.has(label)) values.set(label, value);
    }
  }
  return values;
}

function readLabeled(values: Map<string, string>, aliases: RegExp): string | null {
  for (const [label, value] of values) if (aliases.test(label)) return value;
  return null;
}

export function parseMoodleProfile(html: string): MoodleGatewayProfile {
  const fields = labeledValues(html);
  const externalUserKey = html.match(/\bdata-userid\s*=\s*["'](\d+)["']/i)?.[1]
    ?? html.match(/\/user\/profile\.php\?[^"'<>]*\bid=(\d+)/i)?.[1]
    ?? html.match(/["']userid["']\s*:\s*(\d+)/i)?.[1]
    ?? null;

  const rawNumber = readLabeled(
    fields,
    /^(?:numero (?:de |do )?(?:estudante|aluno)|matricula|id number|idnumber|nome de utilizador|username)$/,
  );
  const studentNumber = rawNumber ? normalizeMoodleStudentNumber(rawNumber) : null;

  const headingBlock = html.match(/<div\b[^>]*class=["'][^"']*page-header-headings[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1];
  const displayName = cleanMoodleText(
    headingBlock
      ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]
      ?? readLabeled(fields, /^(?:nome completo|full name)$/)
      ?? "",
    240,
  ).replace(/\s*:\s*perfil\s*$/iu, "");

  if (!externalUserKey || !studentNumber || !displayName) {
    throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
  }

  const rawEmail = readLabeled(fields, /^(?:endereco de email|email address|e mail|email)$/)
    ?? html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
    ?? null;
  const email = rawEmail?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? null;
  const timezone = readLabeled(fields, /^(?:fuso horario|timezone)$/);

  return { externalUserKey, studentNumber, displayName, email, timezone };
}

export type ParsedCoursePage = {
  course: MoodleGatewayCourse;
  sections: MoodleGatewaySection[];
  materials: MoodleGatewayMaterial[];
};

export function parseMoodleCourseAjaxResponse(raw: unknown): { courses: MoodleGatewayCourse[]; nextOffset: number | null } {
  const data = ajaxCourseListSchema.safeParse(unwrapAjaxData(raw));
  if (!data.success) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED", { cause: data.error });
  const courses = data.data.courses.map((course) => {
    const externalKey = String(course.id);
    if (!NUMERIC_KEY.test(externalKey)) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
    return {
      externalKey,
      name: cleanMoodleText(course.fullname, 500),
      shortName: cleanMoodleText(course.shortname, 240),
      category: cleanMoodleText(course.coursecategory, 500) || null,
      description: cleanMoodleText(course.summary, MAX_TEXT_LENGTH) || null,
      startDate: unixDate(course.startdate),
      endDate: unixDate(course.enddate),
      ...progressValue(course.hasprogress, course.progress),
      visible: toBoolean(course.visible, true),
      hiddenByStudent: toBoolean(course.hidden, false),
      favourite: toBoolean(course.isfavourite, false),
    } satisfies MoodleGatewayCourse;
  });
  const next = Number(data.data.nextoffset);
  return { courses, nextOffset: Number.isInteger(next) && next >= 0 ? next : null };
}

function around(html: string, index: number, nextIndex: number): string {
  const start = Math.max(0, html.lastIndexOf("<", Math.max(0, index - 1_500)));
  const end = Math.min(html.length, nextIndex > index ? nextIndex : index + 3_500);
  return html.slice(start, end);
}

export function parseMoodleCoursesHtml(html: string): MoodleGatewayCourse[] {
  const anchors = [...html.matchAll(/<a\b[^>]*href\s*=\s*(["'])([^"']*\/course\/view\.php\?[^"']*\bid=\d+[^"']*)\1[^>]*>([\s\S]*?)<\/a\s*>/gi)];
  const courses = new Map<string, MoodleGatewayCourse>();
  for (const [position, anchor] of anchors.entries()) {
    const decodedHref = decodeHtml(anchor[2]);
    let id: string | null = null;
    try {
      id = new URL(decodedHref, "https://moodle.invalid").searchParams.get("id");
    } catch {
      continue;
    }
    if (!id || !NUMERIC_KEY.test(id) || courses.has(id)) continue;

    const window = around(html, anchor.index ?? 0, anchors[position + 1]?.index ?? -1);
    const name = cleanMoodleText(anchor[3], 500)
      .replace(/\b(?:disciplina|course)\s*$/iu, "")
      .trim();
    if (!name) continue;
    const rawProgress = window.match(/\baria-valuenow\s*=\s*["'](\d+(?:\.\d+)?)["']/i)?.[1]
      ?? window.match(/\b(\d+(?:[.,]\d+)?)\s*%/i)?.[1]?.replace(",", ".");
    const category = cleanMoodleText(
      window.match(/<[^>]*class=["'][^"']*(?:categoryname|course-category)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
      500,
    ) || null;
    const hasProgress = rawProgress !== undefined;
    courses.set(id, {
      externalKey: id,
      name,
      shortName: cleanMoodleText(firstAttribute(anchor[0], "data-shortname"), 240),
      category,
      description: null,
      startDate: null,
      endDate: null,
      progressAvailable: hasProgress,
      progressPercent: hasProgress ? Math.max(0, Math.min(100, Number(rawProgress))) : null,
      visible: !/\b(?:dimmed|hidden)\b/i.test(window),
      hiddenByStudent: /\bdata-hidden\s*=\s*["']?1/i.test(window),
      favourite: /\bdata-favourite\s*=\s*["']?1/i.test(window),
    });
  }
  return [...courses.values()];
}

function moduleMaterialType(moduleType: string, title: string): MoodleGatewayMaterialType {
  const extension = title.match(/\.([a-z0-9]{2,5})(?:\s|$)/i)?.[1]?.toLowerCase();
  if (["mp4", "webm"].includes(extension ?? "")) return "video";
  if (["mp3", "m4a", "ogg"].includes(extension ?? "")) return "audio";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")) return "image";
  const mapped: Record<string, MoodleGatewayMaterialType> = {
    resource: "file",
    folder: "folder",
    page: "page",
    book: "book",
    url: "url",
    scorm: "scorm",
    hvp: "h5p",
    h5pactivity: "h5p",
    lti: "lti",
  };
  return mapped[moduleType.toLowerCase()] ?? "other";
}

const MATERIAL_MODULE_TYPES = new Set(["resource", "folder", "page", "book", "url"]);

function isMaterialModule(moduleType: string): boolean {
  return MATERIAL_MODULE_TYPES.has(moduleType.toLowerCase());
}

function safeModuleLocator(moduleType: string, moduleKey: string): MoodleGatewayStreamLocator | null {
  return moduleType === "resource" && NUMERIC_KEY.test(moduleKey)
    ? { kind: "course-module", moduleType: "resource", courseModuleKey: moduleKey }
    : null;
}

function parseModulesFromHtml(
  block: string,
  courseExternalKey: string,
  sectionExternalKey: string,
): { summaries: MoodleGatewayModule[]; materials: MoodleGatewayMaterial[] } {
  const moduleStarts = [...block.matchAll(/<(?:li|div)\b[^>]*(?:\bid\s*=\s*["']module-(\d+)["']|\bdata-id\s*=\s*["'](\d+)["'])[^>]*>/gi)];
  const summaries: MoodleGatewayModule[] = [];
  const materials: MoodleGatewayMaterial[] = [];
  const seen = new Set<string>();

  for (const [index, start] of moduleStarts.entries()) {
    const moduleKey = start[1] ?? start[2];
    if (!moduleKey || seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    const end = moduleStarts[index + 1]?.index ?? block.length;
    const moduleBlock = block.slice(start.index ?? 0, end);
    const semanticModuleBlock = moduleBlock.replace(
      /<span\b[^>]*class=["'][^"']*accesshide[^"']*["'][^>]*>[\s\S]*?<\/span\s*>/gi,
      " ",
    );
    const hrefMatch = moduleBlock.match(/<a\b[^>]*href\s*=\s*(["'])([^"']*\/mod\/([a-z0-9_]+)\/view\.php\?[^"']*\bid=\d+[^"']*)\1[^>]*>([\s\S]*?)<\/a\s*>/i);
    const classType = start[0].match(/\bmodtype_([a-z0-9_]+)/i)?.[1];
    const moduleType = (hrefMatch?.[3] ?? classType ?? "other").toLowerCase();
    const instanceName = semanticModuleBlock.match(/<[^>]*class=["'][^"']*instancename[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]
      ?? hrefMatch?.[4]
      ?? "";
    const title = cleanMoodleText(instanceName, 500);
    if (!title) continue;
    const available = !/\b(?:dimmed|notavailable|availabilityinfo)\b/i.test(`${start[0]} ${moduleBlock.slice(0, 1_000)}`);
    const description = cleanMoodleText(
      moduleBlock.match(/<[^>]*class=["'][^"']*activity-description[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1],
      MAX_TEXT_LENGTH,
    ) || null;
    const locator = safeModuleLocator(moduleType, moduleKey);
    const type = moduleMaterialType(moduleType, title);
    summaries.push({ externalKey: moduleKey, type: moduleType, title, available });
    if (isMaterialModule(moduleType)) {
      materials.push({
        externalKey: moduleKey,
        courseExternalKey,
        sectionExternalKey,
        type,
        title,
        description,
        available,
        openAvailable: available && locator !== null,
        downloadAvailable: available && locator !== null,
        mimeType: null,
        sizeBytes: null,
        updatedAt: null,
        locator,
      });
    }
  }

  return { summaries, materials };
}

export function parseMoodleCourseHtml(html: string, courseExternalKey: string): ParsedCoursePage {
  if (!NUMERIC_KEY.test(courseExternalKey)) throw new MoodleGatewayFailure("MOODLE_RESOURCE_NOT_FOUND");
  const heading = cleanMoodleText(
    html.match(/<div\b[^>]*class=["'][^"']*page-header-headings[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1]
      ?? html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i)?.[1]
      ?? "",
    500,
  );
  if (!heading) throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED");
  const category = cleanMoodleText(
    html.match(/<[^>]*class=["'][^"']*(?:categoryname|breadcrumb-item)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1],
    500,
  ) || null;
  const description = cleanMoodleText(
    html.match(/<[^>]*class=["'][^"']*(?:course-description|summary)[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1],
    MAX_TEXT_LENGTH,
  ) || null;
  const rawProgress = html.match(/\baria-valuenow\s*=\s*["'](\d+(?:\.\d+)?)["']/i)?.[1];
  const course: MoodleGatewayCourse = {
    externalKey: courseExternalKey,
    name: heading,
    shortName: cleanMoodleText(html.match(/\bdata-shortname\s*=\s*["']([^"']+)["']/i)?.[1], 240),
    category,
    description,
    startDate: null,
    endDate: null,
    progressAvailable: rawProgress !== undefined,
    progressPercent: rawProgress === undefined ? null : Math.max(0, Math.min(100, Number(rawProgress))),
    visible: !/\bclass\s*=\s*["'][^"']*course-hidden/i.test(html),
    hiddenByStudent: false,
    favourite: false,
  };

  const sectionStarts = [...html.matchAll(/<(?:li|section|div)\b[^>]*(?:\bid\s*=\s*["']section-(\d+)["']|\bdata-sectionid\s*=\s*["'](\d+)["'])[^>]*>/gi)];
  const sections: MoodleGatewaySection[] = [];
  const materials: MoodleGatewayMaterial[] = [];
  const seenSections = new Set<string>();
  for (const [index, start] of sectionStarts.entries()) {
    const position = Number(start[1] ?? index);
    const sectionKey = start[2] ?? `${courseExternalKey}:${Number.isFinite(position) ? position : index}`;
    if (seenSections.has(sectionKey)) continue;
    seenSections.add(sectionKey);
    const end = sectionStarts[index + 1]?.index ?? html.length;
    const block = html.slice(start.index ?? 0, end);
    const title = cleanMoodleText(
      block.match(/<[^>]*class=["'][^"']*(?:sectionname|section-title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]
        ?? block.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]\s*>/i)?.[1]
        ?? `Secção ${Number.isFinite(position) ? position : index}`,
      500,
    );
    const summary = cleanMoodleText(
      block.match(/<[^>]*class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/i)?.[1],
      MAX_TEXT_LENGTH,
    ) || null;
    const parsedModules = parseModulesFromHtml(block, courseExternalKey, sectionKey);
    sections.push({
      externalKey: sectionKey,
      courseExternalKey,
      position: Number.isFinite(position) ? position : index,
      title,
      summary,
      visible: !/\b(?:hidden|section-hidden)\b/i.test(start[0]),
      available: !/\bnotavailable\b/i.test(start[0]),
      modules: parsedModules.summaries,
    });
    materials.push(...parsedModules.materials);
  }
  return { course, sections, materials };
}

type StateRecord = Record<string, unknown> & { __entityName?: string };

function collectStateRecords(value: unknown, output: StateRecord[], depth = 0): boolean {
  if (depth > 8 || output.length >= 5_000) return false;
  if (Array.isArray(value)) {
    let complete = true;
    for (const item of value) {
      if (!collectStateRecords(item, output, depth + 1)) complete = false;
    }
    return complete;
  }
  if (!value || typeof value !== "object") return true;
  const record = value as Record<string, unknown>;
  if (record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)) {
    output.push({
      ...(record.fields as Record<string, unknown>),
      __entityName: typeof record.name === "string" ? record.name : undefined,
    });
  } else {
    output.push(record);
  }
  let complete = true;
  for (const child of Object.values(record)) {
    if (child !== record.fields && !collectStateRecords(child, output, depth + 1)) complete = false;
  }
  return complete;
}

function recordString(record: StateRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return null;
}

function recordArray(record: StateRecord, keys: string[]): unknown[] {
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
  return [];
}

export function parseMoodleCourseFormatAjaxResponse(
  raw: unknown,
  courseExternalKey: string,
): (Pick<ParsedCoursePage, "sections" | "materials"> & { complete: boolean }) | null {
  if (!NUMERIC_KEY.test(courseExternalKey)) throw new MoodleGatewayFailure("MOODLE_RESOURCE_NOT_FOUND");
  let state = unwrapAjaxData(raw);
  if (typeof state === "string") {
    try {
      state = JSON.parse(state);
    } catch (error) {
      throw new MoodleGatewayFailure("MOODLE_UPSTREAM_CHANGED", { cause: error });
    }
  }
  const records: StateRecord[] = [];
  let complete = collectStateRecords(state, records);
  const sectionRecords = records.filter((record) => {
    const entity = record.__entityName?.toLowerCase();
    return entity === "section"
      || ((recordString(record, ["section", "sectionnum", "number"]) !== null)
        && recordArray(record, ["cmlist", "modules", "cms"]).length > 0);
  });
  const moduleRecords = records.filter((record) => {
    const entity = record.__entityName?.toLowerCase();
    return entity === "cm" || recordString(record, ["modname", "modulename"]) !== null;
  });
  if (sectionRecords.length === 0) return null;

  const modulesByKey = new Map<string, StateRecord>();
  for (const module of moduleRecords) {
    const key = recordString(module, ["id", "cmid"]);
    if (key && NUMERIC_KEY.test(key)) modulesByKey.set(key, module);
  }

  const sections: MoodleGatewaySection[] = [];
  const materials: MoodleGatewayMaterial[] = [];
  const seen = new Set<string>();
  for (const [index, section] of sectionRecords.entries()) {
    const sectionKey = recordString(section, ["id", "sectionid"]) ?? `${courseExternalKey}:${index}`;
    if (seen.has(sectionKey)) continue;
    seen.add(sectionKey);
    const positionRaw = recordString(section, ["section", "sectionnum", "number"]);
    const position = positionRaw !== null && Number.isFinite(Number(positionRaw)) ? Number(positionRaw) : index;
    const moduleKeys = recordArray(section, ["cmlist", "modules", "cms"])
      .map((item) => typeof item === "object" && item !== null
        ? recordString(item as StateRecord, ["id", "cmid"])
        : String(item))
      .filter((item): item is string => Boolean(item && NUMERIC_KEY.test(item)));
    const directModules = [...modulesByKey.entries()]
      .filter(([, module]) => recordString(module, ["sectionid", "sectionId"]) === sectionKey)
      .map(([key]) => key);
    const keys = [...new Set([...moduleKeys, ...directModules])];
    const summaries: MoodleGatewayModule[] = [];
    for (const key of keys) {
      const module = modulesByKey.get(key);
      if (!module) {
        complete = false;
        continue;
      }
      const moduleType = (recordString(module, ["modname", "modulename", "type"]) ?? "other").toLowerCase();
      const title = cleanMoodleText(recordString(module, ["name", "title"]) ?? "", 500);
      if (!title) continue;
      const available = toBoolean(module.available, true) && toBoolean(module.visible, true);
      const locator = safeModuleLocator(moduleType, key);
      summaries.push({ externalKey: key, type: moduleType, title, available });
      if (isMaterialModule(moduleType)) {
        materials.push({
          externalKey: key,
          courseExternalKey,
          sectionExternalKey: sectionKey,
          type: moduleMaterialType(moduleType, title),
          title,
          description: cleanMoodleText(recordString(module, ["description", "content"]) ?? "", MAX_TEXT_LENGTH) || null,
          available,
          openAvailable: available && locator !== null,
          downloadAvailable: available && locator !== null,
          mimeType: null,
          sizeBytes: null,
          updatedAt: unixDate(module.timemodified),
          locator,
        });
      }
    }
    sections.push({
      externalKey: sectionKey,
      courseExternalKey,
      position,
      title: cleanMoodleText(recordString(section, ["title", "name"]) ?? `Secção ${position}`, 500),
      summary: cleanMoodleText(recordString(section, ["summary", "content"]) ?? "", MAX_TEXT_LENGTH) || null,
      visible: toBoolean(section.visible, true),
      available: toBoolean(section.available, true),
      modules: summaries,
    });
  }
  return { sections: sections.sort((left, right) => left.position - right.position), materials, complete };
}

export function canonicalPluginFilePath(rawHref: string, baseUrl: URL): string | null {
  let url: URL;
  try {
    url = new URL(decodeHtml(rawHref), baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== baseUrl.hostname.toLowerCase()) return null;
  if (!url.pathname.startsWith("/pluginfile.php/")) return null;
  for (const [key, value] of url.searchParams) {
    if (key !== "forcedownload" || !["0", "1"].includes(value)) return null;
  }
  return `${url.pathname}${url.search}`;
}

export function extractPluginFilePath(html: string, baseUrl: URL): string | null {
  for (const match of html.matchAll(/\bhref\s*=\s*(["'])([^"']*pluginfile\.php[^"']*)\1/gi)) {
    const path = canonicalPluginFilePath(match[2], baseUrl);
    if (path) return path;
  }
  return null;
}
