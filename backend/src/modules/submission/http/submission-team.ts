import { randomInt, randomUUID } from "node:crypto";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { normalizeAngolaPhone } from "../../auth/domain/student-format";
import {
  EXTERNAL_TEAM_MEMBER_REGISTRATION_SOURCE,
  generateTemporaryStudentPassword,
  hashLocalStudentPassword,
  LOCAL_STUDENT_PASSWORD_PURPOSE,
} from "../../auth/domain/local-student-credentials";
import { getSubmissionTypeLabel, normalizeSubmissionType } from "../domain/submission-policy";
import {
  buildSubmissionSlug,
  MAX_TEAM_MEMBERS,
  normalizeTeamMembersInput,
  stringifyTeamMembers,
} from "../domain/submission-format";

type SubmissionTeamSource = {
  id: number;
  referenceCode: string;
  type: "PROJECT" | "BUSINESS" | "PRODUCT";
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  name: string;
  area: string;
  course?: string | null;
  members: string | string[];
  leaderName?: string | null;
  studentId?: number | null;
  studentNumberSnapshot?: string | null;
};

type SubmissionMemberView = {
  id: number;
  name: string;
  confirmed: boolean;
  confirmedAt: string | null;
  expectedStudentNumber: string | null;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  isExternal: boolean;
  externalOrganization: string | null;
  externalReason: string | null;
  exceptionApprovedAt: string | null;
  role: "RESPONSAVEL" | "MEMBRO";
  roleLabel: string;
  isResponsible: boolean;
};

type SubmissionMemberViewSource = {
  id: number;
  name: string;
  confirmedAt?: Date | string | null;
  expectedStudentNumber?: string | null;
  studentNumber?: string | null;
  studentName?: string | null;
  studentCourse?: string | null;
  isExternal?: boolean | null;
  externalOrganization?: string | null;
  externalReason?: string | null;
  exceptionApprovedAt?: Date | string | null;
};

type StudentForConfirmation = {
  id: number;
  studentNumber: string;
  name?: string | null;
  course?: string | null;
  phone?: string | null;
  academicSyncedAt?: Date | string | null;
};

type ExternalTeamMemberConfirmationInput = {
  name?: string | null;
  phone: string;
  externalOrganization: string;
  externalReason?: string | null;
  actorStudentNumber?: string | null;
};

function toIsoString(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function buildSubmissionTeamMemberView(
  member: SubmissionMemberViewSource,
  options: {
    role?: "RESPONSAVEL" | "MEMBRO";
    roleLabel?: string;
    isResponsible?: boolean;
  } = {},
): SubmissionMemberView {
  const role = options.role ?? "MEMBRO";
  const isResponsible = options.isResponsible ?? role === "RESPONSAVEL";

  return {
    id: member.id,
    name: member.name,
    confirmed: Boolean(member.confirmedAt),
    confirmedAt: toIsoString(member.confirmedAt),
    expectedStudentNumber: member.expectedStudentNumber ?? null,
    studentNumber: member.studentNumber ?? null,
    studentName: member.studentName ?? null,
    studentCourse: member.studentCourse ?? null,
    isExternal: member.isExternal ?? false,
    externalOrganization: member.externalOrganization ?? null,
    externalReason: member.externalReason ?? null,
    exceptionApprovedAt: toIsoString(member.exceptionApprovedAt),
    role,
    roleLabel: options.roleLabel ?? (role === "RESPONSAVEL" ? "Responsável" : "Membro"),
    isResponsible,
  };
}

export function normalizeSubmissionMemberKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const nameParticles = new Set(["da", "de", "di", "do", "dos", "das", "e"]);

function significantNameTokens(value?: string | null) {
  return normalizeSubmissionMemberKey(value ?? "")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !nameParticles.has(token));
}

function boundedEditDistance(a: string, b: string, maxDistance: number) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let lastDiagonal = previous[0];
    previous[0] = i;
    let rowMinimum = previous[0];

    for (let j = 1; j <= b.length; j += 1) {
      const beforeUpdate = previous[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        lastDiagonal + cost,
      );
      lastDiagonal = beforeUpdate;
      rowMinimum = Math.min(rowMinimum, previous[j]);
    }

    if (rowMinimum > maxDistance) return maxDistance + 1;
  }

  return previous[b.length];
}

