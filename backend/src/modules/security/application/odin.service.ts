import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import { getCookie } from "../../../shared/cookies";
import { softDeleteStudentWithMoodlePurge } from "../../../shared/student-deactivation";

const ODIN_DEVICE_COOKIE = "uor_device";
const TEN_MINUTES_MS = 10 * 60 * 1000;

export type OdinRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type OdinRawEvent = {
  id: number;
  deviceId: string;
  studentId: number | null;
  studentNumber: string | null;
  studentName?: string | null;
  studentCourse?: string | null;
  eventType: string;
  targetType: string | null;
  targetId: number | null;
  targetLabel?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type OdinDeviceRisk = {
  deviceId: string;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  reasons: string[];
  loginCount: number;
  voteCount: number;
  eventCount: number;
  distinctStudents: number;
  distinctProjectsVoted: number;
  lastSeenAt: string;
  lastIp: string | null;
  lastUserAgent: string | null;
  students: Array<{
    studentId: number | null;
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    eventCount: number;
    voteCount: number;
    firstLoginAt: string | null;
    lastLoginAt: string | null;
    lastSeenAt: string;
  }>;
  loginTimeline: Array<{
    studentId: number | null;
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    loginAt: string;
  }>;
  projects: Array<{
    submissionId: number;
    submissionName: string;
    votes: number;
    students: number;
  }>;
};

export type OdinStudentRisk = {
  studentId: number | null;
  studentNumber: string;
  studentName: string | null;
  studentCourse: string | null;
  riskScore: number;
  riskLevel: OdinRiskLevel;
  reasons: string[];
  devices: string[];
  voteCount: number;
  loginCount: number;
  lastSeenAt: string;
  projectsVoted: Array<{ submissionId: number; submissionName: string; votes: number }>;
};

export type OdinProjectPressure = {
  submissionId: number;
  submissionName: string;
  suspiciousVotes: number;
  suspiciousDevices: number;
  suspiciousStudents: number;
};

export type OdinOverview = {
  generatedAt: string;
  stats: {
    totalEvents: number;
    deviceCount: number;
    suspiciousDevices: number;
    suspectStudents: number;
    suspectVotes: number;
    multiAccountDevices: number;
    projectPressureCount: number;
  };
  devices: OdinDeviceRisk[];
  students: OdinStudentRisk[];
  projects: OdinProjectPressure[];
  suggestions: string[];
};

export type OdinRecordEventInput = {
  request?: FastifyRequest;
  deviceId?: string | null;
  student?: {
    id?: number | null;
    studentNumber?: string | null;
    name?: string | null;
    course?: string | null;
  } | null;
  eventType: "LOGIN_SUCCESS" | "PROJECT_VOTE" | "PROJECT_LIKE" | "PROJECT_COMMENT" | "PASSPORT_SCAN" | "PROFILE_EXCLUDED";
  targetType?: string | null;
  targetId?: number | null;
  targetLabel?: string | null;
  riskContext?: Record<string, unknown> | null;
};

export type OdinStudentExclusionInput = {
  studentId: number;
  actorStudentNumber: string;
  reason: string;
  deleteProfile: boolean;
  removeVotes: boolean;
  removeLikes: boolean;
  removeComments: boolean;
  removePassport: boolean;
};

export type OdinStudentExclusionResult = {
  success: true;
  studentId: number;
  studentNumber: string;
  deletedProfile: boolean;
  removed: {
    studentVotes: number;
    studentLikes: number;
    studentComments: number;
    qrActionScans: number;
    passportScans: number;
    passportChallengeAnswers: number;
    passportBadges: number;
    passportSurpriseEffectsRevoked: number;
    passportPointLedgerRevoked: number;
    exhibitorScoreEventsRevoked: number;
  };
};

export function normalizeOdinDeviceId(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length < 12 || trimmed.length > 96) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function resolveOdinDeviceIdFromRequest(request: FastifyRequest) {
  return normalizeOdinDeviceId(getCookie(request, ODIN_DEVICE_COOKIE))
    ?? normalizeOdinDeviceId(headerValue(request.headers["x-uor-device-id"]));
}

export function createOdinDeviceId() {
  return randomUUID();
}

function riskLevel(score: number): OdinRiskLevel {
  if (score >= 100) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function studentKey(event: OdinRawEvent) {
  if (event.studentId) return `id:${event.studentId}`;
  if (event.studentNumber) return `number:${event.studentNumber}`;
  return null;
}

function latestEvent(left: OdinRawEvent, right: OdinRawEvent) {
  return left.createdAt > right.createdAt ? left : right;
}

function projectKey(event: OdinRawEvent) {
  return event.targetType === "Submission" && event.targetId ? String(event.targetId) : null;
}

function countVelocityVotes(events: OdinRawEvent[]) {
  const votes = events
    .filter((event) => event.eventType === "PROJECT_VOTE")
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  let maxVotes = 0;

  for (let leftIndex = 0; leftIndex < votes.length; leftIndex += 1) {
    let count = 0;
    const start = votes[leftIndex].createdAt.getTime();
    for (let rightIndex = leftIndex; rightIndex < votes.length; rightIndex += 1) {
      if (votes[rightIndex].createdAt.getTime() - start > TEN_MINUTES_MS) break;
      count += 1;
    }
    maxVotes = Math.max(maxVotes, count);
  }

  return maxVotes;
}

function deviceRisk(events: OdinRawEvent[]): OdinDeviceRisk {
  const [first] = events;
  const deviceId = first?.deviceId ?? "unknown";
  const latest = events.reduce(latestEvent, first);
  const studentEvents = new Map<string, OdinRawEvent[]>();
  const projectVotes = new Map<string, OdinRawEvent[]>();
  const reasons: string[] = [];
  let riskScore = 0;

  for (const event of events) {
    const key = studentKey(event);
    if (key) studentEvents.set(key, [...(studentEvents.get(key) ?? []), event]);

    const voteProjectKey = event.eventType === "PROJECT_VOTE" ? projectKey(event) : null;
    if (voteProjectKey) projectVotes.set(voteProjectKey, [...(projectVotes.get(voteProjectKey) ?? []), event]);
  }

  const distinctStudents = studentEvents.size;
  if (distinctStudents >= 3) {
    riskScore += 65;
    reasons.push(`Mesma cookie/dispositivo usada por ${distinctStudents} contas diferentes.`);
  } else if (distinctStudents === 2) {
    riskScore += 45;
    reasons.push("Mesma cookie/dispositivo usada por 2 contas diferentes.");
  }

  const sameProjectMultiAccountVotes = Array.from(projectVotes.values())
    .filter((votes) => unique(votes.map(studentKey).filter(Boolean)).length >= 2);
  if (sameProjectMultiAccountVotes.length > 0) {
    riskScore += 50;
    reasons.push("Contas diferentes no mesmo dispositivo votaram no mesmo projeto.");
  }

  const maxVelocityVotes = countVelocityVotes(events);
  if (maxVelocityVotes >= 5) {
    riskScore += 35;
    reasons.push(`${maxVelocityVotes} votos em 10 minutos no mesmo dispositivo.`);
  } else if (maxVelocityVotes >= 3) {
    riskScore += 20;
    reasons.push(`${maxVelocityVotes} votos em 10 minutos no mesmo dispositivo.`);
  }

  const loginCount = events.filter((event) => event.eventType === "LOGIN_SUCCESS").length;
  const voteCount = events.filter((event) => event.eventType === "PROJECT_VOTE").length;
  if (loginCount >= 3 && voteCount >= 3 && distinctStudents >= 2) {
    riskScore += 15;
    reasons.push("Sequência repetida de login e voto no mesmo dispositivo.");
  }

  const students = Array.from(studentEvents.values()).map((studentEventGroup) => {
    const newest = studentEventGroup.reduce(latestEvent);
    const loginEvents = studentEventGroup
      .filter((event) => event.eventType === "LOGIN_SUCCESS")
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const firstLogin = loginEvents[0] ?? null;
    const lastLogin = loginEvents[loginEvents.length - 1] ?? null;
    return {
      studentId: newest.studentId,
      studentNumber: newest.studentNumber ?? "sem-numero",
      studentName: newest.studentName ?? null,
      studentCourse: newest.studentCourse ?? null,
      eventCount: studentEventGroup.length,
      voteCount: studentEventGroup.filter((event) => event.eventType === "PROJECT_VOTE").length,
      firstLoginAt: firstLogin?.createdAt.toISOString() ?? null,
      lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
      lastSeenAt: newest.createdAt.toISOString(),
    };
  }).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));

  const loginTimeline = events
    .filter((event) => event.eventType === "LOGIN_SUCCESS" && studentKey(event))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((event) => ({
      studentId: event.studentId,
      studentNumber: event.studentNumber ?? "sem-numero",
      studentName: event.studentName ?? null,
      studentCourse: event.studentCourse ?? null,
      loginAt: event.createdAt.toISOString(),
    }))
    .slice(-60);

  const projects = Array.from(projectVotes.entries()).map(([submissionId, votes]) => {
    const newest = votes.reduce(latestEvent);
    return {
      submissionId: Number(submissionId),
      submissionName: newest.targetLabel ?? `Projeto ${submissionId}`,
      votes: votes.length,
      students: unique(votes.map(studentKey).filter(Boolean)).length,
    };
  }).sort((left, right) => right.votes - left.votes);

  return {
    deviceId,
    riskScore: Math.min(100, riskScore),
    riskLevel: riskLevel(riskScore),
    reasons,
    loginCount,
    voteCount,
    eventCount: events.length,
    distinctStudents,
    distinctProjectsVoted: projectVotes.size,
    lastSeenAt: latest.createdAt.toISOString(),
    lastIp: latest.ipAddress,
    lastUserAgent: latest.userAgent,
    students,
    loginTimeline,
    projects,
  };
}

