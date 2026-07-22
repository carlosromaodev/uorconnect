import { createHash } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import type { SecretariaGateway, SecretariaCredentials } from "../domain/gateway";
import { SecretariaError } from "../domain/errors";
import type {
  SecretariaCapability,
  SecretariaCommandResult,
  SecretariaContactDetails,
  SecretariaContactDetailsPatch,
  SecretariaCommandAttemptView,
  SecretariaCommandView,
  SecretariaConnectionView,
  SecretariaDataset,
  SecretariaDocument,
  SecretariaProfile,
  SecretariaPhoto,
  SecretariaPhotoInput,
  SecretariaSession,
  SecretariaGradeReviewSubmission,
  SecretariaStudentIdentity,
  SecretariaSyncView,
} from "../domain/models";
import { NetpaSecretariaGateway, SECRETARIA_DATASETS } from "../infra/netpa-secretaria.gateway";
import { SecretariaCryptoKeyring } from "../infra/secretaria-crypto";

type SecretariaDatabase = typeof prisma;
type StoredConnection = Awaited<ReturnType<SecretariaDatabase["secretariaConnection"]["findUnique"]>>;

export interface SecretariaApplication {
  connect(student: SecretariaStudentIdentity, input: SecretariaCredentials & { rememberCredentials: true }): Promise<{ connection: SecretariaConnectionView; profile: SecretariaProfile }>;
  getConnection(student: SecretariaStudentIdentity): Promise<SecretariaConnectionView>;
  terminateSession(student: SecretariaStudentIdentity): Promise<SecretariaConnectionView>;
  disconnect(student: SecretariaStudentIdentity): Promise<SecretariaConnectionView>;
  deleteImportedData(student: SecretariaStudentIdentity): Promise<{ deletedSnapshots: number; deletedSyncRuns: number; deletedCommands: number }>;
  getProfile(student: SecretariaStudentIdentity): Promise<SecretariaProfile>;
  getContactDetails(student: SecretariaStudentIdentity): Promise<SecretariaContactDetails>;
  getPhoto(student: SecretariaStudentIdentity): Promise<SecretariaPhoto>;
  getConsents(student: SecretariaStudentIdentity): Promise<SecretariaDataset>;
  getDataset(student: SecretariaStudentIdentity, domain: string): Promise<{ data: SecretariaDataset; stale: boolean; snapshotVersion: number | null }>;
  getPaymentReferenceDocument(student: SecretariaStudentIdentity, chargeRef: string): Promise<SecretariaDocument>;
  startSync(student: SecretariaStudentIdentity, domains?: string[]): Promise<SecretariaSyncView>;
  getSync(student: SecretariaStudentIdentity, runId: string): Promise<SecretariaSyncView>;
  preparePaymentReference(student: SecretariaStudentIdentity, chargeRefs: string[], idempotencyKey: string): Promise<SecretariaCommandView>;
  prepareContactDetails(student: SecretariaStudentIdentity, patch: SecretariaContactDetailsPatch, idempotencyKey: string): Promise<SecretariaCommandView>;
  prepareContactDetailsCancellation(student: SecretariaStudentIdentity, idempotencyKey: string): Promise<SecretariaCommandView>;
  preparePhoto(student: SecretariaStudentIdentity, photo: SecretariaPhotoInput, idempotencyKey: string): Promise<SecretariaCommandView>;
  prepareExamRegistrationCancellation(student: SecretariaStudentIdentity, registrationRef: string, idempotencyKey: string): Promise<SecretariaCommandView>;
  prepareGradeReview(student: SecretariaStudentIdentity, reviewRef: string, operation: SecretariaGradeReviewSubmission["operation"], justification: string, idempotencyKey: string): Promise<SecretariaCommandView>;
  getCommand(student: SecretariaStudentIdentity, commandId: string): Promise<SecretariaCommandView>;
  getCommandAttempts(student: SecretariaStudentIdentity, commandId: string): Promise<SecretariaCommandAttemptView[]>;
  confirmCommand(student: SecretariaStudentIdentity, commandId: string, confirmation?: SecretariaCommandView["type"]): Promise<SecretariaCommandView>;
  reconcileCommand(student: SecretariaStudentIdentity, commandId: string): Promise<SecretariaCommandView>;
  cancelCommand(student: SecretariaStudentIdentity, commandId: string): Promise<SecretariaCommandView>;
  capabilities(): SecretariaCapability[];
  stop?(): void;
}

const PAYMENT_REFERENCE_COMMAND = "GENERATE_PAYMENT_REFERENCE" as const;
const CONTACT_DETAILS_COMMAND = "UPDATE_CONTACT_DETAILS" as const;
const CANCEL_CONTACT_DETAILS_COMMAND = "CANCEL_CONTACT_CHANGE_REQUEST" as const;
const PHOTO_COMMAND = "UPDATE_PHOTO" as const;
const CANCEL_EXAM_REGISTRATION_COMMAND = "CANCEL_EXAM_REGISTRATION" as const;
const SUBMIT_GRADE_REVIEW_COMMAND = "SUBMIT_GRADE_REVIEW" as const;
type SecretariaCommandType = SecretariaCommandView["type"];

type StoredCommand = NonNullable<Awaited<ReturnType<SecretariaDatabase["secretariaCommand"]["findFirst"]>>>;

function commandView(command: StoredCommand, result: SecretariaCommandView["result"]): SecretariaCommandView {
  if (command.type !== PAYMENT_REFERENCE_COMMAND && command.type !== CONTACT_DETAILS_COMMAND && command.type !== CANCEL_CONTACT_DETAILS_COMMAND && command.type !== PHOTO_COMMAND && command.type !== CANCEL_EXAM_REGISTRATION_COMMAND && command.type !== SUBMIT_GRADE_REVIEW_COMMAND) {
    throw new SecretariaError("SECRETARIA_UPSTREAM_CHANGED", "Foi encontrado um tipo de comando da Secretaria não suportado.", 500, false, "contact_support");
  }
  return {
    id: command.id,
    type: command.type,
    risk: command.risk,
    status: command.status,
    requiresConfirmation: command.status === "AWAITING_CONFIRMATION",
    confirmationExpiresAt: command.confirmationExpiresAt?.toISOString() ?? null,
    result,
    errorCode: command.errorCode,
    createdAt: command.createdAt.toISOString(),
    updatedAt: command.updatedAt.toISOString(),
    completedAt: command.completedAt?.toISOString() ?? null,
  };
}

