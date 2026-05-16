export type ProfileContextKey = "BASIC" | "CONTACT_READY" | "PUBLIC_READY" | "TEAM_READY" | "ADMIN_READY" | "EXPOSITOR_READY";

export type ProfileRequirement = {
  key: string;
  label: string;
  required: boolean;
  ready: boolean;
};

export type ProfileCompletion = {
  key: ProfileContextKey;
  label: string;
  completionScore: number;
  ready: boolean;
  missingFields: Array<Omit<ProfileRequirement, "ready">>;
  missingRequiredFields: Array<Omit<ProfileRequirement, "ready">>;
};

type StudentLike = {
  studentNumber?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  profileCompletedAt?: Date | string | null;
};

type ProfileExtraLike = {
  bio?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  consentPhotoCredential?: boolean | null;
  consentPublicProfile?: boolean | null;
  consentSocialLinks?: boolean | null;
  consentSms?: boolean | null;
  consentWhatsapp?: boolean | null;
  visibilityJson?: string | null;
};

type MemberLike = {
  category?: string | null;
  team?: string | null;
  role?: string | null;
  accessLevel?: string | null;
  organization?: string | null;
  photoUrl?: string | null;
};

export type ProfileStateInput = {
  student?: StudentLike | null;
  profileExtra?: ProfileExtraLike | null;
  member?: MemberLike | null;
};

const contextLabels: Record<ProfileContextKey, string> = {
  BASIC: "Perfil basico",
  CONTACT_READY: "Contacto",
  PUBLIC_READY: "Perfil publico",
  TEAM_READY: "Credencial de equipa",
  ADMIN_READY: "Acesso administrativo",
  EXPOSITOR_READY: "Credencial de expositor",
};

function filled(value?: string | null) {
  return Boolean(value?.replace(/\s+/g, " ").trim());
}

function withFallback<T>(primary: T | null | undefined, fallback: T | null | undefined) {
  return primary ?? fallback ?? null;
}

function hasAnySocial(input: ProfileStateInput) {
  const student = input.student;
  const extra = input.profileExtra;
  return [
    withFallback(extra?.instagramUrl, student?.instagramUrl),
    withFallback(extra?.facebookUrl, student?.facebookUrl),
    withFallback(extra?.linkedinUrl, student?.linkedinUrl),
    withFallback(extra?.githubUrl, student?.githubUrl),
    withFallback(extra?.websiteUrl, student?.websiteUrl),
  ].some(filled);
}

function requirement(key: string, label: string, required: boolean, ready: boolean): ProfileRequirement {
  return { key, label, required, ready };
}

export function profileRequirements(context: ProfileContextKey, input: ProfileStateInput): ProfileRequirement[] {
  const student = input.student;
  const extra = input.profileExtra;
  const member = input.member;
  const nameReady = filled(student?.name);
  const studentNumberReady = filled(student?.studentNumber);
  const contactReady = filled(student?.phone) || filled(student?.email);
  const photoReady = filled(student?.avatarUrl) || filled(member?.photoUrl);
  const profileCompletedReady = Boolean(student?.profileCompletedAt);
  const teamReady = filled(member?.team);
  const roleReady = filled(member?.role);
  const accessReady = filled(member?.accessLevel);
  const organizationReady = filled(member?.organization) || teamReady;
  const publicContentReady = filled(withFallback(extra?.bio, student?.bio)) || photoReady || hasAnySocial(input);

  if (context === "BASIC") {
    return [
      requirement("studentNumber", "Numero de estudante", true, studentNumberReady),
      requirement("name", "Nome completo", true, nameReady),
      requirement("avatarUrl", "Fotografia", false, photoReady),
    ];
  }

  if (context === "CONTACT_READY") {
    return [
      requirement("name", "Nome completo", true, nameReady),
      requirement("contact", "Telefone ou email", true, contactReady),
      requirement("phone", "Telefone", false, filled(student?.phone)),
      requirement("email", "Email", false, filled(student?.email)),
    ];
  }

  if (context === "PUBLIC_READY") {
    return [
      requirement("name", "Nome publico", true, nameReady),
      requirement("consentPublicProfile", "Consentimento para perfil publico", true, Boolean(extra?.consentPublicProfile)),
      requirement("publicContent", "Bio, foto ou redes sociais", false, publicContentReady),
      requirement("consentSocialLinks", "Consentimento para redes sociais", false, !hasAnySocial(input) || Boolean(extra?.consentSocialLinks)),
    ];
  }

  if (context === "EXPOSITOR_READY") {
    return [
      requirement("name", "Nome completo", true, nameReady),
      requirement("photoUrl", "Fotografia", true, photoReady),
      requirement("profileCompletedAt", "Perfil UOR Connect concluido", true, profileCompletedReady),
      requirement("organization", "Projeto ou organizacao", true, organizationReady),
      requirement("contact", "Telefone ou email", true, contactReady),
    ];
  }

  const teamRequirements = [
    requirement("name", "Nome completo", true, nameReady),
    requirement("photoUrl", "Fotografia", true, photoReady),
    requirement("profileCompletedAt", "Perfil UOR Connect concluido", true, profileCompletedReady),
    requirement("team", "Equipa ou area", true, teamReady),
    requirement("role", "Cargo", true, roleReady),
    requirement("accessLevel", "Nivel de acesso", true, accessReady),
  ];

  if (context === "ADMIN_READY") {
    return [
      ...teamRequirements,
      requirement("contact", "Telefone ou email", false, contactReady),
    ];
  }

  return teamRequirements;
}

export function profileCompletion(context: ProfileContextKey, input: ProfileStateInput): ProfileCompletion {
  const requirements = profileRequirements(context, input);
  const requiredItems = requirements.filter((item) => item.required);
  const missingFields = requirements
    .filter((item) => !item.ready)
    .map(({ key, label, required }) => ({ key, label, required }));
  const missingRequiredFields = missingFields.filter((item) => item.required);
  const readyRequired = requiredItems.filter((item) => item.ready).length;

  return {
    key: context,
    label: contextLabels[context],
    completionScore: requiredItems.length > 0 ? Math.round((readyRequired / requiredItems.length) * 100) : 100,
    ready: missingRequiredFields.length === 0,
    missingFields,
    missingRequiredFields,
  };
}

export function profileState(input: ProfileStateInput) {
  const contexts: ProfileCompletion[] = [
    profileCompletion("BASIC", input),
    profileCompletion("CONTACT_READY", input),
    profileCompletion("PUBLIC_READY", input),
    profileCompletion("TEAM_READY", input),
    profileCompletion("ADMIN_READY", input),
    profileCompletion("EXPOSITOR_READY", input),
  ];

  const primary = contexts.find((item) => !item.ready) ?? contexts[contexts.length - 1];

  return {
    primaryState: primary.key,
    completionScore: primary.completionScore,
    contexts,
  };
}