function studentRisk(events: OdinRawEvent[], riskyDevices: Map<string, OdinDeviceRisk>): OdinStudentRisk[] {
  const byStudent = new Map<string, OdinRawEvent[]>();
  for (const event of events) {
    const key = studentKey(event);
    if (!key) continue;
    byStudent.set(key, [...(byStudent.get(key) ?? []), event]);
  }

  return Array.from(byStudent.values()).map((studentEvents) => {
    const latest = studentEvents.reduce(latestEvent);
    const devices = unique(studentEvents.map((event) => event.deviceId));
    const riskyReasons = unique(devices.flatMap((deviceId) => riskyDevices.get(deviceId)?.reasons ?? []));
    const maxDeviceRisk = devices.reduce((score, deviceId) => Math.max(score, riskyDevices.get(deviceId)?.riskScore ?? 0), 0);
    const projects = new Map<number, { submissionName: string; votes: number }>();

    for (const event of studentEvents) {
      if (event.eventType !== "PROJECT_VOTE" || event.targetType !== "Submission" || !event.targetId) continue;
      const current = projects.get(event.targetId);
      projects.set(event.targetId, {
        submissionName: event.targetLabel ?? `Projeto ${event.targetId}`,
        votes: (current?.votes ?? 0) + 1,
      });
    }

    return {
      studentId: latest.studentId,
      studentNumber: latest.studentNumber ?? "sem-numero",
      studentName: latest.studentName ?? null,
      studentCourse: latest.studentCourse ?? null,
      riskScore: maxDeviceRisk,
      riskLevel: riskLevel(maxDeviceRisk),
      reasons: riskyReasons,
      devices,
      voteCount: studentEvents.filter((event) => event.eventType === "PROJECT_VOTE").length,
      loginCount: studentEvents.filter((event) => event.eventType === "LOGIN_SUCCESS").length,
      lastSeenAt: latest.createdAt.toISOString(),
      projectsVoted: Array.from(projects.entries()).map(([submissionId, project]) => ({
        submissionId,
        submissionName: project.submissionName,
        votes: project.votes,
      })),
    };
  }).filter((student) => student.riskScore >= 40)
    .sort((left, right) => right.riskScore - left.riskScore || right.lastSeenAt.localeCompare(left.lastSeenAt));
}

