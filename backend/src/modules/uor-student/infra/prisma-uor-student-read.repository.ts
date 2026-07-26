import { prisma } from "../../../shared/prisma";
import type { UorStudentDataBlock, UorStudentSyncRunView } from "../domain/models";
import type { UorStudentIdentity, UorStudentLocalState, UorStudentReadRepository } from "../application/ports";

type Database = typeof prisma;

type SnapshotSummary = {
  domain: string;
  total: number;
  coverage: string;
  observedAt: Date;
};

function snapshotBlock(snapshots: SnapshotSummary[], source: UorStudentDataBlock["source"]): UorStudentDataBlock {
  if (!snapshots.length) return { source, observedAt: null, coverage: "not_synced", stale: false };
  const stale = snapshots.some((snapshot) => snapshot.coverage === "stale");
  const exact = snapshots.every((snapshot) => ["live", "fresh", "exact"].includes(snapshot.coverage));
  const observedAt = snapshots.reduce((latest, snapshot) => (
    snapshot.observedAt.getTime() > latest.getTime() ? snapshot.observedAt : latest
  ), snapshots[0].observedAt);
  return {
    source,
    observedAt: observedAt.toISOString(),
    coverage: stale ? "stale" : exact ? "exact" : "partial",
    stale,
  };
}

function totalFor(snapshots: SnapshotSummary[], domain: string) {
  return snapshots.find((snapshot) => snapshot.domain === domain)?.total ?? null;
}

function secretariaRunStatus(status: string): UorStudentSyncRunView["status"] {
  if (status === "RUNNING") return "running";
  if (status === "COMPLETED") return "completed";
  if (status === "PARTIAL") return "partial";
  if (status === "CANCELLED") return "cancelled";
  return "failed";
}

function moodleRunStatus(status: string): UorStudentSyncRunView["status"] {
  if (status === "QUEUED") return "queued";
  return secretariaRunStatus(status);
}

function productJobStatus(status: string): UorStudentSyncRunView["status"] {
  if (status === "QUEUED") return "queued";
  if (status === "RUNNING") return "running";
  if (status === "COMPLETED") return "completed";
  if (status === "CANCELLED") return "cancelled";
  return "failed";
}

function productJobView(job: {
  id: string;
  provider: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastErrorCode: string | null;
}): UorStudentSyncRunView | null {
  if (job.provider !== "secretaria" && job.provider !== "moodle") return null;
  return {
    id: job.id,
    provider: job.provider,
    status: productJobStatus(job.status),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    errorCode: job.lastErrorCode,
  };
}

export class PrismaUorStudentReadRepository implements UorStudentReadRepository {
  constructor(private readonly db: Database = prisma) {}

