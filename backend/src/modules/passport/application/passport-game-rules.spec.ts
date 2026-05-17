import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerPassportChallenge,
  canAcceptPassportReferralInvite,
  awardPassportForQrActionScan,
  createPassportReferralCode,
  defaultPassportMissionKeyForQrAction,
  ensurePassportCatalog,
  getPassportSummary,
  recordPassportConstructiveFeedback,
  recordPassportReferralJoin,
  recordPassportParticipation,
  resetPassportChallengeProgress,
  syncPassportFromExistingActivity,
} from "./passport.service";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((callback) => callback(prismaMock)),
  passportMission: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  passportBadge: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  passportStudentBadge: {
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  passportPointLedger: {
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  passportScan: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  passportChallenge: {
    deleteMany: vi.fn(),
    findUnique: vi.fn(),
  },
  passportChallengeAnswer: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  passportSurpriseQr: {
    findUnique: vi.fn(),
  },
  passportSurpriseEffectLedger: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  qrAction: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  qrActionScan: {
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  passportRankingFreeze: {
    deleteMany: vi.fn(),
  },
  attendanceCheckIn: {
    findMany: vi.fn(),
  },
  submission: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
  },
  studentComment: {
    create: vi.fn(),
  },
}));

vi.mock("../../../shared/prisma", () => ({
  prisma: prismaMock,
}));

const student = {
  id: 12,
  studentNumber: "20240001",
  name: "Ana UOR",
  course: "Engenharia",
  academicSyncedAt: new Date("2026-05-01T10:00:00.000Z"),
  registrationSource: null,
};

const challenge = {
  id: 3001,
  missionId: 44,
  qrActionId: 909,
  type: "EXHIBITOR_CHALLENGE",
  question: "Qual problema o projeto resolve?",
  optionsJson: JSON.stringify(["Filas", "Clima"]),
  correctAnswerHash: "b170b8134f71fbc692d47bcbd0d1b1f89db1df2f98749710f93d7692165ba312",
  explanation: null,
  maxAttempts: 2,
  active: true,
  startsAt: null,
  endsAt: null,
  version: 1,
};

