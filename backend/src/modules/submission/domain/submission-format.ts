const TEAM_MEMBER_SPLIT_REGEX = /[\n,;]+/;

export const DEFAULT_SUBMISSION_PRIMARY_COLOR = "#FD8305";
export const DEFAULT_SUBMISSION_SECONDARY_COLOR = "#223D42";
export const MAX_TEAM_MEMBERS = 17;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTeamMembersArray(values: string[]) {
  const seen = new Set<string>();

  return values
    .map((value) => normalizeText(value))
    .filter((value) => {
      if (!value) return false;

      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TEAM_MEMBERS);
}

export function normalizeTeamMembersInput(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return normalizeTeamMembersArray(value);
  }

  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return normalizeTeamMembersArray(
        parsed.filter((entry): entry is string => typeof entry === "string")
      );
    }
  } catch {
    // Mantém compatibilidade com dados antigos salvos como texto simples.
  }

  return normalizeTeamMembersArray(value.split(TEAM_MEMBER_SPLIT_REGEX));
}

export function countTeamMembers(value: string[] | string | null | undefined) {
  return normalizeTeamMembersInput(value).length;
}

export function stringifyTeamMembers(value: string[] | string | null | undefined) {
  return JSON.stringify(normalizeTeamMembersInput(value));
}

export function formatTeamMembersLabel(value: string[] | string | null | undefined) {
  return normalizeTeamMembersInput(value).join(", ");
}

export function buildSubmissionSlug(name: string, id: number) {
  const base = normalizeText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "projeto"}-${id}`;
}

export function buildSubmissionExcerpt(description: string, maxLength = 140) {
  const cleaned = normalizeText(description);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
