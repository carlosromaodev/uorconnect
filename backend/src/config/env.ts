import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3333),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("file:")).default("file:./dev.db"),
  JWT_SECRET: z.string().min(16).default("dev-secret-change-me"),
  CORS_ORIGIN: z.string().default("*"),
  PUBLIC_API_URL: z.string().url().optional(),
  INVOICE_GENERATOR_API_URL: z.string().url().default("https://invoice-generator.com"),
  INVOICE_GENERATOR_API_KEY: z.string().min(1).optional()
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("[env] invalid configuration", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}
