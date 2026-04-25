import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { Env } from "../../../config/env";
import { signJuryToken, signStudentToken } from "../utils/jwt";
import { authGuard } from "./auth.middleware";

const env = {
  JWT_SECRET: "test-secret-at-least-16-chars",
} as Env;

async function buildApp() {
  const app = Fastify();
  await app.register(authGuard, { env });

  app.get("/whoami", async (request) => ({
    authRole: request.authRole ?? null,
    authSource: request.authSource ?? null,
    student: request.student ?? null,
    jury: request.jury ?? null,
  }));

  app.post("/write-check", async (request) => ({
    authRole: request.authRole ?? null,
    authSource: request.authSource ?? null,
  }));

  await app.ready();
  return app;
}

describe("authGuard", () => {
  it("prioritizes Bearer jury token over stale student cookie", async () => {
    const app = await buildApp();
    const studentToken = signStudentToken(101, "20240001", env);
    const juryToken = signJuryToken(202, "+244911111111", env);

    const response = await app.inject({
      method: "GET",
      url: "/whoami",
      headers: {
        authorization: `Bearer ${juryToken}`,
        cookie: `uor_auth=${studentToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      authRole: "jury",
      authSource: "bearer",
      jury: { id: 202, phone: "+244911111111" },
      student: null,
    });

    await app.close();
  });

  it("does not require CSRF header when auth is resolved from Bearer token", async () => {
    const app = await buildApp();
    const studentToken = signStudentToken(303, "20240002", env);
    const juryToken = signJuryToken(404, "+244922222222", env);

    const response = await app.inject({
      method: "POST",
      url: "/write-check",
      payload: {},
      headers: {
        authorization: `Bearer ${juryToken}`,
        cookie: `uor_auth=${studentToken}; uor_csrf=cookie-csrf-value`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      authRole: "jury",
      authSource: "bearer",
    });

    await app.close();
  });
});
