import { PrismaClient, StudentLoginOrigin as PrismaStudentLoginOrigin } from "@prisma/client";
import {
  type AdminAuthorizedStudent,
  type Student,
  type StudentLoginAudit,
  type StudentLoginOrigin,
  type StudentProfile,
  type StudentWithStats,
} from "../domain/student";

export class StudentRepository {
  constructor(private prisma: PrismaClient) {}

  private toPrismaLoginOrigin(origin: StudentLoginOrigin) {
    return origin === "laboratorio"
      ? PrismaStudentLoginOrigin.LABORATORIO
      : PrismaStudentLoginOrigin.UORCONNECT;
  }

  private fromPrismaLoginOrigin(origin: PrismaStudentLoginOrigin): StudentLoginOrigin {
    return origin === PrismaStudentLoginOrigin.LABORATORIO ? "laboratorio" : "uorconnect";
  }

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
    return this.prisma.student.findMany({
      where: {
        lastLoginAt: {
          not: null
        }
      },
      orderBy: [
        { lastLoginAt: "desc" },
        { updatedAt: "desc" }
      ],
      take: limit
    });
  }

  async recordLoginAudit(student: Student, origin: StudentLoginOrigin): Promise<void> {
    await this.prisma.studentLoginAudit.create({
      data: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        origin: this.toPrismaLoginOrigin(origin),
      }
    });
  }

  async listLoginHistory(limit = 25): Promise<StudentLoginAudit[]> {
    const audits = await this.prisma.studentLoginAudit.findMany({
      include: {
        student: true,
      },
      orderBy: [
        { loggedAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return audits.map((audit) => ({
      ...audit,
      origin: this.fromPrismaLoginOrigin(audit.origin),
    })) as StudentLoginAudit[];
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

  async updateProfile(id: number, profile: Partial<StudentProfile>): Promise<Student | null> {
    const mapped = this.mapProfile(profile as StudentProfile);

    return this.prisma.student.update({
      where: { id },
      data: mapped,
    });
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
    await this.prisma.student.update({
      where: { id: studentId },
      data: { lastLoginAt: new Date() }
    });
  }
}