function namesAreClose(expected: string, actual: string) {
  if (expected === actual) return true;
  if (Math.min(expected.length, actual.length) < 5) return false;
  return boundedEditDistance(expected, actual, 1) <= 1;
}

export function isStudentNameCompatibleWithSubmissionMember(memberName: string, studentName?: string | null) {
  const memberTokens = significantNameTokens(memberName);
  const studentTokens = significantNameTokens(studentName);

  if (memberTokens.length === 0 || studentTokens.length === 0) return false;

  return memberTokens.every((memberToken) => (
    studentTokens.some((studentToken) => namesAreClose(memberToken, studentToken))
  ));
}

export function normalizeExpectedStudentNumber(value?: string | null) {
  const normalized = (value ?? "").replace(/\D/g, "").trim();
  return normalized.length >= 8 && normalized.length <= 12 ? normalized : null;
}

export function isStudentAllowedForSubmissionMember(
  member: { name: string; expectedStudentNumber?: string | null },
  student: { studentNumber: string; name?: string | null },
) {
  const expectedStudentNumber = normalizeExpectedStudentNumber(member.expectedStudentNumber);
  if (expectedStudentNumber) {
    return expectedStudentNumber === student.studentNumber.replace(/\D/g, "").trim();
  }

  return isStudentNameCompatibleWithSubmissionMember(member.name, student.name);
}

export function canShareSubmissionTeamInvite(input: {
  confirmationRequired: boolean;
  members: Array<{
    isResponsible?: boolean | null;
    confirmed?: boolean | null;
    expectedStudentNumber?: string | null;
  }>;
}) {
  if (!input.confirmationRequired) return false;
  return input.members.every((member) => (
    member.isResponsible
    || member.confirmed
    || Boolean(normalizeExpectedStudentNumber(member.expectedStudentNumber))
  ));
}

export function isStudentEligibleForTeamConfirmation(student: {
  studentNumber: string;
  academicSyncedAt?: Date | string | null;
}) {
  return Boolean(student.studentNumber && student.academicSyncedAt);
}

function publicAppBaseUrl(env: Env) {
  return env.PUBLIC_APP_URL?.replace(/\/$/, "")
    ?? env.CORS_ORIGIN.split(",").map((item) => item.trim()).find((item) => item.startsWith("http"))?.replace(/\/$/, "")
    ?? "http://localhost:5173";
}

function buildTeamInviteUrl(env: Env, token: string) {
  return `${publicAppBaseUrl(env)}/equipa/${encodeURIComponent(token)}`;
}

