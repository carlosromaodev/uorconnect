import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { type Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import {
  appendCookie,
  getCookie,
  resolveSharedCookieDomain,
  serializeCookie,
  shouldUseSecureCookies,
} from "../../../shared/cookies";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { signTrainerToken } from "../../auth/utils/jwt";
import {
  TRAINER_ACCESS_CODE_PURPOSE,
  TRAINER_VERIFIED_PHONE_WINDOW_MS,
  buildTrainerDashboardPayload,
  canTrainerAccessDashboard,
  trainerApprovalSchema,
  trainerPhoneSchema,
  trainerRegistrationSubmitSchema,
  trainerRejectSchema,
} from "./trainer-registration";

const AUTH_COOKIE = "uor_auth";
const CSRF_COOKIE = "uor_csrf";
const SESSION_HINT_COOKIE = "uor_session_hint";
const DEVICE_COOKIE = "uor_device";
const LAST_CONNECTION_COOKIE = "uor_last_connection";
const AUTH_MAX_AGE = 60 * 60 * 24 * 7;
const DEVICE_MAX_AGE = 60 * 60 * 24 * 180;

const requestCodeSchema = z.object({
  phone: trainerPhoneSchema,
});

const verifyCodeSchema = z.object({
  phone: trainerPhoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Informe o codigo de 6 digitos."),
});

const statusQuerySchema = z.object({
  phone: trainerPhoneSchema,
});

const requestIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const courseOptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  companyName: z.string(),
  companyCategory: z.string(),
  isPublished: z.boolean(),
});

const trainerRequestSchema = z.object({
  id: z.number(),
  phone: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  specialty: z.string(),
  bio: z.string(),
  linkedinUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  organization: z.string().nullable(),
  selectedCourseId: z.number(),
  selectedCourse: courseOptionSchema,
  status: z.string(),
  reviewedAt: z.string().nullable(),
  reviewedByStudentNumber: z.string().nullable(),
  reviewNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function normalizePhoneForOmbala(value?: string | null): { phone: string; providerTo: string } | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00244") && digits.length >= 14) {
    const local = digits.slice(5, 14);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.startsWith("244") && digits.length >= 12) {
    const local = digits.slice(3, 12);
    return local.length === 9 && local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    const local = digits.slice(1);
    return local.startsWith("9")
      ? { phone: `+244${local}`, providerTo: local }
      : null;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return { phone: `+244${digits}`, providerTo: digits };
  }

  if (digits.length === 8) {
    const local = `9${digits}`;
    return { phone: `+244${local}`, providerTo: local };
  }

  return null;
}

