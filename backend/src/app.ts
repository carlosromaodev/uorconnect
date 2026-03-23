import fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { registerRoutes } from "./core/routes";
import { type Env } from "./config/env";

export type AppDependencies = Record<string, unknown>;

export function buildApp(env: Env, deps?: AppDependencies) {
  const app = fastify({
    logger: true
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const corsOrigin = env.CORS_ORIGIN.trim() === "*"
    ? true
    : env.CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);

  app.register(cors, { origin: corsOrigin });
  app.register(sensible);

  registerRoutes(app, env, deps);

  return app;
}
