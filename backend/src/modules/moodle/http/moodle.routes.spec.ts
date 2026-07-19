import { Readable } from "node:stream";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { loadEnv } from "../../../config/env";
import { signJuryToken, signStudentToken } from "../../auth/utils/jwt";
import type { MoodleApplication } from "../application/ports";
import { MoodleError } from "../domain/errors";
import { moodleRoutes } from "./moodle.routes";

const env = loadEnv({
  NODE_ENV: "test",
  DATABASE_PROVIDER: "sqlite",
  DATABASE_URL: "file:./dev.db",
  JWT_SECRET: "moodle-route-test-secret-at-least-32-characters",
  CORS_ORIGIN: "*",
  MOODLE_INTEGRATION_ENABLED: "false",
});

const connection = {
  status: "CONNECTED" as const,
  connected: true,
  credentialsStored: true,
  actionRequired: "none" as const,
  retryable: false,
  lastAuthenticatedAt: "2026-07-19T12:00:00.000Z",
  lastSuccessfulSyncAt: "2026-07-19T12:05:00.000Z",
};

function fakeApplication(): MoodleApplication {
  return {
    connect: vi.fn().mockResolvedValue({ connection, initialSyncRunId: "550e8400-e29b-41d4-a716-446655440010", created: true }),
    disconnect: vi.fn().mockResolvedValue({ ...connection, status: "DISCONNECTED", connected: false, credentialsStored: false }),
    getConnection: vi.fn().mockResolvedValue(connection),
    getProfile: vi.fn().mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440001",
      studentNumber: "20260001",
      displayName: "Estudante Exemplo",
      email: "estudante@example.test",
      timezone: "Africa/Luanda",
      lastSyncedAt: "2026-07-19T12:00:00.000Z",
    }),
    getOverview: vi.fn().mockResolvedValue({
      data: {
        connection,
        counts: {
          courses: { value: 29, status: "exact" },
          coursesVisible: { value: 29, status: "exact" },
          coursesWithProgress: { value: 5, status: "exact" },
          materials: { value: null, status: "not_synced" },
          activities: { value: null, status: "unsupported" },
          assignmentsOpen: { value: null, status: "unsupported" },
          quizzesOpen: { value: null, status: "unsupported" },
          notificationsUnread: { value: null, status: "unsupported" },
        },
        progress: { status: "exact", trackedCourses: 5, untrackedCourses: 24, averagePercent: 18.5 },
        coverage: { processedCourses: 0, totalCourses: 29, failedCourses: 0 },
        nextDeadlines: { status: "unsupported", items: [] },
      },
      syncedAt: new Date("2026-07-19T12:05:00.000Z"),
      stale: false,
      snapshotVersion: 1,
    }),
    listCourses: vi.fn().mockResolvedValue({
      items: [{
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: "Algoritmos",
        shortName: "ALG",
        category: "Engenharia",
        description: null,
        startDate: "2026-02-01T00:00:00.000Z",
        endDate: null,
        visible: true,
        favourite: false,
        progressAvailable: false,
        progressPercent: null,
        stale: false,
        lastSyncedAt: "2026-07-19T12:05:00.000Z",
      }],
      pagination: { returned: 1, limit: 20, hasMore: false, nextCursor: null, total: 29, totalStatus: "exact" },
      coverage: { processedCourses: 29, totalCourses: 29, failedCourses: 0 },
      syncedAt: new Date("2026-07-19T12:05:00.000Z"),
      stale: false,
      snapshotVersion: 1,
    }),
    getCourse: vi.fn().mockRejectedValue(new MoodleError("MOODLE_RESOURCE_NOT_FOUND", "Disciplina não encontrada.", 404)),
    listSections: vi.fn().mockResolvedValue({
      items: [],
      pagination: { returned: 0, limit: 20, hasMore: false, nextCursor: null, total: 0, totalStatus: "exact" },
      syncedAt: new Date("2026-07-19T12:05:00.000Z"), stale: false, snapshotVersion: 1,
    }),
    listMaterials: vi.fn().mockResolvedValue({
      items: [],
      pagination: { returned: 0, limit: 20, hasMore: false, nextCursor: null, total: 0, totalStatus: "exact" },
      syncedAt: new Date("2026-07-19T12:05:00.000Z"), stale: false, snapshotVersion: 1,
    }),
    openMaterial: vi.fn().mockResolvedValue({
      stream: Readable.from([Buffer.from("document")]), status: 200, contentType: "application/pdf", fileName: "documento.pdf",
      contentLength: 8, acceptRanges: false, contentRange: null,
    }),
    startSync: vi.fn().mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440010", status: "QUEUED", reused: false, reason: "manual",
      discoveredCourses: 0, processedCourses: 0, failedCourses: 0, materialCount: 0,
      startedAt: null, completedAt: null, errorCode: null,
    }),
    getSyncStatus: vi.fn().mockResolvedValue(null),
  };
}

const openedApps: FastifyInstance[] = [];

async function appWith(application = fakeApplication()) {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(rateLimit, { global: false });
  await app.register(moodleRoutes, {
    prefix: "/integrations/moodle",
    env,
    application,
    findEligibleStudent: async (id) => {
      if (id === 101) return { id, studentNumber: "20260001" };
      if (id === 102) return { id, studentNumber: "20260002" };
      return null;
    },
  });
  openedApps.push(app);
  await app.ready();
  return { app, application };
}

