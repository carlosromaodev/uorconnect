import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { renderQrSvg } from "../../../shared/qr";
import { buildValidationQrUrl, buildValidationUrl } from "../application/validation-links";
import { isCredentialPubliclyValid, normalizeCredentialStatus } from "../../credentials/application/credential-policy";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, requireAdminPermission } from "../../auth/http/admin.middleware";

const validationParamsSchema = z.object({
  token: z.string().trim().min(6).max(160),
});

function publicValidationRateLimit(env: Env) {
  return {
    max: env.VALIDATION_RATE_LIMIT_MAX,
    timeWindow: env.VALIDATION_RATE_LIMIT_WINDOW_MS,
  };
}

function hashLogValue(value: string | undefined | null, salt: string) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return createHash("sha256").update(`${salt}:credential-validation:${normalized}`).digest("hex");
}

function publicDisplayName(value?: string | null) {
  const parts = value?.replace(/\s+/g, " ").trim().split(" ").filter(Boolean) ?? [];
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const initials = parts.slice(1)
    .map((part) => `${part[0]?.toLocaleUpperCase("pt-AO") ?? ""}.`)
    .filter((part) => part !== ".")
    .join(" ");
  return initials ? `${parts[0]} ${initials}` : parts[0];
}

function publicMaskedIdentifier(value?: string | null) {
  const compact = value?.replace(/\s+/g, "").trim();
  if (!compact) return null;
  if (compact.length <= 4) return "*".repeat(compact.length);
  const hiddenLength = Math.max(2, compact.length - 4);
  return `${compact.slice(0, 2)}${"*".repeat(hiddenLength)}${compact.slice(-2)}`;
}

function resolveAttendanceValidationState(input: {
  status: string;
  validFrom: Date | null;
  validUntil: Date | null;
  hasCheckIn: boolean;
}) {
  const now = new Date();
  const valid = input.status === "ACTIVE"
    && (!input.validFrom || input.validFrom <= now)
    && (!input.validUntil || input.validUntil >= now);
  const status = input.status !== "ACTIVE"
    ? input.status
    : input.validFrom && input.validFrom > now
      ? "NOT_STARTED"
      : input.validUntil && input.validUntil < now
        ? "EXPIRED"
        : input.hasCheckIn ? "CHECKED_IN" : "CREDENTIAL_CREATED";

  return { valid, status };
}

async function recordValidationLog(params: {
  request: FastifyRequest;
  env: Env;
  token: string;
  kind: "certificate" | "attendance" | "team_credential" | "unknown";
  credentialId?: string | number | null;
  status?: string | null;
  valid: boolean;
}) {
  await prisma.credentialValidationLog.create({
    data: {
      tokenHash: hashLogValue(params.token, params.env.JWT_SECRET) ?? "unknown",
      kind: params.kind,
      credentialId: params.credentialId === undefined || params.credentialId === null ? null : String(params.credentialId),
      status: params.status ?? null,
      valid: params.valid,
      ipHash: hashLogValue(params.request.ip, params.env.JWT_SECRET),
      userAgent: typeof params.request.headers["user-agent"] === "string"
        ? params.request.headers["user-agent"].slice(0, 240)
        : null,
    },
  }).catch((error) => {
    params.request.log.warn({ error }, "Falha ao registar log de validação de credencial");
  });
}

async function validationRecordExists(token: string) {
  const [certificate, credential, teamCredential, qrAction] = await Promise.all([
    prisma.certificate.findUnique({
      where: { validationToken: token },
      select: { id: true },
    }),
    prisma.attendanceCredential.findUnique({
      where: { token },
      select: { id: true },
    }),
    prisma.eventTeamCredential.findUnique({
      where: { publicSlug: token },
      select: { id: true },
    }),
    prisma.qrAction.findUnique({
      where: { token },
      select: { id: true },
    }),
  ]);

  return Boolean(certificate || credential || teamCredential || qrAction);
}

