import { prisma } from "../../../shared/prisma";
import type { UorStudentPublicIdentityResolver } from "../application/ports";

type Database = typeof prisma;

export class PrismaUorStudentPublicIdentityResolver implements UorStudentPublicIdentityResolver {
  constructor(private readonly db: Database = prisma) {}

  async findByProfileId(input: { profileId: string; institutionCode: string }) {
    return this.db.student.findFirst({
      where: { uorStudentPublicId: input.profileId, institutionCode: input.institutionCode, deletedAt: null, isUorStudent: true },
      select: { id: true, institutionCode: true, studentNumber: true },
    });
  }
}
