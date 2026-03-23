import fp from "fastify-plugin";
import { verifyStudentToken } from "../utils/jwt";
import { type Env } from "../../../config/env";

declare module "fastify" {
  interface FastifyRequest {
    student?: {
      id: number;
      studentNumber: string;
    };
  }
}

interface AuthPluginOpts {
  env: Env;
}

export const authGuard = fp<AuthPluginOpts>(async (app, opts) => {
  app.addHook("preHandler", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ message: "Missing or invalid token" });
    }

    const token = authHeader.substring("Bearer ".length);
    try {
      const payload = verifyStudentToken(token, opts.env);
      request.student = { id: payload.sub, studentNumber: payload.studentNumber };
    } catch (err) {
      request.log.warn({ err }, "invalid jwt");
      return reply.status(401).send({ message: "Invalid token" });
    }
  });
});
