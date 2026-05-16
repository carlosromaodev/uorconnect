export const profileVisibilityFields = [
  "photo",
  "bio",
  "socialLinks",
  "course",
  "organization",
  "email",
  "phone",
  "address",
] as const;

export type ProfileVisibilityField = typeof profileVisibilityFields[number];

export type ProfileVisibilitySettings = Record<ProfileVisibilityField, boolean>;

export const defaultProfileVisibility: ProfileVisibilitySettings = {
  photo: true,
  bio: true,
  socialLinks: true,
  course: true,
  organization: true,
  email: false,
  phone: false,
  address: false,
};

export function normalizeProfileVisibility(input?: Partial<Record<string, unknown>> | null): ProfileVisibilitySettings {
  const settings: ProfileVisibilitySettings = { ...defaultProfileVisibility };
  if (!input) return settings;

  for (const field of profileVisibilityFields) {
    const value = input[field];
    if (typeof value === "boolean") settings[field] = value;
  }

  settings.email = false;
  settings.phone = false;
  settings.address = false;
  return settings;
}

export function parseProfileVisibilityJson(value?: string | null): ProfileVisibilitySettings {
  if (!value) return { ...defaultProfileVisibility };
  try {
    const parsed = JSON.parse(value) as Partial<Record<string, unknown>>;
    return normalizeProfileVisibility(parsed);
  } catch {
    return { ...defaultProfileVisibility };
  }
}

export function normalizeProfileVisibilityJson(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return JSON.stringify(defaultProfileVisibility);
  return JSON.stringify(parseProfileVisibilityJson(value));
}

export function isProfileFieldVisible(value: string | null | undefined, field: ProfileVisibilityField) {
  return parseProfileVisibilityJson(value)[field] === true;
}
