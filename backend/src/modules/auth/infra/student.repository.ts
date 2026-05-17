import { Prisma, PrismaClient, StudentLoginOrigin as PrismaStudentLoginOrigin } from "@prisma/client";
import {
  type AdminAccessConflict,
  type AdminAuthorizedStudent,
  type Student,
  type StudentActivityEvent,
  type StudentActivityProject,
  type StudentActivitySummary,
  type StudentPagedFacets,
  type StudentPagedStats,
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

const studentStatsCountSelect = Prisma.validator<Prisma.StudentCountOutputTypeSelect>()({
  likes: true,
  votes: true,
  comments: true,
  courseEnrollments: true,
  certificates: true,
  attendanceCheckIns: true,
  submissions: true,
  submissionMemberships: true,
  liveChatMessages: true,
  passportScans: true,
  passportPointLedger: true,
  passportChallengeAnswers: true,
  passportStudentBadges: true,
  passportSurpriseEffects: true,
  exhibitorVoteScoreEvents: true,
  exhibitorActorScoreEvents: true,
});

const studentPagedInclude = Prisma.validator<Prisma.StudentInclude>()({
  _count: {
    select: studentStatsCountSelect,
  },
  submissions: {
    select: {
      id: true,
      referenceCode: true,
      name: true,
      type: true,
      status: true,
      course: true,
      area: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 6,
  },
  submissionMemberships: {
    select: {
      id: true,
      confirmedAt: true,
      createdAt: true,
      submission: {
        select: {
          id: true,
          referenceCode: true,
          name: true,
          type: true,
          status: true,
          course: true,
          area: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ confirmedAt: "desc" }, { updatedAt: "desc" }],
    take: 6,
  },
  courseEnrollments: {
    select: {
      id: true,
      paymentStatus: true,
      createdAt: true,
      course: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
  },
  certificates: {
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      issuedAt: true,
    },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    take: 5,
  },
  attendanceCheckIns: {
    select: {
      id: true,
      eventLabel: true,
      checkedInAt: true,
      notes: true,
    },
    orderBy: [{ checkedInAt: "desc" }, { id: "desc" }],
    take: 5,
  },
  loginAudits: {
    select: {
      id: true,
      origin: true,
      loggedAt: true,
    },
    orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
    take: 4,
  },
  liveChatMessages: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      hiddenAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 4,
  },
  passportScans: {
    select: {
      id: true,
      result: true,
      pointsAwarded: true,
      message: true,
      scannedAt: true,
      mission: { select: { title: true } },
    },
    orderBy: [{ scannedAt: "desc" }, { id: "desc" }],
    take: 6,
  },
  passportPointLedger: {
    select: {
      id: true,
      sourceType: true,
      points: true,
      status: true,
      reason: true,
      awardedAt: true,
      mission: { select: { title: true } },
    },
    orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
    take: 6,
  },
  passportChallengeAnswers: {
    select: {
      id: true,
      correct: true,
      pointsAwarded: true,
      message: true,
      answeredAt: true,
      challenge: { select: { question: true } },
    },
    orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
    take: 5,
  },
  passportStudentBadges: {
    select: {
      id: true,
      awardedAt: true,
      badge: { select: { label: true } },
    },
    orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
    take: 5,
  },
  passportSurpriseEffects: {
    select: {
      id: true,
      effectType: true,
      effectValue: true,
      deltaPoints: true,
      status: true,
      message: true,
      appliedAt: true,
      surpriseQr: { select: { name: true, displayCode: true } },
    },
    orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
    take: 5,
  },
  exhibitorVoteScoreEvents: {
    select: {
      id: true,
      action: true,
      points: true,
      status: true,
      reason: true,
      awardedAt: true,
      submission: { select: { id: true, referenceCode: true, name: true, type: true } },
    },
    orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
    take: 6,
  },
  exhibitorActorScoreEvents: {
    select: {
      id: true,
      action: true,
      points: true,
      status: true,
      reason: true,
      awardedAt: true,
      submission: { select: { id: true, referenceCode: true, name: true, type: true } },
    },
    orderBy: [{ awardedAt: "desc" }, { id: "desc" }],
    take: 6,
  },
});

type StudentPagedRecord = Prisma.StudentGetPayload<{ include: typeof studentPagedInclude }>;

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
          select: studentStatsCountSelect,
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

    const [total, items, stats, facets] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: studentPagedInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.buildPagedStats(where),
      this.buildStudentFacets(),
    ]);

    return {
      items: items.map((student) => this.toStudentWithActivity(student)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats,
      facets,
    };
  }

  private withStudentWhere(where: Prisma.StudentWhereInput, extra: Prisma.StudentWhereInput): Prisma.StudentWhereInput {
    return { AND: [where, extra] };
  }

  private async buildPagedStats(where: Prisma.StudentWhereInput): Promise<StudentPagedStats> {
    const officialWhere = this.withStudentWhere(where, buildStudentAccessWhere("OFFICIAL"));
    const temporaryWhere = this.withStudentWhere(where, buildStudentAccessWhere("TEMPORARY"));
    const nonEmptyEmailWhere = this.withStudentWhere(where, { email: { not: null }, NOT: { email: "" } });
    const nonEmptyPhoneWhere = this.withStudentWhere(where, { phone: { not: null }, NOT: { phone: "" } });

    const [
      total,
      official,
      temporary,
      synced,
      profileComplete,
      withEmail,
      withPhone,
      universityRows,
    ] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.count({ where: officialWhere }),
      this.prisma.student.count({ where: temporaryWhere }),
      this.prisma.student.count({ where: this.withStudentWhere(where, { academicSyncedAt: { not: null } }) }),
      this.prisma.student.count({ where: this.withStudentWhere(where, { profileCompletedAt: { not: null } }) }),
      this.prisma.student.count({ where: nonEmptyEmailWhere }),
      this.prisma.student.count({ where: nonEmptyPhoneWhere }),
      this.prisma.student.findMany({
        where: this.withStudentWhere(where, { university: { not: null }, NOT: { university: "" } }),
        select: { university: true },
      }),
    ]);

    return {
      total,
      official,
      temporary,
      universities: new Set(universityRows.map((row) => row.university?.trim()).filter(Boolean)).size,
      synced,
      profileComplete,
      withEmail,
      withPhone,
    };
  }

  private async buildStudentFacets(): Promise<StudentPagedFacets> {
    const [courseRows, universityRows] = await Promise.all([
      this.prisma.student.findMany({
        where: { deletedAt: null, course: { not: null }, NOT: { course: "" } },
        select: { course: true },
      }),
      this.prisma.student.findMany({
        where: { deletedAt: null, university: { not: null }, NOT: { university: "" } },
        select: { university: true },
      }),
    ]);

    const normalize = (value?: string | null) => value?.trim() ?? "";
    const byPt = (left: string, right: string) => left.localeCompare(right, "pt");

    return {
      courses: Array.from(new Set(courseRows.map((row) => normalize(row.course)).filter(Boolean))).sort(byPt),
      universities: Array.from(new Set(universityRows.map((row) => normalize(row.university)).filter(Boolean))).sort(byPt),
    };
  }

  private toStudentWithActivity(student: StudentPagedRecord): StudentWithStats {
    const activitySummary = this.buildActivitySummary(student);
    const {
      submissions: _submissions,
      submissionMemberships: _submissionMemberships,
      courseEnrollments: _courseEnrollments,
      certificates: _certificates,
      attendanceCheckIns: _attendanceCheckIns,
      loginAudits: _loginAudits,
      liveChatMessages: _liveChatMessages,
      passportScans: _passportScans,
      passportPointLedger: _passportPointLedger,
      passportChallengeAnswers: _passportChallengeAnswers,
      passportStudentBadges: _passportStudentBadges,
      passportSurpriseEffects: _passportSurpriseEffects,
      exhibitorVoteScoreEvents: _exhibitorVoteScoreEvents,
      exhibitorActorScoreEvents: _exhibitorActorScoreEvents,
      ...profile
    } = student;

    void _submissions;
    void _submissionMemberships;
    void _courseEnrollments;
    void _certificates;
    void _attendanceCheckIns;
    void _loginAudits;
    void _liveChatMessages;
    void _passportScans;
    void _passportPointLedger;
    void _passportChallengeAnswers;
    void _passportStudentBadges;
    void _passportSurpriseEffects;
    void _exhibitorVoteScoreEvents;
    void _exhibitorActorScoreEvents;

    return {
      ...profile,
      activitySummary,
    } as StudentWithStats;
  }

  private buildActivitySummary(student: StudentPagedRecord): StudentActivitySummary {
    const projectMap = new Map<number, StudentActivityProject>();
    const addProject = (project: StudentActivityProject) => {
      const existing = projectMap.get(project.id);
      if (!existing || existing.role !== "RESPONSAVEL") {
        projectMap.set(project.id, project);
      }
    };

    for (const submission of student.submissions) {
      addProject({
        id: submission.id,
        referenceCode: submission.referenceCode,
        name: submission.name,
        type: String(submission.type),
        status: String(submission.status),
        role: "RESPONSAVEL",
        course: submission.course,
        area: submission.area,
        createdAt: submission.createdAt,
        confirmedAt: null,
      });
    }

    for (const membership of student.submissionMemberships) {
      addProject({
        id: membership.submission.id,
        referenceCode: membership.submission.referenceCode,
        name: membership.submission.name,
        type: String(membership.submission.type),
        status: String(membership.submission.status),
        role: "MEMBRO",
        course: membership.submission.course,
        area: membership.submission.area,
        createdAt: membership.submission.createdAt,
        confirmedAt: membership.confirmedAt,
      });
    }

    const projects = Array.from(projectMap.values()).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const recentEvents: StudentActivityEvent[] = [];

    for (const audit of student.loginAudits) {
      recentEvents.push({
        id: `login-${audit.id}`,
        type: "AUTH",
        title: audit.origin === "CONVENTIONAL" ? "Login temporário" : "Login oficial",
        description: "Entrada registada na plataforma.",
        happenedAt: audit.loggedAt,
      });
    }

    for (const project of projects) {
      recentEvents.push({
        id: `submission-${project.id}-${project.role}`,
        type: project.type === "BUSINESS" ? "BUSINESS" : project.type === "PRODUCT" ? "PRODUCT" : "PROJECT",
        title: project.role === "RESPONSAVEL" ? `Responsável por ${project.name}` : `Membro de ${project.name}`,
        description: project.area ?? project.course ?? null,
        status: project.status,
        happenedAt: project.confirmedAt ?? project.createdAt,
      });
    }

    for (const enrollment of student.courseEnrollments) {
      recentEvents.push({
        id: `course-${enrollment.id}`,
        type: "COURSE",
        title: `Inscrição em ${enrollment.course.name}`,
        status: enrollment.paymentStatus,
        happenedAt: enrollment.createdAt,
      });
    }

    for (const certificate of student.certificates) {
      recentEvents.push({
        id: `certificate-${certificate.id}`,
        type: "CERTIFICATE",
        title: certificate.title,
        description: certificate.type,
        status: certificate.status,
        happenedAt: certificate.issuedAt,
      });
    }

    for (const checkIn of student.attendanceCheckIns) {
      recentEvents.push({
        id: `attendance-${checkIn.id}`,
        type: "ATTENDANCE",
        title: `Check-in: ${checkIn.eventLabel}`,
        description: checkIn.notes,
        happenedAt: checkIn.checkedInAt,
      });
    }

    for (const scan of student.passportScans) {
      recentEvents.push({
        id: `passport-scan-${scan.id}`,
        type: "DIGITAL_PASSPORT",
        title: scan.mission?.title ? `QR do passaporte: ${scan.mission.title}` : "QR do passaporte digital",
        description: scan.message,
        status: scan.result,
        points: scan.pointsAwarded,
        happenedAt: scan.scannedAt,
      });
    }

    for (const ledger of student.passportPointLedger) {
      recentEvents.push({
        id: `passport-ledger-${ledger.id}`,
        type: "DIGITAL_PASSPORT",
        title: ledger.mission?.title ?? "Pontuação no passaporte digital",
        description: ledger.reason ?? ledger.sourceType,
        status: ledger.status,
        points: ledger.points,
        happenedAt: ledger.awardedAt,
      });
    }

    for (const answer of student.passportChallengeAnswers) {
      recentEvents.push({
        id: `passport-answer-${answer.id}`,
        type: "DIGITAL_PASSPORT",
        title: answer.correct ? "Resposta correta no desafio" : "Resposta registada no desafio",
        description: answer.challenge.question,
        status: answer.correct ? "CORRETA" : "INCORRETA",
        points: answer.pointsAwarded,
        happenedAt: answer.answeredAt,
      });
    }

    for (const badge of student.passportStudentBadges) {
      recentEvents.push({
        id: `passport-badge-${badge.id}`,
        type: "DIGITAL_PASSPORT",
        title: `Selo desbloqueado: ${badge.badge.label}`,
        happenedAt: badge.awardedAt,
      });
    }

    for (const surprise of student.passportSurpriseEffects) {
      recentEvents.push({
        id: `passport-surprise-${surprise.id}`,
        type: "DIGITAL_PASSPORT",
        title: surprise.surpriseQr?.displayCode
          ? `QR surpresa ${surprise.surpriseQr.displayCode}`
          : surprise.surpriseQr?.name ?? "QR surpresa",
        description: surprise.message ?? surprise.effectType,
        status: surprise.status,
        points: surprise.deltaPoints,
        happenedAt: surprise.appliedAt,
      });
    }

    for (const event of [...student.exhibitorActorScoreEvents, ...student.exhibitorVoteScoreEvents]) {
      recentEvents.push({
        id: `exhibitor-score-${event.id}`,
        type: "EXHIBITOR_CHALLENGE",
        title: `${event.action} em ${event.submission.name}`,
        description: event.reason ?? event.submission.referenceCode,
        status: event.status,
        points: Math.round(event.points),
        happenedAt: event.awardedAt,
      });
    }

    for (const message of student.liveChatMessages) {
      recentEvents.push({
        id: `live-chat-${message.id}`,
        type: "LIVE_CHAT",
        title: message.hiddenAt ? "Mensagem ocultada no Ao Vivo" : "Mensagem no Ao Vivo",
        description: message.content,
        status: message.hiddenAt ? "OCULTA" : "VISÍVEL",
        happenedAt: message.createdAt,
      });
    }

    return {
      projects: projects.filter((project) => project.type === "PROJECT"),
      businesses: projects.filter((project) => project.type === "BUSINESS"),
      products: projects.filter((project) => project.type === "PRODUCT"),
      courses: student.courseEnrollments.map((enrollment) => ({
        id: enrollment.id,
        name: enrollment.course.name,
        paymentStatus: enrollment.paymentStatus,
        createdAt: enrollment.createdAt,
      })),
      challenges: {
        digitalPassportEvents:
          student._count.passportScans
          + student._count.passportPointLedger
          + student._count.passportChallengeAnswers
          + student._count.passportSurpriseEffects,
        exhibitorEvents: student._count.exhibitorActorScoreEvents + student._count.exhibitorVoteScoreEvents,
        badges: student._count.passportStudentBadges,
      },
      recentEvents: recentEvents
        .sort((left, right) => right.happenedAt.getTime() - left.happenedAt.getTime())
        .slice(0, 10),
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
