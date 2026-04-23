import type { FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { type Env } from "../../../config/env";
import { verifyAuthToken } from "../utils/jwt";
import { prisma } from "../../../shared/prisma";
import { isDefaultAdminStudentNumber } from "../domain/admin-authorized-students";

export async function isAdminStudentNumber(studentNumber: string) {
  if (isDefaultAdminStudentNumber(studentNumber)) {
    return true;
  }

  const normalized = studentNumber.trim();
  const authorizedStudent = await prisma.adminAuthorizedStudent.findUnique({
    where: { studentNumber: normalized },
    select: { id: true },
  });

  return Boolean(authorizedStudent);
}

async function isActiveJuryMember(juryId: number): Promise<boolean> {
  const member = await prisma.juryMember.findUnique({
    where: { id: juryId },
    select: { isActive: true },
  });

  return Boolean(member?.isActive);
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
      if (!await isActiveJuryMember(payload.sub)) {
        return {
          allowed: false as const,
          status: 403 as const,
          message: "Access denied",
        };
      }

      return {
        allowed: true as const,
        studentNumber: `jury-${payload.sub}`,
      };
    }

    if (!await isAdminStudentNumber(payload.studentNumber)) {
      return {
        allowed: false as const,
        status: 403 as const,
        message: "Access denied",
      };
    }

    return {
      allowed: true as const,
      studentNumber: payload.studentNumber,
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

    // Jury members have full admin access
    if (jury) {
      if (!await isActiveJuryMember(jury.id)) {
        return reply.status(403).send({ message: "Access denied" });
      }
      return;
    }

    if (!student) {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    if (!await isAdminStudentNumber(student.studentNumber)) {
      return reply.status(403).send({ message: "Access denied" });
    }
  });
});