function normalizeExternalText(value?: string | null, maxLength = 160) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function generateExternalStudentNumber() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `8${String(randomInt(0, 100_000_000_000)).padStart(11, "0")}`;
    const existing = await prisma.student.findFirst({
      where: { studentNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `8${Date.now().toString().slice(-11)}`;
}

async function upsertExternalTeamMemberStudent(env: Env, input: {
  name: string;
  phone: string;
  externalOrganization: string;
}) {
  const name = normalizeExternalText(input.name, 120);
  if (name.length < 2) {
    throw new Error("Indica o nome completo do membro externo.");
  }

  const phone = normalizeAngolaPhone(input.phone);
  if (!phone || !/^\+2449\d{8}$/.test(phone)) {
    throw new Error("Indica um telefone angolano válido para o membro externo.");
  }

  const externalOrganization = normalizeExternalText(input.externalOrganization, 160);
  if (externalOrganization.length < 2) {
    throw new Error("Indica a universidade ou instituto médio deste membro.");
  }

  const now = new Date();
  const existingByPhone = await prisma.student.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { phone },
        { alternatePhone: phone },
      ],
    },
    select: {
      id: true,
      studentNumber: true,
      academicSyncedAt: true,
      registrationSource: true,
      name: true,
      university: true,
      isUorStudent: true,
    },
  });
  const studentNumber = existingByPhone?.studentNumber ?? await generateExternalStudentNumber();
  const preserveOfficialProfile = Boolean(existingByPhone?.academicSyncedAt);

  const student = await prisma.student.upsert({
    where: { institutionCode_studentNumber: { institutionCode: "UOR", studentNumber } },
    create: {
      institutionCode: "UOR",
      studentNumber,
      name,
      phone,
      university: externalOrganization,
      isUorStudent: false,
      registrationSource: EXTERNAL_TEAM_MEMBER_REGISTRATION_SOURCE,
      profileCompletedAt: now,
    },
    update: {
      name: preserveOfficialProfile ? existingByPhone?.name ?? name : name,
      phone,
      university: preserveOfficialProfile ? existingByPhone?.university ?? externalOrganization : externalOrganization,
      isUorStudent: preserveOfficialProfile ? existingByPhone?.isUorStudent ?? false : false,
      registrationSource: preserveOfficialProfile
        ? existingByPhone?.registrationSource ?? "SECRETARIA"
        : EXTERNAL_TEAM_MEMBER_REGISTRATION_SOURCE,
      profileCompletedAt: now,
      deletedAt: null,
      deletionReason: null,
    },
  });

  const temporaryPassword = generateTemporaryStudentPassword();
  await prisma.studentAccessCode.updateMany({
    where: {
      studentId: student.id,
      purpose: LOCAL_STUDENT_PASSWORD_PURPOSE,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      usedAt: now,
      deliveryStatus: "REVOKED",
      errorMessage: "Senha temporária substituída por nova confirmação externa.",
    },
  });

  await prisma.studentAccessCode.create({
    data: {
      studentId: student.id,
      phone,
      codeHash: hashLocalStudentPassword(studentNumber, temporaryPassword, env.JWT_SECRET),
      codeLast4: temporaryPassword.slice(-4),
      expiresAt: new Date(now.getTime() + 180 * 24 * 60 * 60_000),
      sentAt: now,
      purpose: LOCAL_STUDENT_PASSWORD_PURPOSE,
      deliveryStatus: "ACTIVE",
      providerResponseJson: JSON.stringify({
        source: EXTERNAL_TEAM_MEMBER_REGISTRATION_SOURCE,
        channel: "manual",
      }),
    },
  });

  return {
    student,
    temporaryPassword,
    phone,
    externalOrganization,
  };
}

export function isSubmissionTeamConfirmationRequired(
  submission: Pick<SubmissionTeamSource, "status" | "members" | "leaderName">,
) {
  if (submission.status === "REJECTED") return false;

  const memberNames = normalizeTeamMembersInput(submission.members);
  if (memberNames.length === 0) return false;

  const leaderKey = submission.leaderName
    ? normalizeSubmissionMemberKey(submission.leaderName)
    : null;

  if (!leaderKey) {
    return memberNames.length > 1;
  }

  return memberNames.some(
    (memberName) => normalizeSubmissionMemberKey(memberName) !== leaderKey,
  );
}

export function buildMemberJourneyLabel(payload: {
  total: number;
  confirmed: number;
  required?: boolean;
}) {
  if (payload.required === false) {
    return payload.total > 1 ? "Confirmação dispensada" : "Equipa individual";
  }
  if (payload.total === 0) return "Equipa individual";
  if (payload.confirmed >= payload.total) return "Equipa confirmada";
  if (payload.confirmed > 0) return `${payload.confirmed}/${payload.total} membros confirmados`;
  return "Confirmação pendente";
}

export async function ensureSubmissionTeamInviteToken(submissionId: number) {
  const existing = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: { teamInviteToken: true, status: true },
  });

  if (!existing) {
    throw new Error("Submission not found");
  }

  if (existing.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita confirmação de membros.");
  }

  if (existing.teamInviteToken) {
    return existing.teamInviteToken;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = `team_${randomUUID().replace(/-/g, "")}`;
    try {
      const updated = await prisma.submission.update({
        where: { id: submissionId },
        data: { teamInviteToken: token },
        select: { teamInviteToken: true },
      });
      return updated.teamInviteToken!;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }

  throw new Error("Unable to create team invitation");
}

