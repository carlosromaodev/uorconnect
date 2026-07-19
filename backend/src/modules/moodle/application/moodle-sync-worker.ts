import { createHash, randomUUID } from "node:crypto";
import { MoodleConnectionStatus, type PrismaClient } from "@prisma/client";
import type {
  MoodleGateway,
  MoodleGatewayCourse,
  MoodleGatewayCourseContent,
} from "../domain/gateway";
import type {
  MoodleRepository,
  PersistedCourseSnapshot,
  PersistedMaterialSnapshot,
  PersistedMoodleSyncRun,
  PersistedSectionSnapshot,
  RepositoryCourseSnapshotInput,
  RepositoryMaterialSnapshotInput,
  RepositorySectionSnapshotInput,
} from "../domain/repository";
import type { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import { softDeleteStudentWithMoodlePurge } from "../../../shared/student-deactivation";
import { MoodleError } from "../domain/errors";
import { mapMoodleGatewayError, MoodleSessionManager } from "./moodle-session-manager";

const POLL_MS = 2_000;
const SYNC_LEASE_MS = 60_000;
const SYNC_HEARTBEAT_MS = 20_000;
const RECONCILE_MS = 60_000;

export type MoodleSyncWorkerOptions = {
  enabled: boolean;
  concurrency: number;
  prisma?: PrismaClient;
  uuid?: () => string;
  sleep?: (durationMs: number) => Promise<void>;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt")
    .replace(/\s+/g, " ")
    .trim();
}

function parsedDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hashNormalized(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function courseInput(course: MoodleGatewayCourse): RepositoryCourseSnapshotInput {
  const normalized = {
    externalKey: course.externalKey,
    name: course.name,
    shortName: course.shortName,
    category: course.category,
    description: course.description,
    startDate: course.startDate,
    endDate: course.endDate,
    visible: course.visible,
    hiddenByStudent: course.hiddenByStudent,
    favourite: course.favourite,
    progressAvailable: course.progressAvailable,
    progressPercent: course.progressAvailable ? course.progressPercent : null,
  };
  return {
    moodleExternalKey: course.externalKey,
    name: course.name,
    normalizedName: normalizeText(course.name),
    shortName: course.shortName,
    category: course.category,
    descriptionText: course.description,
    visible: course.visible,
    hiddenByStudent: course.hiddenByStudent,
    favourite: course.favourite,
    startAt: parsedDate(course.startDate),
    endAt: parsedDate(course.endDate),
    progressAvailable: course.progressAvailable,
    progressPercent: course.progressAvailable ? course.progressPercent : null,
    normalizedHash: hashNormalized(normalized),
  };
}

function sectionInputs(content: MoodleGatewayCourseContent): RepositorySectionSnapshotInput[] {
  return content.sections.map((section) => ({
    moodleExternalKey: section.externalKey,
    courseExternalKey: content.course.externalKey,
    position: section.position,
    title: section.title,
    normalizedTitle: normalizeText(section.title),
    summaryText: section.summary,
    visible: section.visible,
    available: section.available,
    normalizedHash: hashNormalized({
      externalKey: section.externalKey,
      position: section.position,
      title: section.title,
      summary: section.summary,
      visible: section.visible,
      available: section.available,
    }),
  }));
}

function materialInputs(
  studentId: number,
  content: MoodleGatewayCourseContent,
  keyring: MoodleCryptoKeyring,
): RepositoryMaterialSnapshotInput[] {
  return content.materials.map((material) => {
    const locatorEnvelope = material.locator
      ? keyring.encryptJson(material.locator, {
          studentId: String(studentId),
          purpose: "material-locator",
        })
      : null;
    const canOpen = material.openAvailable && locatorEnvelope !== null;
    const canDownload = material.downloadAvailable && locatorEnvelope !== null;
    return {
      moodleExternalKey: material.externalKey,
      courseExternalKey: content.course.externalKey,
      sectionExternalKey: material.sectionExternalKey || null,
      type: material.type,
      title: material.title,
      normalizedTitle: normalizeText(material.title),
      descriptionText: material.description,
      available: material.available,
      openAvailable: canOpen,
      downloadAvailable: canDownload,
      // The gateway has not confirmed an upstream filename at sync time.
      fileName: null,
      mimeType: material.mimeType,
      sizeBytes: material.sizeBytes === null ? null : BigInt(material.sizeBytes),
      sourceUpdatedAt: parsedDate(material.updatedAt),
      metadataJson: null,
      locatorEnvelope,
      normalizedHash: hashNormalized({
        externalKey: material.externalKey,
        sectionExternalKey: material.sectionExternalKey,
        type: material.type,
        title: material.title,
        description: material.description,
        available: material.available,
        openAvailable: canOpen,
        downloadAvailable: canDownload,
        mimeType: material.mimeType,
        sizeBytes: material.sizeBytes,
        updatedAt: material.updatedAt,
        locatorKind: material.locator?.kind ?? null,
      }),
    };
  });
}

async function concurrentMap<T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (index < values.length) {
      const value = values[index++];
      if (value !== undefined) await operation(value);
    }
  });
  await Promise.all(workers);
}

