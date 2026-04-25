import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaSubmissionRepository, PrismaSubmissionConfigRepository, PrismaVoteRepository, PrismaReviewRepository } from "../infra/prisma/prisma.submission.repository";
import { CreateSubmission } from "../use-cases/create-submission";
import { VoteSubmission } from "../use-cases/vote-submission";
import { ReviewSubmission } from "../use-cases/review-submission";
import { SelectWinnerSubmission } from "../use-cases/select-winner";
import { ClearWinnerSubmission } from "../use-cases/clear-winner";
import {
  DeleteSubmission,
  GetSubmissionConfig,
  ListDetailedSubmissions,
  UpdateSubmissionConfig,
  UpdateSubmissionPresentation,
  UpdateSubmissionStatus
} from "../use-cases/manage-submissions";
import { loadEnv } from "../../../config/env";
import { getSubmissionTypeLabel, isCompetitionEligible, normalizeSubmissionType } from "../domain/submission-policy";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";
import {
  buildSubmissionSlug,
  DEFAULT_SUBMISSION_PRIMARY_COLOR,
  DEFAULT_SUBMISSION_SECONDARY_COLOR,
  formatTeamMembersLabel,
  MAX_TEAM_MEMBERS,
  normalizeTeamMembersInput
} from "../domain/submission-format";
import { buildBoardingPassHtml, buildSubmissionCommunityUrl, parseStoredProof, proofExtensionFromMime } from "./submission-ticket";
import { loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { OFFICIAL_COURSES } from "../../../shared/official-courses";
import { prisma } from "../../../shared/prisma";
import { normalizeAngolaPhone } from "../../auth/domain/student-format";
import {
  buildStudentSubmissionListItem,
  buildStudentSubmissionReceiptResponse,
  canStudentEditSubmission,
} from "./student-submission-presenter";
import { recordAdminAudit } from "../../audit/application/audit.service";

const submissionRepo = new PrismaSubmissionRepository();
const submissionConfigRepo = new PrismaSubmissionConfigRepository();
const voteRepo = new PrismaVoteRepository();
const reviewRepo = new PrismaReviewRepository();

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6})$/);
const imageDataUrlSchema = z.string().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/);
const teamMemberSchema = z.string().trim().min(2).max(80);
const leaderPhoneSchema = z.string()
  .trim()
  .transform((value) => normalizeAngolaPhone(value) ?? value.trim())
  .refine((value) => /^\+2449\d{8}$/.test(value), {
    message: "Número de telefone inválido.",
  });
const teamMembersInputSchema = z.union([
  z.array(teamMemberSchema).min(1).max(MAX_TEAM_MEMBERS),
  z.string().min(3)
]).refine((value) => {
  const members = normalizeTeamMembersInput(value);
  return members.length >= 1 && members.length <= MAX_TEAM_MEMBERS;
}, {
  message: `Adiciona entre 1 e ${MAX_TEAM_MEMBERS} nomes de membros da equipa.`
});

const typeSpecificSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PROJECT"),
    area: z.enum(["Engenharia", "Tecnologia", "Sustentabilidade", "Inovação", "Ciências Aplicadas", "Outra"]),
    course: z.enum(OFFICIAL_COURSES)
  }),
  z.object({
    type: z.literal("BUSINESS"),
    area: z.enum(["Tecnologia", "Comércio", "Serviços", "Alimentação", "Educação", "Saúde", "Outra"]),
    stage: z.enum(["Ideia", "Protótipo", "MVP", "Funcionando", "Já no Mercado"])
  }),
  z.object({
    type: z.literal("PRODUCT"),
    category: z.enum(["Hardware", "Software", "Alimentar", "Artesanato", "Vestuário", "Outro"]),
    productType: z.enum(["Físico", "Digital", "Híbrido"]),
    area: z.string().default("Produto")
  })
]);

const baseSubmissionSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().trim().max(500).refine((value) => value.length === 0 || value.length >= 10, {
    message: "Descrição deve ter entre 10 e 500 caracteres."
  }),
  members: teamMembersInputSchema,
  leaderName: z.string().trim().min(3).max(120),
  leaderPhone: leaderPhoneSchema,
  leaderEmail: z.string().trim().email().optional(),
  needs: z.array(
    z.enum([
      "Tomada elétrica",
      "Projetor multimédia",
      "Ligação à internet",
      "Mesa de exposição",
      "Espaço extra"
    ])
  ),
  paymentProof: z.union([
    z.string().regex(/^data:(application\/pdf|image\/png|image\/jpeg|image\/webp);base64,[A-Za-z0-9+/=]+$/),
    z.string().url()
  ]),
  paymentConfirmed: z.literal(true),
  repoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  observations: z.string().max(500).optional(),
  agreeRules: z.literal(true),
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  bannerUrl: z.union([z.string().url(), imageDataUrlSchema]).nullable().optional()
});

const submissionConfigSchema = z.object({
  isOpen: z.boolean(),
  iban: z.string().min(5).max(80),
  accountName: z.string().min(3).max(120),
  paymentAmount: z.string().min(2).max(40),
  paymentInstructions: z.string().max(300).optional().nullable(),
  projectCommunityUrl: z.string().url().optional().nullable(),
  businessCommunityUrl: z.string().url().optional().nullable(),
  productCommunityUrl: z.string().url().optional().nullable()
});

const createSubmissionSchema = baseSubmissionSchema.and(typeSpecificSchema);
const submissionPresentationSchema = z.object({
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  bannerUrl: z.union([z.string().url(), imageDataUrlSchema]).nullable().optional()
});

const studentSubmissionListItemSchema = z.object({
  id: z.number(),
  referenceCode: z.string(),
  name: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  type: z.string(),
  typeLabel: z.string(),
  createdAt: z.string(),
  detailPath: z.string(),
  bannerUrl: z.string().nullable(),
  receiptPath: z.string(),
});

const studentSubmissionReceiptSchema = z.object({
  id: z.number(),
  referenceCode: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.string(),
  statusLabel: z.string(),
  type: z.string(),
  typeLabel: z.string(),
  area: z.string(),
  course: z.string().nullable(),
  stage: z.string().nullable(),
  category: z.string().nullable(),
  productType: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  members: z.string(),
  membersList: z.array(z.string()),
  teamSize: z.number(),
  leaderName: z.string().nullable(),
  leaderPhone: z.string().nullable(),
  leaderEmail: z.string().nullable(),
  needs: z.array(z.string()),
  observations: z.string().nullable(),
  repoUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  bannerUrl: z.string().nullable(),
  communityUrl: z.string().nullable(),
  boardingPassPath: z.string(),
  paymentProofPath: z.string().nullable(),
  receiptPath: z.string(),
  detailPath: z.string(),
  canEdit: z.boolean(),
});

const adminSubmissionQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  type: z.enum(["PROJECT", "BUSINESS", "PRODUCT"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50),
  search: z.string().trim().max(160).optional(),
  sort: z.enum([
    "created_desc",
    "created_asc",
    "name_asc",
    "name_desc",
    "reference_asc",
    "reference_desc",
    "course_asc",
    "course_desc",
  ]).default("created_desc"),
});

