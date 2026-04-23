import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";
import { type Env } from "../../../config/env";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { PrismaAdminVotesRepository } from "../infra/admin-votes.repository";
import { GetAdminVotesOverview } from "../use-cases/admin-votes";
import { PrismaInteractionModerationRepository } from "../infra/moderation.repository";
import {
  DeleteLiveChatMessage,
  DeleteProjectComment,
  GetInteractionModerationOverview
} from "../use-cases/manage-moderation";
import { getSubmissionTypeLabel, isCompetitionEligible, normalizeSubmissionType } from "../../submission/domain/submission-policy";
import {
  buildSubmissionExcerpt,
  buildSubmissionSlug,
  formatTeamMembersLabel,
  normalizeTeamMembersInput
} from "../../submission/domain/submission-format";

let optsEnvCache: Env;

function normalizeCourseName(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

const courseColorCacheTtlMs = 1000 * 60 * 5;
let cachedCourseColorsAt = 0;
let cachedCourseColorMap: Map<string, string | null> | null = null;

async function getCourseColorMap() {
  const now = Date.now();
  if (cachedCourseColorMap && (now - cachedCourseColorsAt) < courseColorCacheTtlMs) {
    return cachedCourseColorMap;
  }

  const courses = await prisma.course.findMany({
    select: { name: true, courseColor: true }
  });

  cachedCourseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));
  cachedCourseColorsAt = now;
  return cachedCourseColorMap;
}

function resolvePublicOrigin(request: FastifyRequest, env: Env) {
  if (env.PUBLIC_APP_URL) {
    return env.PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const corsOrigins = env.CORS_ORIGIN
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("http://") || value.startsWith("https://"));

  if (corsOrigins.length > 0) {
    return corsOrigins[0].replace(/\/$/, "");
  }

  const originHeader = String(request.headers.origin ?? "").trim();
  if (originHeader.startsWith("http://") || originHeader.startsWith("https://")) {
    return originHeader.replace(/\/$/, "");
  }

  const refererHeader = String(request.headers.referer ?? "").trim();
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      // Ignore malformed referer and continue to forwarded headers.
    }
  }

  const forwardedProto = String(request.headers["x-forwarded-proto"] ?? request.protocol ?? "http").split(",")[0].trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0].trim();
  if (!forwardedHost) return null;

  return `${forwardedProto}://${forwardedHost}`;
}

function buildProjectShareMetadata(request: FastifyRequest, env: Env, submission: { id: number; name: string }) {
  const slug = buildSubmissionSlug(submission.name, submission.id);
  const detailPath = `/projeto/${slug}`;
  const origin = resolvePublicOrigin(request, env);
  const shareUrl = origin ? `${origin}${detailPath}` : detailPath;

  return {
    slug,
    detailPath,
    shareUrl,
    qrCodeValue: shareUrl
  };
}

function formatProjectLike(like: any) {
  const profile = normalizeStudentProfile(like.student);
  return {
    id: like.id,
    createdAt: like.createdAt.toISOString(),
    studentName: profile.name ?? `Estudante ${like.student.studentNumber}`,
    course: profile.course ?? null
  };
}

function formatProjectComment(comment: any) {
  const profile = normalizeStudentProfile(comment.student);
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    studentName: profile.name ?? `Estudante ${comment.student.studentNumber}`,
    course: profile.course ?? null
  };
}

function buildProjectResponse(submission: any, request: FastifyRequest) {
  const normalizedType = normalizeSubmissionType(submission.type, submission.area);
  const competitionEligible = isCompetitionEligible(submission.type, submission.area);
  const membersList = normalizeTeamMembersInput(submission.members);
  const share = buildProjectShareMetadata(request, optsEnvCache, submission);

  return {
    id: submission.id,
    slug: share.slug,
    detailPath: share.detailPath,
    shareUrl: share.shareUrl,
    qrCodeValue: share.qrCodeValue,
    name: submission.name,
    summary: buildSubmissionExcerpt(submission.description),
    description: submission.description,
    area: submission.area,
    course: submission.course ?? null,
    stage: submission.stage ?? null,
    category: submission.category ?? null,
    productType: submission.productType ?? null,
    members: formatTeamMembersLabel(membersList),
    membersList,
    teamSize: membersList.length,
    type: normalizedType,
    typeLabel: getSubmissionTypeLabel(submission.type, submission.area),
    createdAt: submission.createdAt.toISOString(),
    isWinner: competitionEligible ? submission.isWinner : false,
    canVote: competitionEligible,
    canLike: competitionEligible,
    eligibleForAward: competitionEligible,
    primaryColor: submission.primaryColor,
    secondaryColor: submission.secondaryColor,
    bannerUrl: submission.bannerUrl ?? null,
    repoUrl: submission.repoUrl ?? null,
    websiteUrl: submission.websiteUrl ?? null,
    likesCount: submission.studentLikes.length,
    votesCount: competitionEligible ? submission.studentVotes.length : 0,
    commentsCount: submission.studentComments.length,
    likes: submission.studentLikes.map((like: any) => formatProjectLike(like)),
    comments: submission.studentComments.map((comment: any) => formatProjectComment(comment))
  };
}