export async function syncSubmissionTeamMembers(submission: SubmissionTeamSource) {
  const memberNames = normalizeTeamMembersInput(submission.members);
  const normalizedNames = new Set(memberNames.map(normalizeSubmissionMemberKey));

  await prisma.submissionMember.deleteMany({
    where: {
      submissionId: submission.id,
      confirmedAt: null,
      normalizedName: { notIn: Array.from(normalizedNames) },
    },
  });

  await Promise.all(memberNames.map(async (memberName) => {
    const normalizedName = normalizeSubmissionMemberKey(memberName);
    const isLeaderName = submission.leaderName
      ? normalizedName === normalizeSubmissionMemberKey(submission.leaderName)
      : false;

    await prisma.submissionMember.upsert({
      where: {
        submissionId_normalizedName: {
          submissionId: submission.id,
          normalizedName,
        },
      },
      create: {
        submissionId: submission.id,
        name: memberName,
        normalizedName,
        ...(isLeaderName && submission.studentId
          ? {
              studentId: submission.studentId,
              expectedStudentNumber: submission.studentNumberSnapshot ?? null,
              studentNumber: submission.studentNumberSnapshot ?? null,
              studentName: submission.leaderName ?? null,
              studentCourse: submission.course ?? null,
              confirmedAt: new Date(),
            }
          : {}),
      },
      update: {
        name: memberName,
        ...(isLeaderName && submission.studentId
          ? {
              studentId: submission.studentId,
              expectedStudentNumber: submission.studentNumberSnapshot ?? null,
              studentNumber: submission.studentNumberSnapshot ?? null,
              studentName: submission.leaderName ?? null,
              studentCourse: submission.course ?? null,
              confirmedAt: new Date(),
            }
          : {}),
      },
    });
  }));

  return prisma.submissionMember.findMany({
    where: { submissionId: submission.id },
    orderBy: [{ confirmedAt: "desc" }, { name: "asc" }],
  });
}

export async function buildSubmissionTeamPayload(env: Env, submission: SubmissionTeamSource) {
  const confirmationRequired = isSubmissionTeamConfirmationRequired(submission);
  const token = confirmationRequired
    ? await ensureSubmissionTeamInviteToken(submission.id)
    : null;
  const members = await syncSubmissionTeamMembers(submission);
  const leaderName = submission.leaderName?.trim() || null;
  const leaderKey = leaderName ? normalizeSubmissionMemberKey(leaderName) : null;
  const leaderStudentNumber = submission.studentNumberSnapshot?.trim() || null;
  const existingLeaderMember = members.find((member) => (
    (leaderStudentNumber && member.studentNumber === leaderStudentNumber)
    || (leaderKey && normalizeSubmissionMemberKey(member.name) === leaderKey)
  )) ?? null;
  const responsibleMember: SubmissionMemberView | null = leaderName || leaderStudentNumber
    ? {
        id: existingLeaderMember?.id ?? -submission.id,
        name: existingLeaderMember?.name ?? leaderName ?? "Responsável",
        confirmed: true,
        confirmedAt: existingLeaderMember?.confirmedAt?.toISOString() ?? null,
        expectedStudentNumber: existingLeaderMember?.expectedStudentNumber ?? leaderStudentNumber,
        studentNumber: existingLeaderMember?.studentNumber ?? leaderStudentNumber,
        studentName: existingLeaderMember?.studentName ?? leaderName,
        studentCourse: existingLeaderMember?.studentCourse ?? submission.course ?? null,
        isExternal: existingLeaderMember?.isExternal ?? false,
        externalOrganization: existingLeaderMember?.externalOrganization ?? null,
        externalReason: existingLeaderMember?.externalReason ?? null,
        exceptionApprovedAt: existingLeaderMember?.exceptionApprovedAt?.toISOString() ?? null,
        role: "RESPONSAVEL",
        roleLabel: "Responsável",
        isResponsible: true,
      }
    : null;
  const memberViews: SubmissionMemberView[] = members
    .filter((member) => existingLeaderMember ? member.id !== existingLeaderMember.id : true)
    .map((member) => buildSubmissionTeamMemberView(member));
  const teamMembers = responsibleMember ? [responsibleMember, ...memberViews] : memberViews;
  const total = teamMembers.length;
  const confirmed = teamMembers.filter((member) => member.confirmed).length;
  const effectiveConfirmed = confirmationRequired ? confirmed : total;
  const slug = buildSubmissionSlug(submission.name, submission.id);

  return {
    submission: {
      id: submission.id,
      referenceCode: submission.referenceCode,
      name: submission.name,
      status: submission.status,
      type: normalizeSubmissionType(submission.type, submission.area),
      typeLabel: getSubmissionTypeLabel(submission.type, submission.area),
      course: submission.course ?? null,
      leaderName: submission.leaderName ?? null,
      detailPath: `/projeto/${slug}`,
    },
    inviteUrl: token ? buildTeamInviteUrl(env, token) : null,
    token,
    totalMembers: total,
    confirmedMembers: effectiveConfirmed,
    allConfirmed: !confirmationRequired || (total > 0 && confirmed >= total),
    journeyLabel: buildMemberJourneyLabel({
      total,
      confirmed: effectiveConfirmed,
      required: confirmationRequired,
    }),
    members: teamMembers,
  };
}