export class MoodleSyncWorker {
  readonly #owner: string;
  readonly #sleep: (durationMs: number) => Promise<void>;
  #pollTimer: NodeJS.Timeout | null = null;
  #reconcileTimer: NodeJS.Timeout | null = null;
  #drainPromise: Promise<void> | null = null;
  #reconcilePromise: Promise<void> | null = null;
  #stopping = false;

  constructor(
    private readonly repository: MoodleRepository,
    private readonly gateway: MoodleGateway,
    private readonly keyring: MoodleCryptoKeyring,
    private readonly sessions: MoodleSessionManager,
    private readonly options: MoodleSyncWorkerOptions,
  ) {
    this.#owner = (options.uuid ?? randomUUID)();
    this.#sleep = options.sleep ?? ((durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs)));
  }

  async start(): Promise<void> {
    if (!this.options.enabled || this.#pollTimer) return;
    this.#stopping = false;
    await this.reconcileSoftDeletedStudents();
    this.#pollTimer = setInterval(() => this.kick(), POLL_MS);
    this.#pollTimer.unref?.();
    this.#reconcileTimer = setInterval(() => {
      void this.reconcileSoftDeletedStudents().then(() => this.kick()).catch(() => undefined);
    }, RECONCILE_MS);
    this.#reconcileTimer.unref?.();
    this.kick();
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    if (this.#reconcileTimer) clearInterval(this.#reconcileTimer);
    this.#pollTimer = null;
    this.#reconcileTimer = null;
    const active = this.#drainPromise;
    if (active) {
      let timeout: NodeJS.Timeout | undefined;
      await Promise.race([
        active.catch(() => undefined),
        new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, 30_000);
          timeout.unref?.();
        }),
      ]);
      if (timeout) clearTimeout(timeout);
    }
  }

  kick(): void {
    if (!this.options.enabled || this.#stopping || this.#drainPromise) return;
    this.#drainPromise = this.#drain()
      .catch(() => undefined)
      .finally(() => {
        this.#drainPromise = null;
      });
  }

  async reconcileSoftDeletedStudents(): Promise<void> {
    if (!this.options.prisma) return;
    if (this.#reconcilePromise) return this.#reconcilePromise;
    this.#reconcilePromise = this.options.prisma.$transaction(async (tx) => {
      // Drain every bounded query batch in this reconciliation so a bulk
      // deactivation cannot leave later students' secrets for another minute.
      for (;;) {
        const deleted = await tx.student.findMany({
          where: {
            deletedAt: { not: null },
            OR: [
              {
                moodleConnection: {
                  is: {
                    OR: [
                      { status: { not: MoodleConnectionStatus.DISCONNECTED } },
                      { credentialsEnvelope: { not: null } },
                      { sessionEnvelope: { not: null } },
                      { activeSnapshotVersion: { not: null } },
                      { activeSyncRunId: { not: null } },
                    ],
                  },
                },
              },
              { moodleEntityRefs: { some: {} } },
              { moodleCourseSnapshots: { some: {} } },
              { moodleSectionSnapshots: { some: {} } },
              { moodleMaterialSnapshots: { some: {} } },
              { moodleSyncRuns: { some: {} } },
            ],
          },
          select: { id: true, deletedAt: true, deletionReason: true },
          take: 100,
        });
        for (const student of deleted) {
          await softDeleteStudentWithMoodlePurge(tx, {
            studentId: student.id,
            deletedAt: student.deletedAt!,
            deletionReason: student.deletionReason ?? "Conta previamente desativada",
          });
          this.sessions.clear(student.id);
        }
        if (deleted.length < 100) break;
      }
    }).finally(() => {
      this.#reconcilePromise = null;
    });
    return this.#reconcilePromise;
  }

  async #drain(): Promise<void> {
    await this.reconcileSoftDeletedStudents();
    while (!this.#stopping) {
      const run = await this.repository.claimNextSyncRun({
        owner: this.#owner,
        leaseDurationMs: SYNC_LEASE_MS,
      });
      if (!run) return;
      await this.#processRun(run);
    }
  }

  async #processRun(run: PersistedMoodleSyncRun): Promise<void> {
    let heartbeat: NodeJS.Timeout | undefined;
    let leaseLost = false;
    try {
      heartbeat = setInterval(() => {
        void this.repository.heartbeatSyncRun({
          runId: run.id,
          studentId: run.studentId,
          connectionGeneration: run.connectionGeneration,
          owner: this.#owner,
          leaseDurationMs: SYNC_LEASE_MS,
        }).then((kept) => {
          if (!kept) leaseLost = true;
        }).catch(() => {
          leaseLost = true;
        });
      }, SYNC_HEARTBEAT_MS);
      heartbeat.unref?.();

      const connection = await this.repository.getConnection(run.studentId);
      if (
        !connection
        || connection.connectionGeneration !== run.connectionGeneration
        || !connection.moodleStudentNumber
      ) {
        await this.#finish(run, "CANCELLED", "MOODLE_CONNECTION_REQUIRED");
        return;
      }
      const student = await this.#currentStudentIdentity(run.studentId, connection.moodleStudentNumber);
      if (!student) {
        await this.#finish(run, "CANCELLED", "MOODLE_STUDENT_NOT_ELIGIBLE");
        return;
      }
      const courseList = await this.sessions.withSession(student, (session) => this.gateway.listCourses(session));
      const courses = courseList.courses;
      if (leaseLost || this.#stopping) {
        await this.#finish(run, "CANCELLED", "MOODLE_SYNC_CONFLICT");
        return;
      }
      const progress = { processed: 0, failed: 0, materials: 0 };
      const failedKeys = new Set<string>();
      const stagedMaterialCounts = new Map<string, number>();
      let contentIncomplete = false;
      let progressWrite = Promise.resolve(true);
      const initialized = await this.repository.updateSyncProgress({
        runId: run.id,
        studentId: run.studentId,
        connectionGeneration: run.connectionGeneration,
        owner: this.#owner,
        discoveredCourses: courses.length,
        checkpointJson: JSON.stringify({
          processed: 0,
          courseListComplete: courseList.complete,
          courseListSource: courseList.source,
        }),
      });
      if (!initialized) {
        await this.#finish(run, "CANCELLED", "MOODLE_SYNC_CONFLICT");
        return;
      }

      await concurrentMap(courses, this.options.concurrency, async (course) => {
        if (leaseLost || this.#stopping) return;
        try {
          const content = await this.#courseContentWithRetry(student, course.externalKey);
          if (leaseLost || this.#stopping) return;
          if (!content.complete) contentIncomplete = true;
          const staged = await this.repository.stageCourseGraph({
            studentId: run.studentId,
            runId: run.id,
            connectionGeneration: run.connectionGeneration,
            snapshotVersion: run.snapshotVersion,
            leaseOwner: this.#owner,
            course: courseInput(content.course),
            sections: sectionInputs(content),
            materials: materialInputs(run.studentId, content, this.keyring),
          });
          if (!staged) throw new MoodleError("MOODLE_SYNC_CONFLICT", "A sincronização foi substituída.", 409, true);
          if (content.complete) {
            progress.processed += 1;
          } else {
            // Keep the partial graph only when no previous complete graph
            // exists. The stale-copy phase overwrites it when possible.
            progress.failed += 1;
            failedKeys.add(course.externalKey);
            stagedMaterialCounts.set(course.externalKey, content.materials.length);
          }
          progress.materials += content.materials.length;
        } catch {
          progress.failed += 1;
          failedKeys.add(course.externalKey);
        }
        const nextProgress = {
          processedCourses: progress.processed,
          failedCourses: progress.failed,
          totalMaterials: progress.materials,
        };
        progressWrite = progressWrite.then((stillOwned) => stillOwned && this.repository.updateSyncProgress({
          runId: run.id,
          studentId: run.studentId,
          connectionGeneration: run.connectionGeneration,
          owner: this.#owner,
          ...nextProgress,
          checkpointJson: JSON.stringify({
            processed: nextProgress.processedCourses + nextProgress.failedCourses,
            courseListComplete: courseList.complete,
            courseListSource: courseList.source,
            contentComplete: !contentIncomplete,
          }),
        }));
        const updated = await progressWrite;
        if (!updated) leaseLost = true;
      });

      if (leaseLost || this.#stopping) {
        await this.#finish(run, "CANCELLED", "MOODLE_SYNC_CONFLICT");
        return;
      }

      if ((failedKeys.size > 0 || !courseList.complete) && connection.activeSnapshotVersion !== null) {
        await this.#copyStaleCourses(
          run,
          connection.activeSnapshotVersion,
          failedKeys,
          new Set(courses.map((course) => course.externalKey)),
          !courseList.complete,
          stagedMaterialCounts,
          progress,
        );
      }
      const outcome = progress.failed > 0 || !courseList.complete || contentIncomplete
        ? "PARTIAL" as const
        : "COMPLETED" as const;
      const published = await this.repository.publishSnapshot({
        studentId: run.studentId,
        runId: run.id,
        connectionGeneration: run.connectionGeneration,
        snapshotVersion: run.snapshotVersion,
        leaseOwner: this.#owner,
        outcome,
      });
      if (published) {
        await this.repository.purgeSnapshotVersions({
          studentId: run.studentId,
          keepVersions: [run.snapshotVersion, connection.activeSnapshotVersion].filter((value): value is number => value !== null),
        });
      }
    } catch (error) {
      const mapped = mapMoodleGatewayError(error);
      await this.#finish(run, "FAILED", mapped.code);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }

  async #courseContentWithRetry(
    student: { id: number; studentNumber: string },
    externalKey: string,
  ): Promise<MoodleGatewayCourseContent> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.sessions.withSession(student, (session) => this.gateway.getCourseContent(session, externalKey));
      } catch (error) {
        lastError = error;
        const mapped = mapMoodleGatewayError(error);
        if (!mapped.retryable || attempt === 2) throw mapped;
        await this.#sleep((2 ** attempt) * 1_000);
      }
    }
    throw mapMoodleGatewayError(lastError);
  }

  async #currentStudentIdentity(
    studentId: number,
    fallbackNumber: string,
  ): Promise<{ id: number; studentNumber: string } | null> {
    if (!this.options.prisma) return { id: studentId, studentNumber: fallbackNumber };
    const student = await this.options.prisma.student.findFirst({
      where: {
        id: studentId,
        deletedAt: null,
        institutionCode: "UOR",
        isUorStudent: true,
      },
      select: { id: true, studentNumber: true },
    });
    return student ? { id: student.id, studentNumber: student.studentNumber } : null;
  }

  async #copyStaleCourses(
    run: PersistedMoodleSyncRun,
    previousVersion: number,
    failedKeys: Set<string>,
    discoveredKeys: Set<string>,
    preserveUndiscovered: boolean,
    stagedMaterialCounts: Map<string, number>,
    progress: { processed: number; failed: number; materials: number },
  ): Promise<void> {
    const oldCourses = await this.#allCourses(run.studentId, previousVersion);
    const mustPreserve = oldCourses.filter((item) => (
      failedKeys.has(item.moodleExternalKey)
      || (preserveUndiscovered && !discoveredKeys.has(item.moodleExternalKey))
    ));
    for (const course of mustPreserve) {
      const sections = await this.#allSections(run.studentId, previousVersion, course.publicId);
      const materials = await this.#allMaterials(run.studentId, previousVersion, course.publicId);
      const staged = await this.repository.stageCourseGraph({
        studentId: run.studentId,
        runId: run.id,
        connectionGeneration: run.connectionGeneration,
        snapshotVersion: run.snapshotVersion,
        leaseOwner: this.#owner,
        course: this.#staleCourse(course),
        sections: sections.map((section) => this.#staleSection(course, section)),
        materials: materials.map((material) => this.#staleMaterial(course, sections, material)),
      });
      if (staged) {
        progress.materials -= stagedMaterialCounts.get(course.moodleExternalKey) ?? 0;
        progress.materials += materials.length;
      }
    }
    await this.repository.updateSyncProgress({
      runId: run.id,
      studentId: run.studentId,
      connectionGeneration: run.connectionGeneration,
      owner: this.#owner,
      totalMaterials: progress.materials,
    });
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

  async #allSections(studentId: number, snapshotVersion: number, coursePublicId: string): Promise<PersistedSectionSnapshot[]> {
    const output: PersistedSectionSnapshot[] = [];
    let after: { position: number; publicId: string } | undefined;
    while (true) {
      const page = await this.repository.listSections({ studentId, snapshotVersion, coursePublicId, limit: 100, after });
      output.push(...page.items);
      const last = page.items.at(-1);
      if (!page.hasMore || !last) return output;
      after = { position: last.position, publicId: last.publicId };
    }
  }

  async #allMaterials(studentId: number, snapshotVersion: number, coursePublicId: string): Promise<PersistedMaterialSnapshot[]> {
    const output: PersistedMaterialSnapshot[] = [];
    let after: { normalizedText: string; publicId: string } | undefined;
    while (true) {
      const page = await this.repository.listMaterials({ studentId, snapshotVersion, coursePublicId, limit: 100, after });
      output.push(...page.items);
      const last = page.items.at(-1);
      if (!page.hasMore || !last) return output;
      after = { normalizedText: last.normalizedTitle, publicId: last.publicId };
    }
  }

  #staleCourse(course: PersistedCourseSnapshot): RepositoryCourseSnapshotInput {
    return {
      moodleExternalKey: course.moodleExternalKey,
      name: course.name,
      normalizedName: course.normalizedName,
      shortName: course.shortName,
      category: course.category,
      descriptionText: course.descriptionText,
      visible: course.visible,
      hiddenByStudent: course.hiddenByStudent,
      favourite: course.favourite,
      startAt: course.startAt,
      endAt: course.endAt,
      progressAvailable: course.progressAvailable,
      progressPercent: course.progressPercent,
      stale: true,
      sourceSyncedAt: course.sourceSyncedAt ?? course.syncedAt,
      normalizedHash: course.normalizedHash,
    };
  }

  #staleSection(course: PersistedCourseSnapshot, section: PersistedSectionSnapshot): RepositorySectionSnapshotInput {
    return {
      moodleExternalKey: section.moodleExternalKey,
      courseExternalKey: course.moodleExternalKey,
      position: section.position,
      title: section.title,
      normalizedTitle: section.normalizedTitle,
      summaryText: section.summaryText,
      visible: section.visible,
      available: section.available,
      stale: true,
      sourceSyncedAt: section.sourceSyncedAt ?? section.syncedAt,
      normalizedHash: section.normalizedHash,
    };
  }

  #staleMaterial(
    course: PersistedCourseSnapshot,
    sections: PersistedSectionSnapshot[],
    material: PersistedMaterialSnapshot,
  ): RepositoryMaterialSnapshotInput {
    return {
      moodleExternalKey: material.moodleExternalKey,
      courseExternalKey: course.moodleExternalKey,
      sectionExternalKey: sections.find((section) => section.publicId === material.sectionPublicId)?.moodleExternalKey ?? null,
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
      stale: true,
      sourceSyncedAt: material.sourceSyncedAt ?? material.syncedAt,
      normalizedHash: material.normalizedHash,
    };
  }

  async #finish(run: PersistedMoodleSyncRun, outcome: "FAILED" | "CANCELLED", code: string): Promise<void> {
    await this.repository.finishSyncRun({
      studentId: run.studentId,
      runId: run.id,
      connectionGeneration: run.connectionGeneration,
      leaseOwner: this.#owner,
      outcome,
      lastErrorCode: code,
    }).catch(() => false);
  }
}
