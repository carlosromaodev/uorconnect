import fp from "fastify-plugin";
import { verifyStudentToken } from "../utils/jwt";
import { type Env } from "../../../config/env";
import { getCookie } from "../../../shared/cookies";

declare module "fastify" {
  interface FastifyRequest {
    student?: {
      id: number;
      studentNumber: string;
    };
    authSource?: "bearer" | "cookie";
  }
}

interface AuthPluginOpts {
  env: Env;
}

export const authGuard = fp<AuthPluginOpts>(async (app, opts) => {
  app.addHook("preHandler", async (request, reply) => {
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring("Bearer ".length)
      : null;
    const cookieToken = getCookie(request, "uor_auth");
    const token = cookieToken || bearerToken;

    if (!token) {
      return reply.status(401).send({ message: "Missing or invalid token" });
    }

    try {
      const payload = verifyStudentToken(token, opts.env);
      request.student = { id: payload.sub, studentNumber: payload.studentNumber };
      request.authSource = cookieToken ? "cookie" : "bearer";

      if (request.authSource === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
        const csrfCookie = getCookie(request, "uor_csrf");
        const csrfHeader = String(request.headers["x-csrf-token"] ?? "").trim();

        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
          return reply.status(403).send({ message: "CSRF token inválido ou ausente." });
        }
      }
    } catch (err) {
      request.log.warn({ err }, "invalid jwt");
      return reply.status(401).send({ message: "Invalid token" });
    }
  });
});
