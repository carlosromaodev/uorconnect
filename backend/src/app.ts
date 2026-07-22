import fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { registerRoutes } from "./core/routes";
import { type Env } from "./config/env";
import { registerPortugueseErrorHandler } from "./shared/http-errors";
import type { MoodleApplication, MoodleStudentIdentity } from "./modules/moodle/application/ports";
import type { SecretariaApplication } from "./modules/secretaria/application/secretaria.application";

export type AppDependencies = Record<string, unknown> & {
  moodle?: {
    application?: MoodleApplication;
    findEligibleStudent?: (studentId: number) => Promise<MoodleStudentIdentity | null>;
  };
  secretaria?: {
    application?: SecretariaApplication;
    findEligibleStudent?: (studentId: number) => Promise<{ id: number; studentNumber: string } | null>;
  };
};

const requestBodyLimitBytes = 10 * 1024 * 1024;
const officialUorConnectOrigins = new Set([
  "https://uorconnect.space",
  "https://www.uorconnect.space",
  "https://admin.uorconnect.space",
]);

function normalizeAllowedOrigins(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedVercelPreview(origin: string) {
  try {
    const { protocol, hostname } = new URL(origin);

    if (protocol !== "https:") {
      return false;
    }

    if (!hostname.endsWith(".vercel.app")) {
      return false;
    }

    return hostname === "uorconnect.vercel.app"
      || hostname.startsWith("uorconnect-")
      || hostname === "frontend.vercel.app"
      || hostname.startsWith("frontend-");
  } catch {
    return false;
  }
}

export function buildApp(env: Env, deps?: AppDependencies) {
  const app = fastify({
    logger: {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
          "req.body.username",
          "req.body.password",
          "req.body.dataUrl",
          "username",
          "password",
          "cookieJar",
          "sesskey",
          "wstoken",
          "credentialsEnvelope",
          "sessionEnvelope",
          "credentialEnvelope",
          "encryptedCookieJar",
        ],
        censor: "[REDACTED]",
      },
    },
    bodyLimit: requestBodyLimitBytes,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerPortugueseErrorHandler(app);

  const corsOrigin = env.CORS_ORIGIN.trim() === "*"
    ? true
    : normalizeAllowedOrigins(env.CORS_ORIGIN);

  app.register(cors, {
    origin: corsOrigin === true
      ? true
      : (origin, callback) => {
          if (!origin) {
            callback(null, true);
            return;
          }

          const isAllowedOrigin = corsOrigin.includes(origin)
            || officialUorConnectOrigins.has(origin)
            || isAllowedVercelPreview(origin);
          callback(null, isAllowedOrigin ? origin : false);
        },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "ngrok-skip-browser-warning", "x-csrf-token"],
    credentials: true,
    maxAge: 86400
  });
  app.register(sensible);
  app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    cache: 10_000,
    skipOnError: true,
    keyGenerator: (request) => request.ip,
  });

  registerRoutes(app, env, deps);

  return app;
}
