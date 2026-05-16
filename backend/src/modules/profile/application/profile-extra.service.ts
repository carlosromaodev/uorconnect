import { type PrismaClient } from "@prisma/client";
import { normalizeProfileVisibilityJson } from "./profile-visibility.service";

export type StudentProfileExtraInput = {
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

function cleanString(value?: string | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function keepDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function hasSocialProfileFields(input: Pick<StudentProfileExtraInput, "instagramUrl" | "facebookUrl" | "linkedinUrl" | "githubUrl" | "websiteUrl">) {
  return Boolean(
    cleanString(input.instagramUrl)
    || cleanString(input.facebookUrl)
    || cleanString(input.linkedinUrl)
    || cleanString(input.githubUrl)
    || cleanString(input.websiteUrl)
  );
}

export function normalizeStudentProfileExtraInput(input: StudentProfileExtraInput) {
  return keepDefined({
    bio: cleanString(input.bio),
    address: cleanString(input.address),
    instagramUrl: cleanString(input.instagramUrl),
    facebookUrl: cleanString(input.facebookUrl),
    linkedinUrl: cleanString(input.linkedinUrl),
    githubUrl: cleanString(input.githubUrl),
    websiteUrl: cleanString(input.websiteUrl),
    consentPhotoCredential: input.consentPhotoCredential ?? undefined,
    consentPublicProfile: input.consentPublicProfile ?? undefined,
    consentSocialLinks: input.consentSocialLinks ?? undefined,
    consentSms: input.consentSms ?? undefined,
    consentWhatsapp: input.consentWhatsapp ?? undefined,
    visibilityJson: normalizeProfileVisibilityJson(input.visibilityJson),
  });
}

export async function upsertStudentProfileExtra(
  prisma: PrismaClient,
  studentId: number,
  input: StudentProfileExtraInput,
) {
  const data = normalizeStudentProfileExtraInput(input);
  if (Object.keys(data).length === 0) return null;

  return prisma.studentProfileExtra.upsert({
    where: { studentId },
    create: {
      studentId,
      ...data,
    },
    update: data,
  });
}
