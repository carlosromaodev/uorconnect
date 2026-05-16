import { describe, expect, it } from "vitest";
import { sanitizePublicMemberPayload } from "./team-credentials.routes";
import { defaultProfileVisibility } from "../../profile/application/profile-visibility.service";

const baseCredential: Parameters<typeof sanitizePublicMemberPayload>[0] = {
  id: 10,
  teamMembershipId: 20,
  token: "cred_test",
  publicSlug: "membro-teste",
  category: "NUCLEO",
  categoryLabel: "Núcleo",
  team: "Tecnologia",
  role: "Membro",
  accessLevel: "Staff",
  permissions: ["ATTENDANCE"],
  status: "PROFILE_READY",
  statusLabel: "Perfil pronto",
  name: "Carlos Silva",
  email: "carlos@example.com",
  phone: "+244923000000",
  course: "Curso antigo",
  organization: "UOR Connect",
  bio: "Bio antiga da credencial",
  photoUrl: "https://cdn.uor.test/old-photo.jpg",
  address: "Morada privada",
  instagramUrl: "https://instagram.com/old",
  facebookUrl: null,
  linkedinUrl: null,
  githubUrl: null,
  websiteUrl: null,
  consentPhotoCredential: true,
  consentPublicProfile: true,
  consentSocialLinks: true,
  consentSms: false,
  consentWhatsapp: false,
  sourceSubmissionId: null,
  sourceSubmissionRef: null,
  sourceSubmissionName: null,
  sourceSubmissionType: null,
  sourceSubmissionArea: null,
  notes: "Nota interna",
  createdByStudentNumber: "20240001",
  issuedAt: "2026-05-09T08:00:00.000Z",
  issuedByStudentNumber: "20240001",
  hasIssuedSnapshot: true,
  invitationExpiresAt: null,
  expiresAt: null,
  revokedAt: null,
  revokedReason: null,
  version: 1,
  reissuedFromId: null,
  inviteUrl: "https://uor.test/equipa/credencial/cred_test",
  profileUrl: "https://uor.test/equipa/perfil/membro-teste",
  passPdfPath: "/team-credentials/members/membro-teste/pass.pdf",
  passPdfUrl: "https://api.uor.test/team-credentials/members/membro-teste/pass.pdf",
  submittedAt: "2026-05-09T08:00:00.000Z",
  lastPassIssuedAt: null,
  createdAt: "2026-05-09T08:00:00.000Z",
  updatedAt: "2026-05-09T08:00:00.000Z",
};

const liveProfile: NonNullable<Parameters<typeof sanitizePublicMemberPayload>[1]> = {
  avatarUrl: "https://cdn.uor.test/live-photo.jpg",
  course: "Curso atualizado",
  bio: "Bio do estudante",
  address: "Morada privada atualizada",
  instagramUrl: "https://instagram.com/student",
  facebookUrl: null,
  linkedinUrl: null,
  githubUrl: null,
  websiteUrl: null,
  profileExtra: {
    bio: "Bio consentida atualizada",
    address: "Morada privada extra",
    instagramUrl: "https://instagram.com/live",
    facebookUrl: null,
    linkedinUrl: "https://linkedin.com/in/live",
    githubUrl: null,
    websiteUrl: null,
    consentPhotoCredential: true,
    consentPublicProfile: true,
    consentSocialLinks: true,
    visibilityJson: JSON.stringify(defaultProfileVisibility),
  },
};

describe("sanitizePublicMemberPayload", () => {
  it("uses the live student profile as source of truth for consented public fields", () => {
    const publicPayload = sanitizePublicMemberPayload(baseCredential, liveProfile);

    expect(publicPayload.bio).toBe("Bio consentida atualizada");
    expect(publicPayload.photoUrl).toBe("https://cdn.uor.test/live-photo.jpg");
    expect(publicPayload.course).toBe("Curso atualizado");
    expect(publicPayload.instagramUrl).toBe("https://instagram.com/live");
    expect(publicPayload.linkedinUrl).toBe("https://linkedin.com/in/live");
    expect(publicPayload.email).toBeNull();
    expect(publicPayload.phone).toBeNull();
    expect(publicPayload.address).toBeNull();
    expect(publicPayload.notes).toBeNull();
    expect(publicPayload.createdByStudentNumber).toBeNull();
    expect(publicPayload.issuedByStudentNumber).toBeNull();
  });

  it("removes public profile data immediately when consent is revoked", () => {
    const revokedProfile: NonNullable<Parameters<typeof sanitizePublicMemberPayload>[1]> = {
      ...liveProfile,
      profileExtra: {
        ...liveProfile.profileExtra!,
        consentPhotoCredential: false,
        consentPublicProfile: false,
        consentSocialLinks: false,
      },
    };

    const publicPayload = sanitizePublicMemberPayload(baseCredential, revokedProfile);

    expect(publicPayload.bio).toBeNull();
    expect(publicPayload.photoUrl).toBeNull();
    expect(publicPayload.course).toBeNull();
    expect(publicPayload.instagramUrl).toBeNull();
    expect(publicPayload.linkedinUrl).toBeNull();
    expect(publicPayload.email).toBeNull();
    expect(publicPayload.phone).toBeNull();
    expect(publicPayload.address).toBeNull();
  });
});
