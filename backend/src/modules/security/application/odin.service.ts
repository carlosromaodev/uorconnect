import type { FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import { getCookie } from "../../../shared/cookies";

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

export type OdinExhibitorDeviceMembership = {
  submissionId: number;
  submissionName: string;
  studentId?: number | null;
  studentNumber?: string | null;
  memberName?: string | null;
};

export type OdinExhibitorDeviceMisuseSignal = {
  id: string;
  deviceId: string;
  severity: "MEDIUM" | "HIGH";
  outsideVotes: number;
  distinctAccounts: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  exhibitors: Array<{
    submissionId: number;
    submissionName: string;
    studentId: number | null;
    studentNumber: string | null;
    memberName: string | null;
  }>;
  allowedProjects: Array<{
    submissionId: number;
    submissionName: string;
  }>;
  outsideProjects: Array<{
    submissionId: number;
    submissionName: string;
    votes: number;
  }>;
  message: string;
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
    exhibitorDeviceWarnings: number;
  };
  devices: OdinDeviceRisk[];
  students: OdinStudentRisk[];
  projects: OdinProjectPressure[];
  exhibitorDeviceWarnings: OdinExhibitorDeviceMisuseSignal[];
  suggestions: string[];
};

export type OdinStudentExhibitorDeviceWarning = {
  id: string;
  submissionId: number;
  submissionName: string;
  deviceId: string;
  severity: "MEDIUM" | "HIGH";
  outsideVotes: number;
  distinctAccounts: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  outsideProjects: Array<{
    submissionId: number;
    submissionName: string;
    votes: number;
  }>;
  message: string;
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

export type OdinProjectPenaltyMode = "SUSPECT_VOTES" | "EXACT_VOTES" | "POINTS_ONLY";

export type OdinProjectPenaltyInput = {
  submissionId: number;
  actorStudentNumber: string;
  penaltyMode: OdinProjectPenaltyMode;
  reason: string;
  windowHours?: number;
  exactVoteCount?: number | null;
  pointsToRemove?: number | null;
  notifyProjectMembers?: boolean;
  eventKey?: string;
};

export type OdinProjectPenaltyResult = {
  success: true;
  penaltyId: number;
  submissionId: number;
  submissionName: string;
  penaltyMode: OdinProjectPenaltyMode;
  removedVoteCount: number;
  removedPointCount: number;
  revokedScoreEventCount: number;
  notifiedProjectMembers: boolean;
  affectedStudents: Array<{
    studentId: number;
    studentNumber: string;
    studentName: string | null;
  }>;
  message: string;
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

function normalizedStudentNumber(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function membershipStudentKeys(membership: OdinExhibitorDeviceMembership) {
  const keys: string[] = [];
  if (membership.studentId) keys.push(`id:${membership.studentId}`);
  const number = normalizedStudentNumber(membership.studentNumber);
  if (number) keys.push(`number:${number}`);
  return keys;
}

function eventStudentKeys(event: Pick<OdinRawEvent, "studentId" | "studentNumber">) {
  const keys: string[] = [];
  if (event.studentId) keys.push(`id:${event.studentId}`);
  const number = normalizedStudentNumber(event.studentNumber);
  if (number) keys.push(`number:${number}`);
  return keys;
}

function signalId(deviceId: string, submissionIds: number[], lastDetectedAt: string) {
  return `odin-exhibitor-device:${deviceId}:${submissionIds.sort((left, right) => left - right).join("-")}:${lastDetectedAt}`;
}

export function detectExhibitorDeviceMisuse(
  events: OdinRawEvent[],
  memberships: OdinExhibitorDeviceMembership[],
): OdinExhibitorDeviceMisuseSignal[] {
  if (!events.length || !memberships.length) return [];

  const eventsByDevice = new Map<string, OdinRawEvent[]>();
  for (const event of events) {
    eventsByDevice.set(event.deviceId, [...(eventsByDevice.get(event.deviceId) ?? []), event]);
  }

  const membershipByKey = new Map<string, OdinExhibitorDeviceMembership[]>();
  for (const membership of memberships) {
    for (const key of membershipStudentKeys(membership)) {
      membershipByKey.set(key, [...(membershipByKey.get(key) ?? []), membership]);
    }
  }

  return Array.from(eventsByDevice.entries()).flatMap(([deviceId, deviceEvents]) => {
    const deviceMemberships = new Map<number, OdinExhibitorDeviceMembership>();
    for (const event of deviceEvents) {
      for (const key of eventStudentKeys(event)) {
        for (const membership of membershipByKey.get(key) ?? []) {
          deviceMemberships.set(membership.submissionId, membership);
        }
      }
    }

    if (deviceMemberships.size === 0) return [];

    const allowedProjects = Array.from(deviceMemberships.values()).map((membership) => ({
      submissionId: membership.submissionId,
      submissionName: membership.submissionName,
    }));
    const allowedIds = new Set(allowedProjects.map((project) => project.submissionId));
    const outsideVoteEvents = deviceEvents
      .filter((event) =>
        event.eventType === "PROJECT_VOTE"
        && event.targetType === "Submission"
        && event.targetId
        && !allowedIds.has(event.targetId)
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    if (!outsideVoteEvents.length) return [];

    const outsideProjects = new Map<number, { submissionName: string; votes: number }>();
    for (const vote of outsideVoteEvents) {
      if (!vote.targetId) continue;
      const current = outsideProjects.get(vote.targetId);
      outsideProjects.set(vote.targetId, {
        submissionName: vote.targetLabel ?? `Projeto ${vote.targetId}`,
        votes: (current?.votes ?? 0) + 1,
      });
    }

    const firstDetectedAt = outsideVoteEvents[0].createdAt.toISOString();
    const lastDetectedAt = outsideVoteEvents[outsideVoteEvents.length - 1].createdAt.toISOString();
    const distinctAccounts = unique(deviceEvents.map(studentKey).filter(Boolean)).length;
    const severity: OdinExhibitorDeviceMisuseSignal["severity"] =
      outsideVoteEvents.length >= 2 || distinctAccounts >= 3 ? "HIGH" : "MEDIUM";
    const exhibitorProjects = allowedProjects.map((project) => project.submissionName).join(", ");
    const outsideProjectNames = Array.from(outsideProjects.values()).map((project) => project.submissionName).join(", ");
    const message = `Aviso ODIN: o dispositivo associado a expositor do projeto ${exhibitorProjects} foi usado para votar em projeto(s) fora do grupo (${outsideProjectNames}). Esta prática é proibida e pode resultar em remoção de votos, perda de pontos, congelamento do projeto e possível suspensão/banimento temporário da conta.`;

    return [{
      id: signalId(deviceId, Array.from(allowedIds), lastDetectedAt),
      deviceId,
      severity,
      outsideVotes: outsideVoteEvents.length,
      distinctAccounts,
      firstDetectedAt,
      lastDetectedAt,
      exhibitors: Array.from(deviceMemberships.values()).map((membership) => ({
        submissionId: membership.submissionId,
        submissionName: membership.submissionName,
        studentId: membership.studentId ?? null,
        studentNumber: membership.studentNumber ?? null,
        memberName: membership.memberName ?? null,
      })),
      allowedProjects,
      outsideProjects: Array.from(outsideProjects.entries()).map(([submissionId, project]) => ({
        submissionId,
        submissionName: project.submissionName,
        votes: project.votes,
      })).sort((left, right) => right.votes - left.votes || left.submissionId - right.submissionId),
      message,
    }];
  }).sort((left, right) =>
    right.outsideVotes - left.outsideVotes
    || right.distinctAccounts - left.distinctAccounts
    || right.lastDetectedAt.localeCompare(left.lastDetectedAt)
  );
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

function enrichOdinOverviewWithExhibitorMisuse(
  overview: OdinOverview,
  signals: OdinExhibitorDeviceMisuseSignal[],
): OdinOverview {
  if (!signals.length) return { ...overview, exhibitorDeviceWarnings: [] };

  const signalsByDevice = new Map<string, OdinExhibitorDeviceMisuseSignal[]>();
  for (const signal of signals) {
    signalsByDevice.set(signal.deviceId, [...(signalsByDevice.get(signal.deviceId) ?? []), signal]);
  }

  const devices = overview.devices.map((device) => {
    const deviceSignals = signalsByDevice.get(device.deviceId) ?? [];
    if (!deviceSignals.length) return device;

    const outsideVotes = deviceSignals.reduce((total, signal) => total + signal.outsideVotes, 0);
    const signalRisk = outsideVotes >= 2 || device.distinctStudents >= 3 ? 90 : 65;
    const nextRiskScore = Math.min(100, Math.max(device.riskScore, signalRisk));
    const signalReasons = deviceSignals.map((signal) =>
      `ODIN: dispositivo associado a expositor votou ${signal.outsideVotes} vez(es) em projetos fora do próprio grupo. Possível suspensão/banimento temporário se a prática for confirmada.`
    );

    return {
      ...device,
      riskScore: nextRiskScore,
      riskLevel: riskLevel(nextRiskScore),
      reasons: unique([...device.reasons, ...signalReasons]),
    };
  }).sort((left, right) => right.riskScore - left.riskScore || right.lastSeenAt.localeCompare(left.lastSeenAt));

  const projects = projectPressure(devices);
  const suspectVotes = devices
    .filter((device) => device.riskScore >= 40)
    .reduce((total, device) => total + device.voteCount, 0);

  return {
    ...overview,
    stats: {
      ...overview.stats,
      suspiciousDevices: devices.filter((device) => device.riskScore >= 40).length,
      suspectVotes,
      projectPressureCount: projects.length,
      exhibitorDeviceWarnings: signals.length,
    },
    devices,
    projects,
    exhibitorDeviceWarnings: signals,
    suggestions: unique([
      ...overview.suggestions,
      "Avisar expositores: dispositivos associados a membros do projeto não podem ser usados para votar em projetos concorrentes.",
      "Tratar voto em projeto externo por telefone de expositor como sinal ODIN de pressão indevida, sujeito a remoção de votos, perda de pontos e suspensão temporária.",
    ]),
  };
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
      exhibitorDeviceWarnings: 0,
    },
    devices,
    students,
    projects,
    exhibitorDeviceWarnings: [],
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

function toOdinRawEvent(event: {
  id: number;
  deviceId: string;
  studentId: number | null;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  eventType: string;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}): OdinRawEvent {
  return {
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
  };
}

async function loadExhibitorDeviceMemberships(): Promise<OdinExhibitorDeviceMembership[]> {
  const submissions = await prisma.submission.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      studentId: true,
      studentNumberSnapshot: true,
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
        },
      },
      memberConfirmations: {
        select: {
          studentId: true,
          studentNumber: true,
          expectedStudentNumber: true,
          studentName: true,
          name: true,
          student: {
            select: {
              id: true,
              studentNumber: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const memberships: OdinExhibitorDeviceMembership[] = [];
  const seen = new Set<string>();
  for (const submission of submissions) {
    const pushMembership = (membership: OdinExhibitorDeviceMembership) => {
      const key = `${membership.submissionId}:${membership.studentId ?? "none"}:${normalizedStudentNumber(membership.studentNumber) ?? "none"}`;
      if (seen.has(key)) return;
      if (!membership.studentId && !membership.studentNumber) return;
      seen.add(key);
      memberships.push(membership);
    };

    pushMembership({
      submissionId: submission.id,
      submissionName: submission.name,
      studentId: submission.student?.id ?? submission.studentId ?? null,
      studentNumber: submission.student?.studentNumber ?? submission.studentNumberSnapshot ?? null,
      memberName: submission.student?.name ?? null,
    });

    for (const member of submission.memberConfirmations) {
      pushMembership({
        submissionId: submission.id,
        submissionName: submission.name,
        studentId: member.student?.id ?? member.studentId ?? null,
        studentNumber: member.student?.studentNumber ?? member.studentNumber ?? member.expectedStudentNumber ?? null,
        memberName: member.student?.name ?? member.studentName ?? member.name ?? null,
      });
    }
  }

  return memberships;
}

export async function getOdinOverview(windowHours = 48): Promise<OdinOverview> {
  const hours = Number.isFinite(windowHours) ? Math.min(24 * 14, Math.max(1, Math.floor(windowHours))) : 48;
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [events, memberships] = await Promise.all([
    prisma.odinEvent.findMany({
      where: { createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    loadExhibitorDeviceMemberships(),
  ]);

  const rawEvents = events.map(toOdinRawEvent);
  const overview = buildOdinRiskSnapshot({
    generatedAt: new Date(),
    events: rawEvents,
  });

  return enrichOdinOverviewWithExhibitorMisuse(
    overview,
    detectExhibitorDeviceMisuse(rawEvents, memberships),
  );
}

export async function getOdinExhibitorDeviceWarningsForStudent(input: {
  studentId: number;
  studentNumber?: string | null;
  windowHours?: number;
}): Promise<OdinStudentExhibitorDeviceWarning[]> {
  const hours = Number.isFinite(input.windowHours) ? Math.min(24 * 14, Math.max(1, Math.floor(input.windowHours ?? 48))) : 48;
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const number = normalizedStudentNumber(input.studentNumber);

  const ownEvents = await prisma.odinEvent.findMany({
    where: {
      createdAt: { gte: from },
      OR: [
        { studentId: input.studentId },
        ...(number ? [{ studentNumber: { equals: input.studentNumber ?? undefined } }] : []),
      ],
    },
    select: { deviceId: true },
    distinct: ["deviceId"],
  });
  const deviceIds = ownEvents.map((event) => event.deviceId);
  if (!deviceIds.length) return [];

  const [events, memberships] = await Promise.all([
    prisma.odinEvent.findMany({
      where: {
        createdAt: { gte: from },
        deviceId: { in: deviceIds },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    loadExhibitorDeviceMemberships(),
  ]);

  const ownMemberships = memberships.filter((membership) =>
    membership.studentId === input.studentId
    || (number && normalizedStudentNumber(membership.studentNumber) === number)
  );
  if (!ownMemberships.length) return [];

  const rawEvents = events.map(toOdinRawEvent);
  const signals = detectExhibitorDeviceMisuse(rawEvents, memberships);
  const ownProjectIds = new Set(ownMemberships.map((membership) => membership.submissionId));

  return signals.flatMap((signal) =>
    signal.exhibitors
      .filter((exhibitor) => ownProjectIds.has(exhibitor.submissionId))
      .map((exhibitor) => ({
        id: `${signal.id}:${exhibitor.submissionId}`,
        submissionId: exhibitor.submissionId,
        submissionName: exhibitor.submissionName,
        deviceId: signal.deviceId,
        severity: signal.severity,
        outsideVotes: signal.outsideVotes,
        distinctAccounts: signal.distinctAccounts,
        firstDetectedAt: signal.firstDetectedAt,
        lastDetectedAt: signal.lastDetectedAt,
        outsideProjects: signal.outsideProjects,
        message: signal.message,
      }))
  ).sort((left, right) =>
    right.outsideVotes - left.outsideVotes
    || right.lastDetectedAt.localeCompare(left.lastDetectedAt)
  );
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
      await tx.student.update({
        where: { id: input.studentId },
        data: {
          deletedAt: now,
          deletionReason: `ODIN: ${reason}`,
          lastLoginAt: null,
        },
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

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function normalizePositiveInt(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Math.floor(Number(value)));
}

function normalizePositivePoints(value?: number | null) {
  if (!Number.isFinite(value ?? NaN)) return 0;
  return Math.max(0, Number(value));
}

export async function recordOdinProjectPenalty(input: OdinProjectPenaltyInput): Promise<OdinProjectPenaltyResult> {
  const eventKey = input.eventKey ?? "main-event";
  const reason = input.reason.trim();
  if (reason.length < 8) throw new Error("Informa um motivo claro para a penalização ODIN.");

  const pointsToRemove = normalizePositivePoints(input.pointsToRemove);
  const exactVoteCount = normalizePositiveInt(input.exactVoteCount);
  if (input.penaltyMode === "EXACT_VOTES" && exactVoteCount < 1) {
    throw new Error("Informa a quantidade exata de votos a remover.");
  }
  if (input.penaltyMode === "POINTS_ONLY" && pointsToRemove <= 0) {
    throw new Error("Informa os pontos a remover.");
  }

  const overview = input.penaltyMode === "SUSPECT_VOTES" || input.penaltyMode === "EXACT_VOTES"
    ? await getOdinOverview(input.windowHours ?? 48)
    : null;
  const suspiciousDevices = new Set(
    (overview?.devices ?? [])
      .filter((device) => device.riskScore >= 40 && device.projects.some((project) => project.submissionId === input.submissionId))
      .map((device) => device.deviceId),
  );

  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { id: input.submissionId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!submission) throw new Error("Projeto não encontrado.");

    const since = new Date(Date.now() - Math.max(1, Math.min(24 * 14, input.windowHours ?? 48)) * 60 * 60 * 1000);
    const suspiciousVoteEvents = suspiciousDevices.size > 0
      ? await tx.odinEvent.findMany({
        where: {
          eventType: "PROJECT_VOTE",
          targetType: "Submission",
          targetId: submission.id,
          deviceId: { in: Array.from(suspiciousDevices) },
          createdAt: { gte: since },
        },
        select: {
          studentId: true,
          studentNumber: true,
          deviceId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
      : [];
    const suspiciousStudentIds = new Set(
      suspiciousVoteEvents
        .map((event) => event.studentId)
        .filter((studentId): studentId is number => typeof studentId === "number"),
    );
    const suspiciousStudentNumbers = new Set(
      suspiciousVoteEvents
        .map((event) => event.studentNumber)
        .filter((studentNumber): studentNumber is string => Boolean(studentNumber)),
    );

    const voteCandidates = await tx.studentVote.findMany({
      where: { submissionId: submission.id, eventKey },
      select: {
        id: true,
        studentId: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            studentNumber: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const orderedCandidates = [...voteCandidates].sort((left, right) => {
      const leftSuspicious = suspiciousStudentIds.has(left.studentId) || suspiciousStudentNumbers.has(left.student.studentNumber);
      const rightSuspicious = suspiciousStudentIds.has(right.studentId) || suspiciousStudentNumbers.has(right.student.studentNumber);
      if (leftSuspicious !== rightSuspicious) return leftSuspicious ? -1 : 1;
      return right.createdAt.getTime() - left.createdAt.getTime();
    });

    const selectedVotes = input.penaltyMode === "SUSPECT_VOTES"
      ? voteCandidates.filter((vote) => suspiciousStudentIds.has(vote.studentId) || suspiciousStudentNumbers.has(vote.student.studentNumber))
      : input.penaltyMode === "EXACT_VOTES"
        ? orderedCandidates.slice(0, exactVoteCount)
        : [];

    const selectedVoteIds = selectedVotes.map((vote) => vote.id);
    const selectedVoteSourceIds = selectedVoteIds.map(String);

    const scoreEventsToRevoke = selectedVoteSourceIds.length > 0
      ? await tx.exhibitorScoreEvent.findMany({
        where: {
          submissionId: submission.id,
          eventKey,
          sourceType: "STUDENT_VOTE",
          sourceId: { in: selectedVoteSourceIds },
          status: { not: "REVOKED" },
        },
        select: { id: true },
      })
      : [];
    const revokedScoreEventIds = scoreEventsToRevoke.map((event) => event.id);

    if (revokedScoreEventIds.length > 0) {
      await tx.exhibitorScoreEvent.updateMany({
        where: { id: { in: revokedScoreEventIds } },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          revokedByStudentNumber: input.actorStudentNumber,
          revokeReason: `ODIN: ${reason}`,
        },
      });
    }

    const removedVotes = selectedVoteIds.length > 0
      ? await tx.studentVote.deleteMany({ where: { id: { in: selectedVoteIds } } })
      : { count: 0 };

    const penalty = await tx.odinProjectPenalty.create({
      data: {
        submissionId: submission.id,
        penaltyMode: input.penaltyMode,
        requestedVoteCount: input.penaltyMode === "EXACT_VOTES" ? exactVoteCount : null,
        removedVoteCount: removedVotes.count,
        removedPointCount: pointsToRemove,
        reason,
        affectedVoteIdsJson: safeJson(selectedVoteIds),
        affectedStudentIdsJson: safeJson(selectedVotes.map((vote) => vote.studentId)),
        affectedScoreEventIdsJson: safeJson(revokedScoreEventIds),
        notifiedProjectMembers: input.notifyProjectMembers ?? true,
        createdByStudentNumber: input.actorStudentNumber,
      },
    });

    const penaltyScoreEvent = pointsToRemove > 0
      ? await tx.exhibitorScoreEvent.create({
        data: {
          businessKey: `odin-project-penalty:${eventKey}:${submission.id}:${penalty.id}`,
          eventKey,
          submissionId: submission.id,
          sourceType: "ODIN_PROJECT_PENALTY",
          sourceId: String(penalty.id),
          action: "ODIN_PROJECT_PENALTY",
          role: "PROJECT",
          basePoints: -pointsToRemove,
          bonusPoints: 0,
          multiplier: 1,
          points: -pointsToRemove,
          status: "VALID",
          reason: `Penalização ODIN: ${reason}`,
          metadataJson: safeJson({
            penaltyId: penalty.id,
            penaltyMode: input.penaltyMode,
            removedVoteCount: removedVotes.count,
          }),
          scoreConfigVersion: 1,
          createdByStudentNumber: input.actorStudentNumber,
          awardedAt: new Date(),
        },
      })
      : null;

    if (penaltyScoreEvent) {
      await tx.odinProjectPenalty.update({
        where: { id: penalty.id },
        data: {
          affectedScoreEventIdsJson: safeJson([...revokedScoreEventIds, penaltyScoreEvent.id]),
        },
      });
    }

    const affectedStudents = selectedVotes.map((vote) => ({
      studentId: vote.student.id,
      studentNumber: vote.student.studentNumber,
      studentName: vote.student.name,
    }));

    return {
      success: true as const,
      penaltyId: penalty.id,
      submissionId: submission.id,
      submissionName: submission.name,
      penaltyMode: input.penaltyMode,
      removedVoteCount: removedVotes.count,
      removedPointCount: pointsToRemove,
      revokedScoreEventCount: revokedScoreEventIds.length,
      notifiedProjectMembers: penalty.notifiedProjectMembers,
      affectedStudents,
      message: `Penalização ODIN aplicada a ${submission.name}: ${removedVotes.count} voto(s) removido(s), ${pointsToRemove} ponto(s) descontado(s).`,
    };
  });
}