function normalizeSender(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringifyProviderPayload(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const direct = pickString(record.message_id)
    ?? pickString(record.messageId)
    ?? pickString(record.id)
    ?? pickString(record.uuid);

  if (direct) return direct;

  const nestedData = record.data;
  if (nestedData && typeof nestedData === "object") {
    return extractProviderMessageId(nestedData);
  }

  return null;
}

class OmbalaClient {
  constructor(private readonly env: Env) {}

  private get baseUrl() {
    return this.env.OMBALA_API_BASE_URL.replace(/\/$/, "");
  }

  private get token() {
    return this.env.OMBALA_API_TOKEN?.trim();
  }

  get isConfigured() {
    return Boolean(this.token);
  }

  async sendMessage(payload: { message: string; from: string; to: string }) {
    if (!this.token) {
      return {
        ok: false,
        status: 0,
        payload: { message: "OMBALA_API_TOKEN nao configurado." },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let providerPayload: unknown = null;

      if (raw) {
        try {
          providerPayload = JSON.parse(raw);
        } catch {
          providerPayload = raw;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        payload: providerPayload,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          message: error instanceof Error ? error.message : "Falha ao comunicar com o provedor SMS.",
        },
      };
    }
  }
}

function generateAccessCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashTrainerAccessCode(phone: string, code: string, env: Env) {
  return createHash("sha256")
    .update(`${env.JWT_SECRET}:trainer-access:${phone}:${code}`)
    .digest("hex");
}

function serializeTrainerRequest(request: {
  id: number;
  phone: string;
  name: string;
  email: string | null;
  specialty: string;
  bio: string;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  organization: string | null;
  selectedCourseId: number;
  selectedCourse: {
    id: number;
    name: string;
    description: string;
    companyName: string;
    companyCategory: string;
    isPublished: boolean;
  };
  status: string;
  reviewedAt: Date | null;
  reviewedByStudentNumber: string | null;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: request.id,
    phone: request.phone,
    name: request.name,
    email: request.email,
    specialty: request.specialty,
    bio: request.bio,
    linkedinUrl: request.linkedinUrl,
    portfolioUrl: request.portfolioUrl,
    organization: request.organization,
    selectedCourseId: request.selectedCourseId,
    selectedCourse: request.selectedCourse,
    status: request.status,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    reviewedByStudentNumber: request.reviewedByStudentNumber,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

async function findLatestTrainerRequest(phone: string) {
  return prisma.trainerRegistrationRequest.findFirst({
    where: { phone },
    include: {
      selectedCourse: {
        select: {
          id: true,
          name: true,
          description: true,
          companyName: true,
          companyCategory: true,
          isPublished: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
}

async function hasRecentVerifiedTrainerPhone(phone: string) {
  const since = new Date(Date.now() - TRAINER_VERIFIED_PHONE_WINDOW_MS);
  const code = await prisma.studentAccessCode.findFirst({
    where: {
      phone,
      purpose: TRAINER_ACCESS_CODE_PURPOSE,
      usedAt: { gte: since },
      deliveryStatus: "USED",
    },
    select: { id: true },
    orderBy: [{ usedAt: "desc" }, { id: "desc" }],
  });
  return Boolean(code);
}

export async function trainersRoutes(app: FastifyInstance, opts: { env: Env }) {
  const ombala = new OmbalaClient(opts.env);
  const secureCookies = shouldUseSecureCookies(opts.env);
  const sharedCookieDomain = resolveSharedCookieDomain(opts.env) ?? undefined;

  function appendTrainerAuthCookies(reply: FastifyReply, token: string, request: FastifyRequest) {
    const csrfToken = randomUUID();
    const deviceId = getCookie(request, DEVICE_COOKIE) ?? randomUUID();
    const nowIso = new Date().toISOString();

    appendCookie(reply, serializeCookie(AUTH_COOKIE, token, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict",
    }));
    appendCookie(reply, serializeCookie(CSRF_COOKIE, csrfToken, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      domain: sharedCookieDomain,
      httpOnly: false,
      secure: secureCookies,
      sameSite: "Strict",
    }));
    appendCookie(reply, serializeCookie(SESSION_HINT_COOKIE, "1", {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      domain: sharedCookieDomain,
      httpOnly: false,
      secure: secureCookies,
      sameSite: "Strict",
    }));
    appendCookie(reply, serializeCookie(DEVICE_COOKIE, deviceId, {
      path: "/",
      maxAge: DEVICE_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict",
    }));
    appendCookie(reply, serializeCookie(LAST_CONNECTION_COOKIE, nowIso, {
      path: "/",
      maxAge: AUTH_MAX_AGE,
      httpOnly: true,
      secure: secureCookies,
      sameSite: "Strict",
    }));
  }

  app.get(
    "/registration/context",
    {
      schema: {
        description: "Lista cursos ativos para cadastro publico de formador",
        tags: ["Trainers"],
        response: {
          200: z.object({ courses: z.array(courseOptionSchema) }),
        },
      },
    },
    async () => {
      const courses = await prisma.course.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          name: true,
          description: true,
          companyName: true,
          companyCategory: true,
          isPublished: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      return { courses };
    },
  );

  app.post<{ Body: z.infer<typeof requestCodeSchema> }>(
    "/registration/request-code",
    {
      config: { rateLimit: { max: 6, timeWindow: 60_000 } },
      schema: {
        description: "Envia codigo SMS para cadastro de formador",
        tags: ["Trainers"],
        body: requestCodeSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            phone: z.string(),
            codeLast4: z.string(),
            expiresAt: z.string(),
            deliveryStatus: z.string(),
          }),
          400: z.object({ message: z.string() }),
          502: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!ombala.isConfigured) {
        return reply.code(400).send({ message: "Integracao SMS nao configurada. Define OMBALA_API_TOKEN no backend." });
      }

      const normalizedPhone = normalizePhoneForOmbala(request.body.phone);
      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Telefone invalido para envio de SMS." });
      }

      const sender = normalizeSender(opts.env.OMBALA_SMS_DEFAULT_SENDER ?? "");
      if (!sender || !/^[A-Z0-9 _-]{3,16}$/.test(sender)) {
        return reply.code(400).send({ message: "Remetente SMS invalido. Ajusta OMBALA_SMS_DEFAULT_SENDER." });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 10 * 60_000);
      const code = generateAccessCode();
      const codeHash = hashTrainerAccessCode(normalizedPhone.phone, code, opts.env);

      await prisma.studentAccessCode.updateMany({
        where: {
          phone: normalizedPhone.phone,
          purpose: TRAINER_ACCESS_CODE_PURPOSE,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
          deliveryStatus: "REVOKED",
          errorMessage: "Codigo substituido por novo pedido de cadastro de formador.",
        },
      });

      const providerResponse = await ombala.sendMessage({
        from: sender,
        to: normalizedPhone.providerTo,
        message: `UOR Connect: o teu codigo de formador e ${code}. Valido por 10 minutos. Nao partilhes este codigo.`,
      });
      const providerError = pickString((providerResponse.payload as Record<string, unknown>)?.message)
        ?? `Falha no provedor (status ${providerResponse.status || "desconhecido"}).`;

      const accessCode = await prisma.studentAccessCode.create({
        data: {
          phone: normalizedPhone.phone,
          codeHash,
          codeLast4: code.slice(-4),
          expiresAt,
          sentAt: now,
          purpose: TRAINER_ACCESS_CODE_PURPOSE,
          providerMessageId: extractProviderMessageId(providerResponse.payload),
          providerResponseJson: stringifyProviderPayload(providerResponse.payload),
          deliveryStatus: providerResponse.ok ? "SENT" : "FAILED",
          errorMessage: providerResponse.ok ? null : providerError,
          usedAt: providerResponse.ok ? null : now,
        },
      });

      if (!providerResponse.ok) {
        return reply.code(502).send({ message: `Nao foi possivel enviar o codigo por SMS. ${providerError}` });
      }

      return reply.send({
        success: true,
        phone: normalizedPhone.phone,
        codeLast4: accessCode.codeLast4,
        expiresAt: accessCode.expiresAt.toISOString(),
        deliveryStatus: accessCode.deliveryStatus,
      });
    },
  );

  app.post<{ Body: z.infer<typeof verifyCodeSchema> }>(
    "/registration/verify-code",
    {
      config: { rateLimit: { max: 12, timeWindow: 60_000 } },
      schema: {
        description: "Valida codigo SMS do formador e inicia sessao se ja estiver aprovado",
        tags: ["Trainers"],
        body: verifyCodeSchema,
        response: {
          200: z.object({
            success: z.literal(true),
            verified: z.literal(true),
            phone: z.string(),
            status: z.string().nullable(),
            request: trainerRequestSchema.nullable(),
            token: z.string().optional(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const normalizedPhone = normalizePhoneForOmbala(request.body.phone);
      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Telefone invalido." });
      }

      const now = new Date();
      const activeCode = await prisma.studentAccessCode.findFirst({
        where: {
          phone: normalizedPhone.phone,
          purpose: TRAINER_ACCESS_CODE_PURPOSE,
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      });

      if (!activeCode) {
        return reply.code(401).send({ message: "Codigo expirado ou inexistente. Solicita um novo codigo." });
      }

      const incomingHash = hashTrainerAccessCode(normalizedPhone.phone, request.body.code, opts.env);
      if (incomingHash !== activeCode.codeHash) {
        return reply.code(401).send({ message: "Codigo invalido." });
      }

      await prisma.studentAccessCode.update({
        where: { id: activeCode.id },
        data: { usedAt: now, deliveryStatus: "USED" },
      });

      const trainerRequest = await findLatestTrainerRequest(normalizedPhone.phone);
      const serialized = trainerRequest ? serializeTrainerRequest(trainerRequest) : null;
      const status = trainerRequest?.status ?? null;

      if (trainerRequest && canTrainerAccessDashboard(trainerRequest.status)) {
        const token = signTrainerToken(trainerRequest.id, normalizedPhone.phone, opts.env);
        appendTrainerAuthCookies(reply, token, request);
        return reply.send({
          success: true,
          verified: true,
          phone: normalizedPhone.phone,
          status,
          request: serialized,
          token,
        });
      }

      return reply.send({
        success: true,
        verified: true,
        phone: normalizedPhone.phone,
        status,
        request: serialized,
      });
    },
  );

  app.post<{ Body: z.infer<typeof trainerRegistrationSubmitSchema> }>(
    "/registration/submit",
    {
      config: { rateLimit: { max: 10, timeWindow: 60_000 } },
      schema: {
        description: "Submete pedido publico de cadastro de formador",
        tags: ["Trainers"],
        body: trainerRegistrationSubmitSchema,
        response: {
          200: z.object({ success: z.literal(true), request: trainerRequestSchema }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const normalizedPhone = normalizePhoneForOmbala(request.body.phone);
      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Telefone invalido." });
      }

      if (!(await hasRecentVerifiedTrainerPhone(normalizedPhone.phone))) {
        return reply.code(401).send({ message: "Valida o telefone por SMS antes de enviar o pedido." });
      }

      const course = await prisma.course.findFirst({
        where: { id: request.body.selectedCourseId, isPublished: true },
        select: { id: true },
      });
      if (!course) {
        return reply.code(400).send({ message: "Curso indisponivel para cadastro de formador." });
      }

      const latest = await findLatestTrainerRequest(normalizedPhone.phone);
      if (latest?.status === "APPROVED") {
        return reply.code(409).send({ message: "Este telefone ja tem um acesso de formador aprovado." });
      }

      const data = {
        phone: normalizedPhone.phone,
        name: request.body.name,
        email: request.body.email,
        specialty: request.body.specialty,
        bio: request.body.bio,
        linkedinUrl: request.body.linkedinUrl,
        portfolioUrl: request.body.portfolioUrl,
        organization: request.body.organization,
        selectedCourseId: request.body.selectedCourseId,
        status: "PENDING",
        reviewedAt: null,
        reviewedByStudentNumber: null,
        reviewNote: null,
      };

      const saved = latest
        ? await prisma.trainerRegistrationRequest.update({
          where: { id: latest.id },
          data,
          include: { selectedCourse: true },
        })
        : await prisma.trainerRegistrationRequest.create({
          data,
          include: { selectedCourse: true },
        });

      return reply.send({
        success: true,
        request: serializeTrainerRequest(saved),
      });
    },
  );

  app.get<{ Querystring: z.infer<typeof statusQuerySchema> }>(
    "/registration/status",
    {
      schema: {
        description: "Consulta estado do pedido de formador apos telefone validado",
        tags: ["Trainers"],
        querystring: statusQuerySchema,
        response: {
          200: z.object({ request: trainerRequestSchema.nullable() }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const normalizedPhone = normalizePhoneForOmbala(request.query.phone);
      if (!normalizedPhone) {
        return reply.code(400).send({ message: "Telefone invalido." });
      }

      if (!(await hasRecentVerifiedTrainerPhone(normalizedPhone.phone))) {
        return reply.code(401).send({ message: "Valida o telefone por SMS para consultar o pedido." });
      }

      const trainerRequest = await findLatestTrainerRequest(normalizedPhone.phone);
      return {
        request: trainerRequest ? serializeTrainerRequest(trainerRequest) : null,
      };
    },
  );

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["COURSES", "SPEAKERS"]);

    adminApp.get(
      "/admin/requests",
      {
        schema: {
          description: "Lista pedidos de cadastro de formadores para revisao administrativa",
          tags: ["Trainers"],
          response: {
            200: z.object({ requests: z.array(trainerRequestSchema) }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
          },
        },
      },
      async () => {
        const requests = await prisma.trainerRegistrationRequest.findMany({
          include: { selectedCourse: true },
          orderBy: [
            { status: "asc" },
            { createdAt: "desc" },
          ],
        });
        return { requests: requests.map(serializeTrainerRequest) };
      },
    );

    adminApp.post<{ Params: z.infer<typeof requestIdSchema>; Body: z.infer<typeof trainerApprovalSchema> }>(
      "/admin/requests/:id/approve",
      {
        schema: {
          description: "Aprova um formador e vincula a um curso",
          tags: ["Trainers"],
          params: requestIdSchema,
          body: trainerApprovalSchema,
          response: {
            200: z.object({ success: z.literal(true), request: trainerRequestSchema }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const existing = await prisma.trainerRegistrationRequest.findUnique({
          where: { id: request.params.id },
          select: { id: true },
        });
        if (!existing) return reply.code(404).send({ message: "Pedido de formador nao encontrado." });

        const course = await prisma.course.findFirst({
          where: { id: request.body.selectedCourseId, isPublished: true },
          select: { id: true },
        });
        if (!course) return reply.code(400).send({ message: "Curso indisponivel para aprovacao." });

        const updated = await prisma.trainerRegistrationRequest.update({
          where: { id: request.params.id },
          data: {
            selectedCourseId: request.body.selectedCourseId,
            status: "APPROVED",
            reviewedAt: new Date(),
            reviewedByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "admin",
            reviewNote: request.body.note,
          },
          include: { selectedCourse: true },
        });

        return { success: true, request: serializeTrainerRequest(updated) };
      },
    );

    adminApp.post<{ Params: z.infer<typeof requestIdSchema>; Body: z.infer<typeof trainerRejectSchema> }>(
      "/admin/requests/:id/reject",
      {
        schema: {
          description: "Recusa um pedido de formador com motivo curto",
          tags: ["Trainers"],
          params: requestIdSchema,
          body: trainerRejectSchema,
          response: {
            200: z.object({ success: z.literal(true), request: trainerRequestSchema }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        const existing = await prisma.trainerRegistrationRequest.findUnique({
          where: { id: request.params.id },
          select: { id: true },
        });
        if (!existing) return reply.code(404).send({ message: "Pedido de formador nao encontrado." });

        const updated = await prisma.trainerRegistrationRequest.update({
          where: { id: request.params.id },
          data: {
            status: "REJECTED",
            reviewedAt: new Date(),
            reviewedByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "admin",
            reviewNote: request.body.note,
          },
          include: { selectedCourse: true },
        });

        return { success: true, request: serializeTrainerRequest(updated) };
      },
    );
  });

  app.register(async (trainerApp) => {
    trainerApp.register(authGuard, { env: opts.env });

    trainerApp.get(
      "/me/dashboard",
      {
        schema: {
          description: "Painel limitado do formador aprovado",
          tags: ["Trainers"],
          response: {
            200: z.object({
              trainer: z.object({
                id: z.number(),
                name: z.string(),
                status: z.string(),
              }),
              course: courseOptionSchema,
              metrics: z.object({
                totalEnrollments: z.number(),
                confirmedPayments: z.number(),
                pendingPayments: z.number(),
                rejectedPayments: z.number(),
              }),
              updatedAt: z.string(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      },
      async (request, reply) => {
        if (!request.trainer) {
          return reply.code(401).send({ message: "Entra como formador para abrir este painel." });
        }

        const trainerRequest = await prisma.trainerRegistrationRequest.findFirst({
          where: {
            id: request.trainer.id,
            phone: request.trainer.phone,
          },
          include: {
            selectedCourse: {
              select: {
                id: true,
                name: true,
                description: true,
                companyName: true,
                companyCategory: true,
                isPublished: true,
              },
            },
          },
        });

        if (!trainerRequest) {
          return reply.code(404).send({ message: "Pedido de formador nao encontrado." });
        }

        if (!canTrainerAccessDashboard(trainerRequest.status)) {
          return reply.code(403).send({
            message: trainerRequest.status === "REJECTED"
              ? "O teu pedido de formador foi recusado. Contacta a organizacao para mais detalhes."
              : "O teu pedido de formador ainda esta em validacao.",
          });
        }

        const enrollments = await prisma.courseEnrollment.findMany({
          where: { courseId: trainerRequest.selectedCourseId },
          select: { paymentStatus: true },
        });

        return buildTrainerDashboardPayload({
          request: trainerRequest,
          course: trainerRequest.selectedCourse,
          enrollments,
        });
      },
    );
  });
}