function projectPressure(devices: OdinDeviceRisk[]) {
  const projects = new Map<number, {
    submissionName: string;
    suspiciousVotes: number;
    devices: Set<string>;
    students: Set<string>;
  }>();

  for (const device of devices.filter((item) => item.riskScore >= 40)) {
    for (const project of device.projects) {
      if (project.students < 2 && device.riskScore < 70) continue;
      const current = projects.get(project.submissionId) ?? {
        submissionName: project.submissionName,
        suspiciousVotes: 0,
        devices: new Set<string>(),
        students: new Set<string>(),
      };
      current.suspiciousVotes += project.votes;
      current.devices.add(device.deviceId);
      for (const student of device.students) current.students.add(student.studentNumber);
      projects.set(project.submissionId, current);
    }
  }

  return Array.from(projects.entries()).map(([submissionId, item]) => ({
    submissionId,
    submissionName: item.submissionName,
    suspiciousVotes: item.suspiciousVotes,
    suspiciousDevices: item.devices.size,
    suspiciousStudents: item.students.size,
  })).sort((left, right) => right.suspiciousVotes - left.suspiciousVotes);
}

export function buildOdinRiskSnapshot(input: { generatedAt: Date; events: OdinRawEvent[] }): OdinOverview {
  const byDevice = new Map<string, OdinRawEvent[]>();
  for (const event of input.events) {
    byDevice.set(event.deviceId, [...(byDevice.get(event.deviceId) ?? []), event]);
  }

  const devices = Array.from(byDevice.values())
    .map(deviceRisk)
    .sort((left, right) => right.riskScore - left.riskScore || right.lastSeenAt.localeCompare(left.lastSeenAt));
  const riskyDevices = new Map(devices.filter((device) => device.riskScore >= 40).map((device) => [device.deviceId, device]));
  const students = studentRisk(input.events, riskyDevices);
  const projects = projectPressure(devices);
  const suspectVotes = devices
    .filter((device) => device.riskScore >= 40)
    .reduce((total, device) => total + device.voteCount, 0);

  return {
    generatedAt: input.generatedAt.toISOString(),
    stats: {
      totalEvents: input.events.length,
      deviceCount: devices.length,
      suspiciousDevices: devices.filter((device) => device.riskScore >= 40).length,
      suspectStudents: students.length,
      suspectVotes,
      multiAccountDevices: devices.filter((device) => device.distinctStudents >= 2).length,
      projectPressureCount: projects.length,
    },
    devices,
    students,
    projects,
    suggestions: [
      "Acompanhar contas diferentes na mesma cookie/dispositivo, mesmo que o utilizador troque de login.",
      "Comparar votos rápidos no mesmo dispositivo com pressão concentrada num único projeto.",
      "Usar IP e navegador apenas como sinais fracos, porque redes de universidade e sala podem ser partilhadas.",
      "Cruzar perdas/ganhos do passaporte digital com tentativas de recuperação e scans repetidos.",
      "Rever manualmente antes de excluir: o ODIN mostra indícios, não uma sentença automática.",
    ],
  };
}

