import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { renderQrSvg } from "../../../shared/qr";
import { buildValidationQrUrl, buildValidationUrl } from "../application/validation-links";

const validationParamsSchema = z.object({
  token: z.string().trim().min(6).max(160),
});

async function validationRecordExists(token: string) {
  const [certificate, credential] = await Promise.all([
    prisma.certificate.findUnique({
      where: { validationToken: token },
      select: { id: true },
    }),
    prisma.attendanceCredential.findUnique({
      where: { token },
      select: { id: true },
    }),
  ]);

  return Boolean(certificate || credential);
}

export async function validationRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.get("/:token/qr.svg", {
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

  app.get("/:token", {
    schema: {
      params: validationParamsSchema,
      response: {
        200: z.object({
          valid: z.boolean(),
          kind: z.enum(["certificate", "attendance"]),
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
      return {
        valid: certificate.status === "ISSUED",
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

    if (!credential) {
      return reply.code(404).send({ message: "Registo de validação não encontrado." });
    }

    const lastCheckIn = credential.checkIns[0] ?? null;
    return {
      valid: true,
      kind: "attendance" as const,
      status: lastCheckIn ? "CHECKED_IN" : "CREDENTIAL_CREATED",
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
        eventLabel: lastCheckIn?.eventLabel ?? null,
      },
    };
  });
}
