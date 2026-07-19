import { MoodleConnectionStatus, type Prisma } from "@prisma/client";

/**
 * Single transactional path for deactivating a student and irreversibly
 * removing Moodle integration secrets/snapshots from the active database.
 *
 * Callers must pass their existing transaction so profile deactivation and
 * Moodle tombstoning either commit together or both roll back.
 */
export async function softDeleteStudentWithMoodlePurge(
  tx: Prisma.TransactionClient,
  input: {
    studentId: number;
    deletedAt: Date;
    deletionReason: string;
  },
): Promise<void> {
  await tx.student.update({
    where: { id: input.studentId },
    data: {
      deletedAt: input.deletedAt,
      deletionReason: input.deletionReason,
      lastLoginAt: null,
    },
  });

  await tx.moodleConnection.updateMany({
    where: { studentId: input.studentId },
    data: {
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
      lastErrorCode: null,
    },
  });

  await tx.moodleMaterialSnapshot.deleteMany({ where: { studentId: input.studentId } });
  await tx.moodleSectionSnapshot.deleteMany({ where: { studentId: input.studentId } });
  await tx.moodleCourseSnapshot.deleteMany({ where: { studentId: input.studentId } });
  await tx.moodleEntityRef.deleteMany({ where: { studentId: input.studentId } });
  await tx.moodleSyncRun.deleteMany({ where: { studentId: input.studentId } });
}
