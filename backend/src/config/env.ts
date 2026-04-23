import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3333),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgresql"]).default("sqlite"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("file:")).default("file:./dev.db"),
  JWT_SECRET: z.string().min(16).default("dev-secret-change-me"),
  CORS_ORIGIN: z.string().default("*"),
  PUBLIC_API_URL: z.string().url().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(7).max(730).default(180),
  INVOICE_GENERATOR_API_URL: z.string().url().default("https://invoice-generator.com"),
  INVOICE_GENERATOR_API_KEY: z.string().min(1).optional(),
  OMBALA_API_BASE_URL: z.string().url().default("https://api.useombala.ao"),
  OMBALA_API_TOKEN: z.string().min(1).optional(),
  OMBALA_SMS_DEFAULT_SENDER: z.string().min(3).max(16).default("UOR CONNECT"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(20).max(5000).default(400),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") {
    return;
  }

  if (value.DATABASE_PROVIDER !== "postgresql") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_PROVIDER"],
      message: "Production must run with DATABASE_PROVIDER=postgresql",
    });
  }

  if (!/^postgres(?:ql)?:\/\//i.test(value.DATABASE_URL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DATABASE_URL"],
      message: "Production must use a PostgreSQL DATABASE_URL",
    });
  }
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
