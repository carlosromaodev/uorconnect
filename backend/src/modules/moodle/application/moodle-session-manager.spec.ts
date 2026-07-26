import { describe, expect, it, vi } from "vitest";
import type { MoodleGateway, MoodleGatewaySession } from "../domain/gateway";
import { MoodleGatewayFailure } from "../domain/gateway";
import type { MoodleRepository, PersistedMoodleConnection } from "../domain/repository";
import { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import {
  MoodleSessionManager,
  normalizeMoodleIdentity,
} from "./moodle-session-manager";

const key = Buffer.alloc(32, 7).toString("base64");

function connection(overrides: Partial<PersistedMoodleConnection> = {}): PersistedMoodleConnection {
  const now = new Date("2026-07-19T12:00:00.000Z");
  return {
    studentId: 42,
    status: "CONNECTED",
    moodleUserId: "9",
    profilePublicId: "2fe7502c-adbb-4cad-8ef8-c2701fb6471a",
    moodleStudentNumber: "2026-001",
    displayName: "Estudante",
    email: null,
    timezone: null,
    profileSyncedAt: now,
    credentialsEnvelope: "old-credentials",
    sessionEnvelope: "old-session",
    connectionGeneration: 3,
    sessionVersion: 4,
    activeSnapshotVersion: 2,
    activeSyncRunId: null,
    connectionAttemptId: null,
    connectionAttemptLeaseUntil: null,
    sessionExpiresAt: new Date("2026-07-19T13:00:00.000Z"),
    reauthLeaseOwner: null,
    reauthLeaseUntil: null,
    failedReauthCount: 0,
    nextReauthAt: null,
    lastAuthenticatedAt: now,
    lastSuccessfulSyncAt: now,
    lastUsedAt: now,
    lastErrorCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function gateway(overrides: Partial<MoodleGateway> = {}): MoodleGateway {
  return {
    authenticate: vi.fn(),
    validateSession: vi.fn(),
    getProfile: vi.fn(),
    listCourses: vi.fn(),
    getCourse: vi.fn(),
    getCourseContent: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    openStream: vi.fn(),
    ...overrides,
  } as MoodleGateway;
}

describe("MoodleSessionManager", () => {
  it("normaliza o número sem tornar separadores significativos", () => {
    expect(normalizeMoodleIdentity(" 2026-001/uor ")).toBe("2026001UOR");
    expect(normalizeMoodleIdentity(" ")).toBeNull();
  });

  it("rejeita username de outro estudante sem consultar o Moodle", async () => {
    const authenticate = vi.fn();
    const keyring = MoodleCryptoKeyring.fromConfig("v1", `v1:${key}`);
    const repository = { getConnection: vi.fn() } as unknown as MoodleRepository;
    const manager = new MoodleSessionManager(
      repository,
      gateway({ authenticate }),
      keyring,
      { l1TtlMs: 300_000 },
    );

    await expect(manager.connect(
      { id: 42, studentNumber: "2026-001" },
      { username: "2026-999", password: "irrelevant", rememberCredentials: true },
    )).rejects.toMatchObject({ code: "MOODLE_IDENTITY_MISMATCH", statusCode: 403 });
    expect(authenticate).not.toHaveBeenCalled();
    expect(repository.getConnection).not.toHaveBeenCalled();
    keyring.destroy();
  });

  it("preserva a ligação anterior quando novas credenciais são rejeitadas", async () => {
    const previous = connection();
    const connecting = connection({
      status: "CONNECTING",
      connectionGeneration: 4,
      connectionAttemptId: "attempt",
    });
    const cancelConnectionAttempt = vi.fn().mockResolvedValue(true);
    const repository = {
      getConnection: vi.fn().mockResolvedValueOnce(previous),
      beginConnectionAttempt: vi.fn().mockResolvedValue({ acquired: true, connection: connecting }),
      cancelConnectionAttempt,
    } as unknown as MoodleRepository;
    const keyring = MoodleCryptoKeyring.fromConfig("v1", `v1:${key}`);
    const manager = new MoodleSessionManager(
      repository,
      gateway({
        authenticate: vi.fn().mockRejectedValue(new MoodleGatewayFailure("MOODLE_AUTH_FAILED")),
      }),
      keyring,
      { l1TtlMs: 300_000, uuid: () => "attempt" },
    );

    await expect(manager.connect(
      { id: 42, studentNumber: "2026-001" },
      { username: "2026-001", password: "wrong", rememberCredentials: true },
    )).rejects.toMatchObject({ code: "MOODLE_CREDENTIALS_INVALID" });
    expect(cancelConnectionAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "DEGRADED",
      clearSecrets: false,
    }));
    expect(repository.beginConnectionAttempt).toHaveBeenCalledWith(expect.objectContaining({
      credentialsEnvelope: expect.any(String),
    }));
    keyring.destroy();
  });

  it("guarda a credencial inicial cifrada mesmo quando o Moodle exige outra senha", async () => {
    const connecting = connection({
      status: "CONNECTING",
      connectionGeneration: 1,
      connectionAttemptId: "attempt",
      credentialsEnvelope: null,
      sessionEnvelope: null,
    });
    const cancelConnectionAttempt = vi.fn().mockResolvedValue(true);
    const beginConnectionAttempt = vi.fn().mockResolvedValue({ acquired: true, connection: connecting });
    const repository = {
      getConnection: vi.fn().mockResolvedValueOnce(null),
      beginConnectionAttempt,
      cancelConnectionAttempt,
    } as unknown as MoodleRepository;
    const keyring = MoodleCryptoKeyring.fromConfig("v1", `v1:${key}`);
    const manager = new MoodleSessionManager(
      repository,
      gateway({ authenticate: vi.fn().mockRejectedValue(new MoodleGatewayFailure("MOODLE_AUTH_FAILED")) }),
      keyring,
      { l1TtlMs: 300_000, uuid: () => "attempt" },
    );

    await expect(manager.connect(
      { id: 42, studentNumber: "2026-001" },
      { username: "2026-001", password: "Est.2026", rememberCredentials: true },
    )).rejects.toMatchObject({ code: "MOODLE_CREDENTIALS_INVALID" });
    const envelope = beginConnectionAttempt.mock.calls[0]?.[0]?.credentialsEnvelope as string;
    expect(envelope).not.toContain("Est.2026");
    expect(keyring.decryptJson(envelope, { studentId: "42", purpose: "credentials" })).toEqual({
      username: "2026-001",
      password: "Est.2026",
    });
    expect(cancelConnectionAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "REAUTH_REQUIRED",
      clearSecrets: false,
    }));
    keyring.destroy();
  });

  it("persiste por CAS os cookies atualizados durante uma operação normal", async () => {
    const keyring = MoodleCryptoKeyring.fromConfig("v1", `v1:${key}`);
    const session: MoodleGatewaySession = {
      cookies: [{
        name: "MoodleSession",
        value: "before",
        domain: "moodle.uor.edu.ao",
        path: "/",
        expires: null,
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      }],
      sesskey: "safe-session-key",
      authenticatedAt: "2026-07-19T12:00:00.000Z",
      expiresAt: "2026-07-19T13:00:00.000Z",
    };
    const envelope = keyring.encryptJson(session, { studentId: "42", purpose: "session" });
    const current = connection({ sessionEnvelope: envelope });
    const replaceSessionEnvelopeCas = vi.fn().mockResolvedValue(true);
    const repository = {
      getConnection: vi.fn().mockResolvedValue(current),
      recoverExpiredConnectionAttempt: vi.fn().mockResolvedValue(current),
      replaceSessionEnvelopeCas,
    } as unknown as MoodleRepository;
    const manager = new MoodleSessionManager(repository, gateway(), keyring, {
      l1TtlMs: 300_000,
      now: () => new Date("2026-07-19T12:05:00.000Z"),
    });

    const value = await manager.withSession(
      { id: 42, studentNumber: "2026-001" },
      async (active) => {
        active.cookies[0]!.value = "after";
        return 29;
      },
    );

    expect(value).toBe(29);
    expect(replaceSessionEnvelopeCas).toHaveBeenCalledOnce();
    const persisted = replaceSessionEnvelopeCas.mock.calls[0]![0].nextEnvelope as string;
    expect(keyring.decryptJson<MoodleGatewaySession>(persisted, {
      studentId: "42",
      purpose: "session",
    }).cookies[0]?.value).toBe("after");
    keyring.destroy();
  });

  it("recupera um CONNECTING abandonado sem apagar a sessão anterior", async () => {
    const keyring = MoodleCryptoKeyring.fromConfig("v1", `v1:${key}`);
    const session: MoodleGatewaySession = {
      cookies: [],
      sesskey: "safe-session-key",
      authenticatedAt: "2026-07-19T12:00:00.000Z",
      expiresAt: "2026-07-19T13:00:00.000Z",
    };
    const envelope = keyring.encryptJson(session, { studentId: "42", purpose: "session" });
    const abandoned = connection({
      status: "CONNECTING",
      sessionEnvelope: envelope,
      connectionAttemptId: "abandoned",
      connectionAttemptLeaseUntil: new Date("2026-07-19T11:59:00.000Z"),
    });
    const recovered = connection({ status: "DEGRADED", sessionEnvelope: envelope });
    const repository = {
      recoverExpiredConnectionAttempt: vi.fn().mockResolvedValue(recovered),
    } as unknown as MoodleRepository;
    const manager = new MoodleSessionManager(repository, gateway(), keyring, {
      l1TtlMs: 300_000,
      now: () => new Date("2026-07-19T12:00:00.000Z"),
    });

    await expect(manager.getSession({ id: 42, studentNumber: "2026-001" })).resolves.toMatchObject({
      sesskey: "safe-session-key",
    });
    expect(repository.recoverExpiredConnectionAttempt).toHaveBeenCalledWith(42);
    keyring.destroy();
  });

  it("respeita nextReauthAt e falha rápido sem polling", async () => {
    const keyring = MoodleCryptoKeyring.fromConfig("v1", `v1:${key}`);
    const coolingDown = connection({
      status: "DEGRADED",
      nextReauthAt: new Date("2026-07-19T12:05:00.000Z"),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const repository = {
      recoverExpiredConnectionAttempt: vi.fn().mockResolvedValue(coolingDown),
      acquireReauthenticationLease: vi.fn().mockResolvedValue({
        acquired: false,
        connection: coolingDown,
      }),
    } as unknown as MoodleRepository;
    const manager = new MoodleSessionManager(repository, gateway(), keyring, {
      l1TtlMs: 300_000,
      now: () => new Date("2026-07-19T12:00:00.000Z"),
      sleep,
    });

    await expect(manager.reauthenticate({ id: 42, studentNumber: "2026-001" }))
      .rejects.toMatchObject({ code: "MOODLE_UNAVAILABLE", retryable: true });
    expect(sleep).not.toHaveBeenCalled();
    keyring.destroy();
  });
});
