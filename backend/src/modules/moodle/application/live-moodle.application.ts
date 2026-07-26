import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { MoodleGateway, MoodleGatewayStreamLocator } from "../domain/gateway";
import { MoodleError, moodleConnectionRequired } from "../domain/errors";
import type {
  MoodleCountStatus,
  MoodleCourse,
  MoodleCoverage,
  MoodleListResult,
  MoodleMaterial,
  MoodleOverview,
  MoodlePagination,
  MoodleProfile,
  MoodleSection,
  MoodleSyncView,
} from "../domain/models";
import type {
  MoodleRepository,
  PersistedCourseSnapshot,
  PersistedMaterialSnapshot,
  PersistedMoodleConnection,
  PersistedMoodleSyncRun,
} from "../domain/repository";
import type { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import type { MoodleCursorCodec } from "../infra/moodle-cursor";
import {
  connectionView,
  courseView,
  materialView,
  sectionView,
  syncView,
} from "./moodle-presenters";
import type {
  MoodleApplication,
  MoodleConnectInput,
  MoodleConnectResult,
  MoodleDownload,
  MoodlePageInput,
  MoodleStudentIdentity,
} from "./ports";
import { mapMoodleGatewayError, MoodleSessionManager } from "./moodle-session-manager";
import { MoodleSyncWorker } from "./moodle-sync-worker";

const COURSE_FRESH_MS = 10 * 60_000;
const CONTENT_FRESH_MS = 30 * 60_000;

type SnapshotContext = {
  connection: PersistedMoodleConnection;
  version: number | null;
  syncedAt: Date | null;
  stale: boolean;
  publishedRun: PersistedMoodleSyncRun | null;
  latestRun: PersistedMoodleSyncRun | null;
};

function resourceNotFound(): MoodleError {
  return new MoodleError(
    "MOODLE_RESOURCE_NOT_FOUND",
    "O recurso Moodle não foi encontrado.",
    404,
  );
}

function snapshotChanged(): MoodleError {
  return new MoodleError(
    "MOODLE_SNAPSHOT_CHANGED",
    "Os dados foram atualizados; reinicia a paginação.",
    409,
    true,
  );
}

function statusForRun(run: PersistedMoodleSyncRun | null, hasSnapshot: boolean): MoodleCountStatus {
  if (!hasSnapshot) return "not_synced";
  return run?.status === "COMPLETED" ? "exact" : "partial";
}

function pagination(
  returned: number,
  limit: number,
  hasMore: boolean,
  nextCursor: string | null,
  total: number | null,
  status: MoodleCountStatus,
): MoodlePagination {
  return {
    returned,
    limit,
    hasMore,
    nextCursor,
    total,
    totalStatus: status,
  };
}

export class LiveMoodleApplication implements MoodleApplication {
  readonly #now: () => Date;

  constructor(
    private readonly repository: MoodleRepository,
    private readonly gateway: MoodleGateway,
    private readonly keyring: MoodleCryptoKeyring,
    private readonly cursor: MoodleCursorCodec,
    private readonly sessions: MoodleSessionManager,
    private readonly worker: MoodleSyncWorker,
    now?: () => Date,
  ) {
    this.#now = now ?? (() => new Date());
  }

  async start(): Promise<void> {
    await this.worker.start();
  }

  async stop(): Promise<void> {
    await this.worker.stop();
    this.sessions.clear();
    // A bounded worker shutdown may leave an upstream request finishing in the
    // background. Keep immutable crypto dependencies alive until process exit.
  }

  async connect(student: MoodleStudentIdentity, input: MoodleConnectInput): Promise<MoodleConnectResult> {
    const connected = await this.sessions.connect(student, input);
    let initialSyncRunId: string | null = null;
    try {
      const run = await this.startSync(student, "initial-connect");
      initialSyncRunId = run.id;
    } catch {
      // The account is already safely connected. A later read or manual request
      // can enqueue the durable sync without asking for the password again.
    }
    return { ...connected.result, initialSyncRunId };
  }

  async retryStoredConnection(student: MoodleStudentIdentity): Promise<MoodleConnectResult> {
    await this.sessions.reauthenticate(student);
    const connection = await this.#getConnectionWithRecovery(student.id);
    if (!connection) throw moodleConnectionRequired();
    let initialSyncRunId: string | null = null;
    try {
      initialSyncRunId = (await this.startSync(student, "stored-credentials-retry")).id;
    } catch {
      // Authentication recovery is already durable. A later scheduler cycle
      // can enqueue the provider refresh without asking for the password.
    }
    return {
      connection: connectionView(connection),
      initialSyncRunId,
      created: false,
    };
  }

  async disconnect(student: MoodleStudentIdentity) {
    return connectionView(await this.sessions.disconnect(student));
  }

  async terminateSession(student: MoodleStudentIdentity) {
    return connectionView(await this.sessions.terminateSession(student));
  }

  async getConnection(student: MoodleStudentIdentity) {
    return connectionView(await this.#getConnectionWithRecovery(student.id));
  }

  async getProfile(student: MoodleStudentIdentity): Promise<MoodleProfile> {
    const connection = await this.#requireReadableConnection(student.id);
    if (
      !connection.moodleStudentNumber
      || !connection.displayName
      || !connection.profileSyncedAt
    ) throw resourceNotFound();
    return {
      id: connection.profilePublicId,
      studentNumber: connection.moodleStudentNumber,
      displayName: connection.displayName,
      email: connection.email,
      timezone: connection.timezone,
      lastSyncedAt: connection.profileSyncedAt.toISOString(),
    };
  }

  async getOverview(student: MoodleStudentIdentity): Promise<{
    data: MoodleOverview;
    syncedAt: Date | null;
    stale: boolean;
    snapshotVersion: number | null;
  }> {
    const context = await this.#snapshotContext(student, COURSE_FRESH_MS);
    const courses = context.version === null
      ? []
      : await this.#allCourses(student.id, context.version);
    const materials = context.version === null
      ? []
      : await this.#allMaterials(student.id, context.version);
    const tracked = courses.filter((course) => course.progressAvailable && course.progressPercent !== null);
    const countStatus = statusForRun(context.publishedRun, context.version !== null);
    const coverage = this.#coverage(context.publishedRun, context.version !== null, courses.length);
    const courseCount = context.version === null
      ? null
      : context.publishedRun?.status === "COMPLETED"
        ? context.publishedRun.discoveredCourses
        : courses.length;
    const data: MoodleOverview = {
      connection: connectionView(context.connection),
      counts: {
        courses: { value: courseCount, status: countStatus },
        coursesVisible: {
          value: context.version === null ? null : courses.filter((course) => course.visible && !course.hiddenByStudent).length,
          status: countStatus,
        },
        coursesWithProgress: {
          value: context.version === null ? null : tracked.length,
          status: countStatus,
        },
        materials: {
          value: context.version === null ? null : context.publishedRun?.totalMaterials ?? materials.length,
          status: countStatus,
        },
        activities: { value: null, status: "unsupported" },
        assignmentsOpen: { value: null, status: "unsupported" },
        quizzesOpen: { value: null, status: "unsupported" },
        notificationsUnread: { value: null, status: "unsupported" },
      },
      progress: {
        status: context.version === null ? "not_synced" : countStatus,
        trackedCourses: context.version === null ? null : tracked.length,
        untrackedCourses: context.version === null ? null : courses.length - tracked.length,
        averagePercent: tracked.length === 0
          ? null
          : tracked.reduce((sum, course) => sum + (course.progressPercent ?? 0), 0) / tracked.length,
      },
      coverage,
      nextDeadlines: { status: "unsupported", items: [] },
    };
    return {
      data,
      syncedAt: context.syncedAt,
      stale: context.stale
        || courses.some((course) => course.stale === true)
        || materials.some((material) => material.stale === true),
      snapshotVersion: context.version,
    };
  }

  async listCourses(
    student: MoodleStudentIdentity,
    page: MoodlePageInput,
  ): Promise<MoodleListResult<MoodleCourse>> {
    const context = await this.#snapshotContext(student, COURSE_FRESH_MS);
    if (context.version === null) return this.#emptyList(page.limit, context);
    const audience = { studentId: student.id, collection: "courses" as const, courseId: null };
    const after = page.cursor ? this.#decodeTextCursor(page.cursor, context.version, audience) : undefined;
    const result = await this.repository.listCourses({
      studentId: student.id,
      snapshotVersion: context.version,
      limit: page.limit,
      after,
    });
    const last = result.items.at(-1);
    const nextCursor = result.hasMore && last
      ? this.cursor.encode({
          snapshotVersion: context.version,
          normalizedText: last.normalizedName,
          publicId: last.publicId,
          audience,
        })
      : null;
    const status = statusForRun(context.publishedRun, true);
    return {
      items: result.items.map(courseView),
      pagination: pagination(result.items.length, page.limit, result.hasMore, nextCursor, result.total, status),
      coverage: this.#coverage(context.publishedRun, true, result.total),
      syncedAt: context.syncedAt,
      stale: context.stale || result.items.some((item) => item.stale === true),
      snapshotVersion: context.version,
    };
  }

  async getCourse(student: MoodleStudentIdentity, courseId: string) {
    const context = await this.#snapshotContext(student, COURSE_FRESH_MS);
    if (context.version === null) throw resourceNotFound();
    const course = await this.repository.findCourse({
      studentId: student.id,
      snapshotVersion: context.version,
      publicId: courseId,
    });
    if (!course) throw resourceNotFound();
    return {
      data: courseView(course),
      syncedAt: course.syncedAt,
      stale: context.stale || course.stale === true,
      snapshotVersion: context.version,
    };
  }

  async listSections(
    student: MoodleStudentIdentity,
    courseId: string,
    page: MoodlePageInput,
  ): Promise<MoodleListResult<MoodleSection>> {
    const context = await this.#snapshotContext(student, CONTENT_FRESH_MS);
    if (context.version === null) return this.#emptyList(page.limit, context);
    await this.#assertCourseOwner(student.id, context.version, courseId);
    const audience = { studentId: student.id, collection: "sections" as const, courseId };
    const decoded = page.cursor ? this.cursor.decode(page.cursor, audience) : null;
    if (decoded && decoded.snapshotVersion !== context.version) throw snapshotChanged();
    const position = decoded ? Number(decoded.normalizedText) : undefined;
    if (decoded && (!Number.isSafeInteger(position) || Number(position) < 0)) {
      throw new MoodleError("MOODLE_CURSOR_INVALID", "O cursor informado é inválido.", 400);
    }
    const result = await this.repository.listSections({
      studentId: student.id,
      snapshotVersion: context.version,
      coursePublicId: courseId,
      limit: page.limit,
      after: decoded ? { position: position!, publicId: decoded.publicId } : undefined,
    });
    const materials = await this.#allMaterials(student.id, context.version, courseId);
    const last = result.items.at(-1);
    const nextCursor = result.hasMore && last
      ? this.cursor.encode({
          snapshotVersion: context.version,
          normalizedText: String(last.position),
          publicId: last.publicId,
          audience,
        })
      : null;
    const status = statusForRun(context.publishedRun, true);
    return {
      items: result.items.map((section) => sectionView(section, materials)),
      pagination: pagination(result.items.length, page.limit, result.hasMore, nextCursor, result.total, status),
      coverage: this.#coverage(context.publishedRun, true),
      syncedAt: context.syncedAt,
      stale: context.stale
        || result.items.some((item) => item.stale === true)
        || materials.some((item) => item.stale === true),
      snapshotVersion: context.version,
    };
  }

  async listMaterials(
    student: MoodleStudentIdentity,
    courseId: string | null,
    page: MoodlePageInput,
  ): Promise<MoodleListResult<MoodleMaterial>> {
    const context = await this.#snapshotContext(student, CONTENT_FRESH_MS);
    if (context.version === null) return this.#emptyList(page.limit, context);
    if (courseId) await this.#assertCourseOwner(student.id, context.version, courseId);
    const audience = { studentId: student.id, collection: "materials" as const, courseId };
    const after = page.cursor ? this.#decodeTextCursor(page.cursor, context.version, audience) : undefined;
    const result = await this.repository.listMaterials({
      studentId: student.id,
      snapshotVersion: context.version,
      coursePublicId: courseId ?? undefined,
      limit: page.limit,
      after,
    });
    const last = result.items.at(-1);
    const nextCursor = result.hasMore && last
      ? this.cursor.encode({
          snapshotVersion: context.version,
          normalizedText: last.normalizedTitle,
          publicId: last.publicId,
          audience,
        })
      : null;
    const status = statusForRun(context.publishedRun, true);
    return {
      items: result.items.map(materialView),
      pagination: pagination(result.items.length, page.limit, result.hasMore, nextCursor, result.total, status),
      coverage: this.#coverage(context.publishedRun, true),
      syncedAt: context.syncedAt,
      stale: context.stale || result.items.some((item) => item.stale === true),
      snapshotVersion: context.version,
    };
  }

  async openMaterial(
    student: MoodleStudentIdentity,
    materialId: string,
    range?: string,
  ): Promise<MoodleDownload> {
    const context = await this.#snapshotContext(student, CONTENT_FRESH_MS);
    if (context.version === null) throw resourceNotFound();
    const material = await this.repository.findMaterial({
      studentId: student.id,
      snapshotVersion: context.version,
      publicId: materialId,
    });
    if (!material) throw resourceNotFound();
    if (!material.openAvailable || !material.locatorEnvelope) {
      throw new MoodleError(
        "MOODLE_MATERIAL_TYPE_UNSUPPORTED",
        "Este material não pode ser aberto com segurança.",
        415,
      );
    }

    let locator: MoodleGatewayStreamLocator;
    try {
      const decrypted = this.keyring.decryptJsonWithRotation<MoodleGatewayStreamLocator>(material.locatorEnvelope, {
        studentId: String(student.id),
        purpose: "material-locator",
      });
      locator = decrypted.value;
      if (decrypted.rotatedEnvelope) {
        await this.repository.replaceMaterialLocatorEnvelopeCas({
          studentId: student.id,
          snapshotVersion: context.version,
          publicId: material.publicId,
          previousEnvelope: material.locatorEnvelope,
          nextEnvelope: decrypted.rotatedEnvelope,
        }).catch(() => false);
      }
    } catch (error) {
      throw mapMoodleGatewayError(error);
    }
    const result = await this.sessions.withSession(student, (session) => this.gateway.openStream(
      session,
      locator,
      range ? { range } : undefined,
    ));
    return {
      stream: Readable.fromWeb(result.body as NodeReadableStream<Uint8Array>),
      status: result.status,
      contentType: result.contentType,
      fileName: result.filename,
      contentLength: result.contentLength,
      acceptRanges: result.status === 206 || result.contentRange !== null,
      contentRange: result.contentRange,
    };
  }

  async startSync(student: MoodleStudentIdentity, reason: string): Promise<MoodleSyncView> {
    try {
      const { run, reused } = await this.repository.createOrReuseSyncRun({
        studentId: student.id,
        reason,
      });
      this.worker.kick();
      return syncView(run, reused);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "MOODLE_REAUTH_REQUIRED") {
        throw new MoodleError(
          "MOODLE_REAUTH_REQUIRED",
          "Volta a introduzir as credenciais Moodle.",
          409,
          false,
          "reauthenticate",
        );
      }
      if (code === "MOODLE_CONNECTION_REQUIRED") throw moodleConnectionRequired();
      throw mapMoodleGatewayError(error);
    }
  }

  async getSyncStatus(student: MoodleStudentIdentity): Promise<MoodleSyncView | null> {
    await this.#requireReadableConnection(student.id);
    const run = await this.repository.getLatestSyncRun(student.id);
    return run ? syncView(run, false) : null;
  }

  async #snapshotContext(student: MoodleStudentIdentity, freshnessMs: number): Promise<SnapshotContext> {
    const connection = await this.#requireReadableConnection(student.id);
    const [latestRun, publishedRun] = await Promise.all([
      this.repository.getLatestSyncRun(student.id),
      connection.activeSnapshotVersion === null
        ? Promise.resolve(null)
        : this.repository.getSyncRunBySnapshot({
            studentId: student.id,
            snapshotVersion: connection.activeSnapshotVersion,
          }),
    ]);
    const syncedAt = connection.lastSuccessfulSyncAt;
    const ageStale = syncedAt === null
      || this.#now().getTime() - syncedAt.getTime() > freshnessMs;
    const stale = ageStale || publishedRun?.status === "PARTIAL";
    // A partial snapshot is visible as stale immediately, but retries only
    // after the freshness window. This prevents every GET from creating work.
    if (ageStale) this.#scheduleRefresh(student);
    return {
      connection,
      version: connection.activeSnapshotVersion,
      syncedAt,
      stale,
      publishedRun,
      latestRun,
    };
  }

  async #requireReadableConnection(studentId: number): Promise<PersistedMoodleConnection> {
    const connection = await this.#getConnectionWithRecovery(studentId);
    if (!connection || ["DISCONNECTED", "CONNECTING"].includes(connection.status)) {
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
    return connection;
  }

  async #getConnectionWithRecovery(studentId: number): Promise<PersistedMoodleConnection | null> {
    return this.repository.recoverExpiredConnectionAttempt(studentId);
  }

  async #assertCourseOwner(studentId: number, snapshotVersion: number, publicId: string): Promise<void> {
    const course = await this.repository.findCourse({ studentId, snapshotVersion, publicId });
    if (!course) throw resourceNotFound();
  }

  #decodeTextCursor(
    token: string,
    snapshotVersion: number,
    audience: Parameters<MoodleCursorCodec["decode"]>[1],
  ) {
    const decoded = this.cursor.decode(token, audience);
    if (decoded.snapshotVersion !== snapshotVersion) throw snapshotChanged();
    return { normalizedText: decoded.normalizedText, publicId: decoded.publicId };
  }

  #coverage(
    run: PersistedMoodleSyncRun | null,
    hasSnapshot: boolean,
    fallbackProcessed = 0,
  ): MoodleCoverage {
    const listComplete = run?.status === "COMPLETED" || this.#checkpointListComplete(run);
    return {
      processedCourses: hasSnapshot ? run?.processedCourses ?? fallbackProcessed : 0,
      totalCourses: hasSnapshot && listComplete ? run?.discoveredCourses ?? null : null,
      failedCourses: hasSnapshot ? run?.failedCourses ?? 0 : 0,
    };
  }

  #checkpointListComplete(run: PersistedMoodleSyncRun | null): boolean {
    if (!run?.checkpointJson) return false;
    try {
      const value = JSON.parse(run.checkpointJson) as { courseListComplete?: unknown };
      return value.courseListComplete === true;
    } catch {
      return false;
    }
  }

  #emptyList<T>(limit: number, context: SnapshotContext): MoodleListResult<T> {
    return {
      items: [],
      pagination: pagination(0, limit, false, null, null, "not_synced"),
      coverage: this.#coverage(context.publishedRun, false),
      syncedAt: context.syncedAt,
      stale: true,
      snapshotVersion: null,
    };
  }

  #scheduleRefresh(student: MoodleStudentIdentity): void {
    void this.repository.createOrReuseSyncRun({ studentId: student.id, reason: "stale-read" })
      .then(() => this.worker.kick())
      .catch(() => undefined);
  }

  async #allCourses(studentId: number, snapshotVersion: number): Promise<PersistedCourseSnapshot[]> {
    const output: PersistedCourseSnapshot[] = [];
    let after: { normalizedText: string; publicId: string } | undefined;
    while (true) {
      const page = await this.repository.listCourses({ studentId, snapshotVersion, limit: 100, after });
      output.push(...page.items);
      const last = page.items.at(-1);
      if (!page.hasMore || !last) return output;
      after = { normalizedText: last.normalizedName, publicId: last.publicId };
    }
  }

  async #allMaterials(
    studentId: number,
    snapshotVersion: number,
    coursePublicId?: string,
  ): Promise<PersistedMaterialSnapshot[]> {
    const output: PersistedMaterialSnapshot[] = [];
    let after: { normalizedText: string; publicId: string } | undefined;
    while (true) {
      const page = await this.repository.listMaterials({
        studentId,
        snapshotVersion,
        coursePublicId,
        limit: 100,
        after,
      });
      output.push(...page.items);
      const last = page.items.at(-1);
      if (!page.hasMore || !last) return output;
      after = { normalizedText: last.normalizedTitle, publicId: last.publicId };
    }
  }
}
