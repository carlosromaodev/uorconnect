import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../app";
import { loadEnv } from "../../../config/env";
import { signStudentToken } from "../../auth/utils/jwt";
import type { UorStudentApplication } from "../application/ports";
import { uorStudentDomainFromRoute } from "./uor-student.routes";

const runId = "11cda2b1-1af5-4b86-a792-f1ef38386abc";

function fakeApplication(): UorStudentApplication {
  const profile = {
    id: "9f08ecee-8ac7-41f4-bd54-f98531c73c5b",
    institutionCode: "UOR",
    studentNumber: "20240001",
    fields: Object.fromEntries([
      "displayName", "course", "classCode", "academicYear", "academicPeriod",
      "email", "phone", "alternatePhone", "bio", "address",
    ].map((field) => [field, { value: null, source: "unknown", observedAt: null }])),
  } as Awaited<ReturnType<UorStudentApplication["getProfile"]>>;
  return {
    bootstrapInstitutionalLogin: vi.fn(async () => undefined),
    updateMoodleCredentials: vi.fn(async () => undefined),
    terminateExternalSessions: vi.fn(async () => []),
    disconnectProvider: vi.fn(async () => []),
    getProfile: vi.fn(async () => profile),
    updateProfile: vi.fn(async () => profile),
    listPrivacy: vi.fn(async () => []),
    setPrivacy: vi.fn(async (_student, input) => ({
      id: "662f7713-7c4b-4f1e-809d-0cfbc3cd71ec",
      ...input,
      policyVersion: "test",
      expiresAt: input.expiresAt?.toISOString() ?? null,
      revokedAt: input.enabled ? null : "2026-07-22T10:00:00.000Z",
      updatedAt: "2026-07-22T10:00:00.000Z",
    })),
    createDataRequest: vi.fn(async (_student, input) => ({
      id: "21c64a9a-6961-4e37-b160-4507618532b0",
      type: input.type,
      status: input.type === "export" ? "completed" : "pending",
      scope: input.scope,
      retentions: [],
      resultAvailable: input.type === "export",
      errorCode: null,
      requestedAt: "2026-07-22T10:00:00.000Z",
      completedAt: input.type === "export" ? "2026-07-22T10:00:00.000Z" : null,
    })),
    getDataRequest: vi.fn(async () => ({
      id: "21c64a9a-6961-4e37-b160-4507618532b0", type: "export", status: "completed", scope: ["profile"], retentions: [], resultAvailable: true, errorCode: null,
      requestedAt: "2026-07-22T10:00:00.000Z", completedAt: "2026-07-22T10:00:00.000Z",
    })),
    getExportPayload: vi.fn(async () => ({ exportId: "21c64a9a-6961-4e37-b160-4507618532b0" })),
    getOfficialDataset: vi.fn(async (_student, domain, page) => ({
      domain,
      items: [],
      pagination: { limit: page.limit, hasMore: false, nextCursor: null, total: null },
      provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false },
      snapshotVersion: null,
    })),
    getAcademicAverages: vi.fn(),
    listAcademicRules: vi.fn(async () => []),
    createAcademicSimulation: vi.fn(),
    updateAcademicSimulation: vi.fn(),
    listAcademicSimulations: vi.fn(async () => ({ items: [], nextCursor: null })),
    calculateRequiredGrade: vi.fn(),
    calculateScholarshipScenario: vi.fn(),
    getFinanceReceipt: vi.fn(),
    getFinancePaymentReferenceDocument: vi.fn(),
    getProviders: vi.fn(async () => [
      { provider: "secretaria", status: "connected", connected: true, credentialStored: true, actionRequired: "none", retryable: false, lastAuthenticatedAt: null, lastSuccessfulSyncAt: null },
      { provider: "moodle", status: "degraded", connected: false, credentialStored: true, actionRequired: "none", retryable: true, lastAuthenticatedAt: null, lastSuccessfulSyncAt: null },
    ]),
    getSyncOverview: vi.fn(async () => ({ runs: [{ id: runId, provider: "moodle", status: "queued", startedAt: null, finishedAt: null, errorCode: null }], automatic: true })),
    getSyncRun: vi.fn(async (_student, id) => ({ id, provider: "moodle", status: "queued", startedAt: null, finishedAt: null, errorCode: null })),
    getToday: vi.fn(async () => ({
      identity: { institutionCode: "UOR", studentNumber: "20240001", displayName: "Estudante", course: "Curso", classCode: null, academicYear: "2025/2026", academicPeriod: null, provenance: { source: "secretaria_uor", observedAt: "2026-07-22T10:00:00.000Z", coverage: "exact", stale: false } },
      priorities: [],
      academic: { enrollments: null, grades: null, exams: null, attendance: null, provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false } },
      learning: { courses: null, materials: null, provenance: { source: "moodle", observedAt: null, coverage: "not_synced", stale: false } },
      finance: { charges: null, references: null, payments: null, receipts: null, provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false } },
      agenda: { officialExams: null, moodleDeadlines: null, provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false } },
      providers: [],
    })),
    stop: vi.fn(async () => undefined),
  } as unknown as UorStudentApplication;
}

