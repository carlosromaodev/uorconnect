import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { type Env } from "../../../config/env";
import { verifyAuthToken } from "../utils/jwt";
import { prisma } from "../../../shared/prisma";
import {
  type AdminPermission,
  expandAdminPermissions,
  hasAdminPermission,
  isDefaultAdminStudentNumber,
} from "../domain/admin-authorized-students";

export type AdminAccessProfile = {
  studentNumber: string;
  team: string;
  role: string;
  permissions: AdminPermission[];
  isSuperAdmin: boolean;
};

function getRequiredAdminPermissions(url: string, method: string): AdminPermission[] | null {
  const path = url.split("?")[0] ?? url;

  if (path.includes("/auth/admin/access")) return null;
  if (path.includes("/auth/security")) return ["SECURITY"];
  if (path.includes("/auth/students")) return ["STUDENTS"];
  if (path.includes("/analytics/")) return ["ANALYTICS"];
  if (path.includes("/sms/admin")) return ["SMS"];
  if (path.includes("/attendance/admin")) return ["ATTENDANCE"];
  if (path.includes("/certificates/admin")) return ["CERTIFICATES"];
  if (path.includes("/audit/admin")) return ["AUDIT"];
  if (path.includes("/reports/")) return ["OVERVIEW"];
  if (path.includes("/interactions/admin/moderation")) return ["VOTES", "LIVE"];
  if (path.includes("/interactions/admin/votes")) return ["OVERVIEW", "VOTES", "WINNERS"];
  if (path.includes("/agenda/live-config")) return ["LIVE"];
  if (path.includes("/agenda")) return method === "GET" ? ["SCHEDULE", "LIVE"] : ["SCHEDULE"];
  if (path.includes("/speakers")) return ["SPEAKERS"];
  if (path.includes("/guide")) return ["GUIDE"];
  if (path.includes("/faq")) return ["FAQ"];
  if (path.includes("/courses")) return ["COURSES", "SMS"];
  if (path.includes("/home-content/panels")) return ["PANELS"];
  if (path.includes("/home-content/social-config")) return ["EVENTO"];
  if (path.includes("/home-content")) return ["PANELS", "EVENTO"];
  if (path.includes("/submissions/winner") || /\/submissions\/\d+\/winner/.test(path)) return ["WINNERS"];
  if (path.includes("/submissions")) return method === "GET" ? ["OVERVIEW", "SUBMISSIONS", "VOTES", "WINNERS"] : ["SUBMISSIONS"];
  if (path.includes("/contest/security")) return ["SECURITY"];

  return ["OVERVIEW"];
}

function getEmbeddedSmsPermissions(url: string, method: string, body: unknown): AdminPermission[] | null | undefined {
  const path = url.split("?")[0] ?? url;
  if (method !== "POST" || !/\/sms\/admin\/(preview|send)$/.test(path)) return undefined;
  if (!body || typeof body !== "object") return undefined;

  const audience = (body as { audience?: unknown }).audience;
  if (!audience || typeof audience !== "object") return undefined;

  const typedAudience = audience as { courseIds?: unknown; type?: unknown };
  if (typedAudience.type === "SELECTED_STUDENTS") return null;
  if (
    typedAudience.type === "COURSE_ENROLLED"
    && Array.isArray(typedAudience.courseIds)
    && typedAudience.courseIds.length > 0
  ) {
    return ["COURSES"];
  }

  return undefined;
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
    select: { studentNumber: true, team: true, role: true, permissions: true },
  });

  if (!authorizedStudent) return null;

  const permissions = expandAdminPermissions(authorizedStudent.permissions);
  return {
    studentNumber: authorizedStudent.studentNumber,
    team: authorizedStudent.team,
    role: authorizedStudent.role,
    permissions,
    isSuperAdmin: authorizedStudent.role === "SUPER_ADMIN" || authorizedStudent.permissions === "ALL",
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
    isSuperAdmin: member.role === "SUPER_ADMIN" || member.permissions === "ALL",
  };
}

export async function getAdminAccessResult(request: FastifyRequest, env: Env) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      allowed: false as const,
      status: 401 as const,
      message: "Missing or invalid token",
    };
  }

  const token = authHeader.substring("Bearer ".length);

  try {
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
    const embeddedSmsPermissions = getEmbeddedSmsPermissions(request.url, request.method, request.body);
    const requiredPermissions = embeddedSmsPermissions === undefined
      ? getRequiredAdminPermissions(request.url, request.method)
      : embeddedSmsPermissions;

    if (jury) {
      const juryProfile = await getJuryAdminProfileById(jury.id);
      if (!juryProfile) {
        return reply.status(403).send({ message: "Access denied" });
      }
      if (requiredPermissions && !hasAdminPermission(juryProfile.isSuperAdmin ? "ALL" : juryProfile.permissions, requiredPermissions)) {
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

    if (requiredPermissions && !hasAdminPermission(adminProfile.isSuperAdmin ? "ALL" : adminProfile.permissions, requiredPermissions)) {
      return reply.status(403).send({ message: "Access denied for this admin area" });
    }
  });
});
