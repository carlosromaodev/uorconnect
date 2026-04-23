import fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { registerRoutes } from "./core/routes";
import { type Env } from "./config/env";

export type AppDependencies = Record<string, unknown>;

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
    logger: true
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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

          const isAllowedOrigin = corsOrigin.includes(origin) || isAllowedVercelPreview(origin);
          callback(null, isAllowedOrigin ? origin : false);
        },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning", "x-csrf-token"],
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
