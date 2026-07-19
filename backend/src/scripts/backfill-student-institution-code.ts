import { prisma } from "../shared/prisma";
import {
  canonicalStudentUniversityName,
  hasVerifiedIsptecStudentEmail,
  hasOfficialStudentNumberShape,
  normalizeStudentNumberForIdentity,
  resolveStudentInstitutionCode,
} from "../modules/auth/domain/student-identity";
import { softDeleteStudentWithMoodlePurge } from "../shared/student-deactivation";

const apply = process.argv.includes("--apply");

function isOfficialRegistrationSource(value?: string | null) {
  const source = value?.trim().toUpperCase() ?? "";
  return source === "SECRETARIA" || source === "ISPTEC_OFFICIAL";
}

async function main() {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      institutionCode: true,
      studentNumber: true,
      email: true,
      course: true,
      phone: true,
      university: true,
      registrationSource: true,
      isUorStudent: true,
      deletedAt: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          votes: true,
          comments: true,
          submissionMemberships: true,
          passportPointLedger: true,
          exhibitorVoteScoreEvents: true,
          exhibitorActorScoreEvents: true,
        },
      },
    },
    orderBy: [{ id: "asc" }],
  });

  const activeStudents = students.filter((student) => !student.deletedAt);
  const existingKeys = new Map(students.map((student) => [
    `${student.institutionCode}:${student.studentNumber}`,
    student.id,
  ]));

  const plans = activeStudents
    .map((student) => ({
      ...student,
      nextStudentNumber: normalizeStudentNumberForIdentity(student.studentNumber),
      nextInstitutionCode: resolveStudentInstitutionCode(student),
      nextUniversity: canonicalStudentUniversityName(resolveStudentInstitutionCode(student)),
      shouldDeactivate: !hasOfficialStudentNumberShape(student.studentNumber),
    }));

  const groupedByTarget = plans
    .filter((student) => !student.shouldDeactivate)
    .reduce<Map<string, typeof plans>>((acc, student) => {
      const key = `${student.nextInstitutionCode}:${student.nextStudentNumber}`;
      const group = acc.get(key) ?? [];
      group.push(student);
      acc.set(key, group);
      return acc;
    }, new Map());

  const keepIds = new Set<number>();
  const duplicateDeactivateIds = new Set<number>();

  for (const group of groupedByTarget.values()) {
    const sorted = [...group].sort((left, right) => {
      const leftActivity = left._count.votes
        + left._count.comments
        + left._count.submissionMemberships
        + left._count.passportPointLedger
        + left._count.exhibitorVoteScoreEvents
        + left._count.exhibitorActorScoreEvents;
      const rightActivity = right._count.votes
        + right._count.comments
        + right._count.submissionMemberships
        + right._count.passportPointLedger
        + right._count.exhibitorVoteScoreEvents
        + right._count.exhibitorActorScoreEvents;
      if (leftActivity !== rightActivity) return rightActivity - leftActivity;

      const leftAlreadyCanonical = left.studentNumber === left.nextStudentNumber ? 1 : 0;
      const rightAlreadyCanonical = right.studentNumber === right.nextStudentNumber ? 1 : 0;
      if (leftAlreadyCanonical !== rightAlreadyCanonical) return rightAlreadyCanonical - leftAlreadyCanonical;

      const leftInstitutionalEmail = hasVerifiedIsptecStudentEmail(left.studentNumber, left.email) ? 1 : 0;
      const rightInstitutionalEmail = hasVerifiedIsptecStudentEmail(right.studentNumber, right.email) ? 1 : 0;
      if (leftInstitutionalEmail !== rightInstitutionalEmail) return rightInstitutionalEmail - leftInstitutionalEmail;

      const leftOfficial = isOfficialRegistrationSource(left.registrationSource) ? 1 : 0;
      const rightOfficial = isOfficialRegistrationSource(right.registrationSource) ? 1 : 0;
      if (leftOfficial !== rightOfficial) return rightOfficial - leftOfficial;

      const leftLogin = left.lastLoginAt?.getTime() ?? left.createdAt.getTime();
      const rightLogin = right.lastLoginAt?.getTime() ?? right.createdAt.getTime();
      return rightLogin - leftLogin;
    });

    keepIds.add(sorted[0].id);
    for (const duplicate of sorted.slice(1)) {
      duplicateDeactivateIds.add(duplicate.id);
    }
  }

  const deactivations = plans.filter((student) => student.shouldDeactivate || duplicateDeactivateIds.has(student.id));
  const updates = plans.filter((student) => {
    if (!keepIds.has(student.id)) return false;
    if (
      student.studentNumber === student.nextStudentNumber
      && student.institutionCode === student.nextInstitutionCode
      && student.university === student.nextUniversity
    ) return false;

    const targetKey = `${student.nextInstitutionCode}:${student.nextStudentNumber}`;
    const existingId = existingKeys.get(targetKey);
    return !existingId || existingId === student.id;
  });

  const blockedUpdates = plans.filter((student) => {
    if (!keepIds.has(student.id)) return false;
    if (
      student.studentNumber === student.nextStudentNumber
      && student.institutionCode === student.nextInstitutionCode
      && student.university === student.nextUniversity
    ) return false;

    const targetKey = `${student.nextInstitutionCode}:${student.nextStudentNumber}`;
    const existingId = existingKeys.get(targetKey);
    return Boolean(existingId && existingId !== student.id);
  });

  const byNext = updates.reduce<Record<string, number>>((acc, student) => {
    acc[student.nextInstitutionCode] = (acc[student.nextInstitutionCode] ?? 0) + 1;
    return acc;
  }, {});

  if (apply) {
    for (const student of deactivations) {
      const deletedAt = new Date();
      await prisma.$transaction(async (tx) => {
        await softDeleteStudentWithMoodlePurge(tx, {
          studentId: student.id,
          deletedAt,
          deletionReason: student.shouldDeactivate
            ? "Removido da lista ativa: login temporário ou número de estudante fora do padrão oficial iniciado por 2."
            : "Removido da lista ativa: duplicado após normalização institucional.",
        });
      });
    }

    for (const student of updates) {
      await prisma.student.update({
        where: { id: student.id },
        data: {
          institutionCode: student.nextInstitutionCode,
          studentNumber: student.nextStudentNumber,
          university: student.nextUniversity,
        },
      });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    totalStudents: students.length,
    activeStudents: activeStudents.length,
    updates: updates.length,
    deactivations: deactivations.length,
    blockedUpdates: blockedUpdates.length,
    byNextInstitutionCode: byNext,
    sampleUpdates: updates.slice(0, 20).map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      nextStudentNumber: student.nextStudentNumber,
      currentInstitutionCode: student.institutionCode,
      nextInstitutionCode: student.nextInstitutionCode,
      email: student.email,
      course: student.course,
      university: student.university,
      nextUniversity: student.nextUniversity,
      registrationSource: student.registrationSource,
    })),
    sampleDeactivations: deactivations.slice(0, 20).map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      email: student.email,
      course: student.course,
      registrationSource: student.registrationSource,
      reason: student.shouldDeactivate ? "INVALID_STUDENT_NUMBER" : "DUPLICATE_AFTER_NORMALIZATION",
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Falha ao atualizar a classificação institucional dos estudantes.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
