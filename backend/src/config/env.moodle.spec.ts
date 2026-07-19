import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "./env";

const base = {
  NODE_ENV: "test",
  DATABASE_PROVIDER: "sqlite",
  DATABASE_URL: "file:./moodle-env-test.db",
  JWT_SECRET: "moodle-env-test-secret-at-least-32-characters",
  CORS_ORIGIN: "*",
} as const;

describe("Moodle environment configuration", () => {
  it("keeps the integration opt-in and accepts no key while disabled", () => {
    const env = loadEnv(base);
    expect(env.MOODLE_INTEGRATION_ENABLED).toBe(false);
    expect(env.MOODLE_ENCRYPTION_KEYS).toBe("");
  });

  it("requires the active 32-byte key when enabled", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadEnv({ ...base, MOODLE_INTEGRATION_ENABLED: "true" })).toThrow(
      "Invalid environment variables",
    );
    error.mockRestore();
  });

  it("accepts a valid keyring without embedding an operational secret", () => {
    const testKey = Buffer.alloc(32, 7).toString("base64");
    const env = loadEnv({
      ...base,
      MOODLE_INTEGRATION_ENABLED: "true",
      MOODLE_ACTIVE_ENCRYPTION_KEY_ID: "test-v1",
      MOODLE_ENCRYPTION_KEYS: `test-v1:${testKey}`,
    });

    expect(env.MOODLE_INTEGRATION_ENABLED).toBe(true);
    expect(env.MOODLE_ACTIVE_ENCRYPTION_KEY_ID).toBe("test-v1");
  });

  it("rejects key identifiers that the runtime envelope cannot represent", () => {
    const testKey = Buffer.alloc(32, 8).toString("base64");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadEnv({
      ...base,
      MOODLE_INTEGRATION_ENABLED: "true",
      MOODLE_ACTIVE_ENCRYPTION_KEY_ID: "invalid:key-id",
      MOODLE_ENCRYPTION_KEYS: `invalid:key-id:${testKey}`,
    })).toThrow("Invalid environment variables");
    error.mockRestore();
  });

  it("rejects plain HTTP Moodle origins in production", () => {
    const testKey = Buffer.alloc(32, 9).toString("base64");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => loadEnv({
      ...base,
      NODE_ENV: "production",
      DATABASE_PROVIDER: "postgresql",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "a-production-only-test-secret-value-over-32-chars",
      CORS_ORIGIN: "https://uorconnect.example.test",
      MOODLE_INTEGRATION_ENABLED: "true",
      MOODLE_BASE_URL: "http://moodle.example.test",
      MOODLE_ACTIVE_ENCRYPTION_KEY_ID: "test-v1",
      MOODLE_ENCRYPTION_KEYS: `test-v1:${testKey}`,
    })).toThrow("Invalid environment variables");
    error.mockRestore();
  });
});
