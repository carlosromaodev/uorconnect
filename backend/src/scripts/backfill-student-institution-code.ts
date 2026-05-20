import { prisma } from "../shared/prisma";
import { resolveStudentInstitutionCode } from "../modules/auth/domain/student-identity";

const apply = process.argv.includes("--apply");

async function main() {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      institutionCode: true,
      studentNumber: true,
      email: true,
      phone: true,
      university: true,
      registrationSource: true,
      isUorStudent: true,
    },
    orderBy: [{ id: "asc" }],
  });

  const changes = students
    .map((student) => ({
      ...student,
      nextInstitutionCode: resolveStudentInstitutionCode(student),
    }))
    .filter((student) => student.institutionCode !== student.nextInstitutionCode);

  const byNext = changes.reduce<Record<string, number>>((acc, student) => {
    acc[student.nextInstitutionCode] = (acc[student.nextInstitutionCode] ?? 0) + 1;
    return acc;
  }, {});

  if (apply) {
    for (const student of changes) {
      await prisma.student.update({
        where: { id: student.id },
        data: { institutionCode: student.nextInstitutionCode },
      });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    totalStudents: students.length,
    changes: changes.length,
    byNextInstitutionCode: byNext,
    sample: changes.slice(0, 20).map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      currentInstitutionCode: student.institutionCode,
      nextInstitutionCode: student.nextInstitutionCode,
      email: student.email,
      university: student.university,
      registrationSource: student.registrationSource,
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