export async function addSubmissionTeamMember(env: Env, submission: SubmissionTeamSource, name: string) {
  if (submission.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita novos membros.");
  }

  const currentMembers = normalizeTeamMembersInput(submission.members);
  const memberName = normalizeTeamMembersInput([name])[0];

  if (!memberName) {
    throw new Error("Indica um nome válido para o novo membro.");
  }

  const memberKey = normalizeSubmissionMemberKey(memberName);
  const alreadyExists = currentMembers.some((member) => normalizeSubmissionMemberKey(member) === memberKey);

  if (alreadyExists) {
    throw new Error("Este membro já existe na equipa.");
  }

  if (currentMembers.length >= MAX_TEAM_MEMBERS) {
    throw new Error(`A equipa já atingiu o limite de ${MAX_TEAM_MEMBERS} membros.`);
  }

  const nextMembers = [...currentMembers, memberName];

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      members: stringifyTeamMembers(nextMembers),
      teamSize: nextMembers.length,
    },
  });

  return buildSubmissionTeamPayload(env, {
    ...submission,
    members: nextMembers,
  });
}

export function removeSubmissionTeamMemberFromList(input: {
  members: string[] | string;
  memberName: string;
  leaderName?: string | null;
}) {
  const currentMembers = normalizeTeamMembersInput(input.members);
  const memberKey = normalizeSubmissionMemberKey(input.memberName);
  if (!memberKey) {
    throw new Error("Membro não encontrado neste projeto.");
  }

  const leaderKey = input.leaderName ? normalizeSubmissionMemberKey(input.leaderName) : null;
  if (leaderKey && memberKey === leaderKey) {
    throw new Error("O responsável não pode ser removido da equipa.");
  }

  const nextMembers = currentMembers.filter((member) => normalizeSubmissionMemberKey(member) !== memberKey);
  if (nextMembers.length === currentMembers.length) {
    throw new Error("Membro não encontrado neste projeto.");
  }
  if (nextMembers.length === 0) {
    throw new Error("A equipa precisa manter pelo menos um membro.");
  }

  return nextMembers;
}

export async function removeSubmissionTeamMember(
  env: Env,
  submission: SubmissionTeamSource,
  memberId: number,
) {
  if (submission.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita alterações de equipa.");
  }

  await syncSubmissionTeamMembers(submission);

  const member = await prisma.submissionMember.findFirst({
    where: {
      id: memberId,
      submissionId: submission.id,
    },
  });

  if (!member) {
    throw new Error("Membro não encontrado neste projeto.");
  }

  const nextMembers = removeSubmissionTeamMemberFromList({
    members: submission.members,
    memberName: member.name,
    leaderName: submission.leaderName,
  });

  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: {
        members: stringifyTeamMembers(nextMembers),
        teamSize: nextMembers.length,
      },
    }),
    prisma.submissionMember.delete({
      where: { id: member.id },
    }),
  ]);

  return buildSubmissionTeamPayload(env, {
    ...submission,
    members: nextMembers,
  });
}

