import { z } from "zod";

function normalizeDatabaseProvider(value: unknown) {
  return value === "postgres" ? "postgresql" : value;
}

function normalizeBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "sim", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "nao", "não", "off"].includes(normalized)) return false;
  return value;
}

function validEncryptionKeyring(value: string, activeKeyId: string) {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) return false;

  const parsed = entries.map((entry) => {
    const separator = entry.indexOf(":");
    if (separator <= 0) return null;
    const keyId = entry.slice(0, separator).trim();
    const encoded = entry.slice(separator + 1).trim();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(keyId) || !encoded) return null;
    try {
      const decoded = Buffer.from(encoded, "base64");
      const canonical = decoded.toString("base64").replace(/=+$/, "");
      if (decoded.length !== 32 || canonical !== encoded.replace(/=+$/, "")) return null;
      return keyId;
    } catch {
      return null;
    }
  });

  return parsed.every((keyId): keyId is string => Boolean(keyId))
    && new Set(parsed).size === parsed.length
    && parsed.includes(activeKeyId);
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
  UORCONNECT_CERTIFICATE_AUTHORITY_TITLE: z.string().min(2).max(180).default("Vice-Reitor para os Assuntos Científicos e de Pós-Graduação"),
  UORCONNECT_CERTIFICATE_AUTHORITY_NAME: z.string().min(2).max(180).default("Prof. Doutor Eugénio de Carvalho"),
  UORCONNECT_CERTIFICATE_ORGANIZER_NAME: z.string().min(2).max(180).default("Faculdade de Ciências e Tecnologias"),
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
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(2).default("gemini-2.5-flash"),
  GEMINI_API_BASE_URL: z.string().url().default("https://generativelanguage.googleapis.com/v1beta"),
  ODIN_AI_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(true),
  MOODLE_INTEGRATION_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  MOODLE_BASE_URL: z.string().url().default("https://moodle.uor.edu.ao"),
  MOODLE_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(25_000),
  MOODLE_ACTIVE_ENCRYPTION_KEY_ID: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("v1"),
  MOODLE_ENCRYPTION_KEYS: z.string().default(""),
  MOODLE_SESSION_IDLE_TTL_MINUTES: z.coerce.number().int().min(5).max(1_440).default(30),
  MOODLE_L1_TTL_SECONDS: z.coerce.number().int().min(30).max(300).default(300),
  MOODLE_SYNC_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
  MOODLE_SYNC_WORKER_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(true),
  MOODLE_DOWNLOAD_MAX_BYTES: z.coerce.number().int().min(1_048_576).max(524_288_000).default(104_857_600),
  MOODLE_DOWNLOAD_STREAM_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(1_800_000).default(60_000),
  SECRETARIA_INTEGRATION_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_BASE_URL: z.string().url().default("http://secretaria.uor.edu.ao"),
  SECRETARIA_ALLOW_INSECURE_UPSTREAM: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_FETCH_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(25_000),
  SECRETARIA_MAX_RESPONSE_BYTES: z.coerce.number().int().min(65_536).max(20_971_520).default(5_242_880),
  SECRETARIA_ACTIVE_ENCRYPTION_KEY_ID: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("v1"),
  SECRETARIA_ENCRYPTION_KEYS: z.string().default(""),
  SECRETARIA_WRITE_PAYMENT_REFERENCE_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_WRITE_CONTACT_DETAILS_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_WRITE_PHOTO_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_WRITE_EXAM_REGISTRATION_CANCEL_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_WRITE_GRADE_REVIEW_ENABLED: z.preprocess(normalizeBoolean, z.boolean()).default(false),
  SECRETARIA_COMMAND_CONFIRMATION_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  SECRETARIA_COMMAND_LEASE_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  GAME_NOTIFICATIONS_START_AT: z.string().min(1).default("2026-05-18T00:00:00+01:00"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(20).max(5000).default(400),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
  VALIDATION_RATE_LIMIT_MAX: z.coerce.number().int().min(20).max(5000).default(120),
  VALIDATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
}).superRefine((value, ctx) => {
  if (value.MOODLE_INTEGRATION_ENABLED) {
    if (!validEncryptionKeyring(value.MOODLE_ENCRYPTION_KEYS, value.MOODLE_ACTIVE_ENCRYPTION_KEY_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MOODLE_ENCRYPTION_KEYS"],
        message: "Moodle integration requires a valid 32-byte keyring containing the active key",
      });
    }

    if (value.NODE_ENV === "production" && new URL(value.MOODLE_BASE_URL).protocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MOODLE_BASE_URL"],
        message: "Production Moodle integration requires HTTPS",
      });
    }
  }

  if (value.SECRETARIA_INTEGRATION_ENABLED) {
    if (!validEncryptionKeyring(value.SECRETARIA_ENCRYPTION_KEYS, value.SECRETARIA_ACTIVE_ENCRYPTION_KEY_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SECRETARIA_ENCRYPTION_KEYS"],
        message: "Secretaria integration requires a valid 32-byte keyring containing the active key",
      });
    }

    const secretariaProtocol = new URL(value.SECRETARIA_BASE_URL).protocol;
    if (value.NODE_ENV === "production" && secretariaProtocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SECRETARIA_BASE_URL"],
        message: "Production Secretaria integration requires HTTPS or an approved TLS tunnel",
      });
    }
    if (value.NODE_ENV !== "production" && secretariaProtocol !== "https:" && !value.SECRETARIA_ALLOW_INSECURE_UPSTREAM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SECRETARIA_ALLOW_INSECURE_UPSTREAM"],
        message: "HTTP Secretaria access requires explicit non-production acknowledgement",
      });
    }
    if (value.NODE_ENV === "production" && (value.SECRETARIA_WRITE_PAYMENT_REFERENCE_ENABLED || value.SECRETARIA_WRITE_CONTACT_DETAILS_ENABLED || value.SECRETARIA_WRITE_PHOTO_ENABLED || value.SECRETARIA_WRITE_EXAM_REGISTRATION_CANCEL_ENABLED || value.SECRETARIA_WRITE_GRADE_REVIEW_ENABLED) && secretariaProtocol !== "https:") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [value.SECRETARIA_WRITE_PAYMENT_REFERENCE_ENABLED
          ? "SECRETARIA_WRITE_PAYMENT_REFERENCE_ENABLED"
          : value.SECRETARIA_WRITE_CONTACT_DETAILS_ENABLED
            ? "SECRETARIA_WRITE_CONTACT_DETAILS_ENABLED"
            : value.SECRETARIA_WRITE_PHOTO_ENABLED
              ? "SECRETARIA_WRITE_PHOTO_ENABLED"
              : value.SECRETARIA_WRITE_EXAM_REGISTRATION_CANCEL_ENABLED
                ? "SECRETARIA_WRITE_EXAM_REGISTRATION_CANCEL_ENABLED"
                : "SECRETARIA_WRITE_GRADE_REVIEW_ENABLED"],
        message: "Secretaria writes require an HTTPS upstream or approved TLS tunnel",
      });
    }
  }

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