function setup(eligibleStudentNumber = "20240001") {
  const env = loadEnv({ NODE_ENV: "test", JWT_SECRET: "test-secret-with-at-least-32-characters" });
  const application = fakeApplication();
  const app = buildApp(env, {
    uorStudent: {
      application,
      findEligibleStudent: async () => ({ id: 1, institutionCode: "UOR", studentNumber: eligibleStudentNumber }),
    },
  });
  return { app, application, authorization: `Bearer ${signStudentToken(1, "20240001", env)}` };
}

describe("UOR Estudante routes", () => {
  it("deriva o domínio de observabilidade após o prefixo versionado do produto", () => {
    expect(uorStudentDomainFromRoute("/api/v1/student/academic/grades?limit=10")).toBe("academic");
    expect(uorStudentDomainFromRoute("/api/v1/student/admin/configurations")).toBe("admin");
    expect(uorStudentDomainFromRoute("/api/v1/student")).toBe("root");
  });

  it("protege todo o prefixo e valida o contexto institucional", async () => {
    const denied = setup();
    expect((await denied.app.inject({ method: "GET", url: "/api/v1/student" })).statusCode).toBe(401);
    await denied.app.close();

    const mismatch = setup("20249999");
    const response = await mismatch.app.inject({ method: "GET", url: "/api/v1/student", headers: { authorization: mismatch.authorization } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("UOR_STUDENT_ACCESS_DENIED");
    await mismatch.app.close();
  });

  it("expõe today e sincronização automática sem fabricar zeros", async () => {
    const { app, authorization } = setup();
    const today = await app.inject({ method: "GET", url: "/api/v1/student/today", headers: { authorization } });
    expect(today.statusCode).toBe(200);
    expect(today.json()).toMatchObject({
      data: { academic: { grades: null }, finance: { charges: null } },
      meta: { product: "uor_student", coverage: "partial" },
    });
    const sync = await app.inject({ method: "GET", url: "/api/v1/student/sync", headers: { authorization } });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().data).toMatchObject({ automatic: true, runs: [{ id: runId, provider: "moodle" }] });
    const detail = await app.inject({ method: "GET", url: `/api/v1/student/sync/${runId}`, headers: { authorization } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.id).toBe(runId);
    await app.close();
  });

  it("aceita atualização Moodle e não devolve a senha", async () => {
    const { app, application, authorization } = setup();
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/student/providers/moodle/credentials",
      headers: { authorization, "content-type": "application/json" },
      payload: { password: "senha-moodle-atual" },
    });
    expect(response.statusCode).toBe(202);
    expect(response.body).not.toContain("senha-moodle-atual");
    expect(application.updateMoodleCredentials).toHaveBeenCalledWith(
      { id: 1, institutionCode: "UOR", studentNumber: "20240001" },
      "senha-moodle-atual",
    );
    await app.close();
  });

  it("expõe perfil por ID opaco e aplica CSRF às mutações por cookie", async () => {
    const { app, application, authorization } = setup();
    const me = await app.inject({ method: "GET", url: "/api/v1/student/me", headers: { authorization } });
    expect(me.statusCode).toBe(200);
    expect(me.json().data).toMatchObject({
      id: "9f08ecee-8ac7-41f4-bd54-f98531c73c5b",
      institutionCode: "UOR",
    });
    const token = authorization.replace("Bearer ", "");
    const denied = await app.inject({
      method: "PATCH",
      url: "/api/v1/student/profile",
      headers: { cookie: `uor_auth=${token}`, "content-type": "application/json" },
      payload: { bio: "Perfil" },
    });
    expect(denied.statusCode).toBe(403);
    const allowed = await app.inject({
      method: "PATCH",
      url: "/api/v1/student/profile",
      headers: { cookie: `uor_auth=${token}; uor_csrf=csrf-value`, "x-csrf-token": "csrf-value", "content-type": "application/json" },
      payload: { bio: "Perfil" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(application.updateProfile).toHaveBeenCalled();
    await app.close();
  });

  it("serve snapshots académicos locais e mantém conjunto não sincronizado como desconhecido", async () => {
    const { app, application, authorization } = setup();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/student/academic/grades?limit=10",
      headers: { authorization },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { domain: "academic.grades", items: [], pagination: { total: null }, provenance: { coverage: "not_synced" } },
      meta: { coverage: "not_synced" },
    });
    expect(application.getOfficialDataset).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, institutionCode: "UOR" }),
      "academic.grades",
      { limit: 10 },
    );
    await app.close();
  });

  it("distingue término de sessão, desconexão e pedido de eliminação", async () => {
    const { app, application, authorization } = setup();
    expect((await app.inject({ method: "DELETE", url: "/api/v1/student/session", headers: { authorization } })).statusCode).toBe(200);
    expect((await app.inject({ method: "DELETE", url: "/api/v1/student/providers/moodle", headers: { authorization } })).statusCode).toBe(200);
    const deletion = await app.inject({
      method: "POST",
      url: "/api/v1/student/data-deletion-requests",
      headers: { authorization, "content-type": "application/json" },
      payload: { scope: ["profile", "privacy"] },
    });
    expect(deletion.statusCode).toBe(202);
    expect(application.terminateExternalSessions).toHaveBeenCalledTimes(1);
    expect(application.disconnectProvider).toHaveBeenCalledWith(expect.anything(), "moodle");
    expect(application.createDataRequest).toHaveBeenCalledWith(expect.anything(), { type: "delete", scope: ["profile", "privacy"] }, expect.any(String));
    await app.close();
  });
});
