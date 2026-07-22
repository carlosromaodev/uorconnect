import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { buildApp } from "../../../app";
import { loadEnv } from "../../../config/env";
import { signStudentToken } from "../../auth/utils/jwt";
import type { SecretariaApplication } from "../application/secretaria.application";

function fakeApplication(): SecretariaApplication {
  return {
    connect: vi.fn(async () => ({
      connection: { status: "CONNECTED", connected: true, credentialStored: true, actionRequired: "none", retryable: false, lastAuthenticatedAt: "2026-07-21T20:00:00.000Z", lastSuccessfulSyncAt: null },
      profile: { studentNumber: "20240001", displayName: "Estudante Teste", email: null, course: "Curso", birthDate: null, nationality: null, phone: null },
    })),
    getConnection: vi.fn(async () => ({ status: "CONNECTED", connected: true, credentialStored: true, actionRequired: "none", retryable: false, lastAuthenticatedAt: null, lastSuccessfulSyncAt: null })),
    terminateSession: vi.fn(async () => ({ status: "DISCONNECTED", connected: false, credentialStored: true, actionRequired: "none", retryable: false, lastAuthenticatedAt: null, lastSuccessfulSyncAt: null })),
    disconnect: vi.fn(async () => ({ status: "DISCONNECTED", connected: false, credentialStored: false, actionRequired: "connect", retryable: false, lastAuthenticatedAt: null, lastSuccessfulSyncAt: null })),
    deleteImportedData: vi.fn(async () => ({ deletedSnapshots: 2, deletedSyncRuns: 1, deletedCommands: 1 })),
    getProfile: vi.fn(async () => ({ studentNumber: "20240001", displayName: "Estudante Teste", email: null, course: "Curso", birthDate: null, nationality: null, phone: null })),
    getContactDetails: vi.fn(async () => ({
      email: "student@example.test",
      phone: null,
      mobile: null,
      primaryAddress: { line1: "Rua Teste", country: "Angola", postalCode: null, postalSuffix: null, district: null, municipality: null, parish: null, foreignCountry: null },
      secondaryAddress: { line1: null, country: null, postalCode: null, postalSuffix: null, district: null, municipality: null, parish: null, foreignCountry: null },
      mailingAddress: "PRIMARY",
      editableFields: ["email", "phone", "mobile", "primaryAddressLine", "secondaryAddressLine", "mailingAddress"],
      observedAt: "2026-07-21T20:00:00.000Z",
    })),
    getPhoto: vi.fn(async () => ({ body: Buffer.from("GIF89a-test"), contentType: "image/gif", contentLength: 11, sha256: "photo-etag" })),
    getConsents: vi.fn(async () => ({ domain: "privacy.consents", items: [], total: 0, observedAt: "2026-07-21T20:00:00.000Z", coverage: "live" })),
    getDataset: vi.fn(async (_student, domain) => ({ data: { domain, items: [{ subject: "Teste" }], total: 1, observedAt: "2026-07-21T20:00:00.000Z", coverage: "live" }, stale: false, snapshotVersion: null })),
    startSync: vi.fn(async () => ({ id: "b0fd0d6c-e3a5-4abb-a760-c9463fe42336", status: "COMPLETED", snapshotVersion: 1, domains: [], completedDomains: [], failedDomains: [], startedAt: "2026-07-21T20:00:00.000Z", finishedAt: "2026-07-21T20:00:01.000Z" })),
    getSync: vi.fn(async () => ({ id: "b0fd0d6c-e3a5-4abb-a760-c9463fe42336", status: "COMPLETED", snapshotVersion: 1, domains: [], completedDomains: [], failedDomains: [], startedAt: "2026-07-21T20:00:00.000Z", finishedAt: "2026-07-21T20:00:01.000Z" })),
    preparePaymentReference: vi.fn(async () => ({ id: "8b5e8ab9-3989-4517-8a82-56128794ae87", type: "GENERATE_PAYMENT_REFERENCE", risk: "MEDIUM", status: "AWAITING_CONFIRMATION", requiresConfirmation: true, confirmationExpiresAt: "2026-07-21T20:05:00.000Z", result: null, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:00:00.000Z", completedAt: null })),
    prepareContactDetails: vi.fn(async () => ({ id: "d3bd8d65-5695-41b8-9f22-e3b042ea4e6f", type: "UPDATE_CONTACT_DETAILS", risk: "MEDIUM", status: "AWAITING_CONFIRMATION", requiresConfirmation: true, confirmationExpiresAt: "2026-07-21T20:05:00.000Z", result: null, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:00:00.000Z", completedAt: null })),
    preparePhoto: vi.fn(async () => ({ id: "0c359bab-4f18-478c-8a46-64ead3c14dab", type: "UPDATE_PHOTO", risk: "MEDIUM", status: "AWAITING_CONFIRMATION", requiresConfirmation: true, confirmationExpiresAt: "2026-07-21T20:05:00.000Z", result: null, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:00:00.000Z", completedAt: null })),
    getCommand: vi.fn(async () => ({ id: "8b5e8ab9-3989-4517-8a82-56128794ae87", type: "GENERATE_PAYMENT_REFERENCE", risk: "MEDIUM", status: "AWAITING_CONFIRMATION", requiresConfirmation: true, confirmationExpiresAt: "2026-07-21T20:05:00.000Z", result: null, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:00:00.000Z", completedAt: null })),
    getCommandAttempts: vi.fn(async () => []),
    confirmCommand: vi.fn(async () => ({ id: "8b5e8ab9-3989-4517-8a82-56128794ae87", type: "GENERATE_PAYMENT_REFERENCE", risk: "MEDIUM", status: "SUCCEEDED", requiresConfirmation: false, confirmationExpiresAt: "2026-07-21T20:05:00.000Z", result: { items: [], observedAt: "2026-07-21T20:01:00.000Z" }, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:01:00.000Z", completedAt: "2026-07-21T20:01:00.000Z" })),
    reconcileCommand: vi.fn(async () => ({ id: "8b5e8ab9-3989-4517-8a82-56128794ae87", type: "GENERATE_PAYMENT_REFERENCE", risk: "MEDIUM", status: "SUCCEEDED", requiresConfirmation: false, confirmationExpiresAt: null, result: { items: [], observedAt: "2026-07-21T20:01:00.000Z" }, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:01:00.000Z", completedAt: "2026-07-21T20:01:00.000Z" })),
    cancelCommand: vi.fn(async () => ({ id: "8b5e8ab9-3989-4517-8a82-56128794ae87", type: "GENERATE_PAYMENT_REFERENCE", risk: "MEDIUM", status: "CANCELLED", requiresConfirmation: false, confirmationExpiresAt: null, result: null, errorCode: null, createdAt: "2026-07-21T20:00:00.000Z", updatedAt: "2026-07-21T20:01:00.000Z", completedAt: "2026-07-21T20:01:00.000Z" })),
    capabilities: vi.fn(() => [{ key: "profile", mode: "read", status: "available", description: "Perfil" }]),
  } as unknown as SecretariaApplication;
}

function setup() {
  const env = loadEnv({ NODE_ENV: "test", JWT_SECRET: "test-secret-with-at-least-32-characters" });
  const application = fakeApplication();
  const app = buildApp(env, {
    secretaria: {
      application,
      findEligibleStudent: async () => ({ id: 1, studentNumber: "20240001" }),
    },
  });
  const authorization = `Bearer ${signStudentToken(1, "20240001", env)}`;
  return { app, application, authorization };
}

describe("Secretaria routes", () => {
  it("protege dados e expõe health sem informação pessoal", async () => {
    const { app } = setup();
    const health = await app.inject({ method: "GET", url: "/api/v1/integrations/secretaria/health" });
    expect(health.statusCode).toBe(200);
    const denied = await app.inject({ method: "GET", url: "/api/v1/integrations/secretaria/me" });
    expect(denied.statusCode).toBe(401);
    await app.close();
  });

  it("liga a sessão sem devolver a senha", async () => {
    const { app, authorization } = setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/secretaria/session",
      headers: { authorization, "content-type": "application/json" },
      payload: { username: "20240001", password: "never-return", rememberCredentials: true },
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain("never-return");
    expect(response.headers["cache-control"]).toContain("no-store");
    await app.close();
  });

  it("entrega datasets normalizados e exige contrato completo para preparar escrita", async () => {
    const { app, application, authorization } = setup();
    const read = await app.inject({ method: "GET", url: "/api/v1/integrations/secretaria/academic/grades", headers: { authorization } });
    expect(read.statusCode).toBe(200);
    expect(read.json().data.domain).toBe("academic.grades");

    const missingContract = await app.inject({ method: "POST", url: "/api/v1/integrations/secretaria/finance/payment-references", headers: { authorization, "content-type": "application/json" }, payload: {} });
    expect(missingContract.statusCode).toBe(422);

    const chargeRef = `scr_${"a".repeat(43)}`;
    const write = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/secretaria/finance/payment-references",
      headers: { authorization, "content-type": "application/json", "idempotency-key": "payment-reference-test-001" },
      payload: { chargeRefs: [chargeRef] },
    });
    expect(write.statusCode).toBe(202);
    expect(write.json().data.status).toBe("AWAITING_CONFIRMATION");
    expect(application.preparePaymentReference).toHaveBeenCalledWith({ id: 1, studentNumber: "20240001" }, [chargeRef], "payment-reference-test-001");

    const contacts = await app.inject({ method: "GET", url: "/api/v1/integrations/secretaria/me/contact-details", headers: { authorization } });
    expect(contacts.statusCode).toBe(200);
    expect(contacts.json().data.email).toBe("student@example.test");
    const consents = await app.inject({ method: "GET", url: "/api/v1/integrations/secretaria/consents", headers: { authorization } });
    expect(consents.statusCode).toBe(200);
    expect(consents.json().data).toMatchObject({ domain: "privacy.consents", total: 0 });

    const contactWrite = await app.inject({
      method: "PATCH",
      url: "/api/v1/integrations/secretaria/me/contact-details",
      headers: { authorization, "content-type": "application/json", "idempotency-key": "contact-details-test-001" },
      payload: { mobile: "+244 900 000 000" },
    });
    expect(contactWrite.statusCode).toBe(202);
    expect(contactWrite.json().data).toMatchObject({ type: "UPDATE_CONTACT_DETAILS", status: "AWAITING_CONFIRMATION" });
    expect(application.prepareContactDetails).toHaveBeenCalledWith(
      { id: 1, studentNumber: "20240001" },
      { mobile: "+244 900 000 000" },
      "contact-details-test-001",
    );

    const photoRead = await app.inject({ method: "GET", url: "/api/v1/integrations/secretaria/me/photo", headers: { authorization } });
    expect(photoRead.statusCode).toBe(200);
    expect(photoRead.headers.etag).toBe('"photo-etag"');
    expect(photoRead.headers["content-type"]).toContain("image/gif");

    const jpeg = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#dddddd" } }).jpeg().toBuffer();
    const photoWrite = await app.inject({
      method: "PUT",
      url: "/api/v1/integrations/secretaria/me/photo",
      headers: { authorization, "content-type": "application/json", "idempotency-key": "photo-update-test-001" },
      payload: { dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` },
    });
    jpeg.fill(0);
    expect(photoWrite.statusCode).toBe(202);
    expect(photoWrite.json().data).toMatchObject({ type: "UPDATE_PHOTO", status: "AWAITING_CONFIRMATION" });
    expect(application.preparePhoto).toHaveBeenCalledOnce();

    const confirm = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/secretaria/commands/8b5e8ab9-3989-4517-8a82-56128794ae87/confirm",
      headers: { authorization, "content-type": "application/json" },
      payload: { confirmation: "GENERATE_PAYMENT_REFERENCE" },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().data.status).toBe("SUCCEEDED");
    await app.close();
  });

  it("rejeita conteúdo que apenas declara ser JPEG", async () => {
    const { app, application, authorization } = setup();
    const invalidJpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/integrations/secretaria/me/photo",
      headers: { authorization, "content-type": "application/json", "idempotency-key": "invalid-photo-test-001" },
      payload: { dataUrl: `data:image/jpeg;base64,${invalidJpeg.toString("base64")}` },
    });
    invalidJpeg.fill(0);
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("SECRETARIA_REQUEST_INVALID");
    expect(application.preparePhoto).not.toHaveBeenCalled();
    await app.close();
  });
});
