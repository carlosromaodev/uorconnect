import {
  MoodleConnectionStatus,
  MoodleEntityKind,
  MoodleSyncRunStatus,
  Prisma,
  type MoodleConnection as PrismaMoodleConnection,
  type MoodleSyncRun as PrismaMoodleSyncRun,
  type PrismaClient,
} from "@prisma/client";
import type {
  MoodleRepository,
  PersistedCourseSnapshot,
  PersistedMaterialSnapshot,
  PersistedMoodleConnection,
  PersistedMoodleSyncRun,
  PersistedSectionSnapshot,
  RepositoryCourseSnapshotInput,
  RepositoryMaterialSnapshotInput,
  RepositoryPage,
  RepositoryPositionCursor,
  RepositorySectionSnapshotInput,
  RepositoryTextCursor,
} from "../domain/repository";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const ACTIVE_CONNECTION_STATUSES: MoodleConnectionStatus[] = [
  MoodleConnectionStatus.CONNECTED,
  MoodleConnectionStatus.DEGRADED,
  MoodleConnectionStatus.REFRESHING,
];

const ACTIVE_SYNC_STATUSES: MoodleSyncRunStatus[] = [
  MoodleSyncRunStatus.QUEUED,
  MoodleSyncRunStatus.RUNNING,
];

class MoodleRepositoryCasMiss extends Error {}

export class MoodleRepositoryStateError extends Error {
  constructor(
    readonly code:
      | "MOODLE_CONNECTION_REQUIRED"
      | "MOODLE_REAUTH_REQUIRED"
      | "MOODLE_INVALID_SNAPSHOT_INPUT",
    message: string,
  ) {
    super(message);
    this.name = "MoodleRepositoryStateError";
  }
}

function parseDatabaseTimestamp(value: Date | string): Date {
  if (value instanceof Date) return value;
  const timestamp = /(?:Z|[+-]\d\d:\d\d)$/u.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("A base de dados devolveu um timestamp inválido.");
  }
  return parsed;
}

async function databaseNow(client: DatabaseClient): Promise<Date> {
  // CURRENT_TIMESTAMP is supported by SQLite and PostgreSQL. Leases therefore
  // compare a common database clock instead of clocks from application hosts.
  const rows = await client.$queryRawUnsafe<Array<{ now: Date | string }>>(
    'SELECT CURRENT_TIMESTAMP AS "now"',
  );
  const value = rows[0]?.now;
  if (!value) throw new Error("Não foi possível obter a hora da base de dados.");
  return parseDatabaseTimestamp(value);
}

function leaseUntil(now: Date, durationMs: number): Date {
  if (!Number.isSafeInteger(durationMs) || durationMs < 1_000) {
    throw new RangeError("A duração do lease deve ter pelo menos 1000 ms.");
  }
  return new Date(now.getTime() + durationMs);
}

