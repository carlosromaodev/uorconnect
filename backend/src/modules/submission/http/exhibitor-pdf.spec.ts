import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../../config/env";
import { renderQrDataUri } from "../../../shared/qr";
import { renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { generateExhibitorPdfForSubmission } from "./exhibitor-pdf";

const prismaMock = vi.hoisted(() => ({
  submission: {
    findFirst: vi.fn(),
  },
  submissionMember: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  eventTeamCredential: {
    findMany: vi.fn(),
  },
  credentialPrintTemplate: {
    findUnique: vi.fn(),
  },
  passportMission: {
    findUnique: vi.fn(),
  },
  qrAction: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../../../shared/qr", () => ({
  renderQrDataUri: vi.fn(async (value: string) => `data:image/png;base64,${Buffer.from(value).toString("base64")}`),
}));

vi.mock("../../reports/http/pdf-report.utils", () => ({
  escapeHtml: (value: string) => value,
  formatDateLabel: (value: string) => value,
  loadLogoDataUri: vi.fn(async () => "data:image/png;base64,logo"),
  renderPdfFromHtml: vi.fn(async () => Buffer.from("pdf")),
}));

vi.mock("../../team-credentials/http/team-credentials.routes", () => ({
  buildCredentialPassPrintContent: (params: { items: Array<{ member: { name: string | null } }> }) => ({
    css: ".mock-credential-pass{}",
    sheets: params.items.map((item) => `<section class="mock-credential-pass">${item.member.name}</section>`).join(""),
    bodyClass: "print-mode-color",
  }),
  categoryTheme: () => ({
    primary: "#223D42",
    accent: "#FD8305",
    light: "#FFF7ED",
    footerLabel: "Expositor",
  }),
}));

const approvedSubmission = {
  id: 77,
  referenceCode: "UOR-77",
  type: "PROJECT" as const,
  status: "APPROVED" as const,
  name: "UOR Connect",
  description: "Projeto UOR Connect",
  area: "Tecnologia",
  course: "Engenharia Informática",
  stage: null,
  category: null,
  productType: null,
  teamSize: 3,
  members: JSON.stringify([
    "Carlos Junior do Nascimento Romao",
    "Patricia Cayeye",
    "Victorino Ricardo",
  ]),
  leaderName: "Carlos Junior do Nascimento Romao",
  leaderPhone: "923000001",
  leaderEmail: "carlos@example.com",
  needs: "Mesa",
  paymentProof: "proof.jpg",
  paymentConfirmed: true,
  paymentStatus: "CONFIRMED_BY_ADMIN",
  paymentSubmittedAt: null,
  paymentReviewedAt: new Date("2026-05-01T10:00:00.000Z"),
  paymentReviewedByStudentNumber: "20240000",
  paymentReviewNote: null,
  repoUrl: null,
  websiteUrl: null,
  instagramUrl: "https://instagram.com/uorconnect",
  facebookUrl: null,
  linkedinUrl: "https://linkedin.com/company/uorconnect",
  githubUrl: "https://github.com/uor/connect",
  observations: null,
  agreeRules: true,
  primaryColor: "#FD8305",
  secondaryColor: "#223D42",
  bannerUrl: null,
  teamInviteToken: "team_uor",
  teamInviteSentAt: null,
  isWinner: false,
  winnerSelectedAt: null,
  deletedAt: null,
  deletedByStudentNumber: null,
  deletionReason: null,
  createdAt: new Date("2026-05-01T09:00:00.000Z"),
  updatedAt: new Date("2026-05-01T10:00:00.000Z"),
  leaderId: 1,
  studentId: 10,
  studentNumberSnapshot: "20240001",
  student: {
    id: 10,
    studentNumber: "20240001",
    name: "Carlos Junior do Nascimento Romao",
    email: "carlos@example.com",
    course: "Engenharia Informática",
    phone: "923000001",
  },
};

const confirmedMembers = [
  {
    id: 1,
    submissionId: 77,
    name: "Carlos Junior do Nascimento Romao",
    normalizedName: "carlos junior do nascimento romao",
    studentId: 10,
    studentNumber: "20240001",
    studentName: "Carlos Junior do Nascimento Romao",
    studentCourse: "Engenharia Informática",
    studentPhone: "923000001",
    confirmedAt: new Date("2026-05-02T09:00:00.000Z"),
    createdAt: new Date("2026-05-01T09:00:00.000Z"),
    updatedAt: new Date("2026-05-02T09:00:00.000Z"),
  },
  {
    id: 2,
    submissionId: 77,
    name: "Patricia Cayeye",
    normalizedName: "patricia cayeye",
    studentId: 11,
    studentNumber: "20240002",
    studentName: "Patricia Cayeye",
    studentCourse: "Engenharia Informática",
    studentPhone: "923000002",
    confirmedAt: new Date("2026-05-02T09:05:00.000Z"),
    createdAt: new Date("2026-05-01T09:00:00.000Z"),
    updatedAt: new Date("2026-05-02T09:05:00.000Z"),
  },
  {
    id: 3,
    submissionId: 77,
    name: "Victorino Ricardo",
    normalizedName: "victorino ricardo",
    studentId: 12,
    studentNumber: "20240003",
    studentName: "Victorino Ricardo",
    studentCourse: "Engenharia Informática",
    studentPhone: "923000003",
    confirmedAt: new Date("2026-05-02T09:10:00.000Z"),
    createdAt: new Date("2026-05-01T09:00:00.000Z"),
    updatedAt: new Date("2026-05-02T09:10:00.000Z"),
  },
];

const invitedCredentials = [
  {
    publicSlug: "carlos-junior-do-nascimento-romao",
    status: "INVITED",
    teamMembership: { studentNumber: "20240001" },
  },
  {
    publicSlug: "patricia-cayeye",
    status: "INVITED",
    teamMembership: { studentNumber: "20240002" },
  },
  {
    publicSlug: "victorino-ricardo",
    status: "INVITED",
    teamMembership: { studentNumber: "20240003" },
  },
];

async function buildEnv(): Promise<Env> {
  return {
    NODE_ENV: "test",
    PORT: 3333,
    DATABASE_PROVIDER: "sqlite",
    DATABASE_URL: "file:./dev.db",
    JWT_SECRET: "dev-secret-change-me",
    CORS_ORIGIN: "http://localhost:5173",
    DEFAULT_ADMIN_STUDENT_NUMBERS: "",
    PUBLIC_API_URL: "https://api.uor.test",
    PUBLIC_APP_URL: "https://uor.test",
    UORCONNECT_EVENT_NAME: "UOR Connect",
    UORCONNECT_EVENT_DATE: "17 de Maio de 2026",
    UORCONNECT_EVENT_LOCATION: "Universidade Oscar Ribas",
    UORCONNECT_INSTITUTION_NAME: "Universidade Oscar Ribas",
    UORCONNECT_CERTIFICATE_AUTHORITY_TITLE: "Vice Reitora",
    UORCONNECT_CERTIFICATE_AUTHORITY_NAME: "Professora",
    UORCONNECT_CERTIFICATE_ORGANIZER_NAME: "Faculdade",
    MEDIA_STORAGE_DIR: "storage/media",
    MEDIA_ORPHAN_RETENTION_DAYS: 30,
    PDF_JOB_STORAGE_DIR: "storage/pdf-jobs",
    PDF_JOB_RETENTION_HOURS: 48,
    EXHIBITOR_PDF_STORAGE_DIR: path.join(await mkdtemp(path.join(tmpdir(), "uor-exhibitor-pdf-")), "pdfs"),
    ANALYTICS_RETENTION_DAYS: 180,
    AUDIT_LOG_RETENTION_DAYS: 730,
    CREDENTIAL_VALIDATION_LOG_RETENTION_DAYS: 365,
    EXPIRED_CREDENTIAL_RETENTION_DAYS: 365,
    INVOICE_GENERATOR_API_URL: "https://invoice-generator.com",
    OMBALA_API_BASE_URL: "https://api.useombala.ao",
    OMBALA_SMS_DEFAULT_SENDER: "UOR CONNECT",
    EVOLUTION_API_BASE_URL: "http://localhost:8081",
    RATE_LIMIT_MAX: 400,
    RATE_LIMIT_WINDOW_MS: 60_000,
    VALIDATION_RATE_LIMIT_MAX: 120,
    VALIDATION_RATE_LIMIT_WINDOW_MS: 60_000,
  } as Env;
}

describe("exhibitor manual generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.submission.findFirst.mockImplementation(({ select }) => {
      if (select?.teamInviteToken) {
        return Promise.resolve({ teamInviteToken: "team_uor", status: "APPROVED" });
      }
      return Promise.resolve(approvedSubmission);
    });
    prismaMock.submissionMember.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.submissionMember.upsert.mockResolvedValue({});
    prismaMock.submissionMember.findMany.mockResolvedValue(confirmedMembers);
    prismaMock.credentialPrintTemplate.findUnique.mockResolvedValue(null);
    prismaMock.passportMission.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.qrAction.findFirst.mockResolvedValue(null);
    prismaMock.qrAction.create.mockResolvedValue({ token: "qra_exhibitor_manual_test" });
    prismaMock.eventTeamCredential.findMany.mockImplementation(({ where }) => {
      const allowedStatuses = where?.status?.in as string[] | undefined;
      return Promise.resolve(
        invitedCredentials.filter((credential) => !allowedStatuses || allowedStatuses.includes(credential.status)),
      );
    });
  });

  it("does not block a confirmed team manual while exhibitor public profiles are still invited", async () => {
    await expect(generateExhibitorPdfForSubmission(await buildEnv(), 77, { force: true })).resolves.toMatchObject({
      created: true,
      metadata: {
        submissionId: 77,
        referenceCode: "UOR-77",
      },
    });
  });

  it("keeps the confirmed team manual available when no public profile credential exists yet", async () => {
    prismaMock.eventTeamCredential.findMany.mockResolvedValue([]);

    await expect(generateExhibitorPdfForSubmission(await buildEnv(), 77, { force: true })).resolves.toMatchObject({
      created: true,
    });

    const projectUrl = "https://uor.test/projeto/uor-connect-77";
    const projectQrCalls = vi.mocked(renderQrDataUri).mock.calls
      .filter(([value]) => value === projectUrl);

    expect(projectQrCalls).toHaveLength(2);
  });

  it("uses non-competitive exhibitor copy for business and product submissions", async () => {
    for (const variant of [
      { type: "BUSINESS" as const, area: "Negócio", name: "NegoTech Angola" },
      { type: "PRODUCT" as const, area: "Produto", name: "Pulseira NFC UOR" },
    ]) {
      prismaMock.submission.findFirst.mockImplementation(({ select }) => {
        if (select?.teamInviteToken) {
          return Promise.resolve({ teamInviteToken: "team_uor", status: "APPROVED" });
        }
        return Promise.resolve({
          ...approvedSubmission,
          type: variant.type,
          area: variant.area,
          name: variant.name,
          description: "Participação em exposição.",
        });
      });

      await generateExhibitorPdfForSubmission(await buildEnv(), 77, { force: true });

      const html = vi.mocked(renderPdfFromHtml).mock.calls.at(-1)?.[0] ?? "";

      expect(html).toContain("Participação expositiva sem votação pública");
      expect(html).toContain("não concorre à votação pública de projetos");
      expect(html).toContain("Os pontos pertencem ao Passaporte Digital do estudante");
      expect(html).toContain("QR Code oficial do expositor");
      expect(html).toContain(`${variant.area} aprovado`);
      expect(html).not.toContain("Projeto aprovado");
      expect(html).not.toContain("QR Code oficial do projeto");
    }
  });

  it("documents the exhibitor system components and challenge in the official manual", async () => {
    await generateExhibitorPdfForSubmission(await buildEnv(), 77, { force: true });

    const html = vi.mocked(renderPdfFromHtml).mock.calls.at(-1)?.[0] ?? "";

    expect(html).toContain("Componentes do sistema");
    expect(html).toContain("Guia vivo no telemóvel");
    expect(html).toContain("QR de conversão do projeto");
    expect(html).toContain("Gerar QR de votação");
    expect(html).toContain("Minha Área do expositor");
    expect(html).toContain("Detalhes públicos do projeto");
    expect(html).toContain("Guardar detalhes públicos");
    expect(html).toContain("Remover membros do grupo");
    expect(html).toContain("Remover membro");
    expect(html).toContain("Desafio do Expositor");
    expect(html).toContain("Mapa do expositor");
    expect(html).toContain("Ranking interno dos embaixadores");
  });
});
