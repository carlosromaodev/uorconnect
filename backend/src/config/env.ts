import { z } from "zod";

function normalizeDatabaseProvider(value: unknown) {
  return value === "postgres" ? "postgresql" : value;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3333),
  DATABASE_PROVIDER: z.preprocess(normalizeDatabaseProvider, z.enum(["sqlite", "postgresql"])).default("sqlite"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("file:")).default("file:./dev.db"),
  JWT_SECRET: z.string().min(16).default("dev-secret-change-me"),
  CORS_ORIGIN: z.string().default("*"),
  DEFAULT_ADMIN_STUDENT_NUMBERS: z.string().default(""),
  PUBLIC_API_URL: z.string().url().optional(),
  PUBLIC_APP_URL: z.string().url().optional(),
  UORCONNECT_EVENT_NAME: z.string().min(2).max(160).default("UOR Connect"),
  UORCONNECT_EVENT_DATE: z.string().min(2).max(120).default("Data a confirmar"),
  UORCONNECT_EVENT_LOCATION: z.string().min(2).max(160).default("Universidade Óscar Ribas"),
  UORCONNECT_INSTITUTION_NAME: z.string().min(2).max(160).default("Universidade Óscar Ribas"),
  UORCONNECT_CERTIFICATE_AUTHORITY_TITLE: z.string().min(2).max(180).default("A Vice Reitora para os Assuntos Científicos e Pós-Graduação"),
  UORCONNECT_CERTIFICATE_AUTHORITY_NAME: z.string().min(2).max(180).default("Prof. Doutora. Maria de Fátima"),
  UORCONNECT_CERTIFICATE_ORGANIZER_NAME: z.string().min(2).max(180).default("Faculdade de Ciências e Tecnologia"),
  MEDIA_STORAGE_DIR: z.string().min(1).default("storage/media"),
  MEDIA_ORPHAN_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PDF_JOB_STORAGE_DIR: z.string().min(1).default("storage/pdf-jobs"),
  PDF_JOB_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(48),
  EXHIBITOR_PDF_STORAGE_DIR: z.string().min(1).default("storage/exhibitor-pdfs"),
  EXHIBITOR_PDF_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(7).max(730).default(180),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(90).max(3650).default(730),
  CREDENTIAL_VALIDATION_LOG_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  EXPIRED_CREDENTIAL_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  INVOICE_GENERATOR_API_URL: z.string().url().default("https://invoice-generator.com"),
  INVOICE_GENERATOR_API_KEY: z.string().min(1).optional(),
  OMBALA_API_BASE_URL: z.string().url().default("https://api.useombala.ao"),
  OMBALA_API_TOKEN: z.string().min(1).optional(),
  OMBALA_SMS_DEFAULT_SENDER: z.string().min(3).max(16).default("UOR CONNECT"),
  EVOLUTION_API_BASE_URL: z.string().url().default("http://localhost:8081"),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  GAME_NOTIFICATIONS_START_AT: z.string().min(1).default("2026-05-18T00:00:00+01:00"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(20).max(5000).default(400),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
  VALIDATION_RATE_LIMIT_MAX: z.coerce.number().int().min(20).max(5000).default(120),
  VALIDATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
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

  if (value.JWT_SECRET === "dev-secret-change-me" || value.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "Production must use a strong JWT_SECRET with at least 32 characters",
    });
  }

  if (value.CORS_ORIGIN.trim() === "*") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CORS_ORIGIN"],
      message: "Production must set an explicit CORS_ORIGIN when credentials are enabled",
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