function hexToRgb(value: string) {
  const normalized = value.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getLuminance(value: string) {
  const { r, g, b } = hexToRgb(value);

  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
}

function getContrastRatio(left: string, right: string) {
  const [lighter, darker] = [getLuminance(left), getLuminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function validateSubmissionTheme(primaryColor: string, secondaryColor: string) {
  if (primaryColor.toLowerCase() === secondaryColor.toLowerCase()) {
    return "As cores primária e secundária precisam ser diferentes.";
  }

  const pairContrast = getContrastRatio(primaryColor, secondaryColor);
  const primaryReadableContrast = Math.max(
    getContrastRatio(primaryColor, "#FFFFFF"),
    getContrastRatio(primaryColor, "#152434")
  );
  const secondaryReadableContrast = Math.max(
    getContrastRatio(secondaryColor, "#FFFFFF"),
    getContrastRatio(secondaryColor, "#152434")
  );

  if (pairContrast < 1.2 || primaryReadableContrast < 3 || secondaryReadableContrast < 3) {
    return "Escolhe uma combinação de cores com melhor contraste para manter os cards e detalhes legíveis.";
  }

  return null;
}

function parseSubmissionNeeds(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

function toAdminSubmissionResponse(s: any) {
  const membersList = normalizeTeamMembersInput(s.members);
  const needsList = parseSubmissionNeeds(s.needs);
  const competitionEligible = isCompetitionEligible(s.type, s.area);
  const slug = buildSubmissionSlug(s.name, s.id);

  return {
    id: s.id,
    slug,
    detailPath: `/projeto/${slug}`,
    referenceCode: s.referenceCode,
    name: s.name,
    description: s.description,
    status: s.status,
    type: normalizeSubmissionType(s.type, s.area),
    area: s.area ?? null,
    createdAt: s.createdAt ?? null,
    course: s.course ?? null,
    members: membersList.length > 0 ? formatTeamMembersLabel(membersList) : null,
    membersList,
    teamSize: membersList.length,
    leaderName: s.leaderName ?? null,
    leaderPhone: s.leaderPhone ?? null,
    needs: needsList,
    observations: s.observations ?? null,
    primaryColor: s.primaryColor,
    secondaryColor: s.secondaryColor,
    bannerUrl: s.bannerUrl ?? null,
    isWinner: competitionEligible ? s.isWinner ?? false : false,
    canVote: competitionEligible,
    eligibleForAward: competitionEligible
  };
}

export async function submissionRoutes(app: FastifyInstance, { env }: { env: ReturnType<typeof loadEnv> }) {
  const createSubmission = new CreateSubmission(submissionRepo);
  const voteSubmission = new VoteSubmission(submissionRepo, voteRepo);
  const reviewSubmission = new ReviewSubmission(submissionRepo, reviewRepo);
  const selectWinnerSubmission = new SelectWinnerSubmission(submissionRepo);
  const clearWinnerSubmission = new ClearWinnerSubmission(submissionRepo);
  const listDetailedSubmissions = new ListDetailedSubmissions(submissionRepo);
  const getSubmissionConfig = new GetSubmissionConfig(submissionConfigRepo);
  const updateSubmissionConfig = new UpdateSubmissionConfig(submissionConfigRepo);
  const updateSubmissionStatus = new UpdateSubmissionStatus(submissionRepo);
  const updateSubmissionPresentation = new UpdateSubmissionPresentation(submissionRepo);
  const deleteSubmission = new DeleteSubmission(submissionRepo);

  app.get("/config", {
    schema: {
      response: {
        200: submissionConfigSchema.extend({
          key: z.string(),
          createdAt: z.coerce.date(),
          updatedAt: z.coerce.date()
        })
      }
    }
  }, async () => {
    return getSubmissionConfig.execute();
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env });

    protectedApp.post("/", {
      schema: {
        body: createSubmissionSchema,
        response: {
          201: z.object({
            referenceCode: z.string(),
            status: z.string(),
            id: z.number(),
            communityUrl: z.string().nullable(),
            boardingPassPath: z.string(),
            paymentProofPath: z.string().nullable(),
            receiptPath: z.string(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const payload = request.body as z.infer<typeof createSubmissionSchema>;
      const normalizedMembers = normalizeTeamMembersInput(payload.members);
      const primaryColor = payload.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR;
      const secondaryColor = payload.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR;
      const themeError = validateSubmissionTheme(primaryColor, secondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const config = await getSubmissionConfig.execute();
      if (!config.isOpen) {
        return reply.code(403).send({ message: "As candidaturas estão fechadas neste momento." });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.student.id },
      });

      if (!student) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const result = await createSubmission.execute({
        ...payload,
        members: normalizedMembers,
        primaryColor,
        secondaryColor,
        bannerUrl: payload.bannerUrl ?? null,
        studentId: student.id,
        studentNumberSnapshot: student.studentNumber,
      });

      const communityUrl = buildSubmissionCommunityUrl(result.type, config);

      return reply.code(201).send({
        referenceCode: result.referenceCode,
        status: result.status,
        id: result.id,
        communityUrl,
        boardingPassPath: `/submissions/${result.id}/boarding-pass.pdf`,
        paymentProofPath: `/submissions/${result.id}/payment-proof`,
        receiptPath: `/submissoes/${result.id}`,
      });
    });

    protectedApp.get("/mine", {
      schema: {
        response: {
          200: z.array(studentSubmissionListItemSchema),
          401: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const submissions = await submissionRepo.listByStudent(request.student.id);
      return reply.send(submissions.map((submission) => buildStudentSubmissionListItem(submission)));
    });

    protectedApp.get("/:id/receipt", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: studentSubmissionReceiptSchema,
          401: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const submission = await submissionRepo.findOwnedById((request.params as { id: number }).id, request.student.id);
      if (!submission) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      const config = await getSubmissionConfig.execute();
      return reply.send(buildStudentSubmissionReceiptResponse(submission, config));
    });

    protectedApp.patch("/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: createSubmissionSchema,
        response: {
          200: studentSubmissionReceiptSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const submissionId = (request.params as { id: number }).id;
      const existing = await submissionRepo.findOwnedById(submissionId, request.student.id);
      if (!existing) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      if (!canStudentEditSubmission(existing.status)) {
        return reply.code(403).send({ message: "Esta submissão já não pode ser editada." });
      }

      const payload = request.body as z.infer<typeof createSubmissionSchema>;
      const normalizedMembers = normalizeTeamMembersInput(payload.members);
      const primaryColor = payload.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR;
      const secondaryColor = payload.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR;
      const themeError = validateSubmissionTheme(primaryColor, secondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const student = await prisma.student.findUnique({
        where: { id: request.student.id },
      });

      if (!student) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const updated = await submissionRepo.updateOwnedSubmission(submissionId, request.student.id, {
        ...payload,
        members: normalizedMembers,
        primaryColor,
        secondaryColor,
        bannerUrl: payload.bannerUrl ?? null,
        studentId: student.id,
        studentNumberSnapshot: student.studentNumber,
      });

      const config = await getSubmissionConfig.execute();
      return reply.send(buildStudentSubmissionReceiptResponse(updated, config));
    });

    protectedApp.patch("/:id/presentation/mine", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: submissionPresentationSchema,
        response: {
          200: z.object({
            id: z.number(),
            slug: z.string(),
            detailPath: z.string(),
            primaryColor: z.string(),
            secondaryColor: z.string(),
            bannerUrl: z.string().nullable(),
            status: z.string(),
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      if (!request.student?.id) {
        return reply.code(401).send({ message: "Missing or invalid token" });
      }

      const { id } = request.params as { id: number };
      const body = request.body as z.infer<typeof submissionPresentationSchema>;
      const existing = await submissionRepo.findOwnedById(id, request.student.id);

      if (!existing) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      if (existing.status !== "APPROVED") {
        return reply.code(403).send({ message: "A personalização da capa só fica disponível depois da aprovação." });
      }

      const nextPrimaryColor = body.primaryColor ?? existing.primaryColor;
      const nextSecondaryColor = body.secondaryColor ?? existing.secondaryColor;
      const themeError = validateSubmissionTheme(nextPrimaryColor, nextSecondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const updated = await updateSubmissionPresentation.execute(id, body);
      const slug = buildSubmissionSlug(updated.name, updated.id);

      return reply.send({
        id: updated.id,
        slug,
        detailPath: `/projeto/${slug}`,
        primaryColor: updated.primaryColor,
        secondaryColor: updated.secondaryColor,
        bannerUrl: updated.bannerUrl ?? null,
        status: updated.status,
      });
    });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);

      adminApp.put("/config", {
      schema: {
        body: submissionConfigSchema,
        response: {
          200: submissionConfigSchema.extend({
            key: z.string(),
            createdAt: z.coerce.date(),
            updatedAt: z.coerce.date()
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request) => {
        const payload = request.body as z.infer<typeof submissionConfigSchema>;
        return updateSubmissionConfig.execute(payload);
      });

      adminApp.get("/", {
      schema: {
        querystring: z.object({ status: z.string().optional(), type: z.string().optional() }),
        response: {
          200: z.array(z.object({
            id: z.number(),
            slug: z.string(),
            detailPath: z.string(),
            referenceCode: z.string(),
            name: z.string(),
            description: z.string(),
            status: z.string(),
            type: z.string(),
            area: z.string().nullable(),
            createdAt: z.coerce.date().nullable(),
            course: z.string().nullable(),
            members: z.string().nullable(),
            membersList: z.array(z.string()),
            teamSize: z.number(),
            leaderName: z.string().nullable(),
            leaderPhone: z.string().nullable(),
            needs: z.array(z.string()),
            observations: z.string().nullable(),
            primaryColor: z.string(),
            secondaryColor: z.string(),
            bannerUrl: z.string().nullable(),
            isWinner: z.boolean(),
            canVote: z.boolean(),
            eligibleForAward: z.boolean()
          })),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request) => {
        const { status, type } = request.query as { status?: any; type?: any };
        const list = await listDetailedSubmissions.execute(status, type);
        return list.map((submission) => toAdminSubmissionResponse(submission));
      });

      adminApp.get("/paged", {
      schema: {
        querystring: adminSubmissionQuerySchema,
        response: {
          200: z.object({
            items: z.array(z.object({
              id: z.number(),
              slug: z.string(),
              detailPath: z.string(),
              referenceCode: z.string(),
              name: z.string(),
              description: z.string(),
              status: z.string(),
              type: z.string(),
              area: z.string().nullable(),
              createdAt: z.coerce.date().nullable(),
              course: z.string().nullable(),
              members: z.string().nullable(),
              membersList: z.array(z.string()),
              teamSize: z.number(),
              leaderName: z.string().nullable(),
              leaderPhone: z.string().nullable(),
              needs: z.array(z.string()),
              observations: z.string().nullable(),
              primaryColor: z.string(),
              secondaryColor: z.string(),
              bannerUrl: z.string().nullable(),
              isWinner: z.boolean(),
              canVote: z.boolean(),
              eligibleForAward: z.boolean()
            })),
            total: z.number(),
            page: z.number(),
            totalPages: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const query = adminSubmissionQuerySchema.parse(request.query);
        const page = query.page;
        const limit = query.limit;
        const search = query.search?.trim();
        const where = {
          ...(query.status ? { status: query.status } : {}),
          ...(query.type ? { type: query.type } : {}),
          ...(search
            ? {
              OR: [
                { name: { contains: search } },
                { referenceCode: { contains: search } },
                { course: { contains: search } },
                { leaderName: { contains: search } },
                { leaderPhone: { contains: search } },
              ],
            }
            : {}),
        };

        const orderBy = query.sort === "created_asc"
          ? [{ createdAt: "asc" as const }]
          : query.sort === "name_asc"
            ? [{ name: "asc" as const }, { createdAt: "desc" as const }]
            : query.sort === "name_desc"
              ? [{ name: "desc" as const }, { createdAt: "desc" as const }]
              : query.sort === "reference_asc"
                ? [{ referenceCode: "asc" as const }, { createdAt: "desc" as const }]
                : query.sort === "reference_desc"
                  ? [{ referenceCode: "desc" as const }, { createdAt: "desc" as const }]
                  : query.sort === "course_asc"
                    ? [{ course: "asc" as const }, { createdAt: "desc" as const }]
                    : query.sort === "course_desc"
                      ? [{ course: "desc" as const }, { createdAt: "desc" as const }]
                      : [{ createdAt: "desc" as const }];

        const [total, items] = await Promise.all([
          prisma.submission.count({ where }),
          prisma.submission.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
          }),
        ]);

        return reply.send({
          items: items.map((item) => toAdminSubmissionResponse(item)),
          total,
          page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        });
      });

      adminApp.patch("/:id/status", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: z.object({
          status: z.enum(["PENDING", "APPROVED", "REJECTED"])
        }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const { status } = request.body as { status: "PENDING" | "APPROVED" | "REJECTED" };

        try {
          await updateSubmissionStatus.execute(id, status);
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.update_status",
            entityType: "Submission",
            entityId: id,
            summary: `Estado da candidatura ${id} atualizado para ${status}.`,
            metadata: { status },
          });
          return reply.send({ success: true });
        } catch (error) {
          return reply.code(404).send({ message: error instanceof Error ? error.message : "Submission not found" });
        }
      });

      adminApp.patch("/:id/winner", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
      const { id } = request.params as { id: number };

      try {
        await selectWinnerSubmission.execute(id);
        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.select_winner",
          entityType: "Submission",
          entityId: id,
          summary: `Candidatura ${id} marcada como vencedora.`,
        });
        return reply.send({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to select winner";
        if (message === "Submission not found") {
          return reply.code(404).send({ message });
        }
        return reply.code(400).send({ message });
      }
      });

      adminApp.patch("/:id/presentation", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: submissionPresentationSchema,
        response: {
          200: z.object({
            id: z.number(),
            slug: z.string(),
            detailPath: z.string(),
            primaryColor: z.string(),
            secondaryColor: z.string(),
            bannerUrl: z.string().nullable()
          }),
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
      const { id } = request.params as { id: number };
      const body = request.body as z.infer<typeof submissionPresentationSchema>;
      const existing = await submissionRepo.findById(id);

      if (!existing) {
        return reply.code(404).send({ message: "Submission not found" });
      }

      const nextPrimaryColor = body.primaryColor ?? existing.primaryColor;
      const nextSecondaryColor = body.secondaryColor ?? existing.secondaryColor;
      const themeError = validateSubmissionTheme(nextPrimaryColor, nextSecondaryColor);

      if (themeError) {
        return reply.code(400).send({ message: themeError });
      }

      const updated = await updateSubmissionPresentation.execute(id, body);
      const slug = buildSubmissionSlug(updated.name, updated.id);

      await recordAdminAudit({
        actorStudentNumber: request.student?.studentNumber,
        action: "submission.update_presentation",
        entityType: "Submission",
        entityId: id,
        summary: `Apresentação da candidatura ${id} atualizada.`,
        metadata: {
          primaryColor: updated.primaryColor,
          secondaryColor: updated.secondaryColor,
          hasBanner: Boolean(updated.bannerUrl),
        },
      });

      return reply.send({
        id: updated.id,
        slug,
        detailPath: `/projeto/${slug}`,
        primaryColor: updated.primaryColor,
        secondaryColor: updated.secondaryColor,
        bannerUrl: updated.bannerUrl ?? null
      });
      });

      adminApp.delete("/winner", {
      schema: {
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        await clearWinnerSubmission.execute();
        await recordAdminAudit({
          actorStudentNumber: request.student?.studentNumber,
          action: "submission.clear_winner",
          entityType: "Submission",
          summary: "Vencedor de candidaturas removido.",
        });
        return reply.send({ success: true });
      });

      adminApp.delete("/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        try {
          await deleteSubmission.execute(id);
          await recordAdminAudit({
            actorStudentNumber: request.student?.studentNumber,
            action: "submission.delete",
            entityType: "Submission",
            entityId: id,
            summary: `Candidatura ${id} removida.`,
          });
          return reply.send({ success: true });
        } catch (error) {
          return reply.code(404).send({ message: error instanceof Error ? error.message : "Submission not found" });
        }
      });
    });
  });

  app.get("/:id/summary", {
    schema: {
      params: z.object({ id: z.coerce.number().int() }),
      response: {
        200: z.object({
          id: z.number(),
          referenceCode: z.string(),
          name: z.string(),
          status: z.string(),
          type: z.string(),
          votes: z.number(),
          averageRating: z.number(),
          reviews: z.array(z.object({ user: z.string(), rating: z.number(), comment: z.string().nullable(), createdAt: z.string() }))
        }).nullable()
      }
    }
  }, async (request) => {
    const { id } = request.params as { id: number };
    const summary = await submissionRepo.summary(id);
    if (!summary) return null;
    return {
      ...summary,
      reviews: summary.reviews.map((r: { user: string; rating: number; comment?: string | null; createdAt: Date }) => ({
        ...r,
        comment: r.comment ?? null,
        createdAt: r.createdAt.toISOString()
      }))
    };
  });

  app.get("/:id/boarding-pass.pdf", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: {
        404: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const submission = await submissionRepo.findById(id);

    if (!submission) {
      return reply.code(404).send({ message: "Submission not found" });
    }

    const generatedAt = new Date();
    const logoDataUri = await loadLogoDataUri();
    const publicAppUrl = env.PUBLIC_APP_URL ?? env.CORS_ORIGIN.split(",").map((item) => item.trim()).find((item) => item.startsWith("http")) ?? null;
    const publicApiUrl = env.PUBLIC_API_URL?.replace(/\/$/, "") ?? null;
    const html = buildBoardingPassHtml(submission, {
      generatedAt,
      logoDataUri,
      publicAppUrl,
      pdfUrl: publicApiUrl ? `${publicApiUrl}/submissions/${submission.id}/boarding-pass.pdf` : null
    });
    const pdf = await renderPdfFromHtml(html, {
      footerLabel: `Talão ${submission.referenceCode}`
    });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${submission.referenceCode.toLowerCase()}-talao-embarque.pdf"`);
    return reply.send(pdf);
  });

  app.get("/:id/payment-proof", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: {
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const submission = await submissionRepo.findById(id);

    if (!submission) {
      return reply.code(404).send({ message: "Submission not found" });
    }

    const proof = parseStoredProof(submission.paymentProof);

    if (proof.kind === "data-url") {
      const extension = proofExtensionFromMime(proof.mimeType);
      reply.header("Content-Type", proof.mimeType);
      reply.header("Content-Disposition", `inline; filename="${submission.referenceCode.toLowerCase()}-comprovativo.${extension}"`);
      return reply.send(proof.buffer);
    }

    if (proof.kind === "url") {
      return reply.redirect(proof.url);
    }

    return reply.code(409).send({ message: "Comprovativo indisponível para esta candidatura." });
  });

  app.post("/:id/vote", {
    schema: {
      params: z.object({ id: z.coerce.number().int() }),
      body: z.object({ email: z.string().email() })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const { email } = request.body as { email: string };
    await voteSubmission.execute(id, email);
    return reply.code(204).send();
  });

  app.post("/:id/review", {
    schema: {
      params: z.object({ id: z.coerce.number().int() }),
      body: z.object({
        email: z.string().email(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(10).max(500).optional()
      })
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number };
    const { email, rating, comment } = request.body as { email: string; rating: number; comment?: string };
    await reviewSubmission.execute(id, email, rating, comment);
    return reply.code(204).send();
  });
}
