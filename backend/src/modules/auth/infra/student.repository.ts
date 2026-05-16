import { Prisma, PrismaClient, StudentLoginOrigin as PrismaStudentLoginOrigin } from "@prisma/client";
import {
  type AdminAccessConflict,
  type AdminAuthorizedStudent,
  type Student,
  type StudentLoginAudit,
  type StudentLoginOrigin,
  type StudentProfile,
  type StudentWithStats,
} from "../domain/student";
import { serializeAdminPermissions, normalizeAdminRole, type AdminAccessInput } from "../domain/admin-authorized-students";
import {
  hashLocalStudentPassword,
  LOCAL_STUDENT_PASSWORD_PURPOSE,
} from "../domain/local-student-credentials";

type StudentAccessFilter = "OFFICIAL" | "TEMPORARY" | "all" | "todos" | undefined;

function buildStudentAccessWhere(accessType: StudentAccessFilter): Prisma.StudentWhereInput {
  const officialAccessWhere: Prisma.StudentWhereInput = {
    OR: [
      { registrationSource: { in: ["SECRETARIA", "ISPTEC_OFFICIAL"] } },
      { academicSyncedAt: { not: null } },
    ],
  };

  if (accessType === "OFFICIAL") return officialAccessWhere;
  if (accessType === "TEMPORARY") return { NOT: officialAccessWhere };
  return {};
}

function hasExplicitAdminPermissions(permissions?: string | null) {
  return Boolean(permissions?.split(",").some((permission) => permission.trim().length > 0));
}

export class StudentRepository {
  constructor(private prisma: PrismaClient) {}

  private toPrismaLoginOrigin(origin: StudentLoginOrigin) {
    if (origin === "conventional") return PrismaStudentLoginOrigin.CONVENTIONAL;
    return PrismaStudentLoginOrigin.UORCONNECT;
  }

  private fromPrismaLoginOrigin(origin: PrismaStudentLoginOrigin): StudentLoginOrigin {
    if (origin === PrismaStudentLoginOrigin.CONVENTIONAL) return "conventional";
    return "uorconnect";
  }

  async findByStudentNumber(studentNumber: string): Promise<Student | null> {
    // Busca aluno pelo número na base local (sqlite)
    return this.prisma.student.findUnique({
      where: { studentNumber }
    }).then((student) => student?.deletedAt ? null : student);
  }

  async findIncludingDeletedById(id: number): Promise<Student | null> {
    return this.prisma.student.findUnique({
      where: { id }
    });
  }