describe("passport game rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.passportMission.upsert.mockImplementation(({ create }) =>
      Promise.resolve({
        id: create.key === "exhibitor-challenge" ? 44 : create.key === "nucleus-member-bonus" ? 55 : 1,
        ...create,
      }),
    );
    prismaMock.passportBadge.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: create.key === "discreet-hunter" ? 88 : 1, ...create }),
    );
    prismaMock.passportBadge.findMany.mockResolvedValue([]);
    prismaMock.passportMission.findUnique.mockImplementation(({ where }) => {
      if (where.key === "accept-challenge") {
        return Promise.resolve({
          id: 33,
          key: "accept-challenge",
          active: true,
          points: 10,
          title: "Aceitar o desafio",
        });
      }
      if (where.key === "exhibitor-challenge") {
        return Promise.resolve({
          id: 44,
          key: "exhibitor-challenge",
          active: true,
          points: 15,
          title: "Desafio do expositor",
        });
      }
      if (where.key === "stand-visit") {
        return Promise.resolve({
          id: 45,
          key: "stand-visit",
          active: true,
          points: 10,
          title: "Visita a stand",
        });
      }
      if (where.key === "nucleus-member-bonus") {
        return Promise.resolve({
          id: 55,
          key: "nucleus-member-bonus",
          active: true,
          points: 10,
          title: "Bónus Núcleo",
        });
      }
      if (where.key === "fair-surprise") {
        return Promise.resolve({
          id: 66,
          key: "fair-surprise",
          active: true,
          points: 0,
          title: "Caça aos QR",
        });
      }
      if (where.key === "constructive-feedback") {
        return Promise.resolve({
          id: 67,
          key: "constructive-feedback",
          active: true,
          points: 15,
          title: "Crítica construtiva",
        });
      }
      if (where.key === "affiliate-invite") {
        return Promise.resolve({
          id: 77,
          key: "affiliate-invite",
          active: true,
          points: 5,
          title: "Convidar colegas",
        });
      }
      return Promise.resolve(null);
    });
    prismaMock.passportMission.findMany.mockResolvedValue([]);
    prismaMock.passportPointLedger.findUnique.mockResolvedValue(null);
    prismaMock.passportPointLedger.findFirst.mockResolvedValue(null);
    prismaMock.passportPointLedger.findMany.mockResolvedValue([]);
    prismaMock.passportPointLedger.groupBy.mockResolvedValue([]);
    prismaMock.passportPointLedger.aggregate.mockResolvedValue({ _sum: { points: 0 } });
    prismaMock.passportPointLedger.count.mockResolvedValue(0);
    prismaMock.passportPointLedger.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data }),
    );
    prismaMock.passportPointLedger.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: 2, ...create }),
    );
    prismaMock.passportPointLedger.deleteMany.mockResolvedValue({ count: 8 });
    prismaMock.passportScan.deleteMany.mockResolvedValue({ count: 6 });
    prismaMock.passportScan.findMany.mockResolvedValue([]);
    prismaMock.passportScan.upsert.mockResolvedValue({ id: 1 });
    prismaMock.passportStudentBadge.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.passportStudentBadge.upsert.mockResolvedValue({ id: 1 });
    prismaMock.passportChallenge.findUnique.mockResolvedValue(challenge);
    prismaMock.passportChallengeAnswer.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.passportChallengeAnswer.findMany.mockResolvedValue([]);
    prismaMock.passportChallengeAnswer.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 1, ...data }),
    );
    prismaMock.qrAction.findMany.mockResolvedValue([{ id: 501 }, { id: 502 }]);
    prismaMock.qrAction.findUnique.mockResolvedValue({
      id: 909,
      type: "EXHIBITOR_CHALLENGE",
      targetId: 77,
      targetMeta: JSON.stringify({ submissionId: 77 }),
    });
    prismaMock.qrActionScan.deleteMany.mockResolvedValue({ count: 5 });
    prismaMock.qrActionScan.findMany.mockResolvedValue([]);
    prismaMock.qrActionScan.findFirst.mockResolvedValue({
      id: 7001,
      result: "SUCCESS",
      scannedAt: new Date("2026-05-10T10:00:00.000Z"),
    });
    prismaMock.submission.findFirst.mockResolvedValue({
      id: 77,
      name: "Smart Campus",
      studentNumberSnapshot: "20240009",
      student: { studentNumber: "20240009" },
      memberConfirmations: [],
      area: "Tecnologia",
    });
    prismaMock.passportSurpriseQr.findUnique.mockResolvedValue(null);
    prismaMock.passportSurpriseEffectLedger.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.passportSurpriseEffectLedger.findMany.mockResolvedValue([]);
    prismaMock.passportSurpriseEffectLedger.findUnique.mockResolvedValue(null);
    prismaMock.passportSurpriseEffectLedger.count.mockResolvedValue(0);
    prismaMock.passportSurpriseEffectLedger.aggregate.mockResolvedValue({ _sum: { deltaPoints: 0 } });
    prismaMock.passportSurpriseEffectLedger.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 3, ...data }),
    );
    prismaMock.passportRankingFreeze.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.attendanceCheckIn.findMany.mockResolvedValue([]);
    prismaMock.studentComment.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 9001,
        ...data,
        createdAt: new Date("2026-05-16T09:00:00.000Z"),
        student: {
          id: student.id,
          studentNumber: student.studentNumber,
          name: student.name,
          course: student.course,
        },
      }),
    );
  });

  it("registers nucleus member bonus as a first-class mission and QR action type", async () => {
    await ensurePassportCatalog();

    expect(defaultPassportMissionKeyForQrAction("NUCLEUS_MEMBER_BONUS")).toBe(
      "nucleus-member-bonus",
    );
    expect(prismaMock.passportMission.upsert).toHaveBeenCalledWith({
      where: { key: "nucleus-member-bonus" },
      update: expect.objectContaining({
        type: "NUCLEUS_MEMBER_BONUS",
        title: "Pontos Núcleo",
        points: 10,
      }),
      create: expect.objectContaining({
        key: "nucleus-member-bonus",
        type: "NUCLEUS_MEMBER_BONUS",
        title: "Pontos Núcleo",
        points: 10,
      }),
    });
  });

  it("keeps the challenge map complete with more than eleven default missions", async () => {
    await ensurePassportCatalog();

    const missionCreates = prismaMock.passportMission.upsert.mock.calls.map(
      ([payload]) => payload.create,
    );
    const missionKeys = missionCreates.map((mission) => mission.key);

    expect(missionCreates.length).toBeGreaterThan(11);
    expect(missionKeys).toEqual(
      expect.arrayContaining([
        "accept-challenge",
        "affiliate-invite",
        "event-checkin",
        "workshop-checkin",
        "workshop-master-combo",
        "stand-visit",
        "stand-explorer-combo",
        "exhibitor-challenge",
        "constructive-feedback",
        "cross-course-networking",
        "networking-triad-combo",
        "nucleus-member-bonus",
        "fair-surprise",
        "point-battle",
        "clue-chain",
        "cooperative-mission",
        "smart-recovery",
        "journey-complete",
      ]),
    );
    expect(missionKeys.indexOf("affiliate-invite")).toBe(
      missionKeys.indexOf("accept-challenge") + 1,
    );
    expect(missionKeys.indexOf("event-checkin")).toBe(
      missionKeys.indexOf("affiliate-invite") + 1,
    );
    expect(defaultPassportMissionKeyForQrAction("POINT_BATTLE_QR")).toBe("point-battle");
    expect(defaultPassportMissionKeyForQrAction("CLUE_CHAIN_QR")).toBe("clue-chain");
    expect(defaultPassportMissionKeyForQrAction("COOPERATIVE_MISSION_QR")).toBe("cooperative-mission");
    expect(defaultPassportMissionKeyForQrAction("RECOVERY_SMART_QR")).toBe("smart-recovery");
  });

  it("awards digital passport points for constructive feedback on three different projects", async () => {
    prismaMock.student.findUnique.mockResolvedValue(student);
    prismaMock.passportPointLedger.findUnique.mockImplementation(({ where }) => {
      if (where.businessKey === `passport-participation:${student.studentNumber}`) {
        return Promise.resolve({
          id: 9,
          businessKey: `passport-participation:${student.studentNumber}`,
          studentId: student.id,
          studentNumber: student.studentNumber,
          sourceType: "PASSPORT_JOIN",
          sourceId: "minha-area-desafio",
          points: 10,
          status: "VALID",
          awardedAt: new Date("2026-05-16T08:00:00.000Z"),
        });
      }
      return Promise.resolve(null);
    });
    prismaMock.submission.findFirst.mockResolvedValue({
      id: 77,
      name: "Smart Campus",
      status: "APPROVED",
      deletedAt: null,
      studentId: 99,
      studentNumberSnapshot: "20249999",
      student: { studentNumber: "20249999" },
      memberConfirmations: [],
    });
    prismaMock.passportPointLedger.count.mockResolvedValue(3);

    const result = await recordPassportConstructiveFeedback({
      studentId: student.id,
      submissionId: 77,
      content:
        "O projeto está claro, mas ficaria mais forte se explicasse melhor o impacto real, os custos de operação e como será validado com estudantes durante a feira.",
      focus: "impacto",
    });

    expect(result.status).toBe("AWARDED");
    expect(result.pointsAwarded).toBe(5);
    expect(result.completedCount).toBe(3);
    expect(result.missionCompleted).toBe(true);
    expect(prismaMock.studentComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: student.id,
        submissionId: 77,
        content: expect.stringContaining("O projeto está claro"),
      }),
      include: expect.objectContaining({
        student: expect.any(Object),
      }),
    });
    expect(prismaMock.passportPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: student.id,
        studentNumber: student.studentNumber,
        missionId: 67,
        sourceType: "CONSTRUCTIVE_FEEDBACK",
        sourceId: "submission:77",
        points: 5,
        reason: expect.stringContaining("Smart Campus"),
      }),
    });
  });

  it("does not award constructive feedback points for the student's own project", async () => {
    prismaMock.student.findUnique.mockResolvedValue(student);
    prismaMock.passportPointLedger.findUnique.mockImplementation(({ where }) => {
      if (where.businessKey === `passport-participation:${student.studentNumber}`) {
        return Promise.resolve({ id: 9, status: "VALID" });
      }
      return Promise.resolve(null);
    });
    prismaMock.submission.findFirst.mockResolvedValue({
      id: 77,
      name: "Projeto da Ana",
      status: "APPROVED",
      deletedAt: null,
      studentId: student.id,
      studentNumberSnapshot: student.studentNumber,
      student: { studentNumber: student.studentNumber },
      memberConfirmations: [],
    });

    const result = await recordPassportConstructiveFeedback({
      studentId: student.id,
      submissionId: 77,
      content:
        "A apresentação tem pontos interessantes, mas precisa mostrar melhor o problema, a validação com utilizadores e os próximos passos para execução.",
    });

    expect(result.status).toBe("OWN_PROJECT");
    expect(result.pointsAwarded).toBe(0);
    expect(prismaMock.studentComment.create).not.toHaveBeenCalled();
    expect(prismaMock.passportPointLedger.create).not.toHaveBeenCalled();
  });

  it("awards accepting the challenge as a first-class passport mission", async () => {
    prismaMock.student.findUnique.mockResolvedValue(student);

    await recordPassportParticipation({ studentId: student.id });

    expect(prismaMock.passportPointLedger.upsert).toHaveBeenCalledWith({
      where: { businessKey: `passport-participation:${student.studentNumber}` },
      update: expect.objectContaining({
        studentNumber: student.studentNumber,
        missionId: 33,
        sourceType: "PASSPORT_JOIN",
        points: 10,
      }),
      create: expect.objectContaining({
        missionId: 33,
        sourceType: "PASSPORT_JOIN",
        sourceId: "minha-area-desafio",
        points: 10,
      }),
    });
  });

  it("keeps accepting the challenge complete when the participation ledger exists", async () => {
    const awardedAt = new Date("2026-05-11T14:02:01.785Z");
    prismaMock.student.findUnique.mockResolvedValue(student);
    prismaMock.passportMission.findMany.mockResolvedValue([
      {
        id: 33,
        key: "accept-challenge",
        type: "PASSPORT_JOIN",
        title: "Aceitar o desafio",
        description: "Ativa o Passaporte Digital.",
        points: 10,
        active: true,
      },
    ]);
    prismaMock.passportPointLedger.findUnique.mockImplementation(({ where }) => {
      if (where.businessKey === `passport-participation:${student.studentNumber}`) {
        return Promise.resolve({
          id: 9,
          businessKey: `passport-participation:${student.studentNumber}`,
          studentId: student.id,
          studentNumber: student.studentNumber,
          studentName: student.name,
          studentCourse: student.course,
          missionId: null,
          sourceType: "PASSPORT_JOIN",
          sourceId: "minha-area-desafio",
          points: 10,
          status: "VALID",
          awardedAt,
        });
      }
      return Promise.resolve(null);
    });
    prismaMock.passportPointLedger.findMany.mockResolvedValue([]);
    prismaMock.passportPointLedger.count.mockResolvedValue(1);

    const summary = await getPassportSummary(student.id);
    const acceptMission = summary?.missions.find(
      (mission) => mission.key === "accept-challenge",
    );

    expect(summary?.joinedAt).toBe(awardedAt.toISOString());
    expect(summary?.points).toBe(10);
    expect(acceptMission).toEqual(
      expect.objectContaining({
        key: "accept-challenge",
        status: "done",
        completions: 1,
        pointsEarned: 10,
        completedAt: awardedAt.toISOString(),
      }),
    );
  });

  it("awards referral points to the inviter only when the invited student joins", async () => {
    const referrer = {
      id: 21,
      studentNumber: "20240021",
      name: "Carlos Mentor",
      course: "Engenharia",
      phone: "937624785",
      profileExtra: { consentSms: true },
    };
    const invitee = student;
    const code = createPassportReferralCode(
      referrer.studentNumber,
      "super-secret-passport-referral",
    );
    const sendSms = vi
      .fn()
      .mockResolvedValue({ ok: true, providerMessageId: "sms-10" });

    prismaMock.student.findUnique.mockImplementation(({ where }) => {
      if (where.id === invitee.id) return Promise.resolve(invitee);
      if (where.studentNumber === referrer.studentNumber)
        return Promise.resolve(referrer);
      return Promise.resolve(null);
    });
    prismaMock.passportPointLedger.findFirst.mockResolvedValue(null);
    prismaMock.passportPointLedger.count.mockResolvedValue(10);

    const result = await recordPassportReferralJoin({
      inviteeStudentId: invitee.id,
      referralCode: code,
      secret: "super-secret-passport-referral",
      sendSms,
    });

    expect(result.status).toBe("AWARDED");
    expect(result.pointsAwarded).toBe(5);
    expect(prismaMock.passportPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: referrer.id,
        studentNumber: referrer.studentNumber,
        studentName: referrer.name,
        studentCourse: referrer.course,
        missionId: 77,
        sourceType: "PASSPORT_REFERRAL",
        sourceId: invitee.studentNumber,
        points: 5,
      }),
    });
    expect(sendSms).toHaveBeenCalledWith({
      to: "937624785",
      message: expect.stringContaining("+10 pessoas"),
    });
    expect(prismaMock.passportPointLedger.upsert).toHaveBeenCalledWith({
      where: {
        businessKey: `passport-referral-sms:${referrer.studentNumber}:10`,
      },
      update: expect.objectContaining({ metadataJson: expect.any(String) }),
      create: expect.objectContaining({
        businessKey: `passport-referral-sms:${referrer.studentNumber}:10`,
        studentNumber: referrer.studentNumber,
        sourceType: "PASSPORT_REFERRAL_SMS",
        sourceId: "10",
        points: 0,
      }),
    });
  });

  it("allows referral invite login only for students validated by UOR academic data", () => {
    expect(
      canAcceptPassportReferralInvite({
        academicSyncedAt: new Date("2026-05-01T10:00:00.000Z"),
        registrationSource: null,
        isUorStudent: null,
      }),
    ).toBe(true);

    expect(
      canAcceptPassportReferralInvite({
        academicSyncedAt: null,
        registrationSource: "SECRETARIA",
        isUorStudent: true,
      }),
    ).toBe(true);

    expect(
      canAcceptPassportReferralInvite({
        academicSyncedAt: null,
        registrationSource: null,
        isUorStudent: true,
      }),
    ).toBe(true);

    expect(
      canAcceptPassportReferralInvite({
        academicSyncedAt: null,
        registrationSource: "CONVENTIONAL_SMS",
        isUorStudent: true,
      }),
    ).toBe(false);

    expect(
      canAcceptPassportReferralInvite({
        academicSyncedAt: null,
        registrationSource: " conventional_sms ",
        isUorStudent: true,
      }),
    ).toBe(false);
  });

  it("does not award referral points when the invitee entered through SMS registration", async () => {
    const referrer = {
      id: 21,
      studentNumber: "20240021",
      name: "Carlos Mentor",
      course: "Engenharia",
      phone: "937624785",
      profileExtra: { consentSms: true },
    };
    const smsInvitee = {
      ...student,
      academicSyncedAt: null,
      registrationSource: "CONVENTIONAL_SMS",
      isUorStudent: true,
    };

    prismaMock.student.findUnique.mockImplementation(({ where }) => {
      if (where.id === smsInvitee.id) return Promise.resolve(smsInvitee);
      if (where.studentNumber === referrer.studentNumber)
        return Promise.resolve(referrer);
      return Promise.resolve(null);
    });

    const result = await recordPassportReferralJoin({
      inviteeStudentId: smsInvitee.id,
      referralCode: createPassportReferralCode(
        referrer.studentNumber,
        "super-secret-passport-referral",
      ),
      secret: "super-secret-passport-referral",
    });

    expect(result.status).toBe("INVITEE_NOT_UOR_STUDENT");
    expect(prismaMock.passportPointLedger.create).not.toHaveBeenCalled();
  });

  it("does not award referral points for self invites or duplicated invitees", async () => {
    const selfCode = createPassportReferralCode(
      student.studentNumber,
      "super-secret-passport-referral",
    );

    prismaMock.student.findUnique.mockImplementation(({ where }) => {
      if (where.id === student.id) return Promise.resolve(student);
      if (where.studentNumber === student.studentNumber)
        return Promise.resolve(student);
      return Promise.resolve(null);
    });

    const selfResult = await recordPassportReferralJoin({
      inviteeStudentId: student.id,
      referralCode: selfCode,
      secret: "super-secret-passport-referral",
    });

    expect(selfResult.status).toBe("SELF_REFERRAL");
    expect(prismaMock.passportPointLedger.create).not.toHaveBeenCalled();

    prismaMock.student.findUnique.mockImplementation(({ where }) => {
      if (where.id === student.id) return Promise.resolve(student);
      if (where.studentNumber === "20240021") {
        return Promise.resolve({
          id: 21,
          studentNumber: "20240021",
          name: "Carlos Mentor",
          course: "Engenharia",
          phone: "937624785",
          profileExtra: { consentSms: true },
        });
      }
      return Promise.resolve(null);
    });
    prismaMock.passportPointLedger.findFirst.mockResolvedValueOnce({
      id: 90,
      sourceType: "PASSPORT_REFERRAL",
      sourceId: student.studentNumber,
    });

    const duplicateResult = await recordPassportReferralJoin({
      inviteeStudentId: student.id,
      referralCode: createPassportReferralCode(
        "20240021",
        "super-secret-passport-referral",
      ),
      secret: "super-secret-passport-referral",
    });

    expect(duplicateResult.status).toBe("ALREADY_REFERRED");
    expect(prismaMock.passportPointLedger.create).not.toHaveBeenCalled();
  });

  it("requires a previous exhibitor QR scan before challenge answers can score", async () => {
    prismaMock.qrActionScan.findFirst.mockResolvedValue(null);

    const result = await answerPassportChallenge({
      challengeId: challenge.id,
      student,
      answer: "Filas",
    });

    expect(result.status).toBe("CHALLENGE_SCAN_REQUIRED");
    expect(result.pointsAwarded).toBe(0);
    expect(prismaMock.passportChallengeAnswer.create).not.toHaveBeenCalled();
  });

  it("blocks project owners and confirmed members from scoring their own challenge", async () => {
    prismaMock.submission.findFirst.mockResolvedValue({
      id: 77,
      name: "Smart Campus",
      studentNumberSnapshot: "20240009",
      student: { studentNumber: "20240009" },
      memberConfirmations: [{ studentNumber: student.studentNumber }],
      area: "Tecnologia",
    });

    const result = await answerPassportChallenge({
      challengeId: challenge.id,
      student,
      answer: "Filas",
    });

    expect(result.status).toBe("SELF_CHALLENGE");
    expect(result.pointsAwarded).toBe(0);
    expect(prismaMock.passportChallengeAnswer.create).not.toHaveBeenCalled();
  });

  it("does not score exhibitor challenges whose project was removed", async () => {
    prismaMock.submission.findFirst.mockResolvedValue(null);

    const result = await answerPassportChallenge({
      challengeId: challenge.id,
      student,
      answer: "Filas",
    });

    expect(result.status).toBe("PROJECT_UNAVAILABLE");
    expect(result.pointsAwarded).toBe(0);
    expect(prismaMock.passportChallengeAnswer.create).not.toHaveBeenCalled();
  });

  it("does not award stand visits for removed projects", async () => {
    prismaMock.submission.findFirst.mockResolvedValue(null);

    const result = await awardPassportForQrActionScan({
      student,
      action: {
        id: 601,
        type: "STAND_VISIT",
        label: "Stand: Smart Campus",
        targetId: 77,
        targetMeta: JSON.stringify({ submissionId: 77 }),
        eventKey: "submission:77",
        eventLabel: "Smart Campus",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 7004,
        result: "SUCCESS",
        message: "Stand validado.",
        scannedAt: new Date("2026-05-10T10:15:00.000Z"),
      },
    });

    expect(result.result).toBe("PROJECT_UNAVAILABLE");
    expect(result.pointsAwarded).toBe(0);
    expect(prismaMock.passportPointLedger.create).not.toHaveBeenCalled();
  });

  it("awards nucleus member bonus once per scanned member credential", async () => {
    const result = await awardPassportForQrActionScan({
      student,
      action: {
        id: 501,
        type: "NUCLEUS_MEMBER_BONUS",
        label: "Passe Núcleo: Mentor",
        targetId: 900,
        targetMeta: JSON.stringify({
          credentialId: 900,
          memberStudentNumber: "20249999",
          memberName: "Mentor UOR",
          memberRole: "Mentor",
        }),
        eventKey: "team-credential:900",
        eventLabel: "Núcleo UOR Connect",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 7002,
        result: "SUCCESS",
        message: "Passe de membro do núcleo validado.",
        scannedAt: new Date("2026-05-10T10:05:00.000Z"),
      },
    });

    expect(result.result).toBe("SUCCESS");
    expect(result.pointsAwarded).toBe(10);
    expect(prismaMock.passportPointLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: "NUCLEUS_MEMBER",
        sourceId: "credential:900",
        points: 10,
      }),
    });
  });

  it("awards the discreet hunter badge after a secret surprise QR discovery", async () => {
    prismaMock.passportSurpriseQr.findUnique.mockResolvedValue({
      id: 80,
      qrActionId: 502,
      name: "Sinal secreto",
      description: "Pista escondida",
      effectType: "ADD_POINTS",
      effectValue: 12,
      targetScope: "SURPRISE_BONUS",
      rarity: "SECRET",
      visibility: "SECRET",
      maxUsesTotal: null,
      maxUsesPerStudent: 1,
      negativeCapPerStudent: null,
      active: true,
      startsAt: null,
      endsAt: null,
    });
    prismaMock.passportPointLedger.findMany.mockResolvedValue([
      { mission: { key: "fair-surprise" } },
    ]);
    prismaMock.passportSurpriseEffectLedger.count.mockImplementation(({ where }) =>
      Promise.resolve(where.surpriseQr ? 1 : 0),
    );

    const result = await awardPassportForQrActionScan({
      student,
      action: {
        id: 502,
        type: "FAIR_BONUS_QR",
        label: "Sinal secreto",
        targetId: null,
        targetMeta: JSON.stringify({ rarity: "SECRET", visibility: "SECRET" }),
        eventKey: "passport-surprise",
        eventLabel: "Caça aos QR",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 7003,
        result: "SUCCESS",
        message: "QR surpresa validado.",
        scannedAt: new Date("2026-05-10T10:10:00.000Z"),
      },
    });

    expect(result.result).toBe("SURPRISE_APPLIED");
    expect(prismaMock.passportStudentBadge.upsert).toHaveBeenCalledWith({
      where: {
        studentNumber_badgeId: {
          studentNumber: student.studentNumber,
          badgeId: 88,
        },
      },
      update: expect.objectContaining({
        studentId: student.id,
      }),
      create: expect.objectContaining({
        studentNumber: student.studentNumber,
        badgeId: 88,
      }),
    });
  });

  it("subtracts QR de risco from the student's total passport points, not a separate bonus balance", async () => {
    prismaMock.passportPointLedger.aggregate.mockResolvedValue({ _sum: { points: 50 } });
    prismaMock.passportSurpriseQr.findUnique.mockResolvedValue({
      id: 81,
      qrActionId: 503,
      name: "QR de risco",
      description: "Teste de penalização",
      effectType: "SUBTRACT_POINTS",
      effectValue: 10,
      targetScope: "SURPRISE_BONUS",
      rarity: "COMMON",
      visibility: "VISIBLE",
      maxUsesTotal: null,
      maxUsesPerStudent: 1,
      negativeCapPerStudent: null,
      active: true,
      startsAt: null,
      endsAt: null,
    });

    const result = await awardPassportForQrActionScan({
      student,
      action: {
        id: 503,
        type: "FAIR_PENALTY_QR",
        label: "QR de risco",
        targetId: null,
        targetMeta: JSON.stringify({ rarity: "COMMON", visibility: "VISIBLE" }),
        eventKey: "passport-surprise",
        eventLabel: "Caça aos QR",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 7005,
        result: "SUCCESS",
        message: "QR surpresa validado.",
        scannedAt: new Date("2026-05-10T10:20:00.000Z"),
      },
    });

    expect(result.result).toBe("SURPRISE_APPLIED");
    expect(result.pointsAwarded).toBe(-10);
    expect(prismaMock.passportPointLedger.aggregate).toHaveBeenCalledWith({
      where: {
        studentNumber: student.studentNumber,
        status: "VALID",
      },
      _sum: { points: true },
    });
    expect(prismaMock.passportSurpriseEffectLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        beforePoints: 50,
        afterPoints: 40,
        deltaPoints: -10,
      }),
    });
    expect(prismaMock.passportPointLedger.upsert).toHaveBeenCalledWith({
      where: {
        businessKey: `passport-point:${student.studentNumber}:fair-surprise:SURPRISE_QR:surprise:81`,
      },
      update: {},
      create: expect.objectContaining({
        sourceType: "SURPRISE_QR",
        points: -10,
      }),
    });
  });

  it("resolves a universal dynamic QR from that QR's own loss history only", async () => {
    prismaMock.passportPointLedger.aggregate.mockResolvedValue({ _sum: { points: 30 } });
    prismaMock.passportSurpriseEffectLedger.aggregate.mockResolvedValue({ _sum: { deltaPoints: 0 } });
    prismaMock.passportSurpriseEffectLedger.count.mockImplementation(({ where }) => {
      if (where?.studentNumber) return Promise.resolve(0);
      if (where?.surpriseQrId === 901 && where?.deltaPoints?.lt === 0) return Promise.resolve(4);
      if (where?.surpriseQrId === 902 && where?.deltaPoints?.lt === 0) return Promise.resolve(0);
      return Promise.resolve(0);
    });

    const dynamicRulesJson = JSON.stringify({
      mode: "UNIVERSAL_DYNAMIC",
      weights: {
        ADD_POINTS: 0,
        SUBTRACT_POINTS: 100,
        MULTIPLY_BONUS: 0,
        DIVIDE_BONUS: 0,
        NEUTRAL_HINT: 0,
        RECOVERY_POINTS: 0,
      },
      values: {
        ADD_POINTS: 18,
        SUBTRACT_POINTS: 5,
      },
      lossAdjustment: {
        afterLosses: 4,
        weights: {
          ADD_POINTS: 100,
          SUBTRACT_POINTS: 0,
          MULTIPLY_BONUS: 0,
          DIVIDE_BONUS: 0,
          NEUTRAL_HINT: 0,
          RECOVERY_POINTS: 0,
        },
      },
    });

    prismaMock.passportSurpriseQr.findUnique
      .mockResolvedValueOnce({
        id: 901,
        qrActionId: 9010,
        displayCode: "QR-001",
        batchCode: "surprise-test",
        name: "QR Universal #001",
        description: "QR polivalente",
        effectType: "UNIVERSAL_DYNAMIC",
        effectValue: 0,
        dynamicRulesJson,
        targetScope: "SURPRISE_BONUS",
        rarity: "COMMON",
        visibility: "VISIBLE",
        maxUsesTotal: null,
        maxUsesPerStudent: 1,
        negativeCapPerStudent: 20,
        active: true,
        startsAt: null,
        endsAt: null,
      })
      .mockResolvedValueOnce({
        id: 902,
        qrActionId: 9020,
        displayCode: "QR-002",
        batchCode: "surprise-test",
        name: "QR Universal #002",
        description: "QR polivalente",
        effectType: "UNIVERSAL_DYNAMIC",
        effectValue: 0,
        dynamicRulesJson,
        targetScope: "SURPRISE_BONUS",
        rarity: "COMMON",
        visibility: "VISIBLE",
        maxUsesTotal: null,
        maxUsesPerStudent: 1,
        negativeCapPerStudent: 20,
        active: true,
        startsAt: null,
        endsAt: null,
      });

    const boosted = await awardPassportForQrActionScan({
      student,
      action: {
        id: 9010,
        type: "FAIR_BONUS_QR",
        label: "QR Universal #001",
        targetId: null,
        targetMeta: null,
        eventKey: "passport-surprise",
        eventLabel: "Caça aos QR",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 8001,
        result: "SUCCESS",
        message: "QR surpresa validado.",
        scannedAt: new Date("2026-05-18T09:15:00.000Z"),
      },
    });

    const stillRisky = await awardPassportForQrActionScan({
      student,
      action: {
        id: 9020,
        type: "FAIR_BONUS_QR",
        label: "QR Universal #002",
        targetId: null,
        targetMeta: null,
        eventKey: "passport-surprise",
        eventLabel: "Caça aos QR",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 8002,
        result: "SUCCESS",
        message: "QR surpresa validado.",
        scannedAt: new Date("2026-05-18T09:16:00.000Z"),
      },
    });

    expect(boosted.pointsAwarded).toBe(18);
    expect(boosted.surprise?.effectType).toBe("ADD_POINTS");
    expect(stillRisky.pointsAwarded).toBe(-5);
    expect(stillRisky.surprise?.effectType).toBe("SUBTRACT_POINTS");

    const firstLedgerCreate = prismaMock.passportSurpriseEffectLedger.create.mock.calls[0]?.[0];
    const firstMetadata = JSON.parse(firstLedgerCreate.data.metadataJson);
    expect(firstMetadata.dynamicActivated).toBe(true);
    expect(firstMetadata.resolverVersion).toBe("universal-dynamic-v1");
    expect(firstMetadata.seed).toContain("901");
    expect(firstMetadata.selectedEffectType).toBe("ADD_POINTS");
    expect(firstMetadata.adjustedWeights.ADD_POINTS).toBe(100);
    expect(firstMetadata.qrStats.lossCount).toBe(4);
  });

  it("allows the same student to consume a universal dynamic QR again with a scan-specific score entry", async () => {
    const luna = { ...student, name: "Luna Rodrigues", studentNumber: "20249999" };
    const previousBusinessKey = `surprise-effect:${luna.studentNumber}:904`;
    prismaMock.passportPointLedger.aggregate.mockResolvedValue({ _sum: { points: 12 } });
    prismaMock.passportSurpriseEffectLedger.aggregate.mockResolvedValue({ _sum: { deltaPoints: 0 } });
    prismaMock.passportSurpriseEffectLedger.findUnique.mockImplementation(({ where }) => {
      if (where.businessKey === previousBusinessKey) {
        return Promise.resolve({
          id: 701,
          businessKey: previousBusinessKey,
          beforePoints: 2,
          afterPoints: 7,
          deltaPoints: 5,
        });
      }
      return Promise.resolve(null);
    });
    prismaMock.passportSurpriseEffectLedger.count.mockImplementation(({ where }) => {
      if (where?.surpriseQrId === 904 && where?.studentNumber === luna.studentNumber) return Promise.resolve(3);
      return Promise.resolve(0);
    });
    prismaMock.passportSurpriseQr.findUnique.mockResolvedValue({
      id: 904,
      qrActionId: 9040,
      displayCode: "QR-004",
      batchCode: "surprise-repeat",
      name: "QR Universal #004",
      description: "QR polivalente",
      effectType: "UNIVERSAL_DYNAMIC",
      effectValue: 0,
      dynamicRulesJson: JSON.stringify({
        mode: "UNIVERSAL_DYNAMIC",
        weights: {
          ADD_POINTS: 100,
          SUBTRACT_POINTS: 0,
          MULTIPLY_BONUS: 0,
          DIVIDE_BONUS: 0,
          NEUTRAL_HINT: 0,
          RECOVERY_POINTS: 0,
        },
        values: { ADD_POINTS: 9 },
      }),
      targetScope: "SURPRISE_BONUS",
      rarity: "COMMON",
      visibility: "VISIBLE",
      maxUsesTotal: null,
      maxUsesPerStudent: 1,
      negativeCapPerStudent: 20,
      active: true,
      startsAt: null,
      endsAt: null,
    });

    const result = await awardPassportForQrActionScan({
      student: luna,
      action: {
        id: 9040,
        type: "FAIR_BONUS_QR",
        label: "QR Universal #004",
        targetId: null,
        targetMeta: null,
        eventKey: "passport-surprise",
        eventLabel: "Caça aos QR",
        passportMissionId: null,
      },
      qrActionScan: {
        id: 8404,
        result: "SUCCESS",
        message: "QR surpresa validado.",
        scannedAt: new Date("2026-05-18T11:04:00.000Z"),
      },
    });

    expect(result.result).toBe("SURPRISE_APPLIED");
    expect(result.pointsAwarded).toBe(9);
    expect(result.surprise?.hint).toContain("Código QR 4 deu ponto para Luna Rodrigues");
    expect(result.surprise?.hint).toContain("antes que esgote");
    expect(prismaMock.passportSurpriseEffectLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessKey: `surprise-effect:${luna.studentNumber}:904:scan:8404:1779102240000`,
        deltaPoints: 9,
      }),
    });
    expect(prismaMock.passportPointLedger.upsert).toHaveBeenCalledWith({
      where: {
        businessKey: `passport-point:${luna.studentNumber}:fair-surprise:SURPRISE_QR:surprise:904:scan:8404:1779102240000`,
      },
      update: {},
      create: expect.objectContaining({
        points: 9,
        sourceId: "surprise:904:scan:8404:1779102240000",
      }),
    });
  });

  it("resets the passport challenge without deleting mission and challenge configuration", async () => {
    const result = await resetPassportChallengeProgress();

    expect(result).toEqual(expect.objectContaining({
      pointLedgerDeleted: 8,
      scansDeleted: 6,
      challengeAnswersDeleted: 4,
      surpriseEffectsDeleted: 3,
      studentBadgesDeleted: 2,
      rankingFreezesDeleted: 1,
      qrActionScansDeleted: 5,
    }));
    expect(prismaMock.qrAction.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { passportMissionId: { not: null } },
          { type: { in: expect.arrayContaining(["WORKSHOP_CHECKIN", "STAND_VISIT", "EXHIBITOR_CHALLENGE"]) } },
        ],
      },
      select: { id: true },
    });
    expect(prismaMock.passportPointLedger.deleteMany).toHaveBeenCalled();
    expect(prismaMock.passportChallenge.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.passportMission.deleteMany).not.toHaveBeenCalled();
  });

  it("does not resync old scans before the student accepts the passport again", async () => {
    prismaMock.student.findUnique.mockResolvedValue(student);
    prismaMock.passportPointLedger.findUnique.mockResolvedValue(null);
    prismaMock.attendanceCheckIn.findMany.mockResolvedValue([
      {
        id: 10,
        eventKey: "main-event",
        eventLabel: "Entrada",
        checkedInAt: new Date("2026-05-09T10:00:00.000Z"),
        checkedInByStudentNumber: "admin",
      },
    ]);

    await syncPassportFromExistingActivity(student.id);

    expect(prismaMock.attendanceCheckIn.findMany).not.toHaveBeenCalled();
    expect(prismaMock.qrActionScan.findMany).not.toHaveBeenCalled();
    expect(prismaMock.passportPointLedger.create).not.toHaveBeenCalled();
  });
});
