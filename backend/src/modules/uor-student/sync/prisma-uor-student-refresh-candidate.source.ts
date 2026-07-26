import { prisma } from "../../../shared/prisma";
import type { UorStudentRefreshCandidateSource } from "./domain";

type Database = typeof prisma;

export class PrismaUorStudentRefreshCandidateSource implements UorStudentRefreshCandidateSource {
  constructor(private readonly db: Database = prisma) {}

  async listDue(input: {
    now: Date;
    secretariaStaleBefore: Date;
    moodleStaleBefore: Date;
    limit: number;
  }) {
    const students = await this.db.student.findMany({
      where: {
        deletedAt: null,
        institutionCode: "UOR",
        isUorStudent: true,
        OR: [
          {
            secretariaConnection: {
              is: {
                credentialsEnvelope: { not: null },
                status: { in: ["CONNECTED", "DEGRADED"] },
                OR: [
                  { lastSuccessfulSyncAt: null },
                  { lastSuccessfulSyncAt: { lt: input.secretariaStaleBefore } },
                ],
              },
            },
          },
          {
            moodleConnection: {
              is: {
                credentialsEnvelope: { not: null },
                status: { in: ["CONNECTED", "DEGRADED"] },
                OR: [
                  { lastSuccessfulSyncAt: null },
                  { lastSuccessfulSyncAt: { lt: input.moodleStaleBefore } },
                ],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        institutionCode: true,
        studentNumber: true,
        secretariaConnection: {
          select: { credentialsEnvelope: true, status: true, lastSuccessfulSyncAt: true },
        },
        moodleConnection: {
          select: { credentialsEnvelope: true, status: true, lastSuccessfulSyncAt: true },
        },
      },
      orderBy: { id: "asc" },
      take: input.limit,
    });

    return students.flatMap((student) => {
      const identity = {
        id: student.id,
        institutionCode: student.institutionCode,
        studentNumber: student.studentNumber,
      };
      const candidates = [] as Awaited<ReturnType<UorStudentRefreshCandidateSource["listDue"]>>;
      const secretaria = student.secretariaConnection;
      if (
        secretaria?.credentialsEnvelope
        && ["CONNECTED", "DEGRADED"].includes(secretaria.status)
        && (!secretaria.lastSuccessfulSyncAt || secretaria.lastSuccessfulSyncAt < input.secretariaStaleBefore)
      ) candidates.push({ student: identity, provider: "secretaria" });
      const moodle = student.moodleConnection;
      if (
        moodle?.credentialsEnvelope
        && ["CONNECTED", "DEGRADED"].includes(moodle.status)
        && (!moodle.lastSuccessfulSyncAt || moodle.lastSuccessfulSyncAt < input.moodleStaleBefore)
      ) candidates.push({ student: identity, provider: "moodle" });
      return candidates;
    });
  }
}
