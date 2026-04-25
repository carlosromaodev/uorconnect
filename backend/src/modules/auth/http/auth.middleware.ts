import fp from "fastify-plugin";
import { verifyAuthToken } from "../utils/jwt";
import { type Env } from "../../../config/env";
import { getCookie } from "../../../shared/cookies";

declare module "fastify" {
  interface FastifyRequest {
    student?: {
      id: number;
      studentNumber: string;
    };
    jury?: {
      id: number;
      phone: string;
    };
    authRole?: "student" | "jury";
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
    // Prefer Bearer token over cookie so an explicit fresh JWT can override stale cookie auth.
    const token = bearerToken || cookieToken;
    const authSource = bearerToken ? "bearer" : cookieToken ? "cookie" : null;

    if (!token || !authSource) {
      return reply.status(401).send({ message: "Missing or invalid token" });
    }

    try {
      const payload = verifyAuthToken(token, opts.env);
      if (payload.role === "student") {
        request.student = { id: payload.sub, studentNumber: payload.studentNumber };
        request.authRole = "student";
      } else {
        request.jury = { id: payload.sub, phone: payload.juryPhone };
        request.authRole = "jury";
      }
      request.authSource = authSource;

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
