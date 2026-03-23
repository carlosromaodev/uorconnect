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
import { isCompetitionEligible, normalizeSubmissionType } from "../domain/submission-policy";
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

const submissionRepo = new PrismaSubmissionRepository();
const submissionConfigRepo = new PrismaSubmissionConfigRepository();
const voteRepo = new PrismaVoteRepository();
const reviewRepo = new PrismaReviewRepository();

const submissionCourses = [
  "Eng. Informática",
  "Eng. Telecomunicações",
  "Eng. Eletrotécnica",
  "Ciências Computação",
  "Arquitetura e Urbanismo",
  "Direito",
  "Contabilidade e Auditoria",
  "Gestão de Empresas",
  "Economia",
  "Enfermagem",
  "Psicologia",
  "Outro"
] as const;

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6})$/);
const teamMemberSchema = z.string().trim().min(2).max(80);
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
    course: z.enum(submissionCourses)
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
  description: z.string().min(20).max(500),
  members: teamMembersInputSchema,
  leaderName: z.string().trim().min(3).max(120),
  leaderPhone: z.string().regex(/^\+244 9\d{8}$/),
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
  bannerUrl: z.string().url().nullable().optional()
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
  bannerUrl: z.string().url().nullable().optional()
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

  app.post("/", {
    schema: {
      body: createSubmissionSchema,
      response: {
        201: z.object({
          referenceCode: z.string(),
          status: z.string(),
          id: z.number(),
          communityUrl: z.string().nullable(),
          boardingPassPath: z.string(),
          paymentProofPath: z.string().nullable()
        }),
        400: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
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

    const result = await createSubmission.execute({
      ...payload,
      members: normalizedMembers,
      primaryColor,
      secondaryColor,
      bannerUrl: payload.bannerUrl ?? null
    });

    const communityUrl = buildSubmissionCommunityUrl(result.type, config);

    return reply.code(201).send({
      referenceCode: result.referenceCode,
      status: result.status,
      id: result.id,
      communityUrl,
      boardingPassPath: `/submissions/${result.id}/boarding-pass.pdf`,
      paymentProofPath: `/submissions/${result.id}/payment-proof`
    });
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env });
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
      return list.map((s) => {
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
          area: (s as any).area ?? null,
          createdAt: (s as any).createdAt ?? null,
          course: (s as any).course ?? null,
          members: s.members.length > 0 ? formatTeamMembersLabel(s.members) : null,
          membersList: s.members,
          teamSize: s.members.length,
          leaderName: (s as any).leaderName ?? null,
          leaderPhone: (s as any).leaderPhone ?? null,
          needs: s.needs,
          observations: (s as any).observations ?? null,
          primaryColor: s.primaryColor,
          secondaryColor: s.secondaryColor,
          bannerUrl: s.bannerUrl ?? null,
          isWinner: competitionEligible ? (s as any).isWinner ?? false : false,
          canVote: competitionEligible,
          eligibleForAward: competitionEligible
        };
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
    }, async (_, reply) => {
      await clearWinnerSubmission.execute();
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
      try {
        await deleteSubmission.execute((request.params as { id: number }).id);
        return reply.send({ success: true });
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Submission not found" });
      }
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
    const html = buildBoardingPassHtml(submission, { generatedAt, logoDataUri });
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
