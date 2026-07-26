/**
 * Persistence contract for the Moodle bounded context.
 *
 * All methods are owner-scoped by `studentId`. Upstream keys and encrypted
 * locators are infrastructure data and must never be copied to HTTP responses.
 * Mutating methods use generation/version/owner comparisons so a logout or a
 * newer worker can invalidate old work without relying on process-local locks.
 */

export type RepositoryMoodleConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "REFRESHING"
  | "REAUTH_REQUIRED"
  | "DEGRADED";

export type RepositoryMoodleSyncRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED";

export type RepositoryMoodleEntityKind = "COURSE" | "SECTION" | "MATERIAL";

export type PersistedMoodleConnection = {
  studentId: number;
  status: RepositoryMoodleConnectionStatus;
  moodleUserId: string | null;
  profilePublicId: string;
  moodleStudentNumber: string | null;
  displayName: string | null;
  email: string | null;
  timezone: string | null;
  profileSyncedAt: Date | null;
  credentialsEnvelope: string | null;
  sessionEnvelope: string | null;
  connectionGeneration: number;
  sessionVersion: number;
  activeSnapshotVersion: number | null;
  activeSyncRunId: string | null;
  connectionAttemptId: string | null;
  connectionAttemptLeaseUntil: Date | null;
  sessionExpiresAt: Date | null;
  reauthLeaseOwner: string | null;
  reauthLeaseUntil: Date | null;
  failedReauthCount: number;
  nextReauthAt: Date | null;
  lastAuthenticatedAt: Date | null;
  lastSuccessfulSyncAt: Date | null;
  lastUsedAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PersistedMoodleProfile = {
  publicId: string;
  studentNumber: string;
  displayName: string;
  email: string | null;
  timezone: string | null;
  syncedAt: Date;
};

export type PersistedMoodleSyncRun = {
  id: string;
  studentId: number;
  status: RepositoryMoodleSyncRunStatus;
  reason: string | null;
  connectionGeneration: number;
  snapshotVersion: number;
  attempts: number;
  leaseOwner: string | null;
  leaseUntil: Date | null;
  heartbeatAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  discoveredCourses: number;
  processedCourses: number;
  failedCourses: number;
  totalMaterials: number;
  checkpointJson: string | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RepositoryCourseSnapshotInput = {
  moodleExternalKey: string;
  name: string;
  normalizedName: string;
  shortName: string;
  category: string | null;
  descriptionText: string | null;
  visible: boolean;
  hiddenByStudent: boolean;
  favourite: boolean;
  startAt: Date | null;
  endAt: Date | null;
  progressAvailable: boolean;
  progressPercent: number | null;
  stale?: boolean;
  sourceSyncedAt?: Date | null;
  normalizedHash: string;
};

export type RepositorySectionSnapshotInput = {
  moodleExternalKey: string;
  courseExternalKey: string;
  position: number;
  title: string;
  normalizedTitle: string;
  summaryText: string | null;
  visible: boolean;
  available: boolean;
  stale?: boolean;
  sourceSyncedAt?: Date | null;
  normalizedHash: string;
};

export type RepositoryMaterialSnapshotInput = {
  moodleExternalKey: string;
  courseExternalKey: string;
  sectionExternalKey: string | null;
  type: string;
  title: string;
  normalizedTitle: string;
  descriptionText: string | null;
  available: boolean;
  openAvailable: boolean;
  downloadAvailable: boolean;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: bigint | null;
  sourceUpdatedAt: Date | null;
  metadataJson: string | null;
  locatorEnvelope: string | null;
  stale?: boolean;
  sourceSyncedAt?: Date | null;
  normalizedHash: string;
};

export type PersistedCourseSnapshot = RepositoryCourseSnapshotInput & {
  publicId: string;
  snapshotVersion: number;
  syncRunId: string;
  syncedAt: Date;
};

export type PersistedSectionSnapshot = Omit<RepositorySectionSnapshotInput, "courseExternalKey"> & {
  publicId: string;
  coursePublicId: string;
  snapshotVersion: number;
  syncRunId: string;
  syncedAt: Date;
};

export type PersistedMaterialSnapshot = Omit<
  RepositoryMaterialSnapshotInput,
  "courseExternalKey" | "sectionExternalKey"
> & {
  publicId: string;
  coursePublicId: string;
  sectionPublicId: string | null;
  snapshotVersion: number;
  syncRunId: string;
  syncedAt: Date;
};

export type RepositoryPage<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
};

export type RepositoryTextCursor = {
  normalizedText: string;
  publicId: string;
};

export type RepositoryPositionCursor = {
  position: number;
  publicId: string;
};

export interface MoodleRepository {
  getConnection(studentId: number): Promise<PersistedMoodleConnection | null>;

  /** Recovers only a CONNECTING attempt whose lease expired by database time. */
  recoverExpiredConnectionAttempt(studentId: number): Promise<PersistedMoodleConnection | null>;

  beginConnectionAttempt(input: {
    studentId: number;
    attemptId: string;
    leaseDurationMs: number;
    credentialsEnvelope: string;
  }): Promise<{ acquired: boolean; connection: PersistedMoodleConnection }>;

  completeConnectionAttempt(input: {
    studentId: number;
    connectionGeneration: number;
    attemptId: string;
    moodleUserId: string;
    profile: Omit<PersistedMoodleProfile, "publicId">;
    credentialsEnvelope: string;
    sessionEnvelope: string;
    sessionExpiresAt: Date | null;
  }): Promise<boolean>;

  cancelConnectionAttempt(input: {
    studentId: number;
    connectionGeneration: number;
    attemptId: string;
    status: "DISCONNECTED" | "REAUTH_REQUIRED" | "DEGRADED";
    lastErrorCode: string;
    clearSecrets?: boolean;
  }): Promise<boolean>;

  disconnectAndPurge(studentId: number): Promise<PersistedMoodleConnection>;
  terminateSession(studentId: number): Promise<PersistedMoodleConnection>;

  touchConnection(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
  }): Promise<boolean>;

  replaceCredentialsEnvelopeCas(input: {
    studentId: number;
    connectionGeneration: number;
    previousEnvelope: string;
    nextEnvelope: string;
  }): Promise<boolean>;

  replaceSessionEnvelopeCas(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    previousEnvelope: string;
    nextEnvelope: string;
  }): Promise<boolean>;

  acquireReauthenticationLease(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    leaseDurationMs: number;
  }): Promise<{ acquired: boolean; connection: PersistedMoodleConnection | null }>;

  heartbeatReauthenticationLease(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    leaseDurationMs: number;
  }): Promise<boolean>;

  completeReauthentication(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    moodleUserId: string;
    profile: Omit<PersistedMoodleProfile, "publicId">;
    sessionEnvelope: string;
    sessionExpiresAt: Date | null;
  }): Promise<boolean>;

  failReauthentication(input: {
    studentId: number;
    connectionGeneration: number;
    sessionVersion: number;
    owner: string;
    status: "DEGRADED" | "REAUTH_REQUIRED";
    lastErrorCode: string;
    nextReauthAt: Date | null;
  }): Promise<boolean>;

  createOrReuseSyncRun(input: {
    studentId: number;
    reason: string | null;
  }): Promise<{ run: PersistedMoodleSyncRun; reused: boolean }>;

  claimNextSyncRun(input: {
    owner: string;
    leaseDurationMs: number;
  }): Promise<PersistedMoodleSyncRun | null>;

  heartbeatSyncRun(input: {
    runId: string;
    studentId: number;
    connectionGeneration: number;
    owner: string;
    leaseDurationMs: number;
  }): Promise<boolean>;

  updateSyncProgress(input: {
    runId: string;
    studentId: number;
    connectionGeneration: number;
    owner: string;
    discoveredCourses?: number;
    processedCourses?: number;
    failedCourses?: number;
    totalMaterials?: number;
    checkpointJson?: string | null;
  }): Promise<boolean>;

  stageCourseGraph(input: {
    studentId: number;
    runId: string;
    connectionGeneration: number;
    snapshotVersion: number;
    leaseOwner: string;
    course: RepositoryCourseSnapshotInput;
    sections: RepositorySectionSnapshotInput[];
    materials: RepositoryMaterialSnapshotInput[];
  }): Promise<boolean>;

  publishSnapshot(input: {
    studentId: number;
    runId: string;
    connectionGeneration: number;
    snapshotVersion: number;
    leaseOwner: string;
    outcome: "COMPLETED" | "PARTIAL";
  }): Promise<boolean>;

  finishSyncRun(input: {
    studentId: number;
    runId: string;
    connectionGeneration: number;
    leaseOwner: string;
    outcome: "FAILED" | "CANCELLED";
    lastErrorCode: string | null;
  }): Promise<boolean>;

  getLatestSyncRun(studentId: number): Promise<PersistedMoodleSyncRun | null>;

  getSyncRunBySnapshot(input: {
    studentId: number;
    snapshotVersion: number;
  }): Promise<PersistedMoodleSyncRun | null>;

  listCourses(input: {
    studentId: number;
    snapshotVersion: number;
    limit: number;
    after?: RepositoryTextCursor;
  }): Promise<RepositoryPage<PersistedCourseSnapshot>>;

  findCourse(input: {
    studentId: number;
    snapshotVersion: number;
    publicId: string;
  }): Promise<PersistedCourseSnapshot | null>;

  listSections(input: {
    studentId: number;
    snapshotVersion: number;
    coursePublicId: string;
    limit: number;
    after?: RepositoryPositionCursor;
  }): Promise<RepositoryPage<PersistedSectionSnapshot>>;

  listMaterials(input: {
    studentId: number;
    snapshotVersion: number;
    limit: number;
    coursePublicId?: string;
    after?: RepositoryTextCursor;
  }): Promise<RepositoryPage<PersistedMaterialSnapshot>>;

  findMaterial(input: {
    studentId: number;
    snapshotVersion: number;
    publicId: string;
  }): Promise<PersistedMaterialSnapshot | null>;

  replaceMaterialLocatorEnvelopeCas(input: {
    studentId: number;
    snapshotVersion: number;
    publicId: string;
    previousEnvelope: string;
    nextEnvelope: string;
  }): Promise<boolean>;

  purgeSnapshotVersions(input: {
    studentId: number;
    keepVersions: number[];
  }): Promise<void>;
}