function serializeRiskContext(input?: Record<string, unknown> | null) {
  if (!input) return null;
  try {
    return JSON.stringify(input).slice(0, 4000);
  } catch {
    return null;
  }
}

export async function recordOdinEvent(input: OdinRecordEventInput) {
  const deviceId = normalizeOdinDeviceId(input.deviceId) ?? (input.request ? resolveOdinDeviceIdFromRequest(input.request) : null);
  if (!deviceId) return null;

  const now = new Date();
  const ipAddress = input.request?.ip ?? null;
  const userAgent = headerValue(input.request?.headers["user-agent"]) ?? null;
  const isLogin = input.eventType === "LOGIN_SUCCESS";
  const isVote = input.eventType === "PROJECT_VOTE";

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.odinDevice.upsert({
        where: { deviceId },
        update: {
          lastSeenAt: now,
          lastIp: ipAddress,
          lastUserAgent: userAgent,
          ...(isLogin ? { loginCount: { increment: 1 } } : {}),
          ...(isVote ? { voteCount: { increment: 1 } } : {}),
        },
        create: {
          deviceId,
          firstSeenAt: now,
          lastSeenAt: now,
          lastIp: ipAddress,
          lastUserAgent: userAgent,
          loginCount: isLogin ? 1 : 0,
          voteCount: isVote ? 1 : 0,
        },
      });

      return tx.odinEvent.create({
        data: {
          deviceId,
          studentId: input.student?.id ?? null,
          studentNumber: input.student?.studentNumber ?? null,
          studentName: input.student?.name ?? null,
          studentCourse: input.student?.course ?? null,
          eventType: input.eventType,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          targetLabel: input.targetLabel ?? null,
          ipAddress,
          userAgent,
          riskContextJson: serializeRiskContext(input.riskContext),
          createdAt: now,
        },
      });
    });
  } catch {
    return null;
  }
}

