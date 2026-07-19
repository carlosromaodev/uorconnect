import { z } from "zod";
import { moodleConnectionStatuses, moodleCountStatuses, moodleSyncStatuses } from "../domain/models";

export const moodleErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    actionRequired: z.enum(["none", "connect", "reauthenticate", "contact_support"]),
  }),
  meta: z.object({ requestId: z.string() }),
});

export const moodleConnectionSchema = z.object({
  status: z.enum(moodleConnectionStatuses),
  connected: z.boolean(),
  credentialsStored: z.boolean(),
  actionRequired: z.enum(["none", "connect", "reauthenticate", "contact_support"]),
  retryable: z.boolean(),
  lastAuthenticatedAt: z.string().datetime().nullable(),
  lastSuccessfulSyncAt: z.string().datetime().nullable(),
});

const countMetricSchema = z.object({
  value: z.number().int().nonnegative().nullable(),
  status: z.enum(moodleCountStatuses),
});

const coverageSchema = z.object({
  processedCourses: z.number().int().nonnegative(),
  totalCourses: z.number().int().nonnegative().nullable(),
  failedCourses: z.number().int().nonnegative(),
});

const paginationSchema = z.object({
  returned: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative().nullable(),
  totalStatus: z.enum(moodleCountStatuses),
});

export const responseMetaSchema = z.object({
  requestId: z.string(),
  syncedAt: z.string().datetime().nullable(),
  stale: z.boolean(),
  snapshotVersion: z.number().int().nonnegative().nullable().optional(),
  pagination: paginationSchema.optional(),
  coverage: coverageSchema.optional(),
});

export const createMoodleSessionBodySchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(512),
  rememberCredentials: z.literal(true),
});

export const moodleIdParamsSchema = z.object({
  courseId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
});

export const moodleListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(2048).optional(),
});

export const sessionEnvelopeSchema = z.object({
  data: z.object({
    connection: moodleConnectionSchema,
    initialSyncRunId: z.string().uuid().nullable(),
  }),
  meta: responseMetaSchema,
});

export const profileSchema = z.object({
  id: z.string().uuid(),
  studentNumber: z.string(),
  displayName: z.string(),
  email: z.string().email().nullable(),
  timezone: z.string().nullable(),
  lastSyncedAt: z.string().datetime(),
});

export const profileEnvelopeSchema = z.object({
  data: profileSchema,
  meta: responseMetaSchema,
});

export const courseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortName: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  visible: z.boolean(),
  favourite: z.boolean(),
  progressAvailable: z.boolean(),
  progressPercent: z.number().min(0).max(100).nullable(),
  stale: z.boolean(),
  lastSyncedAt: z.string().datetime(),
});

export const courseEnvelopeSchema = z.object({
  data: courseSchema,
  meta: responseMetaSchema,
});

export const courseListEnvelopeSchema = z.object({
  data: z.array(courseSchema),
  meta: responseMetaSchema.extend({ pagination: paginationSchema }),
});

export const moduleSummarySchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  available: z.boolean(),
  kind: z.enum(["material", "activity", "other"]),
});

export const sectionSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  name: z.string(),
  position: z.number().int().nonnegative(),
  summary: z.string().nullable(),
  visible: z.boolean(),
  available: z.boolean(),
  modules: z.array(moduleSummarySchema),
  stale: z.boolean(),
  lastSyncedAt: z.string().datetime(),
});

export const sectionListEnvelopeSchema = z.object({
  data: z.array(sectionSchema),
  meta: responseMetaSchema.extend({ pagination: paginationSchema }),
});

export const materialSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  sectionId: z.string().uuid().nullable(),
  type: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  available: z.boolean(),
  openAvailable: z.boolean(),
  downloadAvailable: z.boolean(),
  mimeType: z.string().nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  stale: z.boolean(),
  lastSyncedAt: z.string().datetime(),
});

export const materialListEnvelopeSchema = z.object({
  data: z.array(materialSchema),
  meta: responseMetaSchema.extend({ pagination: paginationSchema }),
});

export const overviewEnvelopeSchema = z.object({
  data: z.object({
    connection: moodleConnectionSchema,
    counts: z.object({
      courses: countMetricSchema,
      coursesVisible: countMetricSchema,
      coursesWithProgress: countMetricSchema,
      materials: countMetricSchema,
      activities: countMetricSchema,
      assignmentsOpen: countMetricSchema,
      quizzesOpen: countMetricSchema,
      notificationsUnread: countMetricSchema,
    }),
    progress: z.object({
      status: z.enum(moodleCountStatuses),
      trackedCourses: z.number().int().nonnegative().nullable(),
      untrackedCourses: z.number().int().nonnegative().nullable(),
      averagePercent: z.number().min(0).max(100).nullable(),
    }),
    coverage: coverageSchema,
    nextDeadlines: z.object({
      status: z.literal("unsupported"),
      items: z.array(z.never()).max(0),
    }),
  }),
  meta: responseMetaSchema,
});

export const syncViewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(moodleSyncStatuses),
  reused: z.boolean(),
  reason: z.string(),
  discoveredCourses: z.number().int().nonnegative(),
  processedCourses: z.number().int().nonnegative(),
  failedCourses: z.number().int().nonnegative(),
  materialCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  errorCode: z.string().nullable(),
});

export const syncEnvelopeSchema = z.object({
  data: syncViewSchema.nullable(),
  meta: responseMetaSchema,
});