function toConnection(row: PrismaMoodleConnection): PersistedMoodleConnection {
  return {
    studentId: row.studentId,
    status: row.status,
    moodleUserId: row.moodleUserId,
    profilePublicId: row.profilePublicId,
    moodleStudentNumber: row.moodleStudentNumber,
    displayName: row.displayName,
    email: row.email,
    timezone: row.timezone,
    profileSyncedAt: row.profileSyncedAt,
    credentialsEnvelope: row.credentialsEnvelope,
    sessionEnvelope: row.sessionEnvelope,
    connectionGeneration: row.connectionGeneration,
    sessionVersion: row.sessionVersion,
    activeSnapshotVersion: row.activeSnapshotVersion,
    activeSyncRunId: row.activeSyncRunId,
    connectionAttemptId: row.connectionAttemptId,
    connectionAttemptLeaseUntil: row.connectionAttemptLeaseUntil,
    sessionExpiresAt: row.sessionExpiresAt,
    reauthLeaseOwner: row.reauthLeaseOwner,
    reauthLeaseUntil: row.reauthLeaseUntil,
    failedReauthCount: row.failedReauthCount,
    nextReauthAt: row.nextReauthAt,
    lastAuthenticatedAt: row.lastAuthenticatedAt,
    lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
    lastUsedAt: row.lastUsedAt,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSyncRun(row: PrismaMoodleSyncRun): PersistedMoodleSyncRun {
  return {
    id: row.id,
    studentId: row.studentId,
    status: row.status,
    reason: row.reason,
    connectionGeneration: row.connectionGeneration,
    snapshotVersion: row.snapshotVersion,
    attempts: row.attempts,
    leaseOwner: row.leaseOwner,
    leaseUntil: row.leaseUntil,
    heartbeatAt: row.heartbeatAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    discoveredCourses: row.discoveredCourses,
    processedCourses: row.processedCourses,
    failedCourses: row.failedCourses,
    totalMaterials: row.totalMaterials,
    checkpointJson: row.checkpointJson,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertSnapshotGraph(
  course: RepositoryCourseSnapshotInput,
  sections: RepositorySectionSnapshotInput[],
  materials: RepositoryMaterialSnapshotInput[],
): void {
  if (!course.progressAvailable && course.progressPercent !== null) {
    throw new MoodleRepositoryStateError(
      "MOODLE_INVALID_SNAPSHOT_INPUT",
      "Progresso indisponível deve usar percentagem nula.",
    );
  }
  if (
    course.progressPercent !== null
    && (!Number.isFinite(course.progressPercent)
      || course.progressPercent < 0
      || course.progressPercent > 100)
  ) {
    throw new MoodleRepositoryStateError(
      "MOODLE_INVALID_SNAPSHOT_INPUT",
      "A percentagem de progresso está fora do intervalo permitido.",
    );
  }
  const sectionKeys = new Set<string>();
  for (const section of sections) {
    if (section.courseExternalKey !== course.moodleExternalKey) {
      throw new MoodleRepositoryStateError(
        "MOODLE_INVALID_SNAPSHOT_INPUT",
        "Uma secção não pertence ao curso em staging.",
      );
    }
    if (sectionKeys.has(section.moodleExternalKey)) {
      throw new MoodleRepositoryStateError(
        "MOODLE_INVALID_SNAPSHOT_INPUT",
        "A lista contém secções Moodle duplicadas.",
      );
    }
    sectionKeys.add(section.moodleExternalKey);
  }
  const materialKeys = new Set<string>();
  for (const material of materials) {
    if (material.courseExternalKey !== course.moodleExternalKey) {
      throw new MoodleRepositoryStateError(
        "MOODLE_INVALID_SNAPSHOT_INPUT",
        "Um material não pertence ao curso em staging.",
      );
    }
    if (material.sectionExternalKey && !sectionKeys.has(material.sectionExternalKey)) {
      throw new MoodleRepositoryStateError(
        "MOODLE_INVALID_SNAPSHOT_INPUT",
        "Um material referencia uma secção ausente do snapshot.",
      );
    }
    if (materialKeys.has(material.moodleExternalKey)) {
      throw new MoodleRepositoryStateError(
        "MOODLE_INVALID_SNAPSHOT_INPUT",
        "A lista contém materiais Moodle duplicados.",
      );
    }
    materialKeys.add(material.moodleExternalKey);
  }
}

export class PrismaMoodleRepository implements MoodleRepository {
  /** The composition root supplies the already configured shared Prisma client. */
  constructor(private readonly client: PrismaClient) {}

  async getConnection(studentId: number): Promise<PersistedMoodleConnection | null> {
    const row = await this.client.moodleConnection.findUnique({ where: { studentId } });
    return row ? toConnection(row) : null;
  }

  async recoverExpiredConnectionAttempt(studentId: number): Promise<PersistedMoodleConnection | null> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const current = await tx.moodleConnection.findUnique({ where: { studentId } });
      if (
        !current
        || current.status !== MoodleConnectionStatus.CONNECTING
        || !current.connectionAttemptId
        || (current.connectionAttemptLeaseUntil && current.connectionAttemptLeaseUntil > now)
      ) return current ? toConnection(current) : null;

      const preservePrevious = Boolean(current.credentialsEnvelope && current.sessionEnvelope);
      await tx.moodleConnection.updateMany({
        where: {
          studentId,
          connectionGeneration: current.connectionGeneration,
          connectionAttemptId: current.connectionAttemptId,
          status: MoodleConnectionStatus.CONNECTING,
          OR: [
            { connectionAttemptLeaseUntil: null },
            { connectionAttemptLeaseUntil: { lte: now } },
          ],
        },
        data: {
          status: preservePrevious
            ? MoodleConnectionStatus.DEGRADED
            : MoodleConnectionStatus.DISCONNECTED,
          connectionAttemptId: null,
          connectionAttemptLeaseUntil: null,
          lastErrorCode: "MOODLE_CONNECTION_CANCELLED",
          ...(preservePrevious
            ? {}
            : {
                credentialsEnvelope: null,
                sessionEnvelope: null,
                sessionExpiresAt: null,
              }),
        },
      });
      const recovered = await tx.moodleConnection.findUnique({ where: { studentId } });
      return recovered ? toConnection(recovered) : null;
    });
  }

  async beginConnectionAttempt(input: {
    studentId: number;
    attemptId: string;
    leaseDurationMs: number;
  }): Promise<{ acquired: boolean; connection: PersistedMoodleConnection }> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      await tx.moodleConnection.upsert({
        where: { studentId: input.studentId },
        create: {
          studentId: input.studentId,
          status: MoodleConnectionStatus.DISCONNECTED,
        },
        update: {},
      });

      const current = await tx.moodleConnection.findUniqueOrThrow({
        where: { studentId: input.studentId },
      });
      const acquired = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: current.connectionGeneration,
          OR: [
            { status: { not: MoodleConnectionStatus.CONNECTING } },
            { connectionAttemptId: null },
            { connectionAttemptLeaseUntil: null },
            { connectionAttemptLeaseUntil: { lte: now } },
          ],
        },
        data: {
          status: MoodleConnectionStatus.CONNECTING,
          connectionGeneration: { increment: 1 },
          connectionAttemptId: input.attemptId,
          connectionAttemptLeaseUntil: leaseUntil(now, input.leaseDurationMs),
          reauthLeaseOwner: null,
          reauthLeaseUntil: null,
          activeSyncRunId: null,
          lastErrorCode: null,
        },
      });

      if (acquired.count === 1 && current.activeSyncRunId) {
        await tx.moodleSyncRun.updateMany({
          where: {
            id: current.activeSyncRunId,
            studentId: input.studentId,
            status: { in: ACTIVE_SYNC_STATUSES },
          },
          data: {
            status: MoodleSyncRunStatus.CANCELLED,
            finishedAt: now,
            leaseOwner: null,
            leaseUntil: null,
            heartbeatAt: null,
            lastErrorCode: "MOODLE_CONNECTION_REPLACED",
          },
        });
      }

      const result = await tx.moodleConnection.findUniqueOrThrow({
        where: { studentId: input.studentId },
      });
      return { acquired: acquired.count === 1, connection: toConnection(result) };
    });
  }

  async completeConnectionAttempt(input: {
    studentId: number;
    connectionGeneration: number;
    attemptId: string;
    moodleUserId: string;
    profile: {
      studentNumber: string;
      displayName: string;
      email: string | null;
      timezone: string | null;
      syncedAt: Date;
    };
    credentialsEnvelope: string;
    sessionEnvelope: string;
    sessionExpiresAt: Date | null;
  }): Promise<boolean> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const result = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          connectionAttemptId: input.attemptId,
          connectionAttemptLeaseUntil: { gt: now },
          status: MoodleConnectionStatus.CONNECTING,
        },
        data: {
          status: MoodleConnectionStatus.CONNECTED,
          moodleUserId: input.moodleUserId,
          moodleStudentNumber: input.profile.studentNumber,
          displayName: input.profile.displayName,
          email: input.profile.email,
          timezone: input.profile.timezone,
          profileSyncedAt: input.profile.syncedAt,
          credentialsEnvelope: input.credentialsEnvelope,
          sessionEnvelope: input.sessionEnvelope,
          sessionExpiresAt: input.sessionExpiresAt,
          sessionVersion: { increment: 1 },
          connectionAttemptId: null,
          connectionAttemptLeaseUntil: null,
          reauthLeaseOwner: null,
          reauthLeaseUntil: null,
          failedReauthCount: 0,
          nextReauthAt: null,
          lastAuthenticatedAt: input.profile.syncedAt,
          lastUsedAt: input.profile.syncedAt,
          lastErrorCode: null,
        },
      });
      return result.count === 1;
    });
  }

  async cancelConnectionAttempt(input: {
    studentId: number;
    connectionGeneration: number;
    attemptId: string;
    status: "DISCONNECTED" | "REAUTH_REQUIRED" | "DEGRADED";
    lastErrorCode: string;
    clearSecrets?: boolean;
  }): Promise<boolean> {
    const secretData = input.clearSecrets
      ? { credentialsEnvelope: null, sessionEnvelope: null, sessionExpiresAt: null }
      : {};
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        connectionAttemptId: input.attemptId,
        status: MoodleConnectionStatus.CONNECTING,
      },
      data: {
        status: input.status,
        connectionAttemptId: null,
        connectionAttemptLeaseUntil: null,
        lastErrorCode: input.lastErrorCode,
        ...secretData,
      },
    });
    return result.count === 1;
  }

  async disconnectAndPurge(studentId: number): Promise<PersistedMoodleConnection> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const connection = await tx.moodleConnection.upsert({
        where: { studentId },
        create: {
          studentId,
          status: MoodleConnectionStatus.DISCONNECTED,
          connectionGeneration: 1,
          sessionVersion: 1,
          lastUsedAt: now,
        },
        update: {
          status: MoodleConnectionStatus.DISCONNECTED,
          moodleUserId: null,
          moodleStudentNumber: null,
          displayName: null,
          email: null,
          timezone: null,
          profileSyncedAt: null,
          credentialsEnvelope: null,
          sessionEnvelope: null,
          sessionExpiresAt: null,
          connectionGeneration: { increment: 1 },
          sessionVersion: { increment: 1 },
          activeSnapshotVersion: null,
          activeSyncRunId: null,
          connectionAttemptId: null,
          connectionAttemptLeaseUntil: null,
          reauthLeaseOwner: null,
          reauthLeaseUntil: null,
          failedReauthCount: 0,
          nextReauthAt: null,
          lastUsedAt: now,
          lastErrorCode: null,
        },
      });

      await tx.moodleMaterialSnapshot.deleteMany({ where: { studentId } });
      await tx.moodleSectionSnapshot.deleteMany({ where: { studentId } });
      await tx.moodleCourseSnapshot.deleteMany({ where: { studentId } });
      await tx.moodleEntityRef.deleteMany({ where: { studentId } });
      await tx.moodleSyncRun.deleteMany({ where: { studentId } });
      return toConnection(connection);
    });
  }

  async touchConnection(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
  }): Promise<boolean> {
    const now = await databaseNow(this.client);
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        sessionVersion: input.sessionVersion,
        status: { in: ACTIVE_CONNECTION_STATUSES },
      },
      data: { lastUsedAt: now },
    });
    return result.count === 1;
  }

  async replaceCredentialsEnvelopeCas(input: {
    studentId: number;
    connectionGeneration: number;
    previousEnvelope: string;
    nextEnvelope: string;
  }): Promise<boolean> {
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        credentialsEnvelope: input.previousEnvelope,
      },
      data: { credentialsEnvelope: input.nextEnvelope },
    });
    return result.count === 1;
  }

  async replaceSessionEnvelopeCas(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    previousEnvelope: string;
    nextEnvelope: string;
  }): Promise<boolean> {
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        sessionVersion: input.sessionVersion,
        sessionEnvelope: input.previousEnvelope,
      },
      data: { sessionEnvelope: input.nextEnvelope },
    });
    return result.count === 1;
  }

  async acquireReauthenticationLease(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    leaseDurationMs: number;
  }): Promise<{ acquired: boolean; connection: PersistedMoodleConnection | null }> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const result = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          sessionVersion: input.sessionVersion,
          status: { in: ACTIVE_CONNECTION_STATUSES },
          credentialsEnvelope: { not: null },
          AND: [
            {
              OR: [{ nextReauthAt: null }, { nextReauthAt: { lte: now } }],
            },
            {
              OR: [
                { reauthLeaseOwner: null },
                { reauthLeaseUntil: null },
                { reauthLeaseUntil: { lte: now } },
              ],
            },
          ],
        },
        data: {
          status: MoodleConnectionStatus.REFRESHING,
          reauthLeaseOwner: input.owner,
          reauthLeaseUntil: leaseUntil(now, input.leaseDurationMs),
          lastErrorCode: null,
        },
      });
      const connection = await tx.moodleConnection.findUnique({
        where: { studentId: input.studentId },
      });
      return {
        acquired: result.count === 1,
        connection: connection ? toConnection(connection) : null,
      };
    });
  }

  async heartbeatReauthenticationLease(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    leaseDurationMs: number;
  }): Promise<boolean> {
    const now = await databaseNow(this.client);
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        sessionVersion: input.sessionVersion,
        status: MoodleConnectionStatus.REFRESHING,
        reauthLeaseOwner: input.owner,
        reauthLeaseUntil: { gt: now },
      },
      data: { reauthLeaseUntil: leaseUntil(now, input.leaseDurationMs) },
    });
    return result.count === 1;
  }

  async completeReauthentication(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    moodleUserId: string;
    profile: {
      studentNumber: string;
      displayName: string;
      email: string | null;
      timezone: string | null;
      syncedAt: Date;
    };
    sessionEnvelope: string;
    sessionExpiresAt: Date | null;
  }): Promise<boolean> {
    const now = await databaseNow(this.client);
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        sessionVersion: input.sessionVersion,
        status: MoodleConnectionStatus.REFRESHING,
        reauthLeaseOwner: input.owner,
        reauthLeaseUntil: { gt: now },
      },
      data: {
        status: MoodleConnectionStatus.CONNECTED,
        moodleUserId: input.moodleUserId,
        moodleStudentNumber: input.profile.studentNumber,
        displayName: input.profile.displayName,
        email: input.profile.email,
        timezone: input.profile.timezone,
        profileSyncedAt: input.profile.syncedAt,
        sessionEnvelope: input.sessionEnvelope,
        sessionExpiresAt: input.sessionExpiresAt,
        sessionVersion: { increment: 1 },
        reauthLeaseOwner: null,
        reauthLeaseUntil: null,
        failedReauthCount: 0,
        nextReauthAt: null,
        lastAuthenticatedAt: now,
        lastUsedAt: now,
        lastErrorCode: null,
      },
    });
    return result.count === 1;
  }

  async failReauthentication(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    status: "DEGRADED" | "REAUTH_REQUIRED";
    lastErrorCode: string;
    nextReauthAt: Date | null;
  }): Promise<boolean> {
    const now = await databaseNow(this.client);
    const result = await this.client.moodleConnection.updateMany({
      where: {
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        sessionVersion: input.sessionVersion,
        status: MoodleConnectionStatus.REFRESHING,
        reauthLeaseOwner: input.owner,
        reauthLeaseUntil: { gt: now },
      },
      data: {
        status: input.status,
        reauthLeaseOwner: null,
        reauthLeaseUntil: null,
        failedReauthCount: { increment: 1 },
        nextReauthAt: input.nextReauthAt,
        lastErrorCode: input.lastErrorCode,
      },
    });
    return result.count === 1;
  }

  async createOrReuseSyncRun(input: {
    studentId: number;
    reason: string | null;
  }): Promise<{ run: PersistedMoodleSyncRun; reused: boolean }> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      let connection = await tx.moodleConnection.findUnique({
        where: { studentId: input.studentId },
      });
      if (!connection || !ACTIVE_CONNECTION_STATUSES.includes(connection.status)) {
        throw new MoodleRepositoryStateError(
          connection?.status === MoodleConnectionStatus.REAUTH_REQUIRED
            ? "MOODLE_REAUTH_REQUIRED"
            : "MOODLE_CONNECTION_REQUIRED",
          "A ligação Moodle não está pronta para sincronizar.",
        );
      }

      if (connection.activeSyncRunId) {
        const active = await tx.moodleSyncRun.findFirst({
          where: {
            id: connection.activeSyncRunId,
            studentId: input.studentId,
            connectionGeneration: connection.connectionGeneration,
            status: { in: ACTIVE_SYNC_STATUSES },
          },
        });
        if (active) return { run: toSyncRun(active), reused: true };

        await tx.moodleConnection.updateMany({
          where: {
            studentId: input.studentId,
            connectionGeneration: connection.connectionGeneration,
            activeSyncRunId: connection.activeSyncRunId,
          },
          data: { activeSyncRunId: null },
        });
        connection = await tx.moodleConnection.findUniqueOrThrow({
          where: { studentId: input.studentId },
        });
      }

      const previousVersion = await tx.moodleSyncRun.aggregate({
        where: { studentId: input.studentId },
        _max: { snapshotVersion: true },
      });
      const snapshotVersion = Math.max(
        connection.activeSnapshotVersion ?? 0,
        previousVersion._max.snapshotVersion ?? 0,
      ) + 1;
      const candidate = await tx.moodleSyncRun.create({
        data: {
          studentId: input.studentId,
          reason: input.reason,
          status: MoodleSyncRunStatus.QUEUED,
          connectionGeneration: connection.connectionGeneration,
          snapshotVersion,
        },
      });
      const associated = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: connection.connectionGeneration,
          activeSyncRunId: null,
          status: { in: ACTIVE_CONNECTION_STATUSES },
        },
        data: { activeSyncRunId: candidate.id },
      });
      if (associated.count === 1) {
        return { run: toSyncRun(candidate), reused: false };
      }

      await tx.moodleSyncRun.update({
        where: { id: candidate.id },
        data: {
          status: MoodleSyncRunStatus.CANCELLED,
          finishedAt: now,
          lastErrorCode: "MOODLE_SYNC_SUPERSEDED",
        },
      });
      const winnerConnection = await tx.moodleConnection.findUniqueOrThrow({
        where: { studentId: input.studentId },
      });
      const winner = winnerConnection.activeSyncRunId
        ? await tx.moodleSyncRun.findUnique({ where: { id: winnerConnection.activeSyncRunId } })
        : null;
      if (!winner) {
        throw new MoodleRepositoryStateError(
          "MOODLE_CONNECTION_REQUIRED",
          "A ligação Moodle mudou durante o agendamento.",
        );
      }
      return { run: toSyncRun(winner), reused: true };
    });
  }

  async claimNextSyncRun(input: {
    owner: string;
    leaseDurationMs: number;
  }): Promise<PersistedMoodleSyncRun | null> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const candidates = await tx.moodleSyncRun.findMany({
        where: {
          OR: [
            { status: MoodleSyncRunStatus.QUEUED },
            {
              status: MoodleSyncRunStatus.RUNNING,
              OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
            },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 8,
      });

      for (const candidate of candidates) {
        const connection = await tx.moodleConnection.findFirst({
          where: {
            studentId: candidate.studentId,
            connectionGeneration: candidate.connectionGeneration,
            activeSyncRunId: candidate.id,
            status: { in: ACTIVE_CONNECTION_STATUSES },
          },
        });
        if (!connection) {
          await tx.moodleSyncRun.updateMany({
            where: {
              id: candidate.id,
              status: { in: ACTIVE_SYNC_STATUSES },
            },
            data: {
              status: MoodleSyncRunStatus.CANCELLED,
              finishedAt: now,
              leaseOwner: null,
              leaseUntil: null,
              heartbeatAt: null,
              lastErrorCode: "MOODLE_SYNC_GENERATION_EXPIRED",
            },
          });
          continue;
        }

        // Writing the control row takes the same row lock used by logout and
        // snapshot publication. The value is intentionally unchanged.
        const control = await tx.moodleConnection.updateMany({
          where: {
            studentId: candidate.studentId,
            connectionGeneration: candidate.connectionGeneration,
            activeSyncRunId: candidate.id,
          },
          data: { activeSyncRunId: candidate.id },
        });
        if (control.count !== 1) continue;

        const claimed = await tx.moodleSyncRun.updateMany({
          where: {
            id: candidate.id,
            studentId: candidate.studentId,
            connectionGeneration: candidate.connectionGeneration,
            OR: [
              { status: MoodleSyncRunStatus.QUEUED },
              {
                status: MoodleSyncRunStatus.RUNNING,
                OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
              },
            ],
          },
          data: {
            status: MoodleSyncRunStatus.RUNNING,
            leaseOwner: input.owner,
            leaseUntil: leaseUntil(now, input.leaseDurationMs),
            heartbeatAt: now,
            startedAt: candidate.startedAt ?? now,
            attempts: { increment: 1 },
          },
        });
        if (claimed.count === 1) {
          const row = await tx.moodleSyncRun.findUniqueOrThrow({
            where: { id: candidate.id },
          });
          return toSyncRun(row);
        }
      }
      return null;
    });
  }

  async heartbeatSyncRun(input: {
    runId: string;
    studentId: number;
    connectionGeneration: number;
    owner: string;
    leaseDurationMs: number;
  }): Promise<boolean> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const control = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          activeSyncRunId: input.runId,
        },
        data: { activeSyncRunId: input.runId },
      });
      if (control.count !== 1) return false;
      const result = await tx.moodleSyncRun.updateMany({
        where: {
          id: input.runId,
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          status: MoodleSyncRunStatus.RUNNING,
          leaseOwner: input.owner,
          leaseUntil: { gt: now },
        },
        data: {
          heartbeatAt: now,
          leaseUntil: leaseUntil(now, input.leaseDurationMs),
        },
      });
      return result.count === 1;
    });
  }

  async updateSyncProgress(input: {
    runId: string;
    studentId: number;
    connectionGeneration: number;
    owner: string;
    discoveredCourses?: number;
    processedCourses?: number;
    failedCourses?: number;
    totalMaterials?: number;
    checkpointJson?: string | null;
  }): Promise<boolean> {
    const data: Prisma.MoodleSyncRunUpdateManyMutationInput = {};
    if (input.discoveredCourses !== undefined) data.discoveredCourses = input.discoveredCourses;
    if (input.processedCourses !== undefined) data.processedCourses = input.processedCourses;
    if (input.failedCourses !== undefined) data.failedCourses = input.failedCourses;
    if (input.totalMaterials !== undefined) data.totalMaterials = input.totalMaterials;
    if (input.checkpointJson !== undefined) data.checkpointJson = input.checkpointJson;
    const now = await databaseNow(this.client);
    const result = await this.client.moodleSyncRun.updateMany({
      where: {
        id: input.runId,
        studentId: input.studentId,
        connectionGeneration: input.connectionGeneration,
        status: MoodleSyncRunStatus.RUNNING,
        leaseOwner: input.owner,
        leaseUntil: { gt: now },
      },
      data,
    });
    return result.count === 1;
  }

  async stageCourseGraph(input: {
    studentId: number;
    runId: string;
    connectionGeneration: number;
    snapshotVersion: number;
    leaseOwner: string;
    course: RepositoryCourseSnapshotInput;
    sections: RepositorySectionSnapshotInput[];
    materials: RepositoryMaterialSnapshotInput[];
  }): Promise<boolean> {
    assertSnapshotGraph(input.course, input.sections, input.materials);
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const control = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          activeSyncRunId: input.runId,
          status: { in: ACTIVE_CONNECTION_STATUSES },
        },
        data: { activeSyncRunId: input.runId },
      });
      if (control.count !== 1) return false;

      const runLease = await tx.moodleSyncRun.updateMany({
        where: {
          id: input.runId,
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          snapshotVersion: input.snapshotVersion,
          status: MoodleSyncRunStatus.RUNNING,
          leaseOwner: input.leaseOwner,
          leaseUntil: { gt: now },
        },
        data: { heartbeatAt: now },
      });
      if (runLease.count !== 1) throw new MoodleRepositoryCasMiss();

      const courseRef = await tx.moodleEntityRef.upsert({
        where: {
          studentId_kind_moodleExternalKey: {
            studentId: input.studentId,
            kind: MoodleEntityKind.COURSE,
            moodleExternalKey: input.course.moodleExternalKey,
          },
        },
        create: {
          studentId: input.studentId,
          kind: MoodleEntityKind.COURSE,
          moodleExternalKey: input.course.moodleExternalKey,
        },
        update: {},
      });

      const sectionRefs = new Map<string, number>();
      for (const section of input.sections) {
        const ref = await tx.moodleEntityRef.upsert({
          where: {
            studentId_kind_moodleExternalKey: {
              studentId: input.studentId,
              kind: MoodleEntityKind.SECTION,
              moodleExternalKey: section.moodleExternalKey,
            },
          },
          create: {
            studentId: input.studentId,
            kind: MoodleEntityKind.SECTION,
            moodleExternalKey: section.moodleExternalKey,
          },
          update: {},
        });
        sectionRefs.set(section.moodleExternalKey, ref.id);
      }

      const materialRefs = new Map<string, number>();
      for (const material of input.materials) {
        const ref = await tx.moodleEntityRef.upsert({
          where: {
            studentId_kind_moodleExternalKey: {
              studentId: input.studentId,
              kind: MoodleEntityKind.MATERIAL,
              moodleExternalKey: material.moodleExternalKey,
            },
          },
          create: {
            studentId: input.studentId,
            kind: MoodleEntityKind.MATERIAL,
            moodleExternalKey: material.moodleExternalKey,
          },
          update: {},
        });
        materialRefs.set(material.moodleExternalKey, ref.id);
      }

      await tx.moodleMaterialSnapshot.deleteMany({
        where: {
          studentId: input.studentId,
          snapshotVersion: input.snapshotVersion,
          courseEntityRefId: courseRef.id,
        },
      });
      await tx.moodleSectionSnapshot.deleteMany({
        where: {
          studentId: input.studentId,
          snapshotVersion: input.snapshotVersion,
          courseEntityRefId: courseRef.id,
        },
      });
      await tx.moodleCourseSnapshot.deleteMany({
        where: {
          studentId: input.studentId,
          snapshotVersion: input.snapshotVersion,
          entityRefId: courseRef.id,
        },
      });

      await tx.moodleCourseSnapshot.create({
        data: {
          studentId: input.studentId,
          entityRefId: courseRef.id,
          moodleExternalKey: input.course.moodleExternalKey,
          snapshotVersion: input.snapshotVersion,
          syncRunId: input.runId,
          name: input.course.name,
          normalizedName: input.course.normalizedName,
          shortName: input.course.shortName,
          category: input.course.category,
          descriptionText: input.course.descriptionText,
          visible: input.course.visible,
          hiddenByStudent: input.course.hiddenByStudent,
          favourite: input.course.favourite,
          startAt: input.course.startAt,
          endAt: input.course.endAt,
          progressAvailable: input.course.progressAvailable,
          progressPercent: input.course.progressPercent,
          stale: input.course.stale ?? false,
          sourceSyncedAt: input.course.sourceSyncedAt ?? null,
          syncedAt: now,
          normalizedHash: input.course.normalizedHash,
        },
      });

      if (input.sections.length > 0) {
        await tx.moodleSectionSnapshot.createMany({
          data: input.sections.map((section) => ({
            studentId: input.studentId,
            entityRefId: sectionRefs.get(section.moodleExternalKey)!,
            courseEntityRefId: courseRef.id,
            moodleExternalKey: section.moodleExternalKey,
            snapshotVersion: input.snapshotVersion,
            syncRunId: input.runId,
            position: section.position,
            title: section.title,
            normalizedTitle: section.normalizedTitle,
            summaryText: section.summaryText,
            visible: section.visible,
            available: section.available,
            stale: section.stale ?? false,
            sourceSyncedAt: section.sourceSyncedAt ?? null,
            syncedAt: now,
            normalizedHash: section.normalizedHash,
          })),
        });
      }

      if (input.materials.length > 0) {
        await tx.moodleMaterialSnapshot.createMany({
          data: input.materials.map((material) => ({
            studentId: input.studentId,
            entityRefId: materialRefs.get(material.moodleExternalKey)!,
            courseEntityRefId: courseRef.id,
            sectionEntityRefId: material.sectionExternalKey
              ? sectionRefs.get(material.sectionExternalKey)!
              : null,
            moodleExternalKey: material.moodleExternalKey,
            snapshotVersion: input.snapshotVersion,
            syncRunId: input.runId,
            type: material.type,
            title: material.title,
            normalizedTitle: material.normalizedTitle,
            descriptionText: material.descriptionText,
            available: material.available,
            openAvailable: material.openAvailable,
            downloadAvailable: material.downloadAvailable,
            fileName: material.fileName,
            mimeType: material.mimeType,
            sizeBytes: material.sizeBytes,
            sourceUpdatedAt: material.sourceUpdatedAt,
            metadataJson: material.metadataJson,
            locatorEnvelope: material.locatorEnvelope,
            stale: material.stale ?? false,
            sourceSyncedAt: material.sourceSyncedAt ?? null,
            syncedAt: now,
            normalizedHash: material.normalizedHash,
          })),
        });
      }
      return true;
    }).catch((error: unknown) => {
      if (error instanceof MoodleRepositoryCasMiss) return false;
      throw error;
    });
  }

  async publishSnapshot(input: {
    studentId: number;
    runId: string;
    connectionGeneration: number;
    snapshotVersion: number;
    leaseOwner: string;
    outcome: "COMPLETED" | "PARTIAL";
  }): Promise<boolean> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const controlLock = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          activeSyncRunId: input.runId,
          status: { in: ACTIVE_CONNECTION_STATUSES },
        },
        data: { activeSyncRunId: input.runId },
      });
      if (controlLock.count !== 1) return false;

      const finishedRun = await tx.moodleSyncRun.updateMany({
        where: {
          id: input.runId,
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          snapshotVersion: input.snapshotVersion,
          status: MoodleSyncRunStatus.RUNNING,
          leaseOwner: input.leaseOwner,
          leaseUntil: { gt: now },
        },
        data: {
          status: input.outcome,
          finishedAt: now,
          leaseOwner: null,
          leaseUntil: null,
          heartbeatAt: null,
          lastErrorCode: null,
        },
      });
      if (finishedRun.count !== 1) throw new MoodleRepositoryCasMiss();

      const published = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          activeSyncRunId: input.runId,
        },
        data: {
          activeSnapshotVersion: input.snapshotVersion,
          activeSyncRunId: null,
          lastSuccessfulSyncAt: now,
          lastErrorCode: null,
        },
      });
      if (published.count !== 1) throw new MoodleRepositoryCasMiss();
      return true;
    }).catch((error: unknown) => {
      if (error instanceof MoodleRepositoryCasMiss) return false;
      throw error;
    });
  }

  async finishSyncRun(input: {
    studentId: number;
    runId: string;
    connectionGeneration: number;
    leaseOwner: string;
    outcome: "FAILED" | "CANCELLED";
    lastErrorCode: string | null;
  }): Promise<boolean> {
    return this.client.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const control = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          activeSyncRunId: input.runId,
        },
        data: { activeSyncRunId: input.runId },
      });
      if (control.count !== 1) return false;
      const run = await tx.moodleSyncRun.updateMany({
        where: {
          id: input.runId,
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          status: MoodleSyncRunStatus.RUNNING,
          leaseOwner: input.leaseOwner,
          leaseUntil: { gt: now },
        },
        data: {
          status: input.outcome,
          finishedAt: now,
          leaseOwner: null,
          leaseUntil: null,
          heartbeatAt: null,
          lastErrorCode: input.lastErrorCode,
        },
      });
      if (run.count !== 1) throw new MoodleRepositoryCasMiss();
      const released = await tx.moodleConnection.updateMany({
        where: {
          studentId: input.studentId,
          connectionGeneration: input.connectionGeneration,
          activeSyncRunId: input.runId,
        },
        data: {
          activeSyncRunId: null,
          lastErrorCode: input.lastErrorCode,
        },
      });
      if (released.count !== 1) throw new MoodleRepositoryCasMiss();
      return true;
    }).catch((error: unknown) => {
      if (error instanceof MoodleRepositoryCasMiss) return false;
      throw error;
    });
  }

  async getLatestSyncRun(studentId: number): Promise<PersistedMoodleSyncRun | null> {
    const row = await this.client.moodleSyncRun.findFirst({
      where: { studentId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return row ? toSyncRun(row) : null;
  }

  async getSyncRunBySnapshot(input: {
    studentId: number;
    snapshotVersion: number;
  }): Promise<PersistedMoodleSyncRun | null> {
    const row = await this.client.moodleSyncRun.findFirst({
      where: {
        studentId: input.studentId,
        snapshotVersion: input.snapshotVersion,
        status: { in: [MoodleSyncRunStatus.COMPLETED, MoodleSyncRunStatus.PARTIAL] },
      },
      orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
    });
    return row ? toSyncRun(row) : null;
  }

  async listCourses(input: {
    studentId: number;
    snapshotVersion: number;
    limit: number;
    after?: RepositoryTextCursor;
  }): Promise<RepositoryPage<PersistedCourseSnapshot>> {
    const limit = normalizeLimit(input.limit);
    const baseWhere: Prisma.MoodleCourseSnapshotWhereInput = {
      studentId: input.studentId,
      snapshotVersion: input.snapshotVersion,
    };
    const pageWhere: Prisma.MoodleCourseSnapshotWhereInput = input.after
      ? {
          ...baseWhere,
          OR: [
            { normalizedName: { gt: input.after.normalizedText } },
            {
              normalizedName: input.after.normalizedText,
              entityRef: { publicId: { gt: input.after.publicId } },
            },
          ],
        }
      : baseWhere;
    const [total, rows] = await this.client.$transaction([
      this.client.moodleCourseSnapshot.count({ where: baseWhere }),
      this.client.moodleCourseSnapshot.findMany({
        where: pageWhere,
        include: { entityRef: true },
        orderBy: [{ normalizedName: "asc" }, { entityRef: { publicId: "asc" } }],
        take: limit + 1,
      }),
    ]);
    return {
      total,
      hasMore: rows.length > limit,
      items: rows.slice(0, limit).map((row) => ({
        publicId: row.entityRef.publicId,
        moodleExternalKey: row.moodleExternalKey,
        snapshotVersion: row.snapshotVersion,
        syncRunId: row.syncRunId,
        name: row.name,
        normalizedName: row.normalizedName,
        shortName: row.shortName,
        category: row.category,
        descriptionText: row.descriptionText,
        visible: row.visible,
        hiddenByStudent: row.hiddenByStudent,
        favourite: row.favourite,
        startAt: row.startAt,
        endAt: row.endAt,
        progressAvailable: row.progressAvailable,
        progressPercent: row.progressPercent,
        stale: row.stale,
        sourceSyncedAt: row.sourceSyncedAt,
        normalizedHash: row.normalizedHash,
        syncedAt: row.syncedAt,
      })),
    };
  }

  async findCourse(input: {
    studentId: number;
    snapshotVersion: number;
    publicId: string;
  }): Promise<PersistedCourseSnapshot | null> {
    const row = await this.client.moodleCourseSnapshot.findFirst({
      where: {
        studentId: input.studentId,
        snapshotVersion: input.snapshotVersion,
        entityRef: {
          studentId: input.studentId,
          publicId: input.publicId,
          kind: MoodleEntityKind.COURSE,
        },
      },
      include: { entityRef: true },
    });
    if (!row) return null;
    return {
      publicId: row.entityRef.publicId,
      moodleExternalKey: row.moodleExternalKey,
      snapshotVersion: row.snapshotVersion,
      syncRunId: row.syncRunId,
      name: row.name,
      normalizedName: row.normalizedName,
      shortName: row.shortName,
      category: row.category,
      descriptionText: row.descriptionText,
      visible: row.visible,
      hiddenByStudent: row.hiddenByStudent,
      favourite: row.favourite,
      startAt: row.startAt,
      endAt: row.endAt,
      progressAvailable: row.progressAvailable,
      progressPercent: row.progressPercent,
      stale: row.stale,
      sourceSyncedAt: row.sourceSyncedAt,
      normalizedHash: row.normalizedHash,
      syncedAt: row.syncedAt,
    };
  }

  async listSections(input: {
    studentId: number;
    snapshotVersion: number;
    coursePublicId: string;
    limit: number;
    after?: RepositoryPositionCursor;
  }): Promise<RepositoryPage<PersistedSectionSnapshot>> {
    const limit = normalizeLimit(input.limit);
    const courseRef = await this.client.moodleEntityRef.findFirst({
      where: {
        studentId: input.studentId,
        publicId: input.coursePublicId,
        kind: MoodleEntityKind.COURSE,
      },
    });
    if (!courseRef) return { items: [], total: 0, hasMore: false };
    const baseWhere: Prisma.MoodleSectionSnapshotWhereInput = {
      studentId: input.studentId,
      snapshotVersion: input.snapshotVersion,
      courseEntityRefId: courseRef.id,
    };
    const pageWhere: Prisma.MoodleSectionSnapshotWhereInput = input.after
      ? {
          ...baseWhere,
          OR: [
            { position: { gt: input.after.position } },
            {
              position: input.after.position,
              entityRef: { publicId: { gt: input.after.publicId } },
            },
          ],
        }
      : baseWhere;
    const [total, rows] = await this.client.$transaction([
      this.client.moodleSectionSnapshot.count({ where: baseWhere }),
      this.client.moodleSectionSnapshot.findMany({
        where: pageWhere,
        include: { entityRef: true, courseEntityRef: true },
        orderBy: [{ position: "asc" }, { entityRef: { publicId: "asc" } }],
        take: limit + 1,
      }),
    ]);
    return {
      total,
      hasMore: rows.length > limit,
      items: rows.slice(0, limit).map((row) => ({
        publicId: row.entityRef.publicId,
        coursePublicId: row.courseEntityRef.publicId,
        moodleExternalKey: row.moodleExternalKey,
        snapshotVersion: row.snapshotVersion,
        syncRunId: row.syncRunId,
        position: row.position,
        title: row.title,
        normalizedTitle: row.normalizedTitle,
        summaryText: row.summaryText,
        visible: row.visible,
        available: row.available,
        stale: row.stale,
        sourceSyncedAt: row.sourceSyncedAt,
        normalizedHash: row.normalizedHash,
        syncedAt: row.syncedAt,
      })),
    };
  }

  async listMaterials(input: {
    studentId: number;
    snapshotVersion: number;
    limit: number;
    coursePublicId?: string;
    after?: RepositoryTextCursor;
  }): Promise<RepositoryPage<PersistedMaterialSnapshot>> {
    const limit = normalizeLimit(input.limit);
    let courseRefId: number | undefined;
    if (input.coursePublicId) {
      const courseRef = await this.client.moodleEntityRef.findFirst({
        where: {
          studentId: input.studentId,
          publicId: input.coursePublicId,
          kind: MoodleEntityKind.COURSE,
        },
      });
      if (!courseRef) return { items: [], total: 0, hasMore: false };
      courseRefId = courseRef.id;
    }
    const baseWhere: Prisma.MoodleMaterialSnapshotWhereInput = {
      studentId: input.studentId,
      snapshotVersion: input.snapshotVersion,
      ...(courseRefId ? { courseEntityRefId: courseRefId } : {}),
    };
    const pageWhere: Prisma.MoodleMaterialSnapshotWhereInput = input.after
      ? {
          ...baseWhere,
          OR: [
            { normalizedTitle: { gt: input.after.normalizedText } },
            {
              normalizedTitle: input.after.normalizedText,
              entityRef: { publicId: { gt: input.after.publicId } },
            },
          ],
        }
      : baseWhere;
    const [total, rows] = await this.client.$transaction([
      this.client.moodleMaterialSnapshot.count({ where: baseWhere }),
      this.client.moodleMaterialSnapshot.findMany({
        where: pageWhere,
        include: {
          entityRef: true,
          courseEntityRef: true,
          sectionEntityRef: true,
        },
        orderBy: [{ normalizedTitle: "asc" }, { entityRef: { publicId: "asc" } }],
        take: limit + 1,
      }),
    ]);
    return {
      total,
      hasMore: rows.length > limit,
      items: rows.slice(0, limit).map(mapMaterialSnapshot),
    };
  }

  async findMaterial(input: {
    studentId: number;
    snapshotVersion: number;
    publicId: string;
  }): Promise<PersistedMaterialSnapshot | null> {
    const row = await this.client.moodleMaterialSnapshot.findFirst({
      where: {
        studentId: input.studentId,
        snapshotVersion: input.snapshotVersion,
        entityRef: {
          studentId: input.studentId,
          publicId: input.publicId,
          kind: MoodleEntityKind.MATERIAL,
        },
      },
      include: {
        entityRef: true,
        courseEntityRef: true,
        sectionEntityRef: true,
      },
    });
    return row ? mapMaterialSnapshot(row) : null;
  }

  async replaceMaterialLocatorEnvelopeCas(input: {
    studentId: number;
    snapshotVersion: number;
    publicId: string;
    previousEnvelope: string;
    nextEnvelope: string;
  }): Promise<boolean> {
    const reference = await this.client.moodleEntityRef.findFirst({
      where: {
        studentId: input.studentId,
        publicId: input.publicId,
        kind: MoodleEntityKind.MATERIAL,
      },
      select: { id: true },
    });
    if (!reference) return false;
    const result = await this.client.moodleMaterialSnapshot.updateMany({
      where: {
        studentId: input.studentId,
        snapshotVersion: input.snapshotVersion,
        entityRefId: reference.id,
        locatorEnvelope: input.previousEnvelope,
      },
      data: { locatorEnvelope: input.nextEnvelope },
    });
    return result.count === 1;
  }

  async purgeSnapshotVersions(input: {
    studentId: number;
    keepVersions: number[];
  }): Promise<void> {
    await this.client.$transaction(async (tx) => {
      const connection = await tx.moodleConnection.findUnique({
        where: { studentId: input.studentId },
      });
      const keep = new Set(input.keepVersions);
      if (connection?.activeSnapshotVersion !== null && connection?.activeSnapshotVersion !== undefined) {
        keep.add(connection.activeSnapshotVersion);
      }
      const where = keep.size > 0
        ? { studentId: input.studentId, snapshotVersion: { notIn: [...keep] } }
        : { studentId: input.studentId };
      await tx.moodleMaterialSnapshot.deleteMany({ where });
      await tx.moodleSectionSnapshot.deleteMany({ where });
      await tx.moodleCourseSnapshot.deleteMany({ where });
    });
  }
}

function normalizeLimit(limit: number): number {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("O limite deve ser um inteiro entre 1 e 100.");
  }
  return limit;
}

type MaterialWithRefs = Prisma.MoodleMaterialSnapshotGetPayload<{
  include: {
    entityRef: true;
    courseEntityRef: true;
    sectionEntityRef: true;
  };
}>;

function mapMaterialSnapshot(row: MaterialWithRefs): PersistedMaterialSnapshot {
  return {
    publicId: row.entityRef.publicId,
    coursePublicId: row.courseEntityRef.publicId,
    sectionPublicId: row.sectionEntityRef?.publicId ?? null,
    moodleExternalKey: row.moodleExternalKey,
    snapshotVersion: row.snapshotVersion,
    syncRunId: row.syncRunId,
    type: row.type,
    title: row.title,
    normalizedTitle: row.normalizedTitle,
    descriptionText: row.descriptionText,
    available: row.available,
    openAvailable: row.openAvailable,
    downloadAvailable: row.downloadAvailable,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sourceUpdatedAt: row.sourceUpdatedAt,
    metadataJson: row.metadataJson,
    locatorEnvelope: row.locatorEnvelope,
    stale: row.stale,
    sourceSyncedAt: row.sourceSyncedAt,
    normalizedHash: row.normalizedHash,
    syncedAt: row.syncedAt,
  };
}
