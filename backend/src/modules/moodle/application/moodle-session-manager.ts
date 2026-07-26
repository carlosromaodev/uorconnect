import { randomUUID } from "node:crypto";
import type {
  MoodleGateway,
  MoodleGatewayCredentials,
  MoodleGatewayProfile,
  MoodleGatewaySession,
} from "../domain/gateway";
import { MoodleGatewayFailure } from "../domain/gateway";
import { MoodleError, moodleConnectionRequired, moodleUnavailable } from "../domain/errors";
import type { MoodleRepository, PersistedMoodleConnection } from "../domain/repository";
import type { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import { connectionView } from "./moodle-presenters";
import type {
  MoodleConnectInput,
  MoodleConnectResult,
  MoodleStudentIdentity,
} from "./ports";

const CONNECT_LEASE_MS = 90_000;
const REAUTH_LEASE_MS = 90_000;
const REAUTH_HEARTBEAT_MS = 15_000;
const REAUTH_WAIT_MS = 65_000;
const REAUTH_POLL_MS = 250;

type CachedSession = {
  session: MoodleGatewaySession;
  expiresAt: number;
};

export type MoodleSessionManagerOptions = {
  l1TtlMs: number;
  now?: () => Date;
  uuid?: () => string;
  sleep?: (durationMs: number) => Promise<void>;
};

function asDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Normalizes institutional identifiers without making punctuation significant. */
export function normalizeMoodleIdentity(value: string): string | null {
  const normalized = value
    .normalize("NFKC")
    .toLocaleUpperCase("pt")
    .replace(/[^\p{L}\p{N}]/gu, "");
  return normalized.length >= 2 && normalized.length <= 80 ? normalized : null;
}

function assertSameIdentity(expected: string, profile: MoodleGatewayProfile): void {
  const uorNumber = normalizeMoodleIdentity(expected);
  const moodleNumber = normalizeMoodleIdentity(profile.studentNumber);
  if (!moodleNumber) {
    throw new MoodleError(
      "MOODLE_UPSTREAM_CHANGED",
      "O Moodle não devolveu uma identidade académica compatível.",
      502,
      true,
    );
  }
  if (!uorNumber || moodleNumber !== uorNumber) {
    throw new MoodleError(
      "MOODLE_IDENTITY_MISMATCH",
      "A conta Moodle não pertence ao estudante autenticado.",
      403,
    );
  }
}

export function mapMoodleGatewayError(error: unknown): MoodleError {
  if (error instanceof MoodleError) return error;
  if (!(error instanceof MoodleGatewayFailure)) return moodleUnavailable(error);

  switch (error.code) {
    case "MOODLE_AUTH_FAILED":
      return new MoodleError(
        "MOODLE_CREDENTIALS_INVALID",
        "As credenciais Moodle foram rejeitadas.",
        422,
        false,
        "reauthenticate",
      );
    case "MOODLE_SESSION_EXPIRED":
      return new MoodleError(
        "MOODLE_REAUTH_REQUIRED",
        "A sessão Moodle expirou e não pôde ser renovada.",
        409,
        false,
        "reauthenticate",
      );
    case "MOODLE_RESOURCE_NOT_FOUND":
    case "MOODLE_PERMISSION_DENIED":
      return new MoodleError(
        "MOODLE_RESOURCE_NOT_FOUND",
        "O recurso Moodle não foi encontrado.",
        404,
      );
    case "MOODLE_MATERIAL_UNSUPPORTED":
    case "MOODLE_UNSAFE_REDIRECT":
    case "MOODLE_RESPONSE_TOO_LARGE":
      return new MoodleError(
        "MOODLE_MATERIAL_TYPE_UNSUPPORTED",
        "Este material não pode ser aberto com segurança.",
        415,
      );
    case "MOODLE_UPSTREAM_CHANGED":
      return new MoodleError(
        "MOODLE_UPSTREAM_CHANGED",
        "A resposta atual do Moodle não é compatível com a integração.",
        502,
        true,
      );
    case "MOODLE_ENVELOPE_INVALID":
    case "MOODLE_KEY_UNAVAILABLE":
    case "MOODLE_CONFIGURATION_INVALID":
      return new MoodleError(
        "MOODLE_MISCONFIGURED",
        "A integração Moodle não está disponível. Contacta o suporte.",
        503,
        false,
        "contact_support",
      );
    case "MOODLE_UNAVAILABLE":
      return moodleUnavailable(error);
  }
}

function isActive(connection: PersistedMoodleConnection): boolean {
  return ["CONNECTED", "REFRESHING", "DEGRADED"].includes(connection.status);
}

export class MoodleSessionManager {
  readonly #cache = new Map<string, CachedSession>();
  readonly #reauthFlights = new Map<string, Promise<MoodleGatewaySession>>();
  readonly #now: () => Date;
  readonly #uuid: () => string;
  readonly #sleep: (durationMs: number) => Promise<void>;

  constructor(
    private readonly repository: MoodleRepository,
    private readonly gateway: MoodleGateway,
    private readonly keyring: MoodleCryptoKeyring,
    private readonly options: MoodleSessionManagerOptions,
  ) {
    this.#now = options.now ?? (() => new Date());
    this.#uuid = options.uuid ?? randomUUID;
    this.#sleep = options.sleep ?? ((durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)));
  }

  async connect(student: MoodleStudentIdentity, input: MoodleConnectInput): Promise<{
    result: MoodleConnectResult;
    session: MoodleGatewaySession;
  }> {
    if (normalizeMoodleIdentity(input.username) !== normalizeMoodleIdentity(student.studentNumber)) {
      throw new MoodleError(
        "MOODLE_IDENTITY_MISMATCH",
        "Usa o teu próprio número de estudante para ligar o Moodle.",
        403,
      );
    }
    const before = await this.repository.getConnection(student.id);
    const attemptId = this.#uuid();
    const credentialsEnvelope = this.keyring.encryptJson(
      { username: input.username, password: input.password },
      { studentId: String(student.id), purpose: "credentials" },
    );
    const attempt = await this.repository.beginConnectionAttempt({
      studentId: student.id,
      attemptId,
      leaseDurationMs: CONNECT_LEASE_MS,
      credentialsEnvelope,
    });
    if (!attempt.acquired) {
      throw new MoodleError(
        "MOODLE_CONNECTION_IN_PROGRESS",
        "Já existe uma ligação Moodle em curso.",
        409,
        true,
      );
    }
    this.clear(student.id);

    let authenticated: Awaited<ReturnType<MoodleGateway["authenticate"]>> | null = null;
    try {
      authenticated = await this.gateway.authenticate({
        username: input.username,
        password: input.password,
      });
      assertSameIdentity(student.studentNumber, authenticated.profile);

      const contextId = String(student.id);
      const sessionEnvelope = this.keyring.encryptJson(
        authenticated.session,
        { studentId: contextId, purpose: "session" },
      );
      const syncedAt = this.#now();
      const completed = await this.repository.completeConnectionAttempt({
        studentId: student.id,
        connectionGeneration: attempt.connection.connectionGeneration,
        attemptId,
        moodleUserId: authenticated.profile.externalUserKey,
        profile: {
          studentNumber: authenticated.profile.studentNumber,
          displayName: authenticated.profile.displayName,
          email: authenticated.profile.email,
          timezone: authenticated.profile.timezone,
          syncedAt,
        },
        credentialsEnvelope,
        sessionEnvelope,
        sessionExpiresAt: asDate(authenticated.session.expiresAt),
      });
      if (!completed) {
        throw new MoodleError(
          "MOODLE_CONNECTION_CANCELLED",
          "A ligação Moodle foi substituída ou cancelada.",
          409,
          true,
        );
      }

      const connection = await this.repository.getConnection(student.id);
      if (!connection) throw moodleConnectionRequired();
      this.clear(student.id);
      this.#putCached(connection, authenticated.session);
      return {
        result: {
          connection: connectionView(connection),
          initialSyncRunId: null,
          created: !before?.credentialsEnvelope,
        },
        session: authenticated.session,
      };
    } catch (error) {
      const mapped = mapMoodleGatewayError(error);
      const preservedExistingConnection = Boolean(before?.credentialsEnvelope && before.sessionEnvelope);
      await this.repository.cancelConnectionAttempt({
        studentId: student.id,
        connectionGeneration: attempt.connection.connectionGeneration,
        attemptId,
        status: preservedExistingConnection
          ? "DEGRADED"
          : mapped.code === "MOODLE_CREDENTIALS_INVALID" || mapped.code === "MOODLE_IDENTITY_MISMATCH"
            ? "REAUTH_REQUIRED"
            : "DEGRADED",
        lastErrorCode: error instanceof MoodleGatewayFailure ? error.code : error instanceof MoodleError ? error.code : "MOODLE_UNAVAILABLE",
        clearSecrets: false,
      }).catch(() => false);
      if (authenticated) await this.gateway.logout(authenticated.session).catch(() => undefined);
      throw mapped;
    }
  }

  async disconnect(student: MoodleStudentIdentity): Promise<PersistedMoodleConnection> {
    const connection = await this.repository.getConnection(student.id);
    if (connection?.sessionEnvelope) {
      try {
        const session = this.keyring.decryptJson<MoodleGatewaySession>(connection.sessionEnvelope, {
          studentId: String(student.id),
          purpose: "session",
        });
        await this.gateway.logout(session).catch(() => undefined);
      } catch {
        // Local deletion is authoritative even when a stale envelope cannot be read.
      }
    }
    const tombstone = await this.repository.disconnectAndPurge(student.id);
    this.clear(student.id);
    return tombstone;
  }

  async terminateSession(student: MoodleStudentIdentity): Promise<PersistedMoodleConnection> {
    const connection = await this.repository.getConnection(student.id);
    if (connection?.sessionEnvelope) {
      try {
        const session = this.keyring.decryptJson<MoodleGatewaySession>(connection.sessionEnvelope, {
          studentId: String(student.id),
          purpose: "session",
        });
        await this.gateway.logout(session).catch(() => undefined);
      } catch {
        // Local envelope invalidation remains authoritative.
      }
    }
    const terminated = await this.repository.terminateSession(student.id);
    this.clear(student.id);
    return terminated;
  }

  async withSession<T>(
    student: MoodleStudentIdentity,
    operation: (session: MoodleGatewaySession) => Promise<T>,
  ): Promise<T> {
    const current = await this.getSession(student);
    try {
      const result = await operation(current);
      await this.#persistMutatedSession(student, current);
      return result;
    } catch (error) {
      if (!(error instanceof MoodleGatewayFailure) || error.code !== "MOODLE_SESSION_EXPIRED") {
        throw mapMoodleGatewayError(error);
      }
    }

    const refreshed = await this.reauthenticate(student);
    try {
      const result = await operation(refreshed);
      await this.#persistMutatedSession(student, refreshed);
      return result;
    } catch (error) {
      throw mapMoodleGatewayError(error);
    }
  }

  async getSession(student: MoodleStudentIdentity): Promise<MoodleGatewaySession> {
    const connection = await this.#requireActiveConnection(student.id);
    const cacheKey = this.#cacheKey(connection);
    const cached = this.#cache.get(cacheKey);
    if (cached && cached.expiresAt > this.#now().getTime()) {
      await this.repository.touchConnection({
        studentId: student.id,
        connectionGeneration: connection.connectionGeneration,
        sessionVersion: connection.sessionVersion,
      }).catch(() => false);
      return cached.session;
    }
    if (!connection.sessionEnvelope) throw moodleConnectionRequired();

    try {
      const decrypted = this.keyring.decryptJsonWithRotation<MoodleGatewaySession>(
        connection.sessionEnvelope,
        { studentId: String(student.id), purpose: "session" },
      );
      if (decrypted.rotatedEnvelope) {
        await this.repository.replaceSessionEnvelopeCas({
          studentId: student.id,
          connectionGeneration: connection.connectionGeneration,
          sessionVersion: connection.sessionVersion,
          previousEnvelope: connection.sessionEnvelope,
          nextEnvelope: decrypted.rotatedEnvelope,
        }).catch(() => false);
      }
      this.#putCached(connection, decrypted.value);
      return decrypted.value;
    } catch (error) {
      throw mapMoodleGatewayError(error);
    }
  }

  reauthenticate(student: MoodleStudentIdentity): Promise<MoodleGatewaySession> {
    const key = String(student.id);
    const active = this.#reauthFlights.get(key);
    if (active) return active;
    const flight = this.#reauthenticateAcrossInstances(student)
      .finally(() => this.#reauthFlights.delete(key));
    this.#reauthFlights.set(key, flight);
    return flight;
  }

  clear(studentId?: number): void {
    if (studentId === undefined) {
      this.#cache.clear();
      return;
    }
    for (const key of this.#cache.keys()) {
      if (key.startsWith(`${studentId}:`)) this.#cache.delete(key);
    }
  }

  async #reauthenticateAcrossInstances(student: MoodleStudentIdentity): Promise<MoodleGatewaySession> {
    const observed = await this.#requireActiveConnection(student.id);
    const owner = this.#uuid();
    const lease = await this.repository.acquireReauthenticationLease({
      studentId: student.id,
      connectionGeneration: observed.connectionGeneration,
      sessionVersion: observed.sessionVersion,
      owner,
      leaseDurationMs: REAUTH_LEASE_MS,
    });

    if (!lease.acquired) {
      if (lease.connection?.nextReauthAt && lease.connection.nextReauthAt > this.#now()) {
        throw moodleUnavailable();
      }
      return this.#waitForReauthentication(student, observed);
    }
    const connection = lease.connection;
    if (!connection?.credentialsEnvelope) throw moodleConnectionRequired();

    let heartbeat: NodeJS.Timeout | undefined;
    let leaseLost = false;
    try {
      heartbeat = setInterval(() => {
        void this.repository.heartbeatReauthenticationLease({
          studentId: student.id,
          connectionGeneration: observed.connectionGeneration,
          sessionVersion: observed.sessionVersion,
          owner,
          leaseDurationMs: REAUTH_LEASE_MS,
        }).then((kept) => {
          if (!kept) leaseLost = true;
        }).catch(() => {
          leaseLost = true;
        });
      }, REAUTH_HEARTBEAT_MS);
      heartbeat.unref?.();

      const decrypted = this.keyring.decryptJsonWithRotation<MoodleGatewayCredentials>(
        connection.credentialsEnvelope,
        { studentId: String(student.id), purpose: "credentials" },
      );
      if (decrypted.rotatedEnvelope) {
        await this.repository.replaceCredentialsEnvelopeCas({
          studentId: student.id,
          connectionGeneration: observed.connectionGeneration,
          previousEnvelope: connection.credentialsEnvelope,
          nextEnvelope: decrypted.rotatedEnvelope,
        }).catch(() => false);
      }

      const authenticated = await this.gateway.authenticate(decrypted.value);
      assertSameIdentity(student.studentNumber, authenticated.profile);
      if (leaseLost) {
        await this.gateway.logout(authenticated.session).catch(() => undefined);
        return this.#waitForReauthentication(student, observed);
      }
      const sessionEnvelope = this.keyring.encryptJson(authenticated.session, {
        studentId: String(student.id),
        purpose: "session",
      });
      const completed = await this.repository.completeReauthentication({
        studentId: student.id,
        connectionGeneration: observed.connectionGeneration,
        sessionVersion: observed.sessionVersion,
        owner,
        moodleUserId: authenticated.profile.externalUserKey,
        profile: {
          studentNumber: authenticated.profile.studentNumber,
          displayName: authenticated.profile.displayName,
          email: authenticated.profile.email,
          timezone: authenticated.profile.timezone,
          syncedAt: this.#now(),
        },
        sessionEnvelope,
        sessionExpiresAt: asDate(authenticated.session.expiresAt),
      });
      if (!completed) {
        await this.gateway.logout(authenticated.session).catch(() => undefined);
        return this.#waitForReauthentication(student, observed);
      }

      const updated = await this.#requireActiveConnection(student.id);
      this.clear(student.id);
      this.#putCached(updated, authenticated.session);
      return authenticated.session;
    } catch (error) {
      const mapped = mapMoodleGatewayError(error);
      const nextFailureCount = connection.failedReauthCount + 1;
      const authFailure = mapped.code === "MOODLE_CREDENTIALS_INVALID"
        || mapped.code === "MOODLE_IDENTITY_MISMATCH"
        || mapped.code === "MOODLE_UPSTREAM_CHANGED";
      const cooldownMinutes = [1, 5, 15][Math.min(nextFailureCount - 1, 2)] ?? 15;
      await this.repository.failReauthentication({
        studentId: student.id,
        connectionGeneration: observed.connectionGeneration,
        sessionVersion: observed.sessionVersion,
        owner,
        status: authFailure && nextFailureCount >= 3 ? "REAUTH_REQUIRED" : "DEGRADED",
        lastErrorCode: mapped.code,
        nextReauthAt: authFailure
          ? new Date(this.#now().getTime() + cooldownMinutes * 60_000)
          : new Date(this.#now().getTime() + 60_000),
      }).catch(() => false);
      throw mapped;
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }

  async #waitForReauthentication(
    student: MoodleStudentIdentity,
    observed: PersistedMoodleConnection,
  ): Promise<MoodleGatewaySession> {
    const deadline = this.#now().getTime() + REAUTH_WAIT_MS;
    while (this.#now().getTime() < deadline) {
      const current = await this.repository.getConnection(student.id);
      if (!current || current.connectionGeneration !== observed.connectionGeneration) {
        throw moodleConnectionRequired();
      }
      if (current.status === "REAUTH_REQUIRED") {
        throw new MoodleError(
          "MOODLE_REAUTH_REQUIRED",
          "Volta a introduzir as credenciais Moodle.",
          409,
          false,
          "reauthenticate",
        );
      }
      if (current.nextReauthAt && current.nextReauthAt > this.#now()) {
        throw moodleUnavailable();
      }
      if (current.sessionVersion !== observed.sessionVersion && current.sessionEnvelope && isActive(current)) {
        this.clear(student.id);
        return this.getSession(student);
      }
      if (current.status !== "REFRESHING" && (!current.reauthLeaseUntil || current.reauthLeaseUntil <= this.#now())) {
        return this.#reauthenticateAcrossInstances(student);
      }
      await this.#sleep(REAUTH_POLL_MS);
    }
    throw moodleUnavailable();
  }

  async #requireActiveConnection(studentId: number): Promise<PersistedMoodleConnection> {
    const connection = await this.repository.recoverExpiredConnectionAttempt(studentId);
    if (!connection || connection.status === "DISCONNECTED" || connection.status === "CONNECTING") {
      throw moodleConnectionRequired();
    }
    if (connection.status === "REAUTH_REQUIRED") {
      throw new MoodleError(
        "MOODLE_REAUTH_REQUIRED",
        "Volta a introduzir as credenciais Moodle.",
        409,
        false,
        "reauthenticate",
      );
    }
    if (!isActive(connection)) throw moodleConnectionRequired();
    return connection;
  }

  #cacheKey(connection: PersistedMoodleConnection): string {
    return `${connection.studentId}:${connection.connectionGeneration}:${connection.sessionVersion}`;
  }

  #putCached(connection: PersistedMoodleConnection, session: MoodleGatewaySession): void {
    const configuredExpiry = this.#now().getTime() + this.options.l1TtlMs;
    const sessionExpiry = asDate(session.expiresAt)?.getTime() ?? configuredExpiry;
    this.#cache.set(this.#cacheKey(connection), {
      session,
      expiresAt: Math.min(configuredExpiry, sessionExpiry),
    });
  }

  async #persistMutatedSession(
    student: MoodleStudentIdentity,
    session: MoodleGatewaySession,
  ): Promise<void> {
    const connection = await this.repository.getConnection(student.id);
    if (!connection?.sessionEnvelope || !isActive(connection)) return;
    const cached = this.#cache.get(this.#cacheKey(connection));
    if (!cached || cached.session !== session) return;
    const nextEnvelope = this.keyring.encryptJson(session, {
      studentId: String(student.id),
      purpose: "session",
    });
    const persisted = await this.repository.replaceSessionEnvelopeCas({
      studentId: student.id,
      connectionGeneration: connection.connectionGeneration,
      sessionVersion: connection.sessionVersion,
      previousEnvelope: connection.sessionEnvelope,
      nextEnvelope,
    }).catch(() => false);
    if (persisted) this.#putCached(connection, session);
  }
}