  async findByPhone(phone: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { phone },
          { alternatePhone: phone },
        ],
      }
    });
  }

  async findByLocalPassword(studentNumber: string, password: string, secret: string): Promise<Student | null> {
    const student = await this.prisma.student.findUnique({
      where: { studentNumber },
      include: {
        accessCodes: {
          where: {
            purpose: LOCAL_STUDENT_PASSWORD_PURPOSE,
            usedAt: null,
            expiresAt: { gt: new Date() },
            deliveryStatus: "ACTIVE",
          },
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });

    if (!student || student.deletedAt || student.accessCodes.length === 0) {
      return null;
    }

    const incomingHash = hashLocalStudentPassword(studentNumber, password, secret);
    if (incomingHash !== student.accessCodes[0].codeHash) {
      return null;
    }

    await this.touchLastLogin(student.id);
    const { accessCodes: _accessCodes, ...profile } = student;
    void _accessCodes;
    return profile;
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
    return this.prisma.student.findMany({ where: { deletedAt: null } });
  }

  async listAllWithStats() {
    return this.prisma.student.findMany({
      where: { deletedAt: null },
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

  async listAllWithStatsPaged(params: {
    page: number;
    limit: number;
    search?: string;
    course?: string;
    university?: string;
    accessType?: "OFFICIAL" | "TEMPORARY" | "all" | "todos";
    sort?:
      | "created_desc"
      | "created_asc"
      | "name_asc"
      | "name_desc"
      | "number_asc"
      | "number_desc"
      | "course_asc"
      | "course_desc"
      | "university_asc"
      | "university_desc"
      | "interactions_desc";
  }) {
    const page = Math.max(1, params.page);
    const limit = Math.min(Math.max(10, params.limit), 200);
    const search = params.search?.trim();
    const course = params.course?.trim();
    const university = params.university?.trim();
    const accessType = params.accessType;
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...buildStudentAccessWhere(accessType),
      ...(course && course !== "all" ? { course } : {}),
      ...(university && university !== "all" && university !== "todos" ? { university } : {}),
      ...(search
        ? {
          OR: [
            { studentNumber: { contains: search } },
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { university: { contains: search } },
            { course: { contains: search } },
            { classCode: { contains: search } },
          ],
        }
        : {}),
    };

    const orderBy = (() => {
      if (params.sort === "created_asc") return [{ createdAt: "asc" as const }];
      if (params.sort === "name_asc") return [{ name: "asc" as const }, { createdAt: "desc" as const }];
      if (params.sort === "name_desc") return [{ name: "desc" as const }, { createdAt: "desc" as const }];
      if (params.sort === "number_asc") return [{ studentNumber: "asc" as const }];
      if (params.sort === "number_desc") return [{ studentNumber: "desc" as const }];
      if (params.sort === "course_asc") return [{ course: "asc" as const }, { createdAt: "desc" as const }];
      if (params.sort === "course_desc") return [{ course: "desc" as const }, { createdAt: "desc" as const }];
      if (params.sort === "university_asc") return [{ university: "asc" as const }, { course: "asc" as const }, { createdAt: "desc" as const }];
      if (params.sort === "university_desc") return [{ university: "desc" as const }, { course: "asc" as const }, { createdAt: "desc" as const }];
      if (params.sort === "interactions_desc") {
        return [
          { likes: { _count: "desc" as const } },
          { votes: { _count: "desc" as const } },
          { comments: { _count: "desc" as const } },
          { createdAt: "desc" as const },
        ];
      }
      return [{ createdAt: "desc" as const }];
    })();

    const [total, items] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: {
          _count: {
            select: {
              likes: true,
              votes: true,
              comments: true,
              courseEnrollments: true,
              certificates: true,
              attendanceCheckIns: true,
              submissions: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listRecentLogins(limit = 25): Promise<Student[]> {
    return this.prisma.student.findMany({
      where: {
        deletedAt: null,
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
      where: { isActive: true },
      orderBy: [{ createdAt: "asc" }, { studentNumber: "asc" }],
    });
  }

  async listAdminAccessConflicts(): Promise<AdminAccessConflict[]> {
    const admins = await this.prisma.adminAuthorizedStudent.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "asc" }, { studentNumber: "asc" }],
    });
    const studentNumbers = admins.map((admin) => admin.studentNumber);
    if (!studentNumbers.length) return [];

    const memberships = await this.prisma.teamMembership.findMany({
      where: { studentNumber: { in: studentNumbers } },
      select: {
        id: true,
        studentNumber: true,
        fullName: true,
        category: true,
        team: true,
        role: true,
        permissions: true,
        status: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    const membershipsByStudentNumber = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      if (!membership.studentNumber) continue;
      const list = membershipsByStudentNumber.get(membership.studentNumber) ?? [];
      list.push(membership);
      membershipsByStudentNumber.set(membership.studentNumber, list);
    }

    const conflicts: AdminAccessConflict[] = [];

    for (const admin of admins) {
      const relatedMemberships = membershipsByStudentNumber.get(admin.studentNumber) ?? [];
      const activeMemberships = relatedMemberships.filter((membership) => membership.status === "ACTIVE");
      const inactiveMemberships = relatedMemberships.filter((membership) => ["SUSPENDED", "REMOVED"].includes(membership.status));
      const isSuperAdmin = admin.role === "SUPER_ADMIN" || admin.permissions === "ALL";
      const adminPermissions = serializeAdminPermissions(admin.permissions);
      const officialMembership = activeMemberships.find((membership) => hasExplicitAdminPermissions(membership.permissions)) ?? null;

      if (!activeMemberships.length) {
        const blocked = inactiveMemberships.length > 0 && !isSuperAdmin;
        conflicts.push({
          studentNumber: admin.studentNumber,
          issue: blocked ? "BLOCKED_BY_INACTIVE_MEMBERSHIP" : "NO_ACTIVE_MEMBERSHIP",
          severity: blocked ? "HIGH" : "MEDIUM",
          accessBlocked: blocked,
          admin,
          memberships: inactiveMemberships.map(({ studentNumber: _studentNumber, ...membership }) => membership),
          effectiveSource: blocked ? "BLOCKED" : "ADMIN_AUTHORIZED_STUDENT",
        });
        continue;
      }

      if (
        officialMembership
        && !isSuperAdmin
        && (
          admin.team !== officialMembership.team
          || admin.role !== officialMembership.role
          || adminPermissions !== serializeAdminPermissions(officialMembership.permissions)
        )
      ) {
        conflicts.push({
          studentNumber: admin.studentNumber,
          issue: "OFFICIAL_MEMBERSHIP_PRECEDENCE",
          severity: "MEDIUM",
          accessBlocked: false,
          admin,
          memberships: activeMemberships.map(({ studentNumber: _studentNumber, ...membership }) => membership),
          effectiveSource: "TEAM_MEMBERSHIP",
        });
      }
    }

    return conflicts;
  }

  async isAdminAuthorized(studentNumber: string): Promise<boolean> {
    const existing = await this.prisma.adminAuthorizedStudent.findUnique({
      where: { studentNumber },
      select: { id: true, isActive: true },
    });

    return Boolean(existing?.isActive);
  }

  async authorizeAdminStudent(studentNumber: string, input: AdminAccessInput = {}): Promise<AdminAuthorizedStudent> {
    const role = normalizeAdminRole(input.role);
    const data = {
      team: input.team?.trim() || "Geral",
      role,
      permissions: role === "SUPER_ADMIN" ? "ALL" : serializeAdminPermissions(input.permissions),
      isActive: true,
      revokedAt: null,
      revokedByStudentNumber: null,
      revocationReason: null,
    };

    return this.prisma.adminAuthorizedStudent.upsert({
      where: { studentNumber },
      update: data,
      create: { studentNumber, ...data },
    });
  }

  async revokeAdminStudent(
    studentNumber: string,
    input: { revokedByStudentNumber?: string | null; reason?: string | null } = {},
  ): Promise<void> {
    await this.prisma.adminAuthorizedStudent.update({
      where: { studentNumber },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByStudentNumber: input.revokedByStudentNumber ?? null,
        revocationReason: input.reason?.trim() || "Revogado manualmente no painel de segurança.",
      },
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
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: { studentNumber: true },
    });
    if (!student) return;

    await this.prisma.$transaction([
      this.prisma.adminAuthorizedStudent.updateMany({
        where: { studentNumber: student.studentNumber },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revocationReason: "Estudante removido/desativado administrativamente.",
        },
      }),
      this.prisma.teamMembership.updateMany({
        where: { studentNumber: student.studentNumber },
        data: {
          status: "REMOVED",
          notes: "Vínculo removido por desativação administrativa do estudante.",
        },
      }),
      this.prisma.student.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletionReason: "Removido/desativado administrativamente. Histórico documental preservado.",
          lastLoginAt: null,
        },
      }),
    ]);
  }

  private mapProfile(profile?: StudentProfile) {
    // Converte o DTO opcional para o formato aceito pelo Prisma
    if (!profile) return {};
    return Object.fromEntries(Object.entries({
      name: profile.name,
      email: profile.email,
      course: profile.course,
      classCode: profile.classCode,
      academicYear: profile.academicYear,
      academicPeriod: profile.academicPeriod,
      curricularYear: profile.curricularYear,
      academicSyncedAt: profile.academicSyncedAt ? new Date(profile.academicSyncedAt) : undefined,
      nationality: profile.nationality,
      phone: profile.phone,
      alternatePhone: profile.alternatePhone,
      avatarUrl: profile.avatarUrl,
      university: profile.university,
      isUorStudent: profile.isUorStudent,
      registrationSource: profile.registrationSource,
      bio: profile.bio,
      address: profile.address,
      instagramUrl: profile.instagramUrl,
      facebookUrl: profile.facebookUrl,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      websiteUrl: profile.websiteUrl,
      profileCompletedAt: profile.profileCompletedAt ? new Date(profile.profileCompletedAt) : profile.profileCompletedAt,
      birthDate: profile.birthDate ? new Date(profile.birthDate) : undefined
    }).filter(([, value]) => value !== undefined));
  }

  private async touchLastLogin(studentId: number) {
    await this.prisma.student.update({
      where: { id: studentId },
      data: { lastLoginAt: new Date() }
    });
  }
}