export async function getOdinOverview(windowHours = 48): Promise<OdinOverview> {
  const hours = Number.isFinite(windowHours) ? Math.min(24 * 14, Math.max(1, Math.floor(windowHours))) : 48;
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const events = await prisma.odinEvent.findMany({
    where: { createdAt: { gte: from } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return buildOdinRiskSnapshot({
    generatedAt: new Date(),
    events: events.map((event) => ({
      id: event.id,
      deviceId: event.deviceId,
      studentId: event.studentId,
      studentNumber: event.studentNumber,
      studentName: event.studentName,
      studentCourse: event.studentCourse,
      eventType: event.eventType,
      targetType: event.targetType,
      targetId: event.targetId,
      targetLabel: event.targetLabel,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      createdAt: event.createdAt,
    })),
  });
}

export async function recordOdinStudentExclusion(input: OdinStudentExclusionInput): Promise<OdinStudentExclusionResult> {
  const reason = input.reason.trim() || "Exclusão preventiva pelo sistema ODIN.";
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: input.studentId },
      select: { id: true, studentNumber: true },
    });
    if (!student) {
      throw new Error("Estudante não encontrado.");
    }

    const [studentVotes, studentLikes, studentComments, qrActionScans, passportScans, passportChallengeAnswers, passportBadges] = await Promise.all([
      input.removeVotes ? tx.studentVote.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
      input.removeLikes ? tx.studentLike.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
      input.removeComments ? tx.studentComment.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
      input.removePassport ? tx.qrActionScan.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
      input.removePassport ? tx.passportScan.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
      input.removePassport ? tx.passportChallengeAnswer.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
      input.removePassport ? tx.passportStudentBadge.deleteMany({ where: { studentId: input.studentId } }) : Promise.resolve({ count: 0 }),
    ]);

    const [passportSurpriseEffects, passportPointLedger, exhibitorScoreEvents] = await Promise.all([
      input.removePassport
        ? tx.passportSurpriseEffectLedger.updateMany({
          where: { studentId: input.studentId, status: { not: "REVOKED" } },
          data: { status: "REVOKED", message: reason },
        })
        : Promise.resolve({ count: 0 }),
      input.removePassport
        ? tx.passportPointLedger.updateMany({
          where: { studentId: input.studentId, status: { not: "REVOKED" } },
          data: {
            status: "REVOKED",
            revokedAt: now,
            revokedByStudentNumber: input.actorStudentNumber,
            revokeReason: reason,
          },
        })
        : Promise.resolve({ count: 0 }),
      input.removeVotes
        ? tx.exhibitorScoreEvent.updateMany({
          where: {
            OR: [
              { studentId: input.studentId },
              { actorStudentId: input.studentId },
            ],
            status: { not: "REVOKED" },
          },
          data: {
            status: "REVOKED",
            revokedAt: now,
            revokedByStudentNumber: input.actorStudentNumber,
            revokeReason: reason,
          },
        })
        : Promise.resolve({ count: 0 }),
    ]);

    if (input.deleteProfile) {
      await softDeleteStudentWithMoodlePurge(tx, {
        studentId: input.studentId,
        deletedAt: now,
        deletionReason: `ODIN: ${reason}`,
      });

      await tx.adminAuthorizedStudent.updateMany({
        where: { studentNumber: student.studentNumber },
        data: {
          isActive: false,
          revokedAt: now,
          revokedByStudentNumber: input.actorStudentNumber,
          revocationReason: `ODIN: ${reason}`,
        },
      });
    }

    return {
      success: true as const,
      studentId: input.studentId,
      studentNumber: student.studentNumber,
      deletedProfile: input.deleteProfile,
      removed: {
        studentVotes: studentVotes.count,
        studentLikes: studentLikes.count,
        studentComments: studentComments.count,
        qrActionScans: qrActionScans.count,
        passportScans: passportScans.count,
        passportChallengeAnswers: passportChallengeAnswers.count,
        passportBadges: passportBadges.count,
        passportSurpriseEffectsRevoked: passportSurpriseEffects.count,
        passportPointLedgerRevoked: passportPointLedger.count,
        exhibitorScoreEventsRevoked: exhibitorScoreEvents.count,
      },
    };
  });
}