export async function validationRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.get("/:token/qr.svg", {
    config: {
      rateLimit: publicValidationRateLimit(opts.env),
    },
    schema: {
      params: validationParamsSchema,
      response: {
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { token } = validationParamsSchema.parse(request.params);

    if (!await validationRecordExists(token)) {
      return reply.code(404).send({ message: "Registo de validação não encontrado." });
    }

    const svg = await renderQrSvg(buildValidationUrl(opts.env, token), 280);
    reply.header("Content-Type", "image/svg+xml; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=300");
    return reply.send(svg);
  });

  app.register(async (operationalApp) => {
    operationalApp.register(authGuard, { env: opts.env });
    operationalApp.register(adminGuard);

    operationalApp.get("/operational/:token", {
      config: requireAdminPermission(["ATTENDANCE", "CERTIFICATES", "SECURITY"]),
      schema: {
        params: validationParamsSchema,
        response: {
          200: z.object({
            valid: z.boolean(),
            kind: z.enum(["certificate", "attendance", "team_credential"]),
            status: z.string(),
            title: z.string(),
            validationUrl: z.string(),
            qrImageUrl: z.string(),
            certificate: z.object({
              id: z.number(),
              code: z.string(),
              type: z.string(),
              recipientName: z.string(),
              recipientNumber: z.string().nullable(),
              recipientCourse: z.string().nullable(),
              issuedAt: z.string(),
              issuedByStudentNumber: z.string(),
              revokedAt: z.string().nullable(),
            }).nullable(),
            attendance: z.object({
              credentialId: z.number(),
              studentNumber: z.string(),
              studentName: z.string().nullable(),
              studentCourse: z.string().nullable(),
              checkedIn: z.boolean(),
              lastCheckInAt: z.string().nullable(),
              eventLabel: z.string().nullable(),
            }).nullable(),
            teamCredential: z.object({
              credentialId: z.number(),
              holderName: z.string().nullable(),
              studentNumber: z.string().nullable(),
              email: z.string().nullable(),
              phone: z.string().nullable(),
              course: z.string().nullable(),
              category: z.string(),
              team: z.string(),
              role: z.string(),
              accessLevel: z.string(),
              version: z.number(),
              issuedAt: z.string().nullable(),
              expiresAt: z.string().nullable(),
              revokedAt: z.string().nullable(),
              revokedReason: z.string().nullable(),
            }).nullable(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const { token } = validationParamsSchema.parse(request.params);
      const validationUrl = buildValidationUrl(opts.env, token);
      const qrImageUrl = buildValidationQrUrl(opts.env, token);

      const certificate = await prisma.certificate.findUnique({
        where: { validationToken: token },
      });

      if (certificate) {
        const valid = certificate.status === "ISSUED";
        await recordValidationLog({
          request,
          env: opts.env,
          token,
          kind: "certificate",
          credentialId: certificate.id,
          status: certificate.status,
          valid,
        });
        return {
          valid,
          kind: "certificate" as const,
          status: certificate.status,
          title: certificate.title,
          validationUrl,
          qrImageUrl,
          certificate: {
            id: certificate.id,
            code: certificate.code,
            type: certificate.type,
            recipientName: certificate.recipientName,
            recipientNumber: certificate.recipientNumber,
            recipientCourse: certificate.recipientCourse,
            issuedAt: certificate.issuedAt.toISOString(),
            issuedByStudentNumber: certificate.issuedByStudentNumber,
            revokedAt: certificate.revokedAt?.toISOString() ?? null,
          },
          attendance: null,
          teamCredential: null,
        };
      }

      const credential = await prisma.attendanceCredential.findUnique({
        where: { token },
        include: {
          checkIns: {
            orderBy: { checkedInAt: "desc" },
            take: 1,
          },
        },
      });

      if (credential) {
        const lastCheckIn = credential.checkIns[0] ?? null;
        const { valid, status } = resolveAttendanceValidationState({
          status: credential.status,
          validFrom: credential.validFrom,
          validUntil: credential.validUntil,
          hasCheckIn: Boolean(lastCheckIn),
        });
        await recordValidationLog({
          request,
          env: opts.env,
          token,
          kind: "attendance",
          credentialId: credential.id,
          status,
          valid,
        });
        return {
          valid,
          kind: "attendance" as const,
          status,
          title: credential.label,
          validationUrl,
          qrImageUrl,
          certificate: null,
          attendance: {
            credentialId: credential.id,
            studentNumber: credential.studentNumber,
            studentName: credential.studentName,
            studentCourse: credential.studentCourse,
            checkedIn: Boolean(lastCheckIn),
            lastCheckInAt: lastCheckIn?.checkedInAt.toISOString() ?? null,
            eventLabel: lastCheckIn?.eventLabel ?? credential.eventLabel,
          },
          teamCredential: null,
        };
      }

      const teamCredential = await prisma.eventTeamCredential.findUnique({
        where: { publicSlug: token },
        include: {
          teamMembership: {
            select: { studentNumber: true },
          },
        },
      });

      if (!teamCredential) {
        await recordValidationLog({
          request,
          env: opts.env,
          token,
          kind: "unknown",
          status: "NOT_FOUND",
          valid: false,
        });
        return reply.code(404).send({ message: "Registo de validação não encontrado." });
      }

      const status = normalizeCredentialStatus(teamCredential);
      const valid = isCredentialPubliclyValid({ ...teamCredential, status });
      await recordValidationLog({
        request,
        env: opts.env,
        token,
        kind: "team_credential",
        credentialId: teamCredential.id,
        status,
        valid,
      });
      return {
        valid,
        kind: "team_credential" as const,
        status,
        title: "Credencial UOR Connect",
        validationUrl,
        qrImageUrl,
        certificate: null,
        attendance: null,
        teamCredential: {
          credentialId: teamCredential.id,
          holderName: teamCredential.name,
          studentNumber: teamCredential.teamMembership?.studentNumber ?? null,
          email: teamCredential.email,
          phone: teamCredential.phone,
          course: teamCredential.course,
          category: teamCredential.category,
          team: teamCredential.team,
          role: teamCredential.role,
          accessLevel: teamCredential.accessLevel,
          version: teamCredential.version,
          issuedAt: teamCredential.issuedAt?.toISOString() ?? null,
          expiresAt: teamCredential.expiresAt?.toISOString() ?? null,
          revokedAt: teamCredential.revokedAt?.toISOString() ?? null,
          revokedReason: teamCredential.revokedReason,
        },
      };
    });
  });

  app.get("/:token", {
    config: {
      rateLimit: publicValidationRateLimit(opts.env),
    },
    schema: {
      params: validationParamsSchema,
      response: {
        200: z.object({
          valid: z.boolean(),
          kind: z.enum(["certificate", "attendance", "team_credential"]),
          status: z.string(),
          title: z.string(),
          validationUrl: z.string(),
          qrImageUrl: z.string(),
          certificate: z.object({
            id: z.number(),
            code: z.string(),
            type: z.string(),
            recipientName: z.string().nullable(),
            recipientNumber: z.string().nullable(),
            recipientCourse: z.string().nullable(),
            issuedAt: z.string(),
            issuedByStudentNumber: z.string().nullable(),
            revokedAt: z.string().nullable(),
          }).nullable(),
          attendance: z.object({
            credentialId: z.number(),
            studentNumber: z.string().nullable(),
            studentName: z.string().nullable(),
            studentCourse: z.string().nullable(),
            checkedIn: z.boolean(),
            lastCheckInAt: z.string().nullable(),
            eventLabel: z.string().nullable(),
          }).nullable(),
          teamCredential: z.object({
            credentialId: z.number(),
            holderName: z.string().nullable(),
            category: z.string(),
            team: z.string(),
            role: z.string(),
            accessLevel: z.string(),
            version: z.number(),
            issuedAt: z.string().nullable(),
            expiresAt: z.string().nullable(),
            revokedAt: z.string().nullable(),
            revokedReason: z.string().nullable(),
          }).nullable(),
        }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { token } = validationParamsSchema.parse(request.params);
    const validationUrl = buildValidationUrl(opts.env, token);
    const qrImageUrl = buildValidationQrUrl(opts.env, token);

    const certificate = await prisma.certificate.findUnique({
      where: { validationToken: token },
    });

    if (certificate) {
      const valid = certificate.status === "ISSUED";
      await recordValidationLog({
        request,
        env: opts.env,
        token,
        kind: "certificate",
        credentialId: certificate.id,
        status: certificate.status,
        valid,
      });
      return {
        valid,
        kind: "certificate" as const,
        status: certificate.status,
        title: certificate.title,
        validationUrl,
        qrImageUrl,
        certificate: {
          id: certificate.id,
          code: certificate.code,
          type: certificate.type,
          recipientName: publicDisplayName(certificate.recipientName),
          recipientNumber: publicMaskedIdentifier(certificate.recipientNumber),
          recipientCourse: null,
          issuedAt: certificate.issuedAt.toISOString(),
          issuedByStudentNumber: null,
          revokedAt: certificate.revokedAt?.toISOString() ?? null,
        },
        attendance: null,
        teamCredential: null,
      };
    }

    const credential = await prisma.attendanceCredential.findUnique({
      where: { token },
      include: {
        checkIns: {
          orderBy: { checkedInAt: "desc" },
          take: 1,
        },
      },
    });

    if (credential) {
      const lastCheckIn = credential.checkIns[0] ?? null;
      const { valid, status } = resolveAttendanceValidationState({
        status: credential.status,
        validFrom: credential.validFrom,
        validUntil: credential.validUntil,
        hasCheckIn: Boolean(lastCheckIn),
      });
      await recordValidationLog({
        request,
        env: opts.env,
        token,
        kind: "attendance",
        credentialId: credential.id,
        status,
        valid,
      });
      return {
        valid,
        kind: "attendance" as const,
        status,
        title: credential.label,
        validationUrl,
        qrImageUrl,
        certificate: null,
        attendance: {
          credentialId: credential.id,
          studentNumber: publicMaskedIdentifier(credential.studentNumber),
          studentName: publicDisplayName(credential.studentName),
          studentCourse: null,
          checkedIn: Boolean(lastCheckIn),
          lastCheckInAt: lastCheckIn?.checkedInAt.toISOString() ?? null,
          eventLabel: lastCheckIn?.eventLabel ?? credential.eventLabel,
        },
        teamCredential: null,
      };
    }

    const teamCredential = await prisma.eventTeamCredential.findUnique({
      where: { publicSlug: token },
    });

    if (!teamCredential) {
      await recordValidationLog({
        request,
        env: opts.env,
        token,
        kind: "unknown",
        status: "NOT_FOUND",
        valid: false,
      });
      return reply.code(404).send({ message: "Registo de validação não encontrado." });
    }

    const status = normalizeCredentialStatus(teamCredential);
    const valid = isCredentialPubliclyValid({ ...teamCredential, status });
    await recordValidationLog({
      request,
      env: opts.env,
      token,
      kind: "team_credential",
      credentialId: teamCredential.id,
      status,
      valid,
    });
    return {
      valid,
      kind: "team_credential" as const,
      status,
      title: "Credencial UOR Connect",
      validationUrl,
      qrImageUrl,
      certificate: null,
      attendance: null,
      teamCredential: {
        credentialId: teamCredential.id,
        holderName: teamCredential.name,
        category: teamCredential.category,
        team: teamCredential.team,
        role: teamCredential.role,
        accessLevel: teamCredential.accessLevel,
        version: teamCredential.version,
        issuedAt: teamCredential.issuedAt?.toISOString() ?? null,
        expiresAt: teamCredential.expiresAt?.toISOString() ?? null,
        revokedAt: teamCredential.revokedAt?.toISOString() ?? null,
        revokedReason: teamCredential.revokedReason,
      },
    };
  });
}