function commandAttemptView(attempt: {
  id: string;
  attempt: number;
  status: string;
  errorCode: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): SecretariaCommandAttemptView {
  return {
    id: attempt.id,
    attempt: attempt.attempt,
    status: attempt.status,
    errorCode: attempt.errorCode,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt?.toISOString() ?? null,
  };
}

function requestHash(type: SecretariaCommandType, payload: unknown) {
  return createHash("sha256").update(JSON.stringify({ type, payload })).digest("hex");
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

  constructor(
    private readonly gateway: SecretariaGateway,
    private readonly keyring: SecretariaCryptoKeyring,
    private readonly commandOptions: { paymentReferenceEnabled: boolean; contactDetailsEnabled: boolean; photoEnabled: boolean; examRegistrationCancelEnabled: boolean; gradeReviewEnabled: boolean; confirmationTtlSeconds: number; commandLeaseSeconds: number },
    private readonly db: SecretariaDatabase = prisma,
  ) {}

  #context(student: SecretariaStudentIdentity, generation: number, purpose: "credentials" | "session" | "command" | "command_result") {
    return { studentId: student.id, institutionCode: "UOR", generation, purpose } as const;
  }

  async connect(student: SecretariaStudentIdentity, input: SecretariaCredentials & { rememberCredentials: true }) {
    if (normalizeStudentNumber(input.username) !== normalizeStudentNumber(student.studentNumber)) {
      throw new SecretariaError("SECRETARIA_IDENTITY_MISMATCH", "O número informado não corresponde ao estudante autenticado.", 403);
    }
    const existing = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    const generation = (existing?.connectionGeneration ?? 0) + 1;
    await this.db.secretariaConnection.upsert({
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
      const connection = await this.db.secretariaConnection.update({
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
      await this.db.secretariaConnection.update({
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
    return connectionView(await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } }));
  }

  async terminateSession(student: SecretariaStudentIdentity) {
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) return connectionView(null);
    if (connection.sessionEnvelope) {
      const session = this.keyring.decryptJson<SecretariaSession>(connection.sessionEnvelope, this.#context(student, connection.connectionGeneration, "session"));
      await this.gateway.logout(session).catch(() => undefined);
    }
    const updated = await this.db.secretariaConnection.update({
      where: { studentId: student.id },
      data: { status: "DISCONNECTED", sessionEnvelope: null, sessionVersion: { increment: 1 }, lastUsedAt: new Date() },
    });
    return connectionView(updated);
  }

  async disconnect(student: SecretariaStudentIdentity) {
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) return connectionView(null);
    if (connection.sessionEnvelope) {
      const session = this.keyring.decryptJson<SecretariaSession>(connection.sessionEnvelope, this.#context(student, connection.connectionGeneration, "session"));
      await this.gateway.logout(session).catch(() => undefined);
    }
    await this.db.secretariaConnection.delete({ where: { studentId: student.id } });
    return connectionView(null);
  }

  async deleteImportedData(student: SecretariaStudentIdentity) {
    const result = await this.db.$transaction(async (tx) => {
      const snapshots = await tx.secretariaSnapshot.deleteMany({ where: { studentId: student.id } });
      const runs = await tx.secretariaSyncRun.deleteMany({ where: { studentId: student.id } });
      const commands = await tx.secretariaCommand.deleteMany({ where: { studentId: student.id } });
      await tx.secretariaConnection.updateMany({ where: { studentId: student.id }, data: { activeSnapshotVersion: null, lastSuccessfulSyncAt: null } });
      return { deletedSnapshots: snapshots.count, deletedSyncRuns: runs.count, deletedCommands: commands.count };
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
        await this.db.secretariaConnection.update({
          where: { studentId: student.id },
          data: { status: "CONNECTED", sessionEnvelope, sessionVersion: { increment: 1 }, failedReauthCount: 0, lastAuthenticatedAt: new Date(), lastUsedAt: new Date(), lastErrorCode: null },
        });
        return authenticated.session;
      } catch (error) {
        await this.db.secretariaConnection.update({
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
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    if (!connection.sessionEnvelope) return this.#reauthenticate(student, connection);
    const session = this.keyring.decryptJson<SecretariaSession>(connection.sessionEnvelope, this.#context(student, connection.connectionGeneration, "session"));
    if (await this.gateway.validateSession(session)) return session;
    return this.#reauthenticate(student, connection);
  }

  async #persistSession(student: SecretariaStudentIdentity, session: SecretariaSession) {
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) return;
    const sessionEnvelope = this.keyring.encryptJson(session, this.#context(student, connection.connectionGeneration, "session"));
    await this.db.secretariaConnection.updateMany({
      where: { studentId: student.id, connectionGeneration: connection.connectionGeneration },
      data: { sessionEnvelope, lastUsedAt: new Date() },
    });
  }

  async #withSession<T>(student: SecretariaStudentIdentity, operation: (session: SecretariaSession) => Promise<T>): Promise<T> {
    let session = await this.#session(student);
    try {
      const result = await operation(session);
      await this.#persistSession(student, session);
      return result;
    } catch (error) {
      if (!(error instanceof SecretariaError) || error.code !== "SECRETARIA_REAUTH_REQUIRED") throw error;
      const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
      if (!connection) throw error;
      session = await this.#reauthenticate(student, connection);
      const result = await operation(session);
      await this.#persistSession(student, session);
      return result;
    }
  }

  async getProfile(student: SecretariaStudentIdentity) {
    return this.#withSession(student, (session) => this.gateway.getProfile(session));
  }

  async getContactDetails(student: SecretariaStudentIdentity) {
    return this.#withSession(student, (session) => this.gateway.getContactDetails(session));
  }

  async getPhoto(student: SecretariaStudentIdentity) {
    return this.#withSession(student, (session) => this.gateway.getPhoto(session));
  }

  async getConsents(student: SecretariaStudentIdentity) {
    return this.#withSession(student, (session) => this.gateway.getConsents(session));
  }

  async getDataset(student: SecretariaStudentIdentity, domain: string) {
    try {
      return { data: await this.#withSession(student, (session) => this.gateway.getDataset(session, domain)), stale: false, snapshotVersion: null };
    } catch (error) {
      const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
      if (!connection?.activeSnapshotVersion) throw error;
      const snapshot = await this.db.secretariaSnapshot.findUnique({
        where: { studentId_domain_snapshotVersion: { studentId: student.id, domain, snapshotVersion: connection.activeSnapshotVersion } },
      });
      if (!snapshot) throw error;
      const parsed = JSON.parse(snapshot.payloadJson) as SecretariaDataset;
      const data: SecretariaDataset = { ...parsed, coverage: "stale" };
      return { data, stale: true, snapshotVersion: snapshot.snapshotVersion };
    }
  }

  async getPaymentReferenceDocument(student: SecretariaStudentIdentity, chargeRef: string) {
    if (!/^scr_[A-Za-z0-9_-]{43}$/.test(chargeRef)) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A referência financeira é inválida.", 422);
    }
    return this.#withSession(student, (session) => this.gateway.getPaymentReferenceDocument(session, chargeRef));
  }

  async startSync(student: SecretariaStudentIdentity, requested?: string[]) {
    const domains = requested?.length ? requested : Object.keys(SECRETARIA_DATASETS);
    const invalid = domains.find((domain) => !SECRETARIA_DATASETS[domain]);
    if (invalid) throw new SecretariaError("SECRETARIA_REQUEST_INVALID", `Domínio de sincronização inválido: ${invalid}.`, 422);
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const activeRun = await this.db.secretariaSyncRun.findFirst({
      where: { studentId: student.id, status: "RUNNING", startedAt: { gte: new Date(Date.now() - 15 * 60_000) } },
      orderBy: { startedAt: "desc" },
    });
    if (activeRun) return syncView(activeRun);
    const version = (connection.activeSnapshotVersion ?? 0) + 1;
    const run = await this.db.secretariaSyncRun.create({ data: { studentId: student.id, domainsJson: JSON.stringify(domains), snapshotVersion: version } });
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
      ? await this.db.secretariaSnapshot.findMany({
        where: { studentId: student.id, snapshotVersion: connection.activeSnapshotVersion, domain: { in: failed } },
      })
      : [];
    const status = completed.length === domains.length ? "COMPLETED" : completed.length ? "PARTIAL" : "FAILED";
    await this.db.$transaction(async (tx) => {
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
    const run = await this.db.secretariaSyncRun.findFirst({ where: { id: runId, studentId: student.id } });
    if (!run) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "A sincronização não foi encontrada.", 404);
    return syncView(run);
  }

  #requirePaymentReferenceWrite() {
    if (!this.commandOptions.paymentReferenceEnabled) {
      throw new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "A geração de referência está desativada por configuração.", 409);
    }
  }

  #requireContactDetailsWrite() {
    if (!this.commandOptions.contactDetailsEnabled) {
      throw new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "A submissão de alterações de contacto está desativada por configuração.", 409);
    }
  }

  #requirePhotoWrite() {
    if (!this.commandOptions.photoEnabled) {
      throw new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "A submissão de fotografia está desativada por configuração.", 409);
    }
  }

  #requireExamRegistrationCancelWrite() {
    if (!this.commandOptions.examRegistrationCancelEnabled) {
      throw new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "O cancelamento de inscrição em época está desativado por configuração.", 409);
    }
  }

  #requireGradeReviewWrite() {
    if (!this.commandOptions.gradeReviewEnabled) {
      throw new SecretariaError("SECRETARIA_CAPABILITY_DISABLED", "A submissão de revisão de nota está desativada por configuração.", 409);
    }
  }

  #requireCommandWrite(type: string) {
    if (type === PAYMENT_REFERENCE_COMMAND) return this.#requirePaymentReferenceWrite();
    if (type === CONTACT_DETAILS_COMMAND || type === CANCEL_CONTACT_DETAILS_COMMAND) return this.#requireContactDetailsWrite();
    if (type === PHOTO_COMMAND) return this.#requirePhotoWrite();
    if (type === CANCEL_EXAM_REGISTRATION_COMMAND) return this.#requireExamRegistrationCancelWrite();
    if (type === SUBMIT_GRADE_REVIEW_COMMAND) return this.#requireGradeReviewWrite();
    throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "O tipo de comando não é suportado.", 409);
  }

  async #command(student: SecretariaStudentIdentity, commandId: string) {
    const command = await this.db.secretariaCommand.findFirst({ where: { id: commandId, studentId: student.id } });
    if (!command) throw new SecretariaError("SECRETARIA_RESOURCE_NOT_FOUND", "O comando da Secretaria não foi encontrado.", 404);
    return command;
  }

  #commandView(student: SecretariaStudentIdentity, command: StoredCommand) {
    const result = command.resultEnvelope
      ? this.keyring.decryptJson<NonNullable<SecretariaCommandView["result"]>>(
        command.resultEnvelope,
        this.#context(student, command.connectionGeneration, "command_result"),
      )
      : null;
    return commandView(command, result);
  }

  async preparePaymentReference(student: SecretariaStudentIdentity, requestedChargeRefs: string[], idempotencyKey: string) {
    this.#requirePaymentReferenceWrite();
    const chargeRefs = [...new Set(requestedChargeRefs)].sort();
    if (chargeRefs.length !== requestedChargeRefs.length) throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "Os itens financeiros não podem estar repetidos.", 422);
    const hash = requestHash(PAYMENT_REFERENCE_COMMAND, { chargeRefs });
    const byIdempotency = await this.db.secretariaCommand.findFirst({
      where: { studentId: student.id, type: PAYMENT_REFERENCE_COMMAND, idempotencyKey },
    });
    if (byIdempotency) {
      if (byIdempotency.requestHash !== hash) {
        throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      }
      return this.#commandView(student, byIdempotency);
    }
    const semanticDuplicate = await this.db.secretariaCommand.findFirst({
      where: {
        studentId: student.id,
        type: PAYMENT_REFERENCE_COMMAND,
        requestHash: hash,
        OR: [
          { status: { in: ["AWAITING_CONFIRMATION", "SUBMITTING", "VERIFYING", "UNKNOWN"] } },
          { status: "SUCCEEDED", completedAt: { gte: new Date(Date.now() - 15 * 60_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (semanticDuplicate) return this.#commandView(student, semanticDuplicate);

    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const prepared = await this.#withSession(student, (session) => this.gateway.preparePaymentReference(session, chargeRefs));
    const generation = connection.connectionGeneration;
    const payloadEnvelope = this.keyring.encryptJson(
      { chargeRefs: prepared.chargeRefs },
      this.#context(student, generation, "command"),
    );
    const confirmationExpiresAt = new Date(Date.now() + this.commandOptions.confirmationTtlSeconds * 1000);
    try {
      const command = await this.db.secretariaCommand.create({
        data: {
          studentId: student.id,
          type: PAYMENT_REFERENCE_COMMAND,
          risk: "MEDIUM",
          status: "AWAITING_CONFIRMATION",
          idempotencyKey,
          requestHash: hash,
          payloadEnvelope,
          connectionGeneration: generation,
          confirmationExpiresAt,
        },
      });
      return this.#commandView(student, command);
    } catch (error) {
      const concurrent = await this.db.secretariaCommand.findFirst({
        where: { studentId: student.id, type: PAYMENT_REFERENCE_COMMAND, idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, concurrent);
    }
  }

  async prepareContactDetails(
    student: SecretariaStudentIdentity,
    patch: SecretariaContactDetailsPatch,
    idempotencyKey: string,
  ) {
    this.#requireContactDetailsWrite();
    const orderedPatch = Object.fromEntries(Object.entries(patch).sort(([left], [right]) => left.localeCompare(right))) as SecretariaContactDetailsPatch;
    const hash = requestHash(CONTACT_DETAILS_COMMAND, orderedPatch);
    const byIdempotency = await this.db.secretariaCommand.findFirst({
      where: { studentId: student.id, type: CONTACT_DETAILS_COMMAND, idempotencyKey },
    });
    if (byIdempotency) {
      if (byIdempotency.requestHash !== hash) {
        throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      }
      return this.#commandView(student, byIdempotency);
    }
    const semanticDuplicate = await this.db.secretariaCommand.findFirst({
      where: {
        studentId: student.id,
        type: CONTACT_DETAILS_COMMAND,
        requestHash: hash,
        OR: [
          { status: { in: ["AWAITING_CONFIRMATION", "SUBMITTING", "VERIFYING", "UNKNOWN"] } },
          { status: "SUCCEEDED", completedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (semanticDuplicate) return this.#commandView(student, semanticDuplicate);

    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const prepared = await this.#withSession(student, (session) => this.gateway.prepareContactDetails(session, orderedPatch));
    const payloadEnvelope = this.keyring.encryptJson(
      { patch: prepared.patch, preconditionHash: prepared.preconditionHash },
      this.#context(student, connection.connectionGeneration, "command"),
    );
    const confirmationExpiresAt = new Date(Date.now() + this.commandOptions.confirmationTtlSeconds * 1000);
    try {
      const command = await this.db.secretariaCommand.create({
        data: {
          studentId: student.id,
          type: CONTACT_DETAILS_COMMAND,
          risk: "MEDIUM",
          status: "AWAITING_CONFIRMATION",
          idempotencyKey,
          requestHash: hash,
          payloadEnvelope,
          connectionGeneration: connection.connectionGeneration,
          confirmationExpiresAt,
        },
      });
      return this.#commandView(student, command);
    } catch (error) {
      const concurrent = await this.db.secretariaCommand.findFirst({
        where: { studentId: student.id, type: CONTACT_DETAILS_COMMAND, idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, concurrent);
    }
  }

  async prepareContactDetailsCancellation(student: SecretariaStudentIdentity, idempotencyKey: string) {
    this.#requireContactDetailsWrite();
    const hash = requestHash(CANCEL_CONTACT_DETAILS_COMMAND, {});
    const existing = await this.db.secretariaCommand.findFirst({
      where: { studentId: student.id, type: CANCEL_CONTACT_DETAILS_COMMAND, idempotencyKey },
    });
    if (existing) {
      if (existing.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, existing);
    }
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const prepared = await this.#withSession(student, (session) => this.gateway.prepareContactDetailsCancellation(session));
    const payloadEnvelope = this.keyring.encryptJson(prepared, this.#context(student, connection.connectionGeneration, "command"));
    const confirmationExpiresAt = new Date(Date.now() + this.commandOptions.confirmationTtlSeconds * 1000);
    try {
      const command = await this.db.secretariaCommand.create({
        data: {
          studentId: student.id,
          type: CANCEL_CONTACT_DETAILS_COMMAND,
          risk: "MEDIUM",
          status: "AWAITING_CONFIRMATION",
          idempotencyKey,
          requestHash: hash,
          payloadEnvelope,
          connectionGeneration: connection.connectionGeneration,
          confirmationExpiresAt,
        },
      });
      return this.#commandView(student, command);
    } catch (error) {
      const concurrent = await this.db.secretariaCommand.findFirst({ where: { studentId: student.id, type: CANCEL_CONTACT_DETAILS_COMMAND, idempotencyKey } });
      if (!concurrent) throw error;
      return this.#commandView(student, concurrent);
    }
  }

  async preparePhoto(student: SecretariaStudentIdentity, photo: SecretariaPhotoInput, idempotencyKey: string) {
    this.#requirePhotoWrite();
    const actualHash = createHash("sha256").update(photo.body).digest("hex");
    if (
      photo.body.length === 0
      || photo.body.length > 1_048_576
      || actualHash !== photo.sha256
      || photo.width < 64
      || photo.height < 64
      || photo.width > 8_000
      || photo.height > 8_000
    ) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A fotografia JPEG não cumpre os limites permitidos.", 422);
    }
    const publicPayload = { sha256: photo.sha256, size: photo.body.length, width: photo.width, height: photo.height };
    const hash = requestHash(PHOTO_COMMAND, publicPayload);
    const byIdempotency = await this.db.secretariaCommand.findFirst({
      where: { studentId: student.id, type: PHOTO_COMMAND, idempotencyKey },
    });
    if (byIdempotency) {
      if (byIdempotency.requestHash !== hash) {
        throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      }
      return this.#commandView(student, byIdempotency);
    }
    const semanticDuplicate = await this.db.secretariaCommand.findFirst({
      where: {
        studentId: student.id,
        type: PHOTO_COMMAND,
        requestHash: hash,
        OR: [
          { status: { in: ["AWAITING_CONFIRMATION", "SUBMITTING", "VERIFYING", "UNKNOWN"] } },
          { status: "SUCCEEDED", completedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (semanticDuplicate) return this.#commandView(student, semanticDuplicate);

    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const prepared = await this.#withSession(student, (session) => this.gateway.preparePhoto(session));
    const payloadEnvelope = this.keyring.encryptJson(
      { ...publicPayload, jpegBase64: photo.body.toString("base64"), preconditionHash: prepared.preconditionHash },
      this.#context(student, connection.connectionGeneration, "command"),
    );
    const confirmationExpiresAt = new Date(Date.now() + this.commandOptions.confirmationTtlSeconds * 1000);
    try {
      const command = await this.db.secretariaCommand.create({
        data: {
          studentId: student.id,
          type: PHOTO_COMMAND,
          risk: "MEDIUM",
          status: "AWAITING_CONFIRMATION",
          idempotencyKey,
          requestHash: hash,
          payloadEnvelope,
          connectionGeneration: connection.connectionGeneration,
          confirmationExpiresAt,
        },
      });
      return this.#commandView(student, command);
    } catch (error) {
      const concurrent = await this.db.secretariaCommand.findFirst({
        where: { studentId: student.id, type: PHOTO_COMMAND, idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, concurrent);
    }
  }

  async prepareExamRegistrationCancellation(student: SecretariaStudentIdentity, registrationRef: string, idempotencyKey: string) {
    this.#requireExamRegistrationCancelWrite();
    if (!/^ser_[A-Za-z0-9_-]{43}$/.test(registrationRef)) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A referência da inscrição em época é inválida.", 422);
    }
    const hash = requestHash(CANCEL_EXAM_REGISTRATION_COMMAND, { registrationRef });
    const byIdempotency = await this.db.secretariaCommand.findFirst({
      where: { studentId: student.id, type: CANCEL_EXAM_REGISTRATION_COMMAND, idempotencyKey },
    });
    if (byIdempotency) {
      if (byIdempotency.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, byIdempotency);
    }
    const semanticDuplicate = await this.db.secretariaCommand.findFirst({
      where: {
        studentId: student.id,
        type: CANCEL_EXAM_REGISTRATION_COMMAND,
        requestHash: hash,
        OR: [
          { status: { in: ["AWAITING_CONFIRMATION", "SUBMITTING", "VERIFYING", "UNKNOWN"] } },
          { status: "SUCCEEDED", completedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (semanticDuplicate) return this.#commandView(student, semanticDuplicate);

    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const prepared = await this.#withSession(student, (session) => this.gateway.prepareExamRegistrationCancellation(session, registrationRef));
    const payloadEnvelope = this.keyring.encryptJson(prepared, this.#context(student, connection.connectionGeneration, "command"));
    const confirmationExpiresAt = new Date(Date.now() + this.commandOptions.confirmationTtlSeconds * 1000);
    try {
      const command = await this.db.secretariaCommand.create({
        data: {
          studentId: student.id,
          type: CANCEL_EXAM_REGISTRATION_COMMAND,
          risk: "MEDIUM",
          status: "AWAITING_CONFIRMATION",
          idempotencyKey,
          requestHash: hash,
          payloadEnvelope,
          connectionGeneration: connection.connectionGeneration,
          confirmationExpiresAt,
        },
      });
      return this.#commandView(student, command);
    } catch (error) {
      const concurrent = await this.db.secretariaCommand.findFirst({
        where: { studentId: student.id, type: CANCEL_EXAM_REGISTRATION_COMMAND, idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, concurrent);
    }
  }

  async prepareGradeReview(student: SecretariaStudentIdentity, reviewRef: string, operation: SecretariaGradeReviewSubmission["operation"], justification: string, idempotencyKey: string) {
    this.#requireGradeReviewWrite();
    if (!/^sgr_[A-Za-z0-9_-]{43}$/.test(reviewRef)) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A referência da avaliação é inválida.", 422);
    }
    const normalizedJustification = justification.trim();
    if ((operation !== "PROOF_COPY" && !normalizedJustification) || normalizedJustification.length > 16_000) {
      throw new SecretariaError("SECRETARIA_REQUEST_INVALID", "A justificação deve ter entre 1 e 16000 caracteres para revisão ou reapreciação.", 422);
    }
    const hash = requestHash(SUBMIT_GRADE_REVIEW_COMMAND, { reviewRef, operation, justification: normalizedJustification });
    const byIdempotency = await this.db.secretariaCommand.findFirst({
      where: { studentId: student.id, type: SUBMIT_GRADE_REVIEW_COMMAND, idempotencyKey },
    });
    if (byIdempotency) {
      if (byIdempotency.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, byIdempotency);
    }
    const semanticDuplicate = await this.db.secretariaCommand.findFirst({
      where: {
        studentId: student.id,
        type: SUBMIT_GRADE_REVIEW_COMMAND,
        requestHash: hash,
        OR: [
          { status: { in: ["AWAITING_CONFIRMATION", "SUBMITTING", "VERIFYING", "UNKNOWN"] } },
          { status: "SUCCEEDED", completedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (semanticDuplicate) return this.#commandView(student, semanticDuplicate);

    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection?.credentialsEnvelope) throw new SecretariaError("SECRETARIA_SESSION_REQUIRED", "Liga a conta da Secretaria para continuar.", 409, false, "connect");
    const prepared = await this.#withSession(student, (session) => this.gateway.prepareGradeReview(session, reviewRef, operation, normalizedJustification));
    const payloadEnvelope = this.keyring.encryptJson(prepared, this.#context(student, connection.connectionGeneration, "command"));
    const confirmationExpiresAt = new Date(Date.now() + this.commandOptions.confirmationTtlSeconds * 1000);
    try {
      const command = await this.db.secretariaCommand.create({
        data: {
          studentId: student.id,
          type: SUBMIT_GRADE_REVIEW_COMMAND,
          risk: "HIGH",
          status: "AWAITING_CONFIRMATION",
          idempotencyKey,
          requestHash: hash,
          payloadEnvelope,
          connectionGeneration: connection.connectionGeneration,
          confirmationExpiresAt,
        },
      });
      return this.#commandView(student, command);
    } catch (error) {
      const concurrent = await this.db.secretariaCommand.findFirst({
        where: { studentId: student.id, type: SUBMIT_GRADE_REVIEW_COMMAND, idempotencyKey },
      });
      if (!concurrent) throw error;
      if (concurrent.requestHash !== hash) throw new SecretariaError("SECRETARIA_IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com outro pedido.", 409);
      return this.#commandView(student, concurrent);
    }
  }

  async getCommand(student: SecretariaStudentIdentity, commandId: string) {
    return this.#commandView(student, await this.#command(student, commandId));
  }

  async getCommandAttempts(student: SecretariaStudentIdentity, commandId: string) {
    await this.#command(student, commandId);
    const attempts = await this.db.secretariaCommandAttempt.findMany({ where: { commandId }, orderBy: { attempt: "asc" } });
    return attempts.map(commandAttemptView);
  }

  async confirmCommand(student: SecretariaStudentIdentity, commandId: string, confirmation?: SecretariaCommandType) {
    let command = await this.#command(student, commandId);
    this.#requireCommandWrite(command.type);
    if (confirmation && confirmation !== command.type) {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "A confirmação não corresponde ao tipo do comando.", 409);
    }
    if (["SUCCEEDED", "FAILED", "UNKNOWN", "CANCELLED", "EXPIRED"].includes(command.status)) return this.#commandView(student, command);
    if (command.status !== "AWAITING_CONFIRMATION") {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "O comando não pode ser confirmado no estado atual.", 409);
    }
    if (!command.confirmationExpiresAt || command.confirmationExpiresAt.getTime() <= Date.now()) {
      command = await this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "EXPIRED", errorCode: "SECRETARIA_COMMAND_EXPIRED", leaseUntil: null, completedAt: new Date() } });
      throw new SecretariaError("SECRETARIA_COMMAND_EXPIRED", "A confirmação expirou; prepara um novo pedido.", 409);
    }
    const connection = await this.db.secretariaConnection.findUnique({ where: { studentId: student.id } });
    if (!connection || connection.connectionGeneration !== command.connectionGeneration) {
      command = await this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "FAILED", errorCode: "SECRETARIA_REAUTH_REQUIRED", leaseUntil: null, completedAt: new Date() } });
      return this.#commandView(student, command);
    }

    let attemptId: string | null = null;
    const claimed = await this.db.$transaction(async (tx) => {
      const claim = await tx.secretariaCommand.updateMany({
        where: { id: command.id, studentId: student.id, status: "AWAITING_CONFIRMATION" },
        data: { status: "SUBMITTING", submittedAt: new Date(), leaseUntil: new Date(Date.now() + this.commandOptions.commandLeaseSeconds * 1000), errorCode: null },
      });
      if (!claim.count) return false;
      const attemptNumber = await tx.secretariaCommandAttempt.count({ where: { commandId: command.id } }) + 1;
      const attempt = await tx.secretariaCommandAttempt.create({
        data: { commandId: command.id, attempt: attemptNumber, status: "SUBMITTING", requestHash: command.requestHash },
      });
      attemptId = attempt.id;
      return true;
    });
    if (!claimed) return this.#commandView(student, await this.#command(student, commandId));

    try {
      let result: SecretariaCommandResult;
      if (command.type === PAYMENT_REFERENCE_COMMAND) {
        const payload = this.keyring.decryptJson<{ chargeRefs: string[] }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.generatePaymentReference(session, payload.chargeRefs));
      } else if (command.type === CONTACT_DETAILS_COMMAND) {
        const payload = this.keyring.decryptJson<{ patch: SecretariaContactDetailsPatch; preconditionHash: string }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.updateContactDetails(session, payload.patch, payload.preconditionHash));
      } else if (command.type === CANCEL_CONTACT_DETAILS_COMMAND) {
        const payload = this.keyring.decryptJson<{ preconditionHash: string }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.cancelContactDetailsChangeRequest(session, payload.preconditionHash));
      } else if (command.type === PHOTO_COMMAND) {
        const payload = this.keyring.decryptJson<{ jpegBase64: string; sha256: string; size: number; preconditionHash: string }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        const jpeg = Buffer.from(payload.jpegBase64, "base64");
        try {
          if (jpeg.length !== payload.size || createHash("sha256").update(jpeg).digest("hex") !== payload.sha256) {
            throw new SecretariaError("SECRETARIA_ENVELOPE_INVALID", "O payload cifrado da fotografia é inválido.", 500, false, "contact_support");
          }
          result = await this.#withSession(student, (session) => this.gateway.updatePhoto(session, jpeg, payload.preconditionHash));
        } finally {
          jpeg.fill(0);
        }
      } else if (command.type === CANCEL_EXAM_REGISTRATION_COMMAND) {
        const payload = this.keyring.decryptJson<{ registrationRef: string; preconditionHash: string }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.cancelExamRegistration(session, payload));
      } else {
        const payload = this.keyring.decryptJson<SecretariaGradeReviewSubmission>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.submitGradeReview(session, payload));
      }
      await this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "VERIFYING" } });
      const responseHash = NetpaSecretariaGateway.normalizedHash(result);
      const resultEnvelope = this.keyring.encryptJson(result, this.#context(student, command.connectionGeneration, "command_result"));
      await this.db.$transaction([
        this.db.secretariaCommandAttempt.update({ where: { id: attemptId! }, data: { status: "SUCCEEDED", responseHash, finishedAt: new Date() } }),
        this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "SUCCEEDED", resultEnvelope, errorCode: null, leaseUntil: null, completedAt: new Date() } }),
      ]);
      return this.#commandView(student, await this.#command(student, commandId));
    } catch (error) {
      const code = error instanceof SecretariaError ? error.code : "SECRETARIA_UNAVAILABLE";
      const unknown = !(error instanceof SecretariaError)
        || error.retryable
        || error.code === "SECRETARIA_COMMAND_OUTCOME_UNKNOWN"
        || error.code === "SECRETARIA_UNAVAILABLE";
      const status = unknown ? "UNKNOWN" : "FAILED";
      await this.db.$transaction([
        this.db.secretariaCommandAttempt.update({ where: { id: attemptId! }, data: { status, errorCode: code, finishedAt: new Date() } }),
        this.db.secretariaCommand.update({ where: { id: command.id }, data: { status, errorCode: code, leaseUntil: null, completedAt: unknown ? null : new Date() } }),
      ]);
      return this.#commandView(student, await this.#command(student, commandId));
    }
  }

  async reconcileCommand(student: SecretariaStudentIdentity, commandId: string) {
    const command = await this.#command(student, commandId);
    this.#requireCommandWrite(command.type);
    if (command.status === "SUCCEEDED") return this.#commandView(student, command);
    if (command.type === CONTACT_DETAILS_COMMAND || command.type === CANCEL_CONTACT_DETAILS_COMMAND || command.type === PHOTO_COMMAND) {
      throw new SecretariaError(
        "SECRETARIA_COMMAND_RECONCILIATION_UNSUPPORTED",
        "A Secretaria não expõe consulta do pedido de alteração; não é seguro repetir automaticamente.",
        409,
        false,
        "contact_support",
      );
    }
    const now = new Date();
    const expiredLease = (["SUBMITTING", "VERIFYING"] as string[]).includes(command.status)
      && Boolean(command.leaseUntil && command.leaseUntil.getTime() <= now.getTime());
    if (command.status !== "UNKNOWN" && !expiredLease) {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "Apenas comandos com resultado incerto podem ser reconciliados.", 409);
    }
    const claim = await this.db.secretariaCommand.updateMany({
      where: {
        id: command.id,
        studentId: student.id,
        OR: [
          { status: "UNKNOWN" },
          { status: { in: ["SUBMITTING", "VERIFYING"] }, leaseUntil: { lte: now } },
        ],
      },
      data: { status: "VERIFYING", leaseUntil: new Date(Date.now() + this.commandOptions.commandLeaseSeconds * 1000) },
    });
    if (!claim.count) return this.#commandView(student, await this.#command(student, commandId));
    const attemptNumber = await this.db.secretariaCommandAttempt.count({ where: { commandId: command.id } }) + 1;
    const attempt = await this.db.secretariaCommandAttempt.create({
      data: { commandId: command.id, attempt: attemptNumber, status: "RECONCILING", requestHash: command.requestHash },
    });
    try {
      let result: SecretariaCommandResult | null;
      if (command.type === PAYMENT_REFERENCE_COMMAND) {
        const payload = this.keyring.decryptJson<{ chargeRefs: string[] }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.verifyPaymentReference(session, payload.chargeRefs));
      } else if (command.type === CANCEL_EXAM_REGISTRATION_COMMAND) {
        const payload = this.keyring.decryptJson<{ registrationRef: string }>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.verifyExamRegistrationCancellation(session, payload.registrationRef));
      } else {
        const payload = this.keyring.decryptJson<SecretariaGradeReviewSubmission>(
          command.payloadEnvelope,
          this.#context(student, command.connectionGeneration, "command"),
        );
        result = await this.#withSession(student, (session) => this.gateway.verifyGradeReview(session, payload.reviewRef, payload.operation));
      }
      if (!result) {
        await this.db.$transaction([
          this.db.secretariaCommandAttempt.update({ where: { id: attempt.id }, data: { status: "NOT_CONFIRMED", finishedAt: new Date() } }),
          this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "UNKNOWN", leaseUntil: null, errorCode: "SECRETARIA_COMMAND_OUTCOME_UNKNOWN" } }),
        ]);
        return this.#commandView(student, await this.#command(student, commandId));
      }
      const responseHash = NetpaSecretariaGateway.normalizedHash(result);
      const resultEnvelope = this.keyring.encryptJson(result, this.#context(student, command.connectionGeneration, "command_result"));
      await this.db.$transaction([
        this.db.secretariaCommandAttempt.update({ where: { id: attempt.id }, data: { status: "SUCCEEDED", responseHash, finishedAt: new Date() } }),
        this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "SUCCEEDED", resultEnvelope, errorCode: null, leaseUntil: null, completedAt: new Date() } }),
      ]);
      return this.#commandView(student, await this.#command(student, commandId));
    } catch (error) {
      const code = error instanceof SecretariaError ? error.code : "SECRETARIA_UNAVAILABLE";
      await this.db.$transaction([
        this.db.secretariaCommandAttempt.update({ where: { id: attempt.id }, data: { status: "UNKNOWN", errorCode: code, finishedAt: new Date() } }),
        this.db.secretariaCommand.update({ where: { id: command.id }, data: { status: "UNKNOWN", leaseUntil: null, errorCode: code } }),
      ]);
      return this.#commandView(student, await this.#command(student, commandId));
    }
  }

  async cancelCommand(student: SecretariaStudentIdentity, commandId: string) {
    const command = await this.#command(student, commandId);
    if (command.status === "CANCELLED") return this.#commandView(student, command);
    if (command.status !== "AWAITING_CONFIRMATION") {
      throw new SecretariaError("SECRETARIA_COMMAND_STATE_INVALID", "Apenas comandos ainda não confirmados podem ser cancelados.", 409);
    }
    const cancelled = await this.db.secretariaCommand.update({
      where: { id: command.id },
      data: { status: "CANCELLED", leaseUntil: null, completedAt: new Date(), errorCode: null },
    });
    return this.#commandView(student, cancelled);
  }

  capabilities(): SecretariaCapability[] {
    const reads = [
      { key: "profile", description: "Perfil institucional" },
      { key: "contactDetails", description: "Contactos e moradas institucionais" },
      { key: "photo", description: "Fotografia institucional por proxy seguro" },
      { key: "consents", description: "Consentimentos disponíveis para o utilizador" },
      ...Object.entries(SECRETARIA_DATASETS)
        .filter(([key]) => key !== "finance.payments")
        .map(([key, contract]) => ({ key, description: contract.description })),
      { key: "finance.referenceDocument", description: "Documento PDF oficial de uma referência de pagamento" },
    ];
    const writes = ["consents", "examRegistration.create", "application", "advancedTraining", "internship", "activity", "languageCompetency"];
    return [
      ...reads.map((item) => ({ ...item, mode: "read" as const, status: "available" as const })),
      { key: "finance.receipts", description: "O contrato de recibos ainda não foi confirmado.", mode: "read" as const, status: "unsupported" as const },
      { key: "finance.payments", description: "O portal não expõe um histórico de pagamentos verificável neste perfil.", mode: "read" as const, status: "unsupported" as const },
      {
        key: "paymentReference",
        description: this.commandOptions.paymentReferenceEnabled
          ? "Geração oficial com idempotência, confirmação e reconciliação."
          : "Contrato verificado; ativação depende da feature flag operacional.",
        mode: "write" as const,
        status: this.commandOptions.paymentReferenceEnabled ? "available" as const : "disabled" as const,
      },
      {
        key: "contactDetails",
        description: this.commandOptions.contactDetailsEnabled
          ? "Submissão de pedido de alteração com idempotência, confirmação e precondição otimista."
          : "Contrato verificado; ativação depende da feature flag operacional.",
        mode: "write" as const,
        status: this.commandOptions.contactDetailsEnabled ? "available" as const : "disabled" as const,
      },
      {
        key: "contactDetails.cancelPendingChange",
        description: this.commandOptions.contactDetailsEnabled
          ? "Cancelamento do pedido cadastral pendente com confirmação e precondição."
          : "Contrato de cancelamento verificado; ativação depende da feature flag operacional.",
        mode: "write" as const,
        status: this.commandOptions.contactDetailsEnabled ? "available" as const : "disabled" as const,
      },
      {
        key: "photo",
        description: this.commandOptions.photoEnabled
          ? "Pedido de fotografia JPEG com validação, idempotência, confirmação e precondição."
          : "Contrato de atualização verificado; ativação depende da feature flag operacional.",
        mode: "write" as const,
        status: this.commandOptions.photoEnabled ? "available" as const : "disabled" as const,
      },
      {
        key: "examRegistration.cancel",
        description: this.commandOptions.examRegistrationCancelEnabled
          ? "Cancelamento oficial com referência opaca, confirmação, precondição e reconciliação por leitura."
          : "Contrato de cancelamento verificado; ativação depende da feature flag operacional.",
        mode: "write" as const,
        status: this.commandOptions.examRegistrationCancelEnabled ? "available" as const : "disabled" as const,
      },
      {
        key: "gradeReview.submit",
        description: this.commandOptions.gradeReviewEnabled
          ? "Pedidos oficiais de cópia de prova, revisão e reapreciação sem anexos, com referência opaca, confirmação, precondição e reconciliação."
          : "Contratos de cópia de prova, revisão e reapreciação verificados; ativação depende da feature flag operacional.",
        mode: "write" as const,
        status: this.commandOptions.gradeReviewEnabled ? "available" as const : "disabled" as const,
      },
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
  getContactDetails(): never { return this.#disabled(); }
  getPhoto(): never { return this.#disabled(); }
  getConsents(): never { return this.#disabled(); }
  getDataset(): never { return this.#disabled(); }
  getPaymentReferenceDocument(): never { return this.#disabled(); }
  startSync(): never { return this.#disabled(); }
  getSync(): never { return this.#disabled(); }
  preparePaymentReference(): never { return this.#disabled(); }
  prepareContactDetails(): never { return this.#disabled(); }
  prepareContactDetailsCancellation(): never { return this.#disabled(); }
  preparePhoto(): never { return this.#disabled(); }
  prepareExamRegistrationCancellation(): never { return this.#disabled(); }
  prepareGradeReview(): never { return this.#disabled(); }
  getCommand(): never { return this.#disabled(); }
  getCommandAttempts(): never { return this.#disabled(); }
  confirmCommand(): never { return this.#disabled(); }
  reconcileCommand(): never { return this.#disabled(); }
  cancelCommand(): never { return this.#disabled(); }
  capabilities(): SecretariaCapability[] { return []; }
}