afterEach(async () => {
  await Promise.all(openedApps.splice(0).map((app) => app.close()));
});

describe("moodleRoutes", () => {
  it("returns a stable UOR auth error instead of leaking middleware details", async () => {
    const { app } = await appWith();
    const response = await app.inject({ method: "GET", url: "/integrations/moodle/courses" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "UOR_AUTH_REQUIRED", retryable: false } });
  });

  it("rejects a non-student role before invoking the Moodle application", async () => {
    const { app, application } = await appWith();
    const token = signJuryToken(202, "+244900000000", env);
    const response = await app.inject({
      method: "GET",
      url: "/integrations/moodle/courses",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
    expect(application.listCourses).not.toHaveBeenCalled();
  });

  it("returns useful pagination and keeps untracked progress null", async () => {
    const { app } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "GET",
      url: "/integrations/moodle/courses",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json()).toMatchObject({
      data: [{ progressAvailable: false, progressPercent: null }],
      meta: { pagination: { total: 29, totalStatus: "exact", returned: 1 } },
    });
  });

  it("requires CSRF for cookie-authenticated credential storage", async () => {
    const { app, application } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: { cookie: `uor_auth=${token}; uor_csrf=expected` },
      payload: { username: "20260001", password: "never-logged", rememberCredentials: true },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "UOR_CSRF_INVALID" } });
    expect(application.connect).not.toHaveBeenCalled();
  });

  it("stores credentials through the application without returning them", async () => {
    const { app } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { username: "20260001", password: "never-returned", rememberCredentials: true },
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).not.toContain("never-returned");
    expect(response.json()).toMatchObject({ data: { connection: { credentialsStored: true } } });
  });

  it("rejects missing consent with the documented safe envelope", async () => {
    const { app, application } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: { authorization: `Bearer ${token}` },
      payload: { username: "20260001", password: "never-logged", rememberCredentials: false },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: { code: "MOODLE_REQUEST_INVALID", retryable: false },
      meta: { requestId: expect.any(String) },
    });
    expect(application.connect).not.toHaveBeenCalled();
  });

  it("rejects invalid pagination without exposing Zod internals", async () => {
    const { app } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "GET",
      url: "/integrations/moodle/courses?limit=1000",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).not.toContain("Zod");
    expect(response.json()).toMatchObject({ error: { code: "MOODLE_REQUEST_INVALID" } });
  });

  it("maps malformed JSON to a safe client error", async () => {
    const { app } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      payload: "{invalid",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "MOODLE_REQUEST_INVALID" } });
  });

  it("rejects non-JSON credential bodies with 415", async () => {
    const { app } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "text/plain",
      },
      payload: "credentials must not be accepted as text",
    });

    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({ error: { code: "MOODLE_MEDIA_TYPE_UNSUPPORTED" } });
  });

  it("limits credential attempts per student and IP without blocking another student on the same IP", async () => {
    const { app } = await appWith();
    const firstToken = signStudentToken(101, "20260001", env);
    const secondToken = signStudentToken(102, "20260002", env);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accepted = await app.inject({
        method: "POST",
        url: "/integrations/moodle/session",
        headers: { authorization: `Bearer ${firstToken}` },
        payload: { username: "20260001", password: "fixture-only", rememberCredentials: true },
      });
      expect(accepted.statusCode).toBe(201);
    }
    const limited = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: { authorization: `Bearer ${firstToken}` },
      payload: { username: "20260001", password: "fixture-only", rememberCredentials: true },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: "MOODLE_RATE_LIMITED" } });

    const otherStudent = await app.inject({
      method: "POST",
      url: "/integrations/moodle/session",
      headers: { authorization: `Bearer ${secondToken}` },
      payload: { username: "20260002", password: "fixture-only", rememberCredentials: true },
    });
    expect(otherStudent.statusCode).toBe(201);
  });

  it("maps ownership-safe not-found errors", async () => {
    const { app } = await appWith();
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "GET",
      url: "/integrations/moodle/courses/550e8400-e29b-41d4-a716-446655440099",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: { code: "MOODLE_RESOURCE_NOT_FOUND" } });
  });

  it("streams a material with safe ASCII and UTF-8 attachment filenames", async () => {
    const application = fakeApplication();
    vi.mocked(application.openMaterial).mockResolvedValue({
      stream: Readable.from([Buffer.from("document")]),
      status: 200,
      contentType: "application/pdf",
      fileName: "Lição de Álgebra.pdf",
      contentLength: 8,
      acceptRanges: false,
      contentRange: null,
    });
    const { app } = await appWith(application);
    const token = signStudentToken(101, "20260001", env);
    const response = await app.inject({
      method: "GET",
      url: "/integrations/moodle/materials/550e8400-e29b-41d4-a716-446655440002/open",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain('filename="Licao de Algebra.pdf"');
    expect(response.headers["content-disposition"]).toContain("filename*=UTF-8''Li%C3%A7%C3%A3o%20de%20%C3%81lgebra.pdf");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
