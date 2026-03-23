import { PrismaClient } from "@prisma/client";
import { type AdminAuthorizedStudent, type Student, type StudentProfile, type StudentWithStats } from "../domain/student";

export class StudentRepository {
  constructor(private prisma: PrismaClient) {}

  async findByStudentNumber(studentNumber: string): Promise<Student | null> {
    // Busca aluno pelo número na base local (sqlite)
    return this.prisma.student.findUnique({
      where: { studentNumber }
    });
  }

  async create(studentNumber: string, profile?: StudentProfile): Promise<Student> {
    // Cria aluno já preenchendo o perfil capturado da secretaria, quando existir
    return this.prisma.student.create({
      data: {
        studentNumber,
        ...this.mapProfile(profile)
      }
    });
  }

  async upsertProfile(studentNumber: string, profile?: StudentProfile): Promise<Student> {
    // Atualiza se já existir ou cria novo com os dados mais recentes
    const student = await this.prisma.student.upsert({
      where: { studentNumber },
      create: {
        studentNumber,
        ...this.mapProfile(profile)
      },
      update: this.mapProfile(profile)
    });

    await this.touchLastLogin(student.id);

    return (await this.prisma.student.findUnique({
      where: { id: student.id }
    })) as Student;
  }

  async listAll(): Promise<Student[]> {
    return this.prisma.student.findMany();
  }

  async listAllWithStats() {
    return this.prisma.student.findMany({
      include: {
        _count: {
          select: {
            likes: true,
            votes: true,
            comments: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async listRecentLogins(limit = 25): Promise<Student[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, studentNumber, name, email, course, birthDate, nationality, phone, lastLoginAt, createdAt, updatedAt
       FROM Student
       WHERE lastLoginAt IS NOT NULL
       ORDER BY datetime(lastLoginAt) DESC, datetime(updatedAt) DESC
       LIMIT ?`,
      limit
    );

    return rows.map((row) => this.mapStudentRow(row));
  }

  async listAuthorizedAdminStudents(): Promise<AdminAuthorizedStudent[]> {
    return this.prisma.adminAuthorizedStudent.findMany({
      orderBy: [{ createdAt: "asc" }, { studentNumber: "asc" }],
    });
  }

  async isAdminAuthorized(studentNumber: string): Promise<boolean> {
    const existing = await this.prisma.adminAuthorizedStudent.findUnique({
      where: { studentNumber },
      select: { id: true },
    });

    return Boolean(existing);
  }

  async authorizeAdminStudent(studentNumber: string): Promise<AdminAuthorizedStudent> {
    return this.prisma.adminAuthorizedStudent.upsert({
      where: { studentNumber },
      update: {},
      create: { studentNumber },
    });
  }

  async revokeAdminStudent(studentNumber: string): Promise<void> {
    await this.prisma.adminAuthorizedStudent.delete({
      where: { studentNumber },
    });
  }

  async findByIdWithStats(id: number): Promise<StudentWithStats | null> {
    return this.prisma.student.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            likes: true,
            votes: true,
            comments: true
          }
        }
      }
    }) as Promise<StudentWithStats | null>;
  }

  async deleteWithRelations(id: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.studentLike.deleteMany({ where: { studentId: id } }),
      this.prisma.courseLike.deleteMany({ where: { studentId: id } }),
      this.prisma.courseEnrollment.deleteMany({ where: { studentId: id } }),
      this.prisma.studentVote.deleteMany({ where: { studentId: id } }),
      this.prisma.studentComment.deleteMany({ where: { studentId: id } }),
      this.prisma.liveChatMessage.deleteMany({ where: { studentId: id } }),
      this.prisma.student.delete({ where: { id } })
    ]);
  }

  private mapProfile(profile?: StudentProfile) {
    // Converte o DTO opcional para o formato aceito pelo Prisma
    if (!profile) return {};
    return {
      name: profile.name,
      email: profile.email,
      course: profile.course,
      nationality: profile.nationality,
      phone: profile.phone,
      birthDate: profile.birthDate ? new Date(profile.birthDate) : undefined
    };
  }

  private async touchLastLogin(studentId: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE Student SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = ?`,
      studentId
    );
  }

  private mapStudentRow(row: Record<string, unknown>): Student {
    return {
      id: Number(row.id),
      studentNumber: String(row.studentNumber),
      name: (row.name as string | null | undefined) ?? null,
      email: (row.email as string | null | undefined) ?? null,
      course: (row.course as string | null | undefined) ?? null,
      birthDate: row.birthDate ? new Date(String(row.birthDate)) : null,
      nationality: (row.nationality as string | null | undefined) ?? null,
      phone: (row.phone as string | null | undefined) ?? null,
      lastLoginAt: row.lastLoginAt ? new Date(String(row.lastLoginAt)) : null,
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt)),
    };
  }
}