  async getLocalState(student: UorStudentIdentity): Promise<UorStudentLocalState | null> {
    const record = await this.db.student.findFirst({
      where: {
        id: student.id,
        institutionCode: student.institutionCode,
        studentNumber: student.studentNumber,
        deletedAt: null,
      },
      select: {
        institutionCode: true,
        studentNumber: true,
        name: true,
        course: true,
        classCode: true,
        academicYear: true,
        academicPeriod: true,
        academicSyncedAt: true,
        updatedAt: true,
        secretariaConnection: { select: { activeSnapshotVersion: true } },
        moodleConnection: {
          select: {
            activeSnapshotVersion: true,
            lastSuccessfulSyncAt: true,
          },
        },
      },
    });
    if (!record) return null;

    const secretariaVersion = record.secretariaConnection?.activeSnapshotVersion ?? null;
    const moodleVersion = record.moodleConnection?.activeSnapshotVersion ?? null;
    const [secretariaSnapshots, moodleCourses, moodleMaterials, staleCourses, staleMaterials] = await Promise.all([
      secretariaVersion === null
        ? Promise.resolve([])
        : this.db.secretariaSnapshot.findMany({
          where: { studentId: student.id, snapshotVersion: secretariaVersion },
          select: { domain: true, itemCount: true, coverage: true, observedAt: true },
          take: 100,
        }).then((items) => items.map((item) => ({
          domain: item.domain,
          total: item.itemCount,
          coverage: item.coverage,
          observedAt: item.observedAt,
        }))),
      moodleVersion === null ? Promise.resolve(null) : this.db.moodleCourseSnapshot.count({ where: { studentId: student.id, snapshotVersion: moodleVersion } }),
      moodleVersion === null ? Promise.resolve(null) : this.db.moodleMaterialSnapshot.count({ where: { studentId: student.id, snapshotVersion: moodleVersion } }),
      moodleVersion === null ? Promise.resolve(0) : this.db.moodleCourseSnapshot.count({ where: { studentId: student.id, snapshotVersion: moodleVersion, stale: true } }),
      moodleVersion === null ? Promise.resolve(0) : this.db.moodleMaterialSnapshot.count({ where: { studentId: student.id, snapshotVersion: moodleVersion, stale: true } }),
    ]);

    const academicDomains = ["academic.enrollments", "academic.grades", "academic.exams", "academic.absences", "academic.attendance"];
    const financeDomains = ["finance.charges", "finance.references", "finance.payments", "finance.receipts"];
    const academicSnapshots = secretariaSnapshots.filter((snapshot) => academicDomains.includes(snapshot.domain));
    const financeSnapshots = secretariaSnapshots.filter((snapshot) => financeDomains.includes(snapshot.domain));
    const examSnapshots = secretariaSnapshots.filter((snapshot) => snapshot.domain === "academic.exams");
    const learningStale = staleCourses > 0 || staleMaterials > 0;
    const learningProvenance: UorStudentDataBlock = moodleVersion === null
      ? { source: "moodle", observedAt: null, coverage: "not_synced", stale: false }
      : {
        source: "moodle",
        observedAt: record.moodleConnection?.lastSuccessfulSyncAt?.toISOString() ?? null,
        coverage: learningStale ? "stale" : "exact",
        stale: learningStale,
      };
    const identityObservedAt = record.academicSyncedAt ?? record.updatedAt;

    return {
      identity: {
        institutionCode: record.institutionCode,
        studentNumber: record.studentNumber,
        displayName: record.name,
        course: record.course,
        classCode: record.classCode,
        academicYear: record.academicYear,
        academicPeriod: record.academicPeriod,
        provenance: {
          source: "secretaria_uor",
          observedAt: identityObservedAt.toISOString(),
          coverage: record.academicSyncedAt ? "exact" : "partial",
          stale: false,
        },
      },
      academic: {
        enrollments: totalFor(secretariaSnapshots, "academic.enrollments"),
        grades: totalFor(secretariaSnapshots, "academic.grades"),
        exams: totalFor(secretariaSnapshots, "academic.exams"),
        attendance: totalFor(secretariaSnapshots, "academic.attendance") ?? totalFor(secretariaSnapshots, "academic.absences"),
        provenance: snapshotBlock(academicSnapshots, "secretaria_uor"),
      },
      learning: {
        courses: moodleCourses,
        materials: moodleMaterials,
        provenance: learningProvenance,
      },
      finance: {
        charges: totalFor(secretariaSnapshots, "finance.charges"),
        references: totalFor(secretariaSnapshots, "finance.references"),
        payments: totalFor(secretariaSnapshots, "finance.payments"),
        receipts: totalFor(secretariaSnapshots, "finance.receipts"),
        provenance: snapshotBlock(financeSnapshots, "secretaria_uor"),
      },
      agenda: {
        officialExams: totalFor(secretariaSnapshots, "academic.exams"),
        moodleDeadlines: null,
        provenance: snapshotBlock(examSnapshots, "secretaria_uor"),
      },
    };
  }

  async getSyncOverview(student: UorStudentIdentity) {
    const [jobs, secretaria, moodle] = await Promise.all([
      this.db.uorStudentSyncJob.findMany({
        where: { studentId: student.id, institutionCode: student.institutionCode },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.db.secretariaSyncRun.findFirst({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } }),
      this.db.moodleSyncRun.findFirst({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } }),
    ]);
    const productRuns = jobs.flatMap((job) => {
      const view = productJobView(job);
      return view ? [view] : [];
    });
    if (productRuns.length) return { runs: productRuns, automatic: true as const };
    const runs: UorStudentSyncRunView[] = [];
    if (secretaria) {
      runs.push({
        id: secretaria.id,
        provider: "secretaria",
        status: secretariaRunStatus(secretaria.status),
        startedAt: secretaria.startedAt.toISOString(),
        finishedAt: secretaria.finishedAt?.toISOString() ?? null,
        errorCode: secretaria.errorCode,
      });
    }
    if (moodle) {
      runs.push({
        id: moodle.id,
        provider: "moodle",
        status: moodleRunStatus(moodle.status),
        startedAt: moodle.startedAt?.toISOString() ?? null,
        finishedAt: moodle.finishedAt?.toISOString() ?? null,
        errorCode: moodle.lastErrorCode,
      });
    }
    return { runs, automatic: true as const };
  }

  async getSyncRun(student: UorStudentIdentity, runId: string) {
    const [job, secretaria, moodle] = await Promise.all([
      this.db.uorStudentSyncJob.findFirst({
        where: { id: runId, studentId: student.id, institutionCode: student.institutionCode },
      }),
      this.db.secretariaSyncRun.findFirst({ where: { id: runId, studentId: student.id } }),
      this.db.moodleSyncRun.findFirst({ where: { id: runId, studentId: student.id } }),
    ]);
    if (job) return productJobView(job);
    if (secretaria) {
      return {
        id: secretaria.id,
        provider: "secretaria" as const,
        status: secretariaRunStatus(secretaria.status),
        startedAt: secretaria.startedAt.toISOString(),
        finishedAt: secretaria.finishedAt?.toISOString() ?? null,
        errorCode: secretaria.errorCode,
      };
    }
    if (moodle) {
      return {
        id: moodle.id,
        provider: "moodle" as const,
        status: moodleRunStatus(moodle.status),
        startedAt: moodle.startedAt?.toISOString() ?? null,
        finishedAt: moodle.finishedAt?.toISOString() ?? null,
        errorCode: moodle.lastErrorCode,
      };
    }
    return null;
  }
}
