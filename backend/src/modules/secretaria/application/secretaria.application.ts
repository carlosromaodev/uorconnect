import { prisma } from "../../../shared/prisma";
import type { SecretariaGateway, SecretariaCredentials } from "../domain/gateway";
import { SecretariaError } from "../domain/errors";
import type {
  SecretariaCapability,
  SecretariaConnectionView,
  SecretariaDataset,
  SecretariaProfile,
  SecretariaSession,
  SecretariaStudentIdentity,
  SecretariaSyncView,
} from "../domain/models";
import { NetpaSecretariaGateway, SECRETARIA_DATASETS } from "../infra/netpa-secretaria.gateway";
import { SecretariaCryptoKeyring } from "../infra/secretaria-crypto";

type StoredConnection = Awaited<ReturnType<typeof prisma.secretariaConnection.findUnique>>;

export interface SecretariaApplication {
  connect(student: SecretariaStudentIdentity, input: SecretariaCredentials & { rememberCredentials: true }): Promise<{ connection: SecretariaConnectionView; profile: SecretariaProfile }>;
  getConnection(student: SecretariaStudentIdentity): Promise<SecretariaConnectionView>;
  terminateSession(student: SecretariaStudentIdentity): Promise<SecretariaConnectionView>;
  disconnect(student: SecretariaStudentIdentity): Promise<SecretariaConnectionView>;
  deleteImportedData(student: SecretariaStudentIdentity): Promise<{ deletedSnapshots: number; deletedSyncRuns: number }>;
  getProfile(student: SecretariaStudentIdentity): Promise<SecretariaProfile>;
  getDataset(student: SecretariaStudentIdentity, domain: string): Promise<{ data: SecretariaDataset; stale: boolean; snapshotVersion: number | null }>;
  startSync(student: SecretariaStudentIdentity, domains?: string[]): Promise<SecretariaSyncView>;
  getSync(student: SecretariaStudentIdentity, runId: string): Promise<SecretariaSyncView>;
  capabilities(): SecretariaCapability[];
  stop?(): void;
}

function normalizeStudentNumber(value: string) {
  return value.replace(/\D/g, "").replace(/^0+/, "");
}

function connectionView(connection: StoredConnection): SecretariaConnectionView {
  if (!connection) {
    return {
      status: "DISCONNECTED",
      connected: false,
      credentialStored: false,
      actionRequired: "connect",
      retryable: false,
      lastAuthenticatedAt: null,
      lastSuccessfulSyncAt: null,
    };
  }
  return {
    status: connection.status,
    connected: connection.status === "CONNECTED" && Boolean(connection.sessionEnvelope),
    credentialStored: Boolean(connection.credentialsEnvelope),
    actionRequired: connection.status === "REAUTH_REQUIRED" ? "reauthenticate" : connection.credentialsEnvelope ? "none" : "connect",
    retryable: connection.status === "DEGRADED",
    lastAuthenticatedAt: connection.lastAuthenticatedAt?.toISOString() ?? null,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt?.toISOString() ?? null,
  };
}