export function buildSubmissionMemberStudentNumberReservation(input: {
  expectedStudentNumber: string;
  confirmedAt?: Date | null;
  submissionCourse?: string | null;
  student?: StudentForConfirmation | null;
}) {
  if (!input.student || !isStudentEligibleForTeamConfirmation(input.student)) {
    return {
      expectedStudentNumber: input.expectedStudentNumber,
      studentId: null,
      studentNumber: null,
      studentName: null,
      studentCourse: null,
      studentPhone: null,
      confirmedAt: null,
    };
  }

  return {
    expectedStudentNumber: input.expectedStudentNumber,
    studentId: input.student.id,
    studentNumber: input.student.studentNumber,
    studentName: input.student.name ?? null,
    studentCourse: input.student.course ?? input.submissionCourse ?? null,
    studentPhone: input.student.phone ?? null,
    confirmedAt: input.confirmedAt ?? null,
  };
}

export async function setSubmissionTeamMemberExpectedStudentNumber(
  env: Env,
  submission: SubmissionTeamSource,
  memberId: number,
  studentNumber: string,
) {
  if (submission.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita confirmação de membros.");
  }

  const expectedStudentNumber = normalizeExpectedStudentNumber(studentNumber);
  if (!expectedStudentNumber) {
    throw new Error("Indica um número de estudante válido para este membro.");
  }

  await syncSubmissionTeamMembers(submission);

  const member = await prisma.submissionMember.findFirst({
    where: {
      id: memberId,
      submissionId: submission.id,
    },
  });

  if (!member) {
    throw new Error("Membro não encontrado neste projeto.");
  }

  const leaderName = submission.leaderName?.trim() || null;
  const leaderKey = leaderName ? normalizeSubmissionMemberKey(leaderName) : null;
  const isResponsibleMember = Boolean(
    member.studentId && submission.studentId && member.studentId === submission.studentId,
  ) || Boolean(
    leaderKey && normalizeSubmissionMemberKey(member.name) === leaderKey,
  );

  if (isResponsibleMember) {
    throw new Error("O responsável já está ligado à candidatura.");
  }

  const student = await prisma.student.findFirst({
    where: { studentNumber: expectedStudentNumber },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      course: true,
      phone: true,
      academicSyncedAt: true,
    },
  });

  const duplicateMember = await prisma.submissionMember.findFirst({
    where: {
      submissionId: submission.id,
      NOT: { id: member.id },
      OR: student
        ? [
            { expectedStudentNumber },
            { studentNumber: expectedStudentNumber },
            { studentId: student.id },
          ]
        : [
            { expectedStudentNumber },
            { studentNumber: expectedStudentNumber },
          ],
    },
    select: { name: true },
  });

  if (duplicateMember) {
    throw new Error(`O número ${expectedStudentNumber} já está ligado a ${duplicateMember.name}.`);
  }

  if (member.confirmedAt && member.studentNumber && member.studentNumber !== expectedStudentNumber) {
    throw new Error("Este membro já confirmou presença com outro número. Remove ou corrige a equipa antes de alterar.");
  }

  await prisma.submissionMember.update({
    where: { id: member.id },
    data: buildSubmissionMemberStudentNumberReservation({
      expectedStudentNumber,
      confirmedAt: member.confirmedAt,
      submissionCourse: submission.course,
      student,
    }),
  });

  return buildSubmissionTeamPayload(env, submission);
}

export async function adminConfirmSubmissionTeamMember(
  env: Env,
  submission: SubmissionTeamSource,
  memberId: number,
) {
  if (submission.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita confirmação de membros.");
  }

  await syncSubmissionTeamMembers(submission);

  const member = await prisma.submissionMember.findFirst({
    where: {
      id: memberId,
      submissionId: submission.id,
    },
  });

  if (!member) {
    throw new Error("Membro não encontrado neste projeto.");
  }

  const expectedStudentNumber = normalizeExpectedStudentNumber(member.expectedStudentNumber);
  if (!expectedStudentNumber) {
    throw new Error("Indica primeiro o número de estudante deste membro.");
  }

  const student = await prisma.student.findFirst({
    where: { studentNumber: expectedStudentNumber },
    select: {
      id: true,
      studentNumber: true,
      name: true,
      course: true,
      phone: true,
      academicSyncedAt: true,
    },
  });

  if (!student || !isStudentEligibleForTeamConfirmation(student)) {
    throw new Error("Este estudante ainda precisa entrar pela Secretaria antes de ser confirmado pela administração.");
  }

  const otherMemberForStudent = await prisma.submissionMember.findFirst({
    where: {
      submissionId: submission.id,
      NOT: { id: member.id },
      OR: [
        { studentId: student.id },
        { studentNumber: student.studentNumber },
      ],
    },
    select: { name: true },
  });

  if (otherMemberForStudent) {
    throw new Error(`Este estudante já está ligado a ${otherMemberForStudent.name}.`);
  }

  await prisma.submissionMember.update({
    where: { id: member.id },
    data: {
      expectedStudentNumber,
      studentId: student.id,
      studentNumber: student.studentNumber,
      studentName: student.name ?? member.name,
      studentCourse: student.course ?? submission.course ?? null,
      studentPhone: student.phone ?? null,
      confirmedAt: member.confirmedAt ?? new Date(),
    },
  });

  return buildSubmissionTeamPayload(env, submission);
}

