export const OFFICIAL_COURSES = [
  "Direito",
  "Relações Internacionais",
  "Psicologia",
  "Gestão de Administração e Marketing",
  "Contabilidade e Finanças",
  "Engenharia Informática e Comunicações",
  "Engenharia Electromecânica",
  "Engenharia Civil",
  "Arquitectura e Urbanismo",
  "Engenharia de Gestão Industrial",
] as const;

const OFFICIAL_COURSE_SET = new Set<string>(OFFICIAL_COURSES);

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COURSE_ALIASES = new Map<string, string>([
  ["direito", "Direito"],
  ["relacoes internacionais", "Relações Internacionais"],
  ["psicologia", "Psicologia"],
  ["gestao de administracao e marketing", "Gestão de Administração e Marketing"],
  ["gestao de empresas", "Gestão de Administração e Marketing"],
  ["contabilidade e financas", "Contabilidade e Finanças"],
  ["contabilidade e auditoria", "Contabilidade e Finanças"],
  ["engenharia informatica e comunicacoes", "Engenharia Informática e Comunicações"],
  ["eng informatica", "Engenharia Informática e Comunicações"],
  ["engenharia informatica", "Engenharia Informática e Comunicações"],
  ["eng telecomunicacoes", "Engenharia Informática e Comunicações"],
  ["engenharia telecomunicacoes", "Engenharia Informática e Comunicações"],
  ["engenharia electromecanica", "Engenharia Electromecânica"],
  ["eng eletrotecnica", "Engenharia Electromecânica"],
  ["eng electrotecnica", "Engenharia Electromecânica"],
  ["engenharia civil", "Engenharia Civil"],
  ["arquitetura e urbanismo", "Arquitectura e Urbanismo"],
  ["arquitectura e urbanismo", "Arquitectura e Urbanismo"],
  ["engenharia de gestao industrial", "Engenharia de Gestão Industrial"],
]);

export function normalizeOfficialCourse(value?: string | null) {
  if (!value) return undefined;

  const cleaned = value
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;
  if (OFFICIAL_COURSE_SET.has(cleaned)) return cleaned;

  const normalized = normalizeText(cleaned);
  const directAlias = COURSE_ALIASES.get(normalized);
  if (directAlias) return directAlias;

  const normalizedWithoutDegreePrefix = normalized
    .replace(/^(licenciatura|bacharelato|mestrado)\s+em\s+/, "")
    .trim();

  return COURSE_ALIASES.get(normalizedWithoutDegreePrefix);
}
