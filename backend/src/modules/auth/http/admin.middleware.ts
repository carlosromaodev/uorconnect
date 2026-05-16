import type { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import fp from "fastify-plugin";
import { type Env } from "../../../config/env";
import { verifyAuthToken } from "../utils/jwt";
import { prisma } from "../../../shared/prisma";
import { getCookie } from "../../../shared/cookies";
import {
  ALL_ADMIN_PERMISSIONS,
  type AdminPermission,
  expandAdminPermissions,
  hasAdminPermission,
  isDefaultAdminStudentNumber,
} from "../domain/admin-authorized-students";
import { recordAdminAudit } from "../../audit/application/audit.service";

export type AdminAccessProfile = {
  studentNumber: string;
  team: string;
  role: string;
  permissions: AdminPermission[];
  isSuperAdmin: boolean;
};

export type AdminPermissionMode = "ANY" | "ALL";

export type AdminPermissionPolicy = {
  permissions: AdminPermission[];
  mode: AdminPermissionMode;
};

const nucleusBaseAdminPermissions = "OVERVIEW,TASKS,NUCLEUS,CREDENTIALS";
const nucleusFullAdminPermissions = ALL_ADMIN_PERMISSIONS.join(",");

declare module "fastify" {
  interface FastifyContextConfig {
    adminPermissionPolicy?: AdminPermissionPolicy | null;
  }
}

export function requireAdminPermission(
  permissions: AdminPermission[],
  mode: AdminPermissionMode = "ANY",
) {
  return { adminPermissionPolicy: { permissions, mode } };
}

export function setDefaultAdminPermission(
  app: FastifyInstance,
  permissions: AdminPermission[],
  mode: AdminPermissionMode = "ANY",
) {
  app.addHook("onRoute", (routeOptions: RouteOptions) => {
    const config = routeOptions.config ?? {};
    if ("adminPermissionPolicy" in config) return;
    routeOptions.config = {
      ...config,
      ...requireAdminPermission(permissions, mode),
    };
  });
}

function isSuperAdminProfile(role: string, permissions: string) {
  return role === "SUPER_ADMIN" || permissions === "ALL";
}

async function auditAdminPermissionConflict(input: {
  studentNumber: string;
  reason: string;
  authorizedStudent?: { team: string; role: string; permissions: string } | null;
  membership?: { id: number; team: string; role: string; permissions: string; status: string } | null;
}) {
  try {
    const recent = await prisma.adminAuditLog.findFirst({
      where: {
        action: "security.admin_permission_conflict",
        entityType: "AdminAuthorizedStudent",
        entityId: input.studentNumber,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) return;

    await recordAdminAudit({
      actorStudentNumber: input.studentNumber,
      action: "security.admin_permission_conflict",
      entityType: "AdminAuthorizedStudent",
      entityId: input.studentNumber,
      summary: `Conflito de permissão administrativa para ${input.studentNumber}: ${input.reason}.`,
      metadata: {
        reason: input.reason,
        authorizedStudent: input.authorizedStudent ?? null,
        membership: input.membership ?? null,
      },
    });
  } catch {
    // Audit failures must not open or block admin access decisions.
  }
}

function hasAdminPermissionByPolicy(
  permissions: string[] | string | null | undefined,
  policy: AdminPermissionPolicy,
) {
  if (policy.mode === "ANY") return hasAdminPermission(permissions, policy.permissions);
  return policy.permissions.every((permission) => hasAdminPermission(permissions, permission));
}

function hasExplicitAdminPermissions(permissions?: string | null) {
  return Boolean(permissions?.split(",").some((permission) => permission.trim().length > 0));
}

function normalizeAdminMembershipText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isNucleusMembershipWithAdminAccess(member: { category?: string | null; permissions?: string | null }) {
  return member.category === "NUCLEO" || hasExplicitAdminPermissions(member.permissions);
}

function isNucleusFullAccessMembership(member: {
  category?: string | null;
  team?: string | null;
  role?: string | null;
  accessLevel?: string | null;
}) {
  if (member.category !== "NUCLEO") return false;
  const text = `${normalizeAdminMembershipText(member.role)} ${normalizeAdminMembershipText(member.accessLevel)}`;
  return [
    "presidente",
    "vice",
    "secretario",
    "tesoureiro",
    "coordenador",
    "subcoordenador",
    "lider",
    "direcao",
    "secretaria",
    "tesouraria",
    "coordenacao",
    "lideranca",
  ].some((term) => text.includes(term));
}

function permissionsForOfficialMembership(member: {
  category?: string | null;
  team?: string | null;
  role?: string | null;
  accessLevel?: string | null;
  permissions?: string | null;
}) {
  if (isNucleusFullAccessMembership(member)) return nucleusFullAdminPermissions;
  if (hasExplicitAdminPermissions(member.permissions)) return member.permissions;
  if (member.category === "NUCLEO") return nucleusBaseAdminPermissions;
  return member.permissions;
}

async function auditAdminPermissionDenied(input: {
  studentNumber: string;
  url: string;
  method: string;
  policy: AdminPermissionPolicy;
}) {
  try {
    await recordAdminAudit({
      actorStudentNumber: input.studentNumber,
      action: "security.admin_permission_denied",
      entityType: "AdminRoute",
      entityId: `${input.method} ${input.url.split("?")[0] ?? input.url}`,
      summary: `Acesso negado a rota administrativa por falta de permissão.`,
      metadata: {
        method: input.method,
        url: input.url,
        requiredPermissions: input.policy.permissions,
        mode: input.policy.mode,
      },
    });
  } catch {
    // Denial audit must not change the authorization response.
  }
}

export async function isAdminStudentNumber(studentNumber: string) {
  return Boolean(await getAdminProfileByStudentNumber(studentNumber));
}

export async function getAdminProfileByStudentNumber(studentNumber: string): Promise<AdminAccessProfile | null> {
  const normalized = studentNumber.trim();
  if (isDefaultAdminStudentNumber(normalized)) {
    return {
      studentNumber: normalized,
      team: "Direção",
      role: "SUPER_ADMIN",
      permissions: expandAdminPermissions("ALL"),
      isSuperAdmin: true,
    };
  }

  const authorizedStudent = await prisma.adminAuthorizedStudent.findUnique({
    where: { studentNumber: normalized },
    select: { studentNumber: true, team: true, role: true, permissions: true, isActive: true },
  });

  const memberships = await prisma.teamMembership.findMany({
    where: { studentNumber: normalized },
    select: {
      id: true,
      studentNumber: true,
      category: true,
      team: true,
      role: true,
      accessLevel: true,
      permissions: true,
      status: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });
  const activeMemberships = memberships.filter((item) => item.status === "ACTIVE");
  const inactiveOfficialMembership = memberships.find((item) => ["SUSPENDED", "REMOVED"].includes(item.status)) ?? null;
  const membership = activeMemberships.find((item) => isNucleusMembershipWithAdminAccess(item)) ?? null;

  if (!authorizedStudent?.isActive) {
    if (!membership) return null;

    const membershipPermissionString = permissionsForOfficialMembership(membership);
    const membershipPermissions = expandAdminPermissions(membershipPermissionString);
    return {
      studentNumber: membership.studentNumber ?? normalized,
      team: membership.team,
      role: membership.role,
      permissions: membershipPermissions,
      isSuperAdmin: isSuperAdminProfile(membership.role, membershipPermissionString ?? ""),
    };
  }

  if (isSuperAdminProfile(authorizedStudent.role, authorizedStudent.permissions)) {
    const permissions = expandAdminPermissions(authorizedStudent.permissions);
    return {
      studentNumber: authorizedStudent.studentNumber,
      team: authorizedStudent.team,
      role: authorizedStudent.role,
      permissions,
      isSuperAdmin: true,
    };
  }

  if (!membership && inactiveOfficialMembership) {
    await auditAdminPermissionConflict({
      studentNumber: normalized,
      reason: "official_membership_inactive",
      authorizedStudent,
      membership: inactiveOfficialMembership,
    });
    return null;
  }

  if (membership) {
    const membershipPermissionString = permissionsForOfficialMembership(membership);
    if (
      authorizedStudent.team !== membership.team
      || authorizedStudent.role !== membership.role
      || authorizedStudent.permissions !== membershipPermissionString
    ) {
      await auditAdminPermissionConflict({
        studentNumber: normalized,
        reason: "official_membership_precedence",
        authorizedStudent,
        membership,
      });
    }

    const membershipPermissions = expandAdminPermissions(membershipPermissionString);
    return {
      studentNumber: membership.studentNumber ?? normalized,
      team: membership.team,
      role: membership.role,
      permissions: membershipPermissions,
      isSuperAdmin: isSuperAdminProfile(membership.role, membershipPermissionString ?? ""),
    };
  }

  const permissions = expandAdminPermissions(authorizedStudent.permissions);
  return {
    studentNumber: authorizedStudent.studentNumber,
    team: authorizedStudent.team,
    role: authorizedStudent.role,
    permissions,
    isSuperAdmin: isSuperAdminProfile(authorizedStudent.role, authorizedStudent.permissions),
  };
}

export async function getJuryAdminProfileById(juryId: number): Promise<AdminAccessProfile | null> {
  const member = await prisma.juryMember.findUnique({
    where: { id: juryId },
    select: { id: true, name: true, team: true, role: true, permissions: true, isActive: true },
  });

  if (!member?.isActive) return null;

  const permissions = expandAdminPermissions(member.permissions);
  return {
    studentNumber: `jury-${member.id}`,
    team: member.team || "Júri",
    role: member.role,
    permissions,
    isSuperAdmin: isSuperAdminProfile(member.role, member.permissions),
  };
}

export async function getAdminAccessResult(request: FastifyRequest, env: Env) {
  const authHeader = request.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring("Bearer ".length)
    : null;
  const cookieToken = getCookie(request, "uor_auth");
  const token = bearerToken || cookieToken;
  const authSource = bearerToken ? "bearer" : cookieToken ? "cookie" : null;

  if (!token || !authSource) {
    return {
      allowed: false as const,
      status: 401 as const,
      message: "Missing or invalid token",
    };
  }

  try {
    if (authSource === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
      const csrfCookie = getCookie(request, "uor_csrf");
      const csrfHeader = String(request.headers["x-csrf-token"] ?? "").trim();
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return {
          allowed: false as const,
          status: 403 as const,
          message: "CSRF token inválido ou ausente.",
        };
      }
    }

    const payload = verifyAuthToken(token, env);

    if (payload.role === "jury") {
      const juryProfile = await getJuryAdminProfileById(payload.sub);
      if (!juryProfile) {
        return {
          allowed: false as const,
          status: 403 as const,
          message: "Access denied",
        };
      }

      return {
        allowed: true as const,
        studentNumber: `jury-${payload.sub}`,
        admin: juryProfile,
      };
    }

    if (payload.role === "trainer") {
      return {
        allowed: false as const,
        status: 403 as const,
        message: "Access denied",
      };
    }

    const adminProfile = await getAdminProfileByStudentNumber(payload.studentNumber);
    if (!adminProfile) {
      return {
        allowed: false as const,
        status: 403 as const,
        message: "Access denied",
      };
    }

    return {
      allowed: true as const,
      studentNumber: payload.studentNumber,
      admin: adminProfile,
    };
  } catch {
    return {
      allowed: false as const,
      status: 401 as const,
      message: "Invalid token",
    };
  }
}

export const adminGuard = fp(async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const student = request.student;
    const jury = request.jury;
    const routePolicy = request.routeOptions.config.adminPermissionPolicy;
    const requiredPolicy = routePolicy === undefined
      ? { permissions: ["SECURITY"] as AdminPermission[], mode: "ANY" as const }
      : routePolicy;

    if (jury) {
      const juryProfile = await getJuryAdminProfileById(jury.id);
      if (!juryProfile) {
        return reply.status(403).send({ message: "Access denied" });
      }
      if (requiredPolicy && !hasAdminPermissionByPolicy(juryProfile.isSuperAdmin ? "ALL" : juryProfile.permissions, requiredPolicy)) {
        await auditAdminPermissionDenied({
          studentNumber: `jury-${jury.id}`,
          url: request.url,
          method: request.method,
          policy: requiredPolicy,
        });
        return reply.status(403).send({ message: "Access denied for this admin area" });
      }
      return;
    }

    if (!student) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const adminProfile = await getAdminProfileByStudentNumber(student.studentNumber);
    if (!adminProfile) {
      return reply.status(403).send({ message: "Access denied" });
    }

    if (requiredPolicy && !hasAdminPermissionByPolicy(adminProfile.isSuperAdmin ? "ALL" : adminProfile.permissions, requiredPolicy)) {
      await auditAdminPermissionDenied({
        studentNumber: student.studentNumber,
        url: request.url,
        method: request.method,
        policy: requiredPolicy,
      });
      return reply.status(403).send({ message: "Access denied for this admin area" });
    }
  });
});