export async function adminConfirmExternalSubmissionTeamMember(
  env: Env,
  submission: SubmissionTeamSource,
  memberId: number,
  input: ExternalTeamMemberConfirmationInput,
) {
  if (submission.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita confirmação de membros.");
  }

  await syncSubmissionTeamMembers(submission);

  const member = await prisma.submissionMember.findFirst({
    where: {
      id: memberId,
      submissionId: submission.id,
    },
  });

  if (!member) {
    throw new Error("Membro não encontrado neste projeto.");
  }

  const leaderName = submission.leaderName?.trim() || null;
  const leaderKey = leaderName ? normalizeSubmissionMemberKey(leaderName) : null;
  const isResponsibleMember = Boolean(
    member.studentId && submission.studentId && member.studentId === submission.studentId,
  ) || Boolean(
    leaderKey && normalizeSubmissionMemberKey(member.name) === leaderKey,
  );

  if (isResponsibleMember) {
    throw new Error("O responsável já está ligado à candidatura.");
  }

  const created = await upsertExternalTeamMemberStudent(env, {
    name: input.name?.trim() || member.name,
    phone: input.phone,
    externalOrganization: input.externalOrganization,
  });

  const duplicateMember = await prisma.submissionMember.findFirst({
    where: {
      submissionId: submission.id,
      NOT: { id: member.id },
      OR: [
        { studentId: created.student.id },
        { studentNumber: created.student.studentNumber },
      ],
    },
    select: { name: true },
  });

  if (duplicateMember) {
    throw new Error(`Este estudante já está ligado a ${duplicateMember.name}.`);
  }

  const now = new Date();
  const externalReason = normalizeExternalText(
    input.externalReason || "Membro externo confirmado pelo responsável do projeto.",
    400,
  );

  await prisma.submissionMember.update({
    where: { id: member.id },
    data: {
      expectedStudentNumber: created.student.studentNumber,
      studentId: created.student.id,
      studentNumber: created.student.studentNumber,
      studentName: created.student.name ?? member.name,
      studentCourse: created.student.course ?? submission.course ?? null,
      studentPhone: created.phone,
      isExternal: true,
      externalOrganization: created.externalOrganization,
      externalReason,
      exceptionApprovedAt: now,
      exceptionApprovedByStudentNumber: input.actorStudentNumber ?? null,
      confirmedAt: member.confirmedAt ?? now,
    },
  });

  return {
    credentials: {
      studentNumber: created.student.studentNumber,
      temporaryPassword: created.temporaryPassword,
    },
    team: await buildSubmissionTeamPayload(env, submission),
  };
}

export async function replaceSubmissionTeamMembers(
  env: Env,
  submission: SubmissionTeamSource,
  members: string[],
) {
  const normalizedMembers = normalizeTeamMembersInput(members);

  if (normalizedMembers.length === 0) {
    throw new Error("Indica pelo menos um membro da equipa.");
  }

  if (normalizedMembers.length > MAX_TEAM_MEMBERS) {
    throw new Error(`A equipa só pode ter até ${MAX_TEAM_MEMBERS} membros.`);
  }

  const normalizedNames = new Set(normalizedMembers.map(normalizeSubmissionMemberKey));
  if (normalizedNames.size !== normalizedMembers.length) {
    throw new Error("Remove nomes repetidos antes de guardar a equipa.");
  }

  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: {
        members: stringifyTeamMembers(normalizedMembers),
        teamSize: normalizedMembers.length,
      },
    }),
    prisma.submissionMember.deleteMany({
      where: {
        submissionId: submission.id,
        normalizedName: { notIn: Array.from(normalizedNames) },
      },
    }),
  ]);

  return buildSubmissionTeamPayload(env, {
    ...submission,
    members: normalizedMembers,
  });
}