function extractSubmissionIdFromSlug(slug: string) {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;

  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

export async function interactionsRoutes(app: FastifyInstance, opts: { env: Env }) {
  optsEnvCache = opts.env;
  const adminVotesRepository = new PrismaAdminVotesRepository();
  const adminVotesOverview = new GetAdminVotesOverview(adminVotesRepository);
  const moderationRepository = new PrismaInteractionModerationRepository();
  const interactionModerationOverview = new GetInteractionModerationOverview(moderationRepository);
  const deleteProjectComment = new DeleteProjectComment(moderationRepository);
  const deleteLiveChatMessage = new DeleteLiveChatMessage(moderationRepository);
  const projectLikeSchema = z.object({
    id: z.number(),
    createdAt: z.string(),
    studentName: z.string(),
    course: z.string().nullable()
  });
  const projectCommentSchema = z.object({
    id: z.number(),
    content: z.string(),
    createdAt: z.string(),
    studentName: z.string(),
    course: z.string().nullable()
  });
  const projectSchema = z.object({
    id: z.number(),
    slug: z.string(),
    detailPath: z.string(),
    shareUrl: z.string(),
    qrCodeValue: z.string(),
    name: z.string(),
    summary: z.string(),
    description: z.string(),
    area: z.string(),
    course: z.string().nullable(),
    stage: z.string().nullable(),
    category: z.string().nullable(),
    productType: z.string().nullable(),
    members: z.string(),
    membersList: z.array(z.string()),
    teamSize: z.number(),
    type: z.string(),
    typeLabel: z.string(),
    createdAt: z.string(),
    isWinner: z.boolean(),
    canVote: z.boolean(),
    canLike: z.boolean(),
    eligibleForAward: z.boolean(),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    bannerUrl: z.string().nullable(),
    repoUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    likesCount: z.number(),
    votesCount: z.number(),
    commentsCount: z.number(),
    likes: z.array(projectLikeSchema),
    comments: z.array(projectCommentSchema)
  });

  app.get(
    "/projects",
    {
      schema: {
        response: {
          200: z.array(projectSchema)
        }
      }
    },
    async (request, reply) => {
      const submissions = await prisma.submission.findMany({
        where: { status: "APPROVED" },
        include: {
          studentLikes: {
            include: { student: true },
            orderBy: { createdAt: "desc" }
          },
          studentVotes: true,
          studentComments: {
            include: { student: true },
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return reply.send(submissions.map((submission) => buildProjectResponse(submission, request)));
    }
  );

  app.get(
    "/projects/:slug",
    {
      schema: {
        params: z.object({ slug: z.string().min(3) }),
        response: {
          200: projectSchema,
          404: z.object({ message: z.string() })
        }
      }
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const id = extractSubmissionIdFromSlug(slug);
      if (!id) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const submission = await prisma.submission.findUnique({
        where: { id },
        include: {
          studentLikes: {
            include: { student: true },
            orderBy: { createdAt: "desc" }
          },
          studentVotes: true,
          studentComments: {
            include: { student: true },
            orderBy: { createdAt: "asc" }
          }
        }
      });

      if (!submission || submission.status !== "APPROVED") {
        return reply.status(404).send({ message: "Project not found" });
      }

      const derivedSlug = buildSubmissionSlug(submission.name, submission.id);
      if (derivedSlug !== slug) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return reply.send(buildProjectResponse(submission, request));
    }
  );

  app.get(
    "/activity-feed",
    {
      schema: {
        response: {
          200: z.array(z.object({
            id: z.string(),
            type: z.enum(["vote", "comment", "submission"]),
            message: z.string(),
            actorName: z.string(),
            actorCourse: z.string().nullable(),
            actorCourseColor: z.string().nullable(),
            subject: z.string(),
            createdAt: z.string()
          }))
        }
      }
    },
    async (_, reply) => {
      const [votes, comments, submissions, courses] = await Promise.all([
        prisma.studentVote.findMany({
          include: { student: true, submission: true },
          orderBy: { createdAt: "desc" },
          take: 12
        }),
        prisma.studentComment.findMany({
          include: { student: true, submission: true },
          orderBy: { createdAt: "desc" },
          take: 12
        }),
        prisma.submission.findMany({
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          take: 12
        }),
        prisma.course.findMany({
          select: {
            name: true,
            courseColor: true
          }
        })
      ]);

      const courseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));

      const items = [
        ...votes.map((vote) => {
          const profile = normalizeStudentProfile(vote.student);
          const actorName = profile.name ?? `Estudante ${vote.student.studentNumber}`;
          return {
            id: `vote-${vote.id}`,
            type: "vote" as const,
            message: "votou neste projeto",
            actorName,
            actorCourse: profile.course ?? null,
            actorCourseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null,
            subject: vote.submission.name,
            createdAt: vote.createdAt.toISOString()
          };
        }),
        ...comments.map((comment) => {
          const profile = normalizeStudentProfile(comment.student);
          const actorName = profile.name ?? `Estudante ${comment.student.studentNumber}`;
          return {
            id: `comment-${comment.id}`,
            type: "comment" as const,
            message: comment.content,
            actorName,
            actorCourse: profile.course ?? null,
            actorCourseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null,
            subject: comment.submission.name,
            createdAt: comment.createdAt.toISOString()
          };
        }),
        ...submissions.map((submission) => ({
          id: `submission-${submission.id}`,
          type: "submission" as const,
          message: `Novo projeto aprovado: ${submission.name}`,
          actorName: "Sistema",
          actorCourse: submission.course ?? null,
          actorCourseColor: courseColorMap.get(normalizeCourseName(submission.course)) ?? null,
          subject: submission.name,
          createdAt: submission.createdAt.toISOString()
        }))
      ]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 12);

      return reply.send(items);
    }
  );

  app.get(
    "/live-chat",
    {
      schema: {
        response: {
          200: z.array(z.object({
            id: z.number(),
            content: z.string(),
            createdAt: z.string(),
            studentName: z.string(),
            course: z.string().nullable(),
            courseColor: z.string().nullable()
          }))
        }
      }
    },
    async (_, reply) => {
      const [messages, courses] = await Promise.all([
        prisma.liveChatMessage.findMany({
          include: { student: true },
          orderBy: { createdAt: "desc" },
          take: 30
        }),
        prisma.course.findMany({
          select: {
            name: true,
            courseColor: true
          }
        })
      ]);

      const courseColorMap = new Map(courses.map((course) => [normalizeCourseName(course.name), course.courseColor]));

      return reply.send(messages.map((message) => {
        const profile = normalizeStudentProfile(message.student);
        return {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          studentName: profile.name ?? `Estudante ${message.student.studentNumber}`,
          course: profile.course ?? null,
          courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
        };
      }));
    }
  );

  const submissionIdSchema = z.object({
    submissionId: z.coerce.number().int().positive()
  });
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);

      adminApp.get(
        "/admin/moderation",
        {
          schema: {
            response: {
              200: z.object({
                projectComments: z.array(z.object({
                  id: z.number(),
                  content: z.string(),
                  createdAt: z.string(),
                  studentName: z.string(),
                  studentNumber: z.string(),
                  course: z.string().nullable(),
                  submissionId: z.number(),
                  submissionName: z.string()
                })),
                liveChatMessages: z.array(z.object({
                  id: z.number(),
                  content: z.string(),
                  createdAt: z.string(),
                  studentName: z.string(),
                  studentNumber: z.string(),
                  course: z.string().nullable(),
                  courseColor: z.string().nullable()
                }))
              }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() })
            }
          }
        },
        async (_, reply) => {
          return reply.send(await interactionModerationOverview.execute());
        }
      );

      adminApp.delete(
        "/admin/comments/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().positive() }),
            response: {
              200: z.object({ success: z.literal(true) }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() })
            }
          }
        },
        async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
          try {
            return reply.send(await deleteProjectComment.execute(request.params.id));
          } catch (error) {
            return reply.status(404).send({ message: error instanceof Error ? error.message : "Project comment not found" });
          }
        }
      );

      adminApp.delete(
        "/admin/live-chat/:id",
        {
          schema: {
            params: z.object({ id: z.coerce.number().int().positive() }),
            response: {
              200: z.object({ success: z.literal(true) }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
              404: z.object({ message: z.string() })
            }
          }
        },
        async (request: FastifyRequest<{ Params: { id: number } }>, reply) => {
          try {
            return reply.send(await deleteLiveChatMessage.execute(request.params.id));
          } catch (error) {
            return reply.status(404).send({ message: error instanceof Error ? error.message : "Live chat message not found" });
          }
        }
      );

      adminApp.get(
        "/admin/votes",
        {
          schema: {
            response: {
              200: z.object({
                projects: z.array(z.object({
                  id: z.number(),
                  name: z.string(),
                  type: z.string(),
                  votes: z.number(),
                  comments: z.number(),
                  averageRating: z.number()
                })),
                votes: z.array(z.object({
                  id: z.number(),
                  studentId: z.number(),
                  studentNumber: z.string(),
                  studentName: z.string().nullable(),
                  studentEmail: z.string().nullable(),
                  submissionId: z.number(),
                  submissionName: z.string(),
                  createdAt: z.string()
                }))
              }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() })
            }
          }
        },
        async (_, reply) => {
          return reply.send(await adminVotesOverview.execute());
        }
      );

      adminApp.get(
        "/admin/votes/paged",
        {
          schema: {
            querystring: z.object({
              projectsPage: z.coerce.number().int().min(1).default(1),
              projectsLimit: z.coerce.number().int().min(10).max(200).default(50),
              votesPage: z.coerce.number().int().min(1).default(1),
              votesLimit: z.coerce.number().int().min(10).max(200).default(50),
            }),
            response: {
              200: z.object({
                projects: z.object({
                  items: z.array(z.object({
                    id: z.number(),
                    name: z.string(),
                    type: z.string(),
                    votes: z.number(),
                    comments: z.number(),
                    averageRating: z.number()
                  })),
                  total: z.number(),
                  page: z.number(),
                  totalPages: z.number(),
                }),
                votes: z.object({
                  items: z.array(z.object({
                    id: z.number(),
                    studentId: z.number(),
                    studentNumber: z.string(),
                    studentName: z.string().nullable(),
                    studentEmail: z.string().nullable(),
                    submissionId: z.number(),
                    submissionName: z.string(),
                    createdAt: z.string()
                  })),
                  total: z.number(),
                  page: z.number(),
                  totalPages: z.number(),
                }),
              }),
              401: z.object({ message: z.string() }),
              403: z.object({ message: z.string() }),
            }
          }
        },
        async (request, reply) => {
          const { projectsPage, projectsLimit, votesPage, votesLimit } = request.query as {
            projectsPage: number;
            projectsLimit: number;
            votesPage: number;
            votesLimit: number;
          };

          const [projects, votes] = await Promise.all([
            adminVotesRepository.listProjectSummariesPaged({ page: projectsPage, limit: projectsLimit }),
            adminVotesRepository.listVotesPaged({ page: votesPage, limit: votesLimit }),
          ]);

          return reply.send({ projects, votes });
        }
      );
    });

    protectedApp.post(
      "/live-chat",
      {
        config: {
          rateLimit: {
            max: 30,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: z.object({
            content: z.string().trim().min(1).max(280)
          }),
          response: {
            201: z.object({
              id: z.number(),
              content: z.string(),
              createdAt: z.string(),
              studentName: z.string(),
              course: z.string().nullable(),
              courseColor: z.string().nullable()
            })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode enviar mensagens no chat ao vivo." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const created = await prisma.liveChatMessage.create({
          data: {
            content: request.body.content,
            studentId: student.id
          },
          include: {
            student: true
          }
        });

        const profile = normalizeStudentProfile(created.student);
        const courseColorMap = await getCourseColorMap();

        return reply.code(201).send({
          id: created.id,
          content: created.content,
          createdAt: created.createdAt.toISOString(),
          studentName: profile.name ?? `Estudante ${created.student.studentNumber}`,
          course: profile.course ?? null,
          courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
        });
      }
    );

    protectedApp.post(
      "/like",
      {
        config: {
          rateLimit: {
            max: 60,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: submissionIdSchema,
          response: {
            200: z.object({
              liked: z.boolean(),
              likesCount: z.number()
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { submissionId: number } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode registar likes." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const { submissionId } = request.body;
        const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
        if (!submission) {
          return reply.status(404).send({ message: "Submission not found" });
        }
        if (submission.status !== "APPROVED" || !isCompetitionEligible(submission.type, submission.area)) {
          return reply.status(403).send({ message: "A votação pública está disponível apenas para projetos académicos aprovados." });
        }

        const existing = await prisma.studentLike.findUnique({
          where: { studentId_submissionId: { studentId: student.id, submissionId } }
        });

        if (existing) {
          await prisma.studentLike.delete({ where: { id: existing.id } });
          return reply.send({
            liked: false,
            likesCount: await prisma.studentLike.count({ where: { submissionId } })
          });
        }

        await prisma.studentLike.create({
          data: { studentId: student.id, submissionId }
        });
        return reply.send({
          liked: true,
          likesCount: await prisma.studentLike.count({ where: { submissionId } })
        });
      }
    );

    protectedApp.post(
      "/vote",
      {
        config: {
          rateLimit: {
            max: 30,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: submissionIdSchema,
          response: {
            200: z.object({
              voted: z.literal(true),
              votesCount: z.number()
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { submissionId: number } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode registar votos." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }
        const { submissionId } = request.body;

        const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
        if (!submission) {
          return reply.status(404).send({ message: "Submission not found" });
        }
        if (submission.status !== "APPROVED" || !isCompetitionEligible(submission.type, submission.area)) {
          return reply.status(403).send({ message: "A votação pública está disponível apenas para projetos académicos aprovados." });
        }

        await prisma.studentVote.upsert({
          where: { studentId_submissionId: { studentId: student.id, submissionId } },
          create: { studentId: student.id, submissionId },
          update: {}
        });

        return reply.send({
          voted: true,
          votesCount: await prisma.studentVote.count({ where: { submissionId } })
        });
      }
    );

    protectedApp.post(
      "/comment",
      {
        config: {
          rateLimit: {
            max: 20,
            timeWindow: 60_000,
          }
        },
        schema: {
          body: z.object({
            submissionId: z.coerce.number().int().positive(),
            content: z.string().trim().min(1).max(500)
          }),
          response: {
            201: z.object({
              id: z.number(),
              content: z.string(),
              createdAt: z.string(),
              studentName: z.string(),
              course: z.string().nullable(),
              courseColor: z.string().nullable()
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      },
      async (request: FastifyRequest<{ Body: { submissionId: number; content: string } }>, reply: FastifyReply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            return reply.status(403).send({ message: "Acesso de júri ainda não pode publicar comentários." });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }
        const { submissionId, content } = request.body;

        const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
        if (!submission) {
          return reply.status(404).send({ message: "Submission not found" });
        }
        if (submission.status !== "APPROVED") {
          return reply.status(403).send({ message: "Comentários apenas em candidaturas aprovadas." });
        }

        const comment = await prisma.studentComment.create({
          data: {
            studentId: student.id,
            submissionId,
            content
          },
          include: {
            student: true
          }
        });

        const courseColorMap = await getCourseColorMap();
        const profile = normalizeStudentProfile(comment.student);

        return reply.code(201).send({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt.toISOString(),
          studentName: profile.name ?? `Estudante ${comment.student.studentNumber}`,
          course: profile.course ?? null,
          courseColor: courseColorMap.get(normalizeCourseName(profile.course)) ?? null
        });
      }
    );

    protectedApp.get(
      "/me",
      async (request, reply) => {
        const student = request.student;
        if (!student) {
          if (request.jury) {
            const juryMember = await prisma.juryMember.findUnique({
              where: { id: request.jury.id },
              select: { id: true, name: true, phone: true, isActive: true, lastCodeSentAt: true },
            });

            if (!juryMember || !juryMember.isActive) {
              return reply.status(403).send({ message: "Sessão de júri inválida ou desativada." });
            }

            return reply.send({
              student: null,
              jury: {
                id: juryMember.id,
                name: juryMember.name,
                phone: juryMember.phone,
                lastCodeSentAt: juryMember.lastCodeSentAt?.toISOString() ?? null,
              },
              stats: {
                likes: 0,
                votes: 0,
                comments: 0,
              },
            });
          }
          return reply.status(401).send({ message: "Unauthorized" });
        }

        const [profile, likeCount, voteCount, commentCount] = await Promise.all([
          prisma.student.findUnique({ where: { id: student.id } }),
          prisma.studentLike.count({ where: { studentId: student.id } }),
          prisma.studentVote.count({ where: { studentId: student.id } }),
          prisma.studentComment.count({ where: { studentId: student.id } })
        ]);

        return reply.send({
          student: profile ? normalizeStudentProfile(profile) : null,
          stats: {
            likes: likeCount,
            votes: voteCount,
            comments: commentCount
          }
        });
      }
    );
  });
}