function syncView(run: {
  id: string;
  status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  snapshotVersion: number | null;
  domainsJson: string;
  resultJson: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): SecretariaSyncView {
  const result = run.resultJson ? JSON.parse(run.resultJson) as { completed?: string[]; failed?: string[] } : {};
  return {
    id: run.id,
    status: run.status,
    snapshotVersion: run.snapshotVersion,
    domains: JSON.parse(run.domainsJson) as string[],
    completedDomains: result.completed ?? [],
    failedDomains: result.failed ?? [],
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export class LiveSecretariaApplication implements SecretariaApplication {
  readonly #refreshing = new Map<number, Promise<SecretariaSession>>();

  constructor(private readonly gateway: SecretariaGateway, private readonly keyring: SecretariaCryptoKeyring) {}

  #context(student: SecretariaStudentIdentity, generation: number, purpose: "credentials" | "session") {
    return { studentId: student.id, institutionCode: "UOR", generation, purpose } as const;
  }

  async connect(student: SecretariaStudentIdentity, input: SecretariaCredentials & { rememberCredentials: true }) {
    if (normalizeStudentNumber(input.username) !== normalizeStudentNumber(student.studentNumber)) {
      throw new SecretariaError("SECRETARIA_IDENTITY_MISMATCH", "O número informado não corresponde ao estudante autenticado.", 403);
    }
    const existing = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
    const generation = (existing?.connectionGeneration ?? 0) + 1;
    await prisma.secretariaConnection.upsert({
      where: { studentId: student.id },
      create: { studentId: student.id, status: "CONNECTING", connectionGeneration: 0 },
      update: { status: "CONNECTING", lastErrorCode: null },
    });
    try {
      const authenticated = await this.gateway.authenticate(input);
      if (normalizeStudentNumber(authenticated.profile.studentNumber) !== normalizeStudentNumber(student.studentNumber)) {
        await this.gateway.logout(authenticated.session);
        throw new SecretariaError("SECRETARIA_IDENTITY_MISMATCH", "A conta da Secretaria pertence a outro estudante.", 403);
      }
      const credentialsEnvelope = this.keyring.encryptJson(
        { username: input.username, password: input.password },
        this.#context(student, generation, "credentials"),
      );
      const sessionEnvelope = this.keyring.encryptJson(authenticated.session, this.#context(student, generation, "session"));
      const now = new Date();
      const connection = await prisma.secretariaConnection.update({
        where: { studentId: student.id },
        data: {
          status: "CONNECTED",
          upstreamStudentNumber: authenticated.profile.studentNumber,
          displayName: authenticated.profile.displayName,
          credentialsEnvelope,
          sessionEnvelope,
          connectionGeneration: generation,
          sessionVersion: { increment: 1 },
          failedReauthCount: 0,
          lastAuthenticatedAt: now,
          lastUsedAt: now,
          lastErrorCode: null,
        },
      });
      return { connection: connectionView(connection), profile: authenticated.profile };
    } catch (error) {
      await prisma.secretariaConnection.update({
        where: { studentId: student.id },
        data: {
          status: existing?.status ?? (error instanceof SecretariaError && error.code === "SECRETARIA_AUTH_FAILED" ? "REAUTH_REQUIRED" : "DEGRADED"),
          lastErrorCode: error instanceof SecretariaError ? error.code : "SECRETARIA_UNAVAILABLE",
        },
      });
      throw error;
    }
  }

  async getConnection(student: SecretariaStudentIdentity) {
    return connectionView(await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } }));
  }

  async terminateSession(student: SecretariaStudentIdentity) {
    const connection = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) return connectionView(null);
    if (connection.sessionEnvelope) {
      const session = this.keyring.decryptJson<SecretariaSession>(connection.sessionEnvelope, this.#context(student, connection.connectionGeneration, "session"));
      await this.gateway.logout(session).catch(() => undefined);
    }
    const updated = await prisma.secretariaConnection.update({
      where: { studentId: student.id },
      data: { status: "DISCONNECTED", sessionEnvelope: null, sessionVersion: { increment: 1 }, lastUsedAt: new Date() },
    });
    return connectionView(updated);
  }

  async disconnect(student: SecretariaStudentIdentity) {
    const connection = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) return connectionView(null);
    if (connection.sessionEnvelope) {
      const session = this.keyring.decryptJson<SecretariaSession>(connection.sessionEnvelope, this.#context(student, connection.connectionGeneration, "session"));
      await this.gateway.logout(session).catch(() => undefined);
    }
    await prisma.secretariaConnection.delete({ where: { studentId: student.id } });
    return connectionView(null);
  }

  async deleteImportedData(student: SecretariaStudentIdentity) {
    const result = await prisma.$transaction(async (tx) => {
      const snapshots = await tx.secretariaSnapshot.deleteMany({ where: { studentId: student.id } });
      const runs = await tx.secretariaSyncRun.deleteMany({ where: { studentId: student.id } });
      await tx.secretariaConnection.updateMany({ where: { studentId: student.id }, data: { activeSnapshotVersion: null, lastSuccessfulSyncAt: null } });
      return { deletedSnapshots: snapshots.count, deletedSyncRuns: runs.count };
    });
    return result;
  }

  async #reauthenticate(student: SecretariaStudentIdentity, connection: NonNullable<StoredConnection>): Promise<SecretariaSession> {
    const active = this.#refreshing.get(student.id);
    if (active) return active;
    const refresh = (async () => {
      if (!connection.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
      const credentials = this.keyring.decryptJson<SecretariaCredentials>(connection.credentialsEnvelope, this.#context(student, connection.connectionGeneration, "credentials"));
      try {
        const authenticated = await this.gateway.authenticate(credentials);
        if (normalizeStudentNumber(authenticated.profile.studentNumber) !== normalizeStudentNumber(student.studentNumber)) {
          throw new SecretariaError("SECRETARIA_IDENTITY_MISMATCH", "A identidade devolvida pela Secretaria não corresponde ao titular.", 403);
        }
        const sessionEnvelope = this.keyring.encryptJson(authenticated.session, this.#context(student, connection.connectionGeneration, "session"));
        await prisma.secretariaConnection.update({
          where: { studentId: student.id },
          data: { status: "CONNECTED", sessionEnvelope, sessionVersion: { increment: 1 }, failedReauthCount: 0, lastAuthenticatedAt: new Date(), lastUsedAt: new Date(), lastErrorCode: null },
        });
        return authenticated.session;
      } catch (error) {
        await prisma.secretariaConnection.update({
          where: { studentId: student.id },
          data: { status: "REAUTH_REQUIRED", sessionEnvelope: null, failedReauthCount: { increment: 1 }, lastErrorCode: error instanceof SecretariaError ? error.code : "SECRETARIA_AUTH_FAILED" },
        });
        throw error;
      }
    })().finally(() => this.#refreshing.delete(student.id));
    this.#refreshing.set(student.id, refresh);
    return refresh;
  }

  async #session(student: SecretariaStudentIdentity): Promise<SecretariaSession> {
    const connection = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    if (!connection.sessionEnvelope) return this.#reauthenticate(student, connection);
    const session = this.keyring.decryptJson<SecretariaSession>(connection.sessionEnvelope, this.#context(student, connection.connectionGeneration, "session"));
    if (await this.gateway.validateSession(session)) return session;
    return this.#reauthenticate(student, connection);
  }

  async #withSession<T>(student: SecretariaStudentIdentity, operation: (session: SecretariaSession) => Promise<T>): Promise<T> {
    let session = await this.#session(student);
    try {
      const result = await operation(session);
      await prisma.secretariaConnection.update({ where: { studentId: student.id }, data: { lastUsedAt: new Date() } });
      return result;
    } catch (error) {
      if (!(error instanceof SecretariaError) || error.code !== "SECRETARIA_REAUTH_REQUIRED") throw error;
      const connection = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
      if (!connection) throw error;
      session = await this.#reauthenticate(student, connection);
      return operation(session);
    }
  }

  async getProfile(student: SecretariaStudentIdentity) {
    return this.#withSession(student, (session) => this.gateway.getProfile(session));
  }

  async getDataset(student: SecretariaStudentIdentity, domain: string) {
    try {
      return { data: await this.#withSession(student, (session) => this.gateway.getDataset(session, domain)), stale: false, snapshotVersion: null };
    } catch (error) {
      const connection = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
      if (!connection?.activeSnapshotVersion) throw error;
      const snapshot = await prisma.secretariaSnapshot.findUnique({
        where: { studentId_domain_snapshotVersion: { studentId: student.id, domain, snapshotVersion: connection.activeSnapshotVersion } },
      });
      if (!snapshot) throw error;
      const parsed = JSON.parse(snapshot.payloadJson) as SecretariaDataset;
      const data: SecretariaDataset = { ...parsed, coverage: "stale" };
      return { data, stale: true, snapshotVersion: snapshot.snapshotVersion };
    }
  }

  async startSync(student: SecretariaStudentIdentity, requested?: string[]) {
    const domains = requested?.length ? requested : Object.keys(SECRETARIA_DATASETS);
    const invalid = domains.find((domain) => !SECRETARIA_DATASETS[domain]);
    if (invalid) throw new SecretariaError("SECRETARIA_REQUEST_INVALID", `Domínio de sincronização inválido: ${invalid}.`, 422);
    const connection = await prisma.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const activeRun = await prisma.secretariaSyncRun.findFirst({
      where: { studentId: student.id, status: "RUNNING", startedAt: { gte: new Date(Date.now() - 15 * 60_000) } },
      orderBy: { startedAt: "desc" },
    });
    if (activeRun) return syncView(activeRun);
    const version = (connection.activeSnapshotVersion ?? 0) + 1;
    const run = await prisma.secretariaSyncRun.create({ data: { studentId: student.id, domainsJson: JSON.stringify(domains), snapshotVersion: version } });
    const completed: string[] = [];
    const failed: string[] = [];
    const snapshots: Array<{ domain: string; dataset: SecretariaDataset }> = [];
    for (const domain of domains) {
      try {
        snapshots.push({ domain, dataset: await this.#withSession(student, (session) => this.gateway.getDataset(session, domain)) });
        completed.push(domain);
      } catch {
        failed.push(domain);
      }
    }
    const fallbackSnapshots = connection.activeSnapshotVersion && failed.length
      ? await prisma.secretariaSnapshot.findMany({
        where: { studentId: student.id, snapshotVersion: connection.activeSnapshotVersion, domain: { in: failed } },
      })
      : [];
    const status = completed.length === domains.length ? "COMPLETED" : completed.length ? "PARTIAL" : "FAILED";
    await prisma.$transaction(async (tx) => {
      for (const entry of snapshots) {
        await tx.secretariaSnapshot.create({
          data: {
            studentId: student.id,
            domain: entry.domain,
            snapshotVersion: version,
            payloadJson: JSON.stringify(entry.dataset),
            itemCount: entry.dataset.items.length,
            coverage: entry.dataset.coverage,
            sourceHash: NetpaSecretariaGateway.normalizedHash(entry.dataset.items),
            observedAt: new Date(entry.dataset.observedAt),
          },
        });
      }
      for (const previous of fallbackSnapshots) {
        const stale = { ...(JSON.parse(previous.payloadJson) as SecretariaDataset), coverage: "stale" as const };
        await tx.secretariaSnapshot.create({
          data: {
            studentId: student.id,
            domain: previous.domain,
            snapshotVersion: version,
            payloadJson: JSON.stringify(stale),
            itemCount: previous.itemCount,
            coverage: "stale",
            sourceHash: previous.sourceHash,
            observedAt: previous.observedAt,
          },
        });
      }
      await tx.secretariaSyncRun.update({ where: { id: run.id }, data: { status, resultJson: JSON.stringify({ completed, failed }), finishedAt: new Date() } });
      if (completed.length) await tx.secretariaConnection.update({ where: { studentId: student.id }, data: { activeSnapshotVersion: version, lastSuccessfulSyncAt: new Date() } });
    });
    return this.getSync(student, run.id);
  }

  async getSync(student: SecretariaStudentIdentity, runId: string) {
    const run = await prisma.secretariaSyncRun.findFirst({ where: { id: runId, studentId: student.id } });
    if (!run) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "A sincronização não foi encontrada.", 404);
    return syncView(run);
  }

  capabilities(): SecretariaCapability[] {
    const reads = [
      { key: "profile", description: "Perfil institucional" },
      ...Object.entries(SECRETARIA_DATASETS).map(([key, contract]) => ({ key, description: contract.description })),
    ];
    const writes = ["contactDetails", "photo", "consents", "examRegistration", "gradeReview", "application", "advancedTraining", "internship", "activity", "languageCompetency", "paymentReference"];
    return [
      ...reads.map((item) => ({ ...item, mode: "read" as const, status: "available" as const })),
      { key: "consents", description: "O contrato de leitura de consentimentos ainda não foi confirmado.", mode: "read" as const, status: "unsupported" as const },
      { key: "finance.receipts", description: "O contrato de recibos ainda não foi confirmado.", mode: "read" as const, status: "unsupported" as const },
      ...writes.map((key) => ({ key, description: "Aguardando contrato e verificação individual.", mode: "write" as const, status: "disabled" as const })),
    ];
  }

  stop() {
    this.keyring.destroy();
  }
}

export class DisabledSecretariaApplication implements SecretariaApplication {
  #disabled(): never {
    throw new SecretariaError("SECRETARIA_INTEGRATION_DISABLED", "A integração Secretaria está desativada.", 503, false, "contact_support");
  }
  connect(): never { return this.#disabled(); }
  getConnection(): Promise<SecretariaConnectionView> { return Promise.resolve(connectionView(null)); }
  terminateSession(): never { return this.#disabled(); }
  disconnect(): Promise<SecretariaConnectionView> { return Promise.resolve(connectionView(null)); }
  deleteImportedData(): never { return this.#disabled(); }
  getProfile(): never { return this.#disabled(); }
  getDataset(): never { return this.#disabled(); }
  startSync(): never { return this.#disabled(); }
  getSync(): never { return this.#disabled(); }
  capabilities(): SecretariaCapability[] { return []; }
}