export async function loadSubmissionTeamByToken(env: Env, token: string) {
  const submission = await prisma.submission.findFirst({
    where: {
      teamInviteToken: token,
      deletedAt: null,
      status: { not: "REJECTED" },
    },
    select: {
      id: true,
      referenceCode: true,
      type: true,
      status: true,
      name: true,
      area: true,
      course: true,
      members: true,
      leaderName: true,
      studentId: true,
      studentNumberSnapshot: true,
    },
  });

  if (!submission) {
    return null;
  }

  return buildSubmissionTeamPayload(env, submission);
}

export async function confirmSubmissionTeamMember(env: Env, input: {
  token: string;
  memberId: number;
  student: StudentForConfirmation;
}) {
  const submission = await prisma.submission.findFirst({
    where: {
      teamInviteToken: input.token,
      deletedAt: null,
      status: { not: "REJECTED" },
    },
    select: {
      id: true,
      referenceCode: true,
      type: true,
      status: true,
      name: true,
      area: true,
      course: true,
      members: true,
      leaderName: true,
      studentId: true,
      studentNumberSnapshot: true,
    },
  });

  if (!submission) {
    throw new Error("Convite de equipa não encontrado.");
  }

  if (submission.status === "REJECTED") {
    throw new Error("Esta candidatura foi recusada e já não aceita confirmação de membros.");
  }

  await syncSubmissionTeamMembers(submission);

  const member = await prisma.submissionMember.findFirst({
    where: {
      id: input.memberId,
      submissionId: submission.id,
    },
  });

  if (!member) {
    throw new Error("Membro não encontrado neste convite.");
  }

  if (!isStudentEligibleForTeamConfirmation(input.student)) {
    throw new Error("A confirmação de presença exige login pela Secretaria. Entra com o número de estudante e a senha da secretaria.uor.edu.ao.");
  }

  if (!normalizeExpectedStudentNumber(member.expectedStudentNumber)) {
    throw new Error("Este convite ainda não tem número de estudante reservado. Pede ao responsável para preencher o número antes de confirmares.");
  }

  if (member.studentId && member.studentId !== input.student.id) {
    throw new Error("Este nome já foi confirmado por outro estudante.");
  }

  if (!isStudentAllowedForSubmissionMember(member, input.student)) {
    const sessionName = input.student.name?.trim() || "esta conta";
    const expectedStudentNumber = normalizeExpectedStudentNumber(member.expectedStudentNumber);
    if (expectedStudentNumber) {
      throw new Error(`Este convite está reservado para o número ${expectedStudentNumber}. Entra com essa conta ou pede ao responsável para corrigir o número.`);
    }
    throw new Error(`Selecionaste ${member.name}, mas a sessão ativa é ${sessionName}. Entra com a conta correta ou pede à organização para corrigir a equipa.`);
  }

  const otherMemberForStudent = await prisma.submissionMember.findFirst({
    where: {
      submissionId: submission.id,
      studentId: input.student.id,
      NOT: { id: member.id },
    },
  });

  if (otherMemberForStudent) {
    throw new Error("Este estudante já confirmou outro nome neste projeto.");
  }

  const updated = await prisma.submissionMember.update({
    where: { id: member.id },
    data: {
      studentId: input.student.id,
      studentNumber: input.student.studentNumber,
      studentName: input.student.name ?? member.name,
      studentCourse: input.student.course ?? submission.course ?? null,
      studentPhone: input.student.phone ?? null,
      confirmedAt: member.confirmedAt ?? new Date(),
    },
  });

  return {
    member: buildSubmissionTeamMemberView(updated),
    team: await buildSubmissionTeamPayload(env, submission),
  };
}
