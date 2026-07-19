import type {
  PersistedCourseSnapshot,
  PersistedMaterialSnapshot,
  PersistedMoodleConnection,
  PersistedMoodleSyncRun,
  PersistedSectionSnapshot,
} from "../domain/repository";
import type {
  MoodleConnectionView,
  MoodleCourse,
  MoodleMaterial,
  MoodleSection,
  MoodleSyncView,
} from "../domain/models";

export function connectionView(connection: PersistedMoodleConnection | null): MoodleConnectionView {
  if (!connection) {
    return {
      status: "DISCONNECTED",
      connected: false,
      credentialsStored: false,
      actionRequired: "connect",
      retryable: false,
      lastAuthenticatedAt: null,
      lastSuccessfulSyncAt: null,
    };
  }

  const connected = ["CONNECTED", "REFRESHING", "DEGRADED"].includes(connection.status);
  const actionRequired = connection.status === "REAUTH_REQUIRED"
    ? "reauthenticate" as const
    : connection.status === "DISCONNECTED"
      ? "connect" as const
      : "none" as const;
  return {
    status: connection.status,
    connected,
    credentialsStored: Boolean(connection.credentialsEnvelope),
    actionRequired,
    retryable: connection.status === "DEGRADED" || connection.status === "REFRESHING",
    lastAuthenticatedAt: connection.lastAuthenticatedAt?.toISOString() ?? null,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt?.toISOString() ?? null,
  };
}

export function courseView(course: PersistedCourseSnapshot): MoodleCourse {
  const stale = course.stale ?? false;
  return {
    id: course.publicId,
    name: course.name,
    shortName: course.shortName || null,
    category: course.category,
    description: course.descriptionText,
    startDate: course.startAt?.toISOString() ?? null,
    endDate: course.endAt?.toISOString() ?? null,
    visible: course.visible && !course.hiddenByStudent,
    favourite: course.favourite,
    progressAvailable: course.progressAvailable,
    progressPercent: course.progressAvailable ? course.progressPercent : null,
    stale,
    lastSyncedAt: (stale ? course.sourceSyncedAt ?? course.syncedAt : course.syncedAt).toISOString(),
  };
}

export function sectionView(
  section: PersistedSectionSnapshot,
  materials: PersistedMaterialSnapshot[] = [],
): MoodleSection {
  const stale = section.stale ?? false;
  return {
    id: section.publicId,
    courseId: section.coursePublicId,
    name: section.title,
    position: section.position,
    summary: section.summaryText,
    visible: section.visible,
    available: section.available,
    modules: materials
      .filter((material) => material.sectionPublicId === section.publicId)
      .map((material) => ({
        id: material.publicId,
        type: material.type,
        title: material.title,
        available: material.available,
        kind: "material" as const,
      })),
    stale,
    lastSyncedAt: (stale ? section.sourceSyncedAt ?? section.syncedAt : section.syncedAt).toISOString(),
  };
}

export function materialView(material: PersistedMaterialSnapshot): MoodleMaterial {
  const rawSize = material.sizeBytes === null ? null : Number(material.sizeBytes);
  const stale = material.stale ?? false;
  return {
    id: material.publicId,
    courseId: material.coursePublicId,
    sectionId: material.sectionPublicId,
    type: material.type,
    title: material.title,
    description: material.descriptionText,
    available: material.available,
    openAvailable: material.openAvailable && Boolean(material.locatorEnvelope),
    downloadAvailable: material.downloadAvailable && Boolean(material.locatorEnvelope),
    mimeType: material.mimeType,
    fileName: material.fileName,
    sizeBytes: rawSize !== null && Number.isSafeInteger(rawSize) && rawSize >= 0 ? rawSize : null,
    stale,
    lastSyncedAt: (stale ? material.sourceSyncedAt ?? material.syncedAt : material.syncedAt).toISOString(),
  };
}

export function syncView(run: PersistedMoodleSyncRun, reused: boolean): MoodleSyncView {
  return {
    id: run.id,
    status: run.status,
    reused,
    reason: run.reason ?? "unspecified",
    discoveredCourses: run.discoveredCourses,
    processedCourses: run.processedCourses,
    failedCourses: run.failedCourses,
    materialCount: run.totalMaterials,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.finishedAt?.toISOString() ?? null,
    errorCode: run.lastErrorCode,
  };
}
