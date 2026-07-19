export const moodleCountStatuses = ["exact", "partial", "not_synced", "unsupported"] as const;
export type MoodleCountStatus = (typeof moodleCountStatuses)[number];

export type MoodleCountMetric = {
  value: number | null;
  status: MoodleCountStatus;
};

export const moodleConnectionStatuses = [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "REFRESHING",
  "REAUTH_REQUIRED",
  "DEGRADED",
  "UNAVAILABLE",
] as const;
export type MoodleConnectionStatus = (typeof moodleConnectionStatuses)[number];

export type MoodleConnectionView = {
  status: MoodleConnectionStatus;
  connected: boolean;
  credentialsStored: boolean;
  actionRequired: "none" | "connect" | "reauthenticate" | "contact_support";
  retryable: boolean;
  lastAuthenticatedAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

export type MoodleProfile = {
  id: string;
  studentNumber: string;
  displayName: string;
  email: string | null;
  timezone: string | null;
  lastSyncedAt: string;
};

export type MoodleCourse = {
  id: string;
  name: string;
  shortName: string | null;
  category: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  visible: boolean;
  favourite: boolean;
  progressAvailable: boolean;
  progressPercent: number | null;
  stale: boolean;
  lastSyncedAt: string;
};

export type MoodleModuleSummary = {
  id: string;
  type: string;
  title: string;
  available: boolean;
  kind: "material" | "activity" | "other";
};

export type MoodleSection = {
  id: string;
  courseId: string;
  name: string;
  position: number;
  summary: string | null;
  visible: boolean;
  available: boolean;
  modules: MoodleModuleSummary[];
  stale: boolean;
  lastSyncedAt: string;
};

export type MoodleMaterial = {
  id: string;
  courseId: string;
  sectionId: string | null;
  type: string;
  title: string;
  description: string | null;
  available: boolean;
  openAvailable: boolean;
  downloadAvailable: boolean;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  stale: boolean;
  lastSyncedAt: string;
};

export type MoodleCoverage = {
  processedCourses: number;
  totalCourses: number | null;
  failedCourses: number;
};

export type MoodlePagination = {
  returned: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  total: number | null;
  totalStatus: MoodleCountStatus;
};

export type MoodleResponseMeta = {
  requestId: string;
  syncedAt: string | null;
  stale: boolean;
  snapshotVersion?: number | null;
  pagination?: MoodlePagination;
  coverage?: MoodleCoverage;
};

export type MoodleOverview = {
  connection: MoodleConnectionView;
  counts: {
    courses: MoodleCountMetric;
    coursesVisible: MoodleCountMetric;
    coursesWithProgress: MoodleCountMetric;
    materials: MoodleCountMetric;
    activities: MoodleCountMetric;
    assignmentsOpen: MoodleCountMetric;
    quizzesOpen: MoodleCountMetric;
    notificationsUnread: MoodleCountMetric;
  };
  progress: {
    status: MoodleCountStatus;
    trackedCourses: number | null;
    untrackedCourses: number | null;
    averagePercent: number | null;
  };
  coverage: MoodleCoverage;
  nextDeadlines: {
    status: "unsupported";
    items: never[];
  };
};

export const moodleSyncStatuses = ["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"] as const;
export type MoodleSyncStatus = (typeof moodleSyncStatuses)[number];

export type MoodleSyncView = {
  id: string;
  status: MoodleSyncStatus;
  reused: boolean;
  reason: string;
  discoveredCourses: number;
  processedCourses: number;
  failedCourses: number;
  materialCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
};

export type MoodleListResult<T> = {
  items: T[];
  pagination: MoodlePagination;
  coverage?: MoodleCoverage;
  syncedAt: Date | null;
  stale: boolean;
  snapshotVersion: number | null;
};
