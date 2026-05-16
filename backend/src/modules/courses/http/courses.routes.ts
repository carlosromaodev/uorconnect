import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  CreateCourse,
  DeleteCourse,
  ListCourses,
  SyncCourseStudentCounts,
  UpdateCourse
} from "../use-cases/manage-courses";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, getAdminAccessResult, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { prisma } from "../../../shared/prisma";
import type { Env } from "../../../config/env";
import { renderCourseEnrollmentsPdf } from "./course-enrollments-report";
import { renderCourseEnrollmentTicketPdf } from "./course-enrollment-ticket";
import { normalizeAngolaPhone } from "../../auth/domain/student-format";
import {
  buildEnrollmentReference,
  buildPaymentShareUrl,
  canAccessEnrollmentBenefits,
  buildStudentEnrollmentListItem,
  buildStudentEnrollmentReceipt,
  buildWhatsAppUrl,
  getEnrollmentStatusLabel,
  toAbsoluteUrl,
} from "./course-enrollment-helpers";
import { enqueuePdfJob, getPdfJob, getPdfJobResult, pdfJobInputHash, registerPdfJobHandler } from "../../../shared/pdf-job-queue";
import { sendWhatsAppAutomationEvent } from "../../whatsapp/http/whatsapp.routes";
import { isStoredMediaUrl, persistMediaValue, resolveStoredMediaFile } from "../../media/application/media-storage";
import { normalizePaymentStatus } from "../../payments/payment-status";

const courseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  preview: z.string().nullable(),
  communityUrl: z.string().nullable(),
  companyName: z.string(),
  companyCategory: z.string(),
  companyLogoUrl: z.string().nullable(),
  companyWebsite: z.string().nullable(),
  companyInstagram: z.string().nullable(),
  companyLinkedin: z.string().nullable(),
  isPaid: z.boolean(),
  priceLabel: z.string().nullable(),
  studentCount: z.number(),
  likesCount: z.number(),
  accentColor: z.string(),
  accentColorSecondary: z.string(),
  courseColor: z.string(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const courseInputSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(3),
  preview: z.string().nullable().optional(),
  communityUrl: z.string().url().nullable().optional(),
  companyName: z.string().min(2),
  companyCategory: z.string().min(2),
  companyLogoUrl: z.string().url().nullable().optional(),
  companyWebsite: z.string().url().nullable().optional(),
  companyInstagram: z.string().url().nullable().optional(),
  companyLinkedin: z.string().url().nullable().optional(),
  isPaid: z.boolean().optional(),
  priceLabel: z.string().nullable().optional(),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  accentColorSecondary: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  courseColor: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

const courseEnrollmentSchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  fullName: z.string(),
  course: z.string().nullable(),
  phone: z.string().nullable(),
  paymentPhone: z.string().nullable(),
  paymentStatus: z.string(),
  statusLabel: z.string(),
  paymentSubmittedAt: z.string().nullable(),
  paymentReviewedAt: z.string().nullable().optional(),
  paymentReviewedByStudentNumber: z.string().nullable().optional(),
  paymentReviewNote: z.string().nullable().optional(),
  paymentProofPath: z.string().nullable(),
  whatsAppUrl: z.string().nullable(),
  enrolledAt: z.string()
});

const courseEnrollmentStatusSchema = z.enum([
  "SUBMITTED_BY_USER",
  "PENDING_REVIEW",
  "CONFIRMED_BY_ADMIN",
  "REJECTED",
  "CANCELED",
  "PENDING",
  "CONFIRMED",
  "APPROVED",
]);
const enrollmentsPagedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50),
  search: z.string().trim().max(120).optional(),
  paymentStatus: courseEnrollmentStatusSchema.optional(),
});

const adminCourseEnrollmentInputSchema = z.object({
  studentNumber: z.string().trim().min(4).max(20),
  fullName: z.string().trim().min(2).max(160).optional().nullable(),
  studentCourse: z.string().trim().min(2).max(160).optional().nullable(),
  phone: z.string().trim().min(6).max(30).optional().nullable(),
  paymentPhone: z.string().trim().min(6).max(30).optional().nullable(),
  paymentStatus: courseEnrollmentStatusSchema.optional(),
  note: z.string().trim().max(400).optional().nullable(),
});

const paymentTimelineItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.string(),
  at: z.string().nullable(),
  by: z.string().nullable(),
  note: z.string().nullable(),
});

const paidCourseEnrollmentSchema = z.object({
  paymentProof: z.string().regex(/^(data:|https?:\/\/|\/(?:api\/)?media\/files\/)/, "Anexa o comprovativo do pagamento."),
  paymentConfirmed: z.literal(true),
  paymentPhone: z.string().min(8).max(20).optional()
});

function hidePublicCourseBenefits<T extends { courses: Array<{ communityUrl: string | null }>; topCourses: Array<{ communityUrl: string | null }>; preview: Array<{ communityUrl: string | null }> }>(payload: T): T {
  const hideCommunityUrl = <C extends { communityUrl: string | null }>(course: C): C => ({
    ...course,
    communityUrl: null,
  });

  return {
    ...payload,
    courses: payload.courses.map(hideCommunityUrl),
    topCourses: payload.topCourses.map(hideCommunityUrl),
    preview: payload.preview.map(hideCommunityUrl),
  };
}

const studentEnrollmentListItemSchema = z.object({
  id: z.number(),
  courseId: z.number(),
  courseName: z.string(),
  companyName: z.string(),
  referenceCode: z.string(),
  paymentStatus: z.string(),
  statusLabel: z.string(),
  enrolledAt: z.string(),
  receiptPath: z.string(),
  ticketPath: z.string().nullable(),
  paymentProofPath: z.string().nullable(),
});

const studentEnrollmentReceiptSchema = z.object({
  id: z.number(),
  courseId: z.number(),
  courseName: z.string(),
  courseDescription: z.string(),
  companyName: z.string(),
  companyCategory: z.string(),
  communityUrl: z.string().nullable(),
  referenceCode: z.string(),
  studentNumber: z.string(),
  fullName: z.string(),
  email: z.string().nullable(),
  studentCourse: z.string().nullable(),
  phone: z.string().nullable(),
  paymentPhone: z.string().nullable(),
  paymentStatus: z.string(),
  statusLabel: z.string(),
  paymentSubmittedAt: z.string().nullable(),
  paymentReviewedAt: z.string().nullable(),
  paymentReviewedByStudentNumber: z.string().nullable(),
  paymentReviewNote: z.string().nullable(),
  paymentTimeline: z.array(paymentTimelineItemSchema),
  paymentProofPath: z.string().nullable(),
  ticketPath: z.string().nullable(),
  whatsAppRedirectUrl: z.string().nullable(),
  enrolledAt: z.string(),
  receiptPath: z.string(),
});

function normalizeFreeText(value?: string | null) {
  if (!value) return null;

  const cleaned = value
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function serializeAdminCourseEnrollment(input: {
  enrollment: {
    id: number;
    studentNumber: string;
    studentName: string | null;
    studentCourse: string | null;
    paymentProof: string | null;
    paymentPhone: string | null;
    paymentStatus: string;
    paymentSubmittedAt: Date | null;
    paymentReviewedAt: Date | null;
    paymentReviewedByStudentNumber: string | null;
    paymentReviewNote: string | null;
    createdAt: Date;
    student: {
      name: string | null;
      course: string | null;
      phone: string | null;
    } | null;
    course: {
      name: string;
    };
  };
  publicApiBaseUrl: string | null;
}) {
  const fullName = normalizeFreeText(input.enrollment.studentName ?? input.enrollment.student?.name)
    ?? `Estudante ${input.enrollment.studentNumber}`;
  const studentCourse = normalizeFreeText(input.enrollment.studentCourse ?? input.enrollment.student?.course);
  const phone = normalizeFreeText(input.enrollment.student?.phone);
  const paymentProofPath = input.enrollment.paymentProof
    ? `${input.publicApiBaseUrl ?? ""}/courses/enrollments/${input.enrollment.id}/payment-proof`
    : null;

  return {
    id: input.enrollment.id,
    studentNumber: input.enrollment.studentNumber,
    fullName,
    course: studentCourse,
    phone,
    paymentPhone: normalizeFreeText(input.enrollment.paymentPhone),
    paymentStatus: input.enrollment.paymentStatus,
    statusLabel: getEnrollmentStatusLabel(input.enrollment.paymentStatus, paymentProofPath),
    paymentSubmittedAt: input.enrollment.paymentSubmittedAt?.toISOString() ?? null,
    paymentReviewedAt: input.enrollment.paymentReviewedAt?.toISOString() ?? null,
    paymentReviewedByStudentNumber: input.enrollment.paymentReviewedByStudentNumber ?? null,
    paymentReviewNote: input.enrollment.paymentReviewNote ?? null,
    paymentProofPath,
    whatsAppUrl: buildWhatsAppUrl(phone, { courseName: input.enrollment.course.name, fullName }),
    enrolledAt: input.enrollment.createdAt.toISOString(),
  };
}

async function sendStoredEnrollmentProof(env: Env, reply: FastifyReply, enrollment: { id: number; paymentProof: string | null }) {
  if (!enrollment.paymentProof) {
    return reply.code(409).send({ message: "Comprovativo indisponível para esta inscrição." });
  }

  const stored = enrollment.paymentProof;
  if (isStoredMediaUrl(stored)) {
    const media = await resolveStoredMediaFile(env, stored).catch(() => null);
    if (!media) {
      return reply.code(409).send({ message: "Comprovativo indisponível para esta inscrição." });
    }

    reply.header("Content-Type", media.mimeType);
    reply.header("Content-Disposition", `inline; filename="curso-comprovativo-${enrollment.id}.${media.mimeType.includes("pdf") ? "pdf" : "webp"}"`);
    return reply.send(media.stream);
  }

  if (stored.startsWith("data:")) {
    const [metadata, content] = stored.split(",", 2);
    const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1] ?? "application/octet-stream";
    const extension = mimeType.includes("pdf") ? "pdf" : mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";

    reply.header("Content-Type", mimeType);
    reply.header("Content-Disposition", `inline; filename="curso-comprovativo-${enrollment.id}.${extension}"`);
    return reply.send(Buffer.from(content, "base64"));
  }

  if (/^https?:\/\//i.test(stored)) {
    return reply.redirect(stored);
  }

  return reply.code(409).send({ message: "Comprovativo inválido para esta inscrição." });
}

async function getCourseEnrollmentAccess(
  request: FastifyRequest,
  env: Env,
  enrollment: { studentId: number },
) {
  if (request.student?.id === enrollment.studentId) {
    return { allowed: true as const };
  }

  const access = await getAdminAccessResult(request, env);
  if (!access.allowed) {
    return {
      allowed: false as const,
      status: access.status,
      message: access.message,
    };
  }

  return { allowed: true as const };
}

export async function coursesRoutes(app: FastifyInstance, opts: { env: Env }) {
  const publicApiBaseUrl = opts.env.PUBLIC_API_URL?.replace(/\/$/, "") ?? null;
  const publicAppUrl = opts.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://uorconnect.space";
  const listCourses = new ListCourses();
  const createCourse = new CreateCourse();
  const updateCourse = new UpdateCourse();
  const deleteCourse = new DeleteCourse();
  const syncCourseStudentCounts = new SyncCourseStudentCounts();

  app.get("/", {
    schema: {
      querystring: z.object({ includeDrafts: z.coerce.boolean().optional() }),
      response: {
        200: z.object({
          courses: z.array(courseSchema),
          topCourses: z.array(courseSchema),
          preview: z.array(courseSchema)
        }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() })
      }
    }
  }, async (request, reply) => {
    const { includeDrafts = false } = request.query as { includeDrafts?: boolean };

    if (includeDrafts) {
      const access = await getAdminAccessResult(request, opts.env);
      if (!access.allowed) {
        return reply.status(access.status).send({ message: access.message });
      }
    }

    const payload = await listCourses.execute(includeDrafts);
    return includeDrafts ? payload : hidePublicCourseBenefits(payload);
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);
      setDefaultAdminPermission(adminApp, ["COURSES"]);

      const loadCourseEnrollments = async (courseId: number) => {
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          include: {
            enrollments: {
              include: {
                student: true
              },
              orderBy: [{ createdAt: "asc" }, { studentNumber: "asc" }]
            }
          }
        });

        if (!course) return null;

        const enrollments = course.enrollments.map((entry) => {
          const fullName = normalizeFreeText(entry.studentName ?? entry.student?.name) ?? `Estudante ${entry.studentNumber}`;
          const studentCourse = normalizeFreeText(entry.studentCourse ?? entry.student?.course);
          const phone = normalizeFreeText(entry.student?.phone);
          const paymentProofPath = entry.paymentProof
            ? `${publicApiBaseUrl ?? ""}/courses/enrollments/${entry.id}/payment-proof`
            : null;

          return {
            id: entry.id,
            studentNumber: entry.studentNumber,
            fullName,
            course: studentCourse,
            phone,
            paymentPhone: normalizeFreeText(entry.paymentPhone),
            paymentStatus: entry.paymentStatus,
            statusLabel: getEnrollmentStatusLabel(entry.paymentStatus, paymentProofPath),
            paymentSubmittedAt: entry.paymentSubmittedAt?.toISOString() ?? null,
            paymentReviewedAt: entry.paymentReviewedAt?.toISOString() ?? null,
            paymentReviewedByStudentNumber: entry.paymentReviewedByStudentNumber ?? null,
            paymentReviewNote: entry.paymentReviewNote ?? null,
            paymentProofPath,
            whatsAppUrl: buildWhatsAppUrl(phone, { courseName: course.name, fullName }),
            enrolledAt: entry.createdAt.toISOString()
          };
        });

        return {
          course: {
            id: course.id,
            name: course.name,
            description: course.description,
            companyName: course.companyName,
            companyCategory: course.companyCategory,
            communityUrl: course.communityUrl ?? null,
            studentCount: enrollments.length
          },
          enrollments
        };
      };

      const loadCourseEnrollmentsPaged = async (
        courseId: number,
        options: z.infer<typeof enrollmentsPagedQuerySchema>
      ) => {
        const page = options.page;
        const limit = options.limit;
        const search = options.search?.trim();

        const [course, total, enrollments] = await Promise.all([
          prisma.course.findUnique({
            where: { id: courseId },
            select: {
              id: true,
              name: true,
              description: true,
              companyName: true,
              companyCategory: true,
              communityUrl: true,
            }
          }),
          prisma.courseEnrollment.count({
            where: {
              courseId,
              ...(options.paymentStatus ? { paymentStatus: options.paymentStatus } : {}),
              ...(search
                ? {
                  OR: [
                    { studentNumber: { contains: search } },
                    { studentName: { contains: search } },
                    { studentCourse: { contains: search } },
                    { paymentPhone: { contains: search } },
                  ]
                }
                : {}),
            },
          }),
          prisma.courseEnrollment.findMany({
            where: {
              courseId,
              ...(options.paymentStatus ? { paymentStatus: options.paymentStatus } : {}),
              ...(search
                ? {
                  OR: [
                    { studentNumber: { contains: search } },
                    { studentName: { contains: search } },
                    { studentCourse: { contains: search } },
                    { paymentPhone: { contains: search } },
                  ]
                }
                : {}),
            },
            include: {
              student: true,
            },
            orderBy: [{ createdAt: "asc" }, { studentNumber: "asc" }],
            skip: (page - 1) * limit,
            take: limit,
          }),
        ]);

        if (!course) return null;

        const normalized = enrollments.map((entry) => {
          const fullName = normalizeFreeText(entry.studentName ?? entry.student?.name) ?? `Estudante ${entry.studentNumber}`;
          const studentCourse = normalizeFreeText(entry.studentCourse ?? entry.student?.course);
          const phone = normalizeFreeText(entry.student?.phone);
          const paymentProofPath = entry.paymentProof
            ? `${publicApiBaseUrl ?? ""}/courses/enrollments/${entry.id}/payment-proof`
            : null;

          return {
            id: entry.id,
            studentNumber: entry.studentNumber,
            fullName,
            course: studentCourse,
            phone,
            paymentPhone: normalizeFreeText(entry.paymentPhone),
            paymentStatus: entry.paymentStatus,
            statusLabel: getEnrollmentStatusLabel(entry.paymentStatus, paymentProofPath),
            paymentSubmittedAt: entry.paymentSubmittedAt?.toISOString() ?? null,
            paymentReviewedAt: entry.paymentReviewedAt?.toISOString() ?? null,
            paymentReviewedByStudentNumber: entry.paymentReviewedByStudentNumber ?? null,
            paymentReviewNote: entry.paymentReviewNote ?? null,
            paymentProofPath,
            whatsAppUrl: buildWhatsAppUrl(phone, { courseName: course.name, fullName }),
            enrolledAt: entry.createdAt.toISOString()
          };
        });

        return {
          course: {
            id: course.id,
            name: course.name,
            description: course.description,
            companyName: course.companyName,
            companyCategory: course.companyCategory,
            communityUrl: course.communityUrl ?? null,
            studentCount: total,
          },
          enrollments: normalized,
          total,
          page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        };
      };

      type CourseEnrollmentsPayload = NonNullable<Awaited<ReturnType<typeof loadCourseEnrollments>>>;
      const renderCourseEnrollmentsPayloadPdf = async (payload: CourseEnrollmentsPayload) => {
        const generatedAt = new Date();
        const pdfBuffer = await renderCourseEnrollmentsPdf({
          courseName: payload.course.name,
          description: payload.course.description,
          companyName: payload.course.companyName,
          companyCategory: payload.course.companyCategory,
          communityUrl: payload.course.communityUrl,
          generatedAt,
          reportNumber: `CURSO-${payload.course.id}-${generatedAt.toISOString().slice(0, 10)}`,
          enrollments: payload.enrollments.map((entry) => ({
            studentNumber: entry.studentNumber,
            fullName: entry.fullName,
            course: entry.course,
            phone: entry.phone,
            whatsAppUrl: entry.whatsAppUrl,
            enrolledAt: new Date(entry.enrolledAt)
          }))
        });

        return {
          pdfBuffer,
          fileName: `uor-connect-curso-${payload.course.id}-${generatedAt.toISOString().slice(0, 10)}.pdf`,
        };
      };
      const generateCourseEnrollmentsPdf = async (courseId: number) => {
        const payload = await loadCourseEnrollments(courseId);
        if (!payload) {
          throw new Error("Course not found");
        }

        return renderCourseEnrollmentsPayloadPdf(payload);
      };
      registerPdfJobHandler("courses.enrollments", async (job) => {
        const payload = job.snapshot?.payload as CourseEnrollmentsPayload | undefined;
        if (!payload?.course?.id) {
          throw new Error("Snapshot de inscrições do curso inválido.");
        }
        const result = await renderCourseEnrollmentsPayloadPdf(payload);
        return { buffer: result.pdfBuffer, fileName: result.fileName, contentType: "application/pdf" };
      });

      adminApp.post("/sync-student-counts", {
        schema: {
          response: {
            200: z.object({
              courses: z.array(courseSchema),
              topCourses: z.array(courseSchema),
              preview: z.array(courseSchema)
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() })
          }
        }
      }, async () => {
        return syncCourseStudentCounts.execute();
      });

      adminApp.post("/", { schema: { body: courseInputSchema, response: { 201: courseSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) } } }, async (request, reply) => {
        return reply.code(201).send(await createCourse.execute(request.body as z.infer<typeof courseInputSchema>));
      });

      adminApp.get("/:id/enrollments", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: z.object({
              course: z.object({
                id: z.number(),
                name: z.string(),
                description: z.string(),
                companyName: z.string(),
                companyCategory: z.string(),
                communityUrl: z.string().nullable(),
                studentCount: z.number()
              }),
              enrollments: z.array(courseEnrollmentSchema)
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      }, async (request, reply) => {
        const payload = await loadCourseEnrollments((request.params as { id: number }).id);
        if (!payload) {
          return reply.code(404).send({ message: "Course not found" });
        }

        return reply.send(payload);
      });

      adminApp.get("/:id/enrollments/paged", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          querystring: enrollmentsPagedQuerySchema,
          response: {
            200: z.object({
              course: z.object({
                id: z.number(),
                name: z.string(),
                description: z.string(),
                companyName: z.string(),
                companyCategory: z.string(),
                communityUrl: z.string().nullable(),
                studentCount: z.number()
              }),
              enrollments: z.array(courseEnrollmentSchema),
              total: z.number(),
              page: z.number(),
              totalPages: z.number(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() })
          }
        }
      }, async (request, reply) => {
        const payload = await loadCourseEnrollmentsPaged(
          (request.params as { id: number }).id,
          enrollmentsPagedQuerySchema.parse(request.query)
        );
        if (!payload) {
          return reply.code(404).send({ message: "Course not found" });
        }

        return reply.send(payload);
      });

      adminApp.post("/:id/enrollments/pdf-jobs", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            202: z.object({
              id: z.string(),
              kind: z.string(),
              status: z.enum(["queued", "processing", "completed", "failed", "expired"]),
              error: z.string().nullable().optional(),
              createdAt: z.string(),
              updatedAt: z.string(),
              expiresAt: z.string().nullable().optional(),
              hasFile: z.boolean().optional(),
              fileName: z.string().optional(),
              sizeBytes: z.number().nullable().optional(),
              statusPath: z.string(),
              filePath: z.string(),
            }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      }, async (request, reply) => {
        const courseId = (request.params as { id: number }).id;
        const payload = await loadCourseEnrollments(courseId);
        if (!payload) {
          return reply.code(404).send({ message: "Course not found" });
        }

        const snapshot = { courseId, payload };
        const version = pdfJobInputHash(snapshot);
        const job = await enqueuePdfJob(opts.env, {
          kind: "courses.enrollments",
          businessKey: `courses.enrollments:${courseId}:${version}`,
          fileName: `uor-connect-curso-${courseId}-${new Date().toISOString().slice(0, 10)}.pdf`,
          snapshot,
          createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
          execute: async () => {
            const { pdfBuffer, fileName } = await renderCourseEnrollmentsPayloadPdf(payload);
            return { buffer: pdfBuffer, fileName, contentType: "application/pdf" };
          },
        });

        return reply.code(202).send({
          ...job,
          statusPath: `/courses/${courseId}/enrollments/pdf-jobs/${job.id}`,
          filePath: `/courses/${courseId}/enrollments/pdf-jobs/${job.id}/file`,
        });
      });

      adminApp.get("/:id/enrollments/pdf-jobs/:jobId", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive(), jobId: z.string() }),
        }
      }, async (request, reply) => {
        const { id, jobId } = request.params as { id: number; jobId: string };
        const job = await getPdfJob(opts.env, jobId);

        if (!job) {
          return reply.code(404).send({ message: "Job not found" });
        }

        return reply.send({
          ...job,
          statusPath: `/courses/${id}/enrollments/pdf-jobs/${job.id}`,
          filePath: `/courses/${id}/enrollments/pdf-jobs/${job.id}/file`,
        });
      });

      adminApp.get("/:id/enrollments/pdf-jobs/:jobId/file", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive(), jobId: z.string() }),
          response: {
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          }
        }
      }, async (request, reply) => {
        const { jobId } = request.params as { id: number; jobId: string };
        const job = await getPdfJob(opts.env, jobId);

        if (!job) {
          return reply.code(404).send({ message: "Job not found" });
        }

        if (job.status !== "completed") {
          return reply.code(409).send({ message: "PDF not ready yet" });
        }

        const result = await getPdfJobResult(opts.env, jobId);
        if (!result) {
          return reply.code(404).send({ message: "Job result not found" });
        }

        reply.header("Content-Type", result.contentType ?? "application/pdf");
        reply.header("Content-Disposition", `attachment; filename=\"${result.fileName}\"`);
        return reply.send(result.buffer);
      });

      adminApp.get("/:id/enrollments/pdf", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            502: z.object({ message: z.string() })
          }
        }
      }, async (request, reply) => {
        const courseId = (request.params as { id: number }).id;

        try {
          const { pdfBuffer, fileName } = await generateCourseEnrollmentsPdf(courseId);

          reply.header("Content-Type", "application/pdf");
          reply.header("Content-Disposition", `attachment; filename=\"${fileName}\"`);
          return reply.send(pdfBuffer);
        } catch (error) {
          if (error instanceof Error && error.message === "Course not found") {
            return reply.code(404).send({ message: error.message });
          }
          request.log.error({ err: error }, "course enrollments pdf render failed");
          return reply.status(502).send({
            message: "Falha ao gerar o relatório PDF localmente. Verifica se o Chromium do Playwright está instalado neste ambiente.",
          });
        }
      });

      adminApp.patch("/enrollments/:enrollmentId/status", {
        schema: {
          params: z.object({ enrollmentId: z.coerce.number().int().positive() }),
          body: z.object({
            status: courseEnrollmentStatusSchema,
            note: z.string().trim().max(400).nullable().optional(),
          }),
          response: {
            200: z.object({ enrollment: courseEnrollmentSchema }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      }, async (request, reply) => {
        const { enrollmentId } = request.params as { enrollmentId: number };
        const { status, note } = request.body as { status: z.infer<typeof courseEnrollmentStatusSchema>; note?: string | null };
        const nextStatus = normalizePaymentStatus(status);
        const reviewedAt = ["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(nextStatus) ? new Date() : null;

        const existing = await prisma.courseEnrollment.findUnique({
          where: { id: enrollmentId },
          include: {
            student: true,
            course: true,
          }
        });

        if (!existing) {
          return reply.code(404).send({ message: "Enrollment not found" });
        }

        const updated = await prisma.courseEnrollment.update({
          where: { id: enrollmentId },
          data: {
            paymentStatus: nextStatus,
            paymentSubmittedAt: nextStatus === "PENDING_REVIEW" || nextStatus === "SUBMITTED_BY_USER"
              ? existing.paymentSubmittedAt ?? new Date()
              : existing.paymentSubmittedAt,
            paymentReviewedAt: reviewedAt,
            paymentReviewedByStudentNumber: reviewedAt ? request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : null) : null,
            paymentReviewNote: reviewedAt ? note?.trim() || null : null,
          },
          include: {
            student: true,
            course: true,
          }
        });

        const fullName = normalizeFreeText(updated.studentName ?? updated.student?.name) ?? `Estudante ${updated.studentNumber}`;
        const studentCourse = normalizeFreeText(updated.studentCourse ?? updated.student?.course);
        const phone = normalizeFreeText(updated.student?.phone);
        const paymentProofPath = updated.paymentProof
          ? `${publicApiBaseUrl ?? ""}/courses/enrollments/${updated.id}/payment-proof`
          : null;

        try {
          await sendWhatsAppAutomationEvent(opts.env, "COURSE_ENROLLMENT_STATUS_UPDATED", {
            phone: updated.student?.phone ?? updated.paymentPhone,
            studentId: updated.studentId,
            studentNumber: updated.studentNumber,
            recipientName: fullName,
            recipientCourse: studentCourse ?? updated.course.name,
            values: {
              curso: updated.course.name,
              estado: getEnrollmentStatusLabel(updated.paymentStatus, paymentProofPath),
              detalhe: normalizePaymentStatus(updated.paymentStatus) === "CONFIRMED_BY_ADMIN"
                ? "A tua vaga foi confirmada pela equipa."
                : normalizePaymentStatus(updated.paymentStatus) === "REJECTED"
                  ? "A equipa marcou a inscrição como rejeitada. Revê os dados enviados."
                  : normalizePaymentStatus(updated.paymentStatus) === "CANCELED"
                    ? "A inscrição foi cancelada pela equipa."
                    : "A equipa está a rever a tua inscrição.",
              link: `${publicAppUrl}/cursos/inscricoes/${updated.id}`,
            },
          });
        } catch (error) {
          request.log.warn({ err: error, enrollmentId: updated.id }, "automatic course enrollment status WhatsApp notification failed");
        }

        return reply.send({
          enrollment: {
            id: updated.id,
            studentNumber: updated.studentNumber,
            fullName,
            course: studentCourse,
            phone,
            paymentPhone: normalizeFreeText(updated.paymentPhone),
            paymentStatus: updated.paymentStatus,
            statusLabel: getEnrollmentStatusLabel(updated.paymentStatus, paymentProofPath),
            paymentSubmittedAt: updated.paymentSubmittedAt?.toISOString() ?? null,
            paymentReviewedAt: updated.paymentReviewedAt?.toISOString() ?? null,
            paymentReviewedByStudentNumber: updated.paymentReviewedByStudentNumber ?? null,
            paymentReviewNote: updated.paymentReviewNote ?? null,
            paymentProofPath,
            whatsAppUrl: buildWhatsAppUrl(phone, { courseName: updated.course.name, fullName }),
            enrolledAt: updated.createdAt.toISOString(),
          }
        });
      });

      adminApp.post("/:id/enrollments", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          body: adminCourseEnrollmentInputSchema,
          response: {
            201: z.object({ enrollment: courseEnrollmentSchema }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id: courseId } = request.params as { id: number };
        const body = adminCourseEnrollmentInputSchema.parse(request.body);
        const studentNumber = body.studentNumber.replace(/\D/g, "");
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) return reply.code(404).send({ message: "Curso não encontrado." });

        const student = await prisma.student.findUnique({ where: { studentNumber } });
        if (!student) return reply.code(404).send({ message: "Estudante não encontrado com este número." });

        const existing = await prisma.courseEnrollment.findUnique({
          where: { studentId_courseId: { studentId: student.id, courseId } },
        });
        if (existing) return reply.code(409).send({ message: "Este estudante já está inscrito neste curso." });

        const fullName = normalizeFreeText(body.fullName);
        const studentCourse = normalizeFreeText(body.studentCourse);
        const phone = normalizeAngolaPhone(body.phone);
        const paymentPhone = normalizeAngolaPhone(body.paymentPhone ?? body.phone ?? student.phone);
        const nextStatus = normalizePaymentStatus(body.paymentStatus ?? "CONFIRMED_BY_ADMIN");
        const reviewedAt = ["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(nextStatus) ? new Date() : null;

        if (fullName || studentCourse || phone) {
          await prisma.student.update({
            where: { id: student.id },
            data: {
              ...(fullName ? { name: fullName } : {}),
              ...(studentCourse ? { course: studentCourse } : {}),
              ...(phone ? { phone } : {}),
            },
          });
        }

        const enrollment = await prisma.courseEnrollment.create({
          data: {
            studentId: student.id,
            courseId,
            studentNumber,
            studentName: fullName ?? student.name,
            studentEmail: student.email,
            studentCourse: studentCourse ?? student.course,
            paymentPhone,
            paymentStatus: nextStatus,
            paymentSubmittedAt: ["SUBMITTED_BY_USER", "PENDING_REVIEW"].includes(nextStatus) ? new Date() : null,
            paymentReviewedAt: reviewedAt,
            paymentReviewedByStudentNumber: reviewedAt ? request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : null) : null,
            paymentReviewNote: reviewedAt ? body.note?.trim() || "Inscrição adicionada manualmente pela admin." : body.note?.trim() || null,
          },
          include: { student: true, course: true },
        });

        return reply.code(201).send({
          enrollment: serializeAdminCourseEnrollment({ enrollment, publicApiBaseUrl }),
        });
      });

      adminApp.patch("/enrollments/:enrollmentId", {
        schema: {
          params: z.object({ enrollmentId: z.coerce.number().int().positive() }),
          body: adminCourseEnrollmentInputSchema.partial(),
          response: {
            200: z.object({ enrollment: courseEnrollmentSchema }),
            400: z.object({ message: z.string() }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { enrollmentId } = request.params as { enrollmentId: number };
        const body = adminCourseEnrollmentInputSchema.partial().parse(request.body);
        const existing = await prisma.courseEnrollment.findUnique({
          where: { id: enrollmentId },
          include: { student: true, course: true },
        });
        if (!existing) return reply.code(404).send({ message: "Inscrição não encontrada." });

        const nextStudentNumber = body.studentNumber ? body.studentNumber.replace(/\D/g, "") : existing.studentNumber;
        const nextStudent = nextStudentNumber !== existing.studentNumber
          ? await prisma.student.findUnique({ where: { studentNumber: nextStudentNumber } })
          : existing.student;
        if (!nextStudent) return reply.code(404).send({ message: "Estudante não encontrado com este número." });

        if (nextStudent.id !== existing.studentId) {
          const duplicate = await prisma.courseEnrollment.findUnique({
            where: { studentId_courseId: { studentId: nextStudent.id, courseId: existing.courseId } },
          });
          if (duplicate) return reply.code(409).send({ message: "O novo estudante já está inscrito neste curso." });
        }

        const fullName = normalizeFreeText(body.fullName);
        const studentCourse = normalizeFreeText(body.studentCourse);
        const phone = normalizeAngolaPhone(body.phone);
        const paymentPhone = body.paymentPhone !== undefined
          ? normalizeAngolaPhone(body.paymentPhone)
          : undefined;
        const nextStatus = body.paymentStatus ? normalizePaymentStatus(body.paymentStatus) : existing.paymentStatus;
        const reviewChanged = body.paymentStatus !== undefined || body.note !== undefined;
        const reviewedAt = reviewChanged && ["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(nextStatus) ? new Date() : existing.paymentReviewedAt;

        if (fullName || studentCourse || phone) {
          await prisma.student.update({
            where: { id: nextStudent.id },
            data: {
              ...(fullName ? { name: fullName } : {}),
              ...(studentCourse ? { course: studentCourse } : {}),
              ...(phone ? { phone } : {}),
            },
          });
        }

        const enrollment = await prisma.courseEnrollment.update({
          where: { id: enrollmentId },
          data: {
            studentId: nextStudent.id,
            studentNumber: nextStudent.studentNumber,
            studentName: fullName ?? existing.studentName ?? nextStudent.name,
            studentEmail: nextStudent.email,
            studentCourse: studentCourse ?? existing.studentCourse ?? nextStudent.course,
            ...(paymentPhone !== undefined ? { paymentPhone } : {}),
            paymentStatus: nextStatus,
            paymentSubmittedAt: ["SUBMITTED_BY_USER", "PENDING_REVIEW"].includes(nextStatus)
              ? existing.paymentSubmittedAt ?? new Date()
              : existing.paymentSubmittedAt,
            paymentReviewedAt: reviewedAt,
            paymentReviewedByStudentNumber: reviewedAt && reviewChanged ? request.student?.studentNumber ?? (request.jury ? `jury-${request.jury.id}` : null) : existing.paymentReviewedByStudentNumber,
            paymentReviewNote: reviewChanged ? body.note?.trim() || null : existing.paymentReviewNote,
          },
          include: { student: true, course: true },
        });

        return reply.send({
          enrollment: serializeAdminCourseEnrollment({ enrollment, publicApiBaseUrl }),
        });
      });

      adminApp.delete("/enrollments/:enrollmentId", {
        schema: {
          params: z.object({ enrollmentId: z.coerce.number().int().positive() }),
          response: {
            200: z.object({ success: z.literal(true) }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { enrollmentId } = request.params as { enrollmentId: number };
        const existing = await prisma.courseEnrollment.findUnique({ where: { id: enrollmentId } });
        if (!existing) return reply.code(404).send({ message: "Inscrição não encontrada." });

        await prisma.courseEnrollment.delete({ where: { id: enrollmentId } });
        return { success: true as const };
      });

      adminApp.patch("/:id", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          body: courseInputSchema,
          response: { 200: courseSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) }
        }
      }, async (request, reply) => {
        try {
          return await updateCourse.execute((request.params as { id: number }).id, request.body as z.infer<typeof courseInputSchema>);
        } catch (error) {
          return reply.code(404).send({ message: error instanceof Error ? error.message : "Course not found" });
        }
      });

      adminApp.delete("/:id", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: { 200: z.object({ success: z.literal(true) }), 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) }
        }
      }, async (request, reply) => {
        try {
          await deleteCourse.execute((request.params as { id: number }).id);
          return { success: true };
        } catch (error) {
          return reply.code(404).send({ message: error instanceof Error ? error.message : "Course not found" });
        }
      });
    });

    protectedApp.get("/liked", {
    schema: {
      response: {
        200: z.object({
          likedCourseIds: z.array(z.number())
        }),
        401: z.object({ message: z.string() })
      }
    }
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const likes = await prisma.courseLike.findMany({
        where: { studentId: student.id },
        select: { courseId: true }
      });

      return {
        likedCourseIds: likes.map((like) => like.courseId)
      };
    });

    protectedApp.get("/enrollments", {
    schema: {
      response: {
        200: z.object({
          enrolledCourseIds: z.array(z.number())
        }),
        401: z.object({ message: z.string() })
      }
    }
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const enrollments = await prisma.courseEnrollment.findMany({
        where: { studentId: student.id },
        select: { courseId: true }
      });

      return {
        enrolledCourseIds: enrollments.map((entry) => entry.courseId)
      };
    });

    protectedApp.get("/enrollments/mine", {
      schema: {
        response: {
          200: z.array(studentEnrollmentListItemSchema),
          401: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const enrollments = await prisma.courseEnrollment.findMany({
        where: { studentId: student.id },
        include: {
          course: {
            select: {
              name: true,
              companyName: true,
            }
          }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      return reply.send(enrollments.map((entry) => buildStudentEnrollmentListItem({
        id: entry.id,
        courseId: entry.courseId,
        enrolledAt: entry.createdAt.toISOString(),
        paymentStatus: entry.paymentStatus,
        paymentProofPath: entry.paymentProof ? `/courses/enrollments/${entry.id}/payment-proof` : null,
        ticketPath: `/courses/enrollments/${entry.id}/ticket.pdf`,
        course: entry.course,
      })));
    });

    protectedApp.get("/enrollments/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: studentEnrollmentReceiptSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: (request.params as { id: number }).id },
        include: {
          course: true,
          student: true,
        }
      });

      if (!enrollment) {
        return reply.code(404).send({ message: "Enrollment not found" });
      }

      if (enrollment.studentId !== student.id) {
        return reply.status(403).send({ message: "Access denied" });
      }

      const paymentProofPath = enrollment.paymentProof
        ? `/courses/enrollments/${enrollment.id}/payment-proof`
        : null;
      const ticketPath = `/courses/enrollments/${enrollment.id}/ticket.pdf`;
      const canAccessBenefits = canAccessEnrollmentBenefits(enrollment.paymentStatus);

      return reply.send(buildStudentEnrollmentReceipt({
        id: enrollment.id,
        courseId: enrollment.courseId,
        studentNumber: enrollment.studentNumber,
        fullName: normalizeFreeText(enrollment.studentName ?? enrollment.student?.name) ?? `Estudante ${enrollment.studentNumber}`,
        email: normalizeFreeText(enrollment.studentEmail ?? enrollment.student?.email),
        studentCourse: normalizeFreeText(enrollment.studentCourse ?? enrollment.student?.course),
        phone: normalizeFreeText(enrollment.student?.phone),
        paymentPhone: normalizeFreeText(enrollment.paymentPhone),
        paymentStatus: enrollment.paymentStatus,
        paymentSubmittedAt: enrollment.paymentSubmittedAt?.toISOString() ?? null,
        paymentReviewedAt: enrollment.paymentReviewedAt?.toISOString() ?? null,
        paymentReviewedByStudentNumber: enrollment.paymentReviewedByStudentNumber ?? null,
        paymentReviewNote: enrollment.paymentReviewNote ?? null,
        paymentProofPath,
        ticketPath,
        whatsAppRedirectUrl: enrollment.course.isPaid ? buildPaymentShareUrl({
          courseName: enrollment.course.name,
          fullName: normalizeFreeText(enrollment.studentName ?? enrollment.student?.name) ?? `Estudante ${enrollment.studentNumber}`,
          studentNumber: enrollment.studentNumber,
          destinationUrl: canAccessBenefits ? enrollment.course.communityUrl ?? null : null,
          paymentProofPath,
          ticketPath,
          publicApiBaseUrl,
          publicAppUrl,
        }) : null,
        enrolledAt: enrollment.createdAt.toISOString(),
        course: {
          name: enrollment.course.name,
          description: enrollment.course.description,
          companyName: enrollment.course.companyName,
          companyCategory: enrollment.course.companyCategory,
          communityUrl: enrollment.course.communityUrl ?? null,
        }
      }));
    });

    protectedApp.get("/enrollments/:id/payment-proof", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        }
      }
    }, async (request, reply) => {
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: (request.params as { id: number }).id },
      });

      if (!enrollment) {
        return reply.code(404).send({ message: "Enrollment not found" });
      }

      const access = await getCourseEnrollmentAccess(request, opts.env, enrollment);
      if (!access.allowed) {
        return reply.status(access.status).send({ message: access.message });
      }

      return sendStoredEnrollmentProof(opts.env, reply, enrollment);
    });

    protectedApp.post("/:id/enroll", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      body: paidCourseEnrollmentSchema.partial().optional(),
      response: {
        200: z.object({
          enrolled: z.boolean(),
          enrollmentId: z.number().nullable(),
          communityUrl: z.string().nullable(),
          studentCount: z.number(),
          paymentStatus: z.string().nullable(),
          paymentProofPath: z.string().nullable(),
          ticketPath: z.string().nullable(),
          whatsAppRedirectUrl: z.string().nullable(),
          receiptPath: z.string().nullable(),
        }),
        401: z.object({ message: z.string() }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() })
      }
    }
    }, async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const [course, studentProfile] = await Promise.all([
        prisma.course.findUnique({ where: { id: request.params.id } }),
        prisma.student.findUnique({ where: { id: student.id } })
      ]);

      if (!course) {
        return reply.status(404).send({ message: "Course not found" });
      }

      const body = (request.body ?? {}) as Partial<z.infer<typeof paidCourseEnrollmentSchema>>;
      if (course.isPaid) {
        const parsed = paidCourseEnrollmentSchema.safeParse({
          paymentProof: body.paymentProof,
          paymentConfirmed: body.paymentConfirmed,
          paymentPhone: body.paymentPhone
        });

        if (!parsed.success) {
          return reply.status(400).send({ message: parsed.error.issues[0]?.message ?? "Dados do pagamento inválidos." });
        }
      }

      const normalizedPaymentPhone = normalizeAngolaPhone(body.paymentPhone ?? studentProfile?.phone ?? null) ?? null;
      const storedPaymentProof = course.isPaid && body.paymentProof
        ? await persistMediaValue(opts.env, body.paymentProof, {
          purpose: "course-payment-proofs",
          allowDocuments: true,
        })
        : null;

      const existing = await prisma.courseEnrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: student.id,
            courseId: course.id
          }
        }
      });

      if (!existing) {
        await prisma.courseEnrollment.create({
          data: {
            studentId: student.id,
            courseId: course.id,
            studentNumber: student.studentNumber,
            studentName: studentProfile?.name ?? null,
            studentEmail: studentProfile?.email ?? null,
            studentCourse: studentProfile?.course ?? null,
            paymentProof: course.isPaid ? storedPaymentProof ?? body.paymentProof ?? null : null,
            paymentPhone: course.isPaid ? normalizedPaymentPhone : null,
            paymentStatus: course.isPaid ? "PENDING_REVIEW" : "CONFIRMED_BY_ADMIN",
            paymentSubmittedAt: course.isPaid ? new Date() : null,
            paymentReviewedAt: course.isPaid ? null : new Date(),
            paymentReviewedByStudentNumber: course.isPaid ? null : "system",
            paymentReviewNote: course.isPaid ? null : "Curso gratuito confirmado automaticamente.",
          }
        });
      } else if (course.isPaid && body.paymentProof) {
        await prisma.courseEnrollment.update({
          where: { id: existing.id },
          data: {
            paymentProof: storedPaymentProof ?? body.paymentProof,
            paymentPhone: normalizedPaymentPhone,
            paymentStatus: "PENDING_REVIEW",
            paymentSubmittedAt: new Date(),
            paymentReviewedAt: null,
            paymentReviewedByStudentNumber: null,
            paymentReviewNote: null,
          }
        });
      }

      const finalEnrollment = await prisma.courseEnrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: student.id,
            courseId: course.id
          }
        }
      });

      const paymentProofPath = finalEnrollment?.paymentProof
        ? `${publicApiBaseUrl ?? ""}/courses/enrollments/${finalEnrollment.id}/payment-proof`
        : null;
      const ticketPath = finalEnrollment
        ? `${publicApiBaseUrl ?? ""}/courses/enrollments/${finalEnrollment.id}/ticket.pdf`
        : null;
      const canAccessBenefits = finalEnrollment ? canAccessEnrollmentBenefits(finalEnrollment.paymentStatus) : false;
      const shouldNotifyEnrollment = Boolean(finalEnrollment && (!existing || (course.isPaid && body.paymentProof)));

      if (shouldNotifyEnrollment && finalEnrollment) {
        try {
          await sendWhatsAppAutomationEvent(opts.env, "COURSE_ENROLLMENT_CREATED", {
            phone: studentProfile?.phone ?? normalizedPaymentPhone,
            studentId: student.id,
            studentNumber: student.studentNumber,
            recipientName: studentProfile?.name ?? null,
            recipientCourse: studentProfile?.course ?? course.name,
            values: {
              curso: course.name,
              detalhe: course.isPaid
                ? "A tua inscrição ficou pendente enquanto a equipa valida o pagamento."
                : "A tua inscrição ficou confirmada.",
              link: `${publicAppUrl}/cursos/inscricoes/${finalEnrollment.id}`,
            },
          });
        } catch (error) {
          request.log.warn({ err: error }, "automatic course enrollment WhatsApp notification failed");
        }
      }

      return {
        enrolled: true,
        enrollmentId: finalEnrollment?.id ?? null,
        communityUrl: canAccessBenefits ? course.communityUrl ?? null : null,
        studentCount: await prisma.courseEnrollment.count({ where: { courseId: course.id } }),
        paymentStatus: finalEnrollment?.paymentStatus ?? null,
        paymentProofPath,
        ticketPath,
        receiptPath: finalEnrollment ? `/cursos/inscricoes/${finalEnrollment.id}` : null,
        whatsAppRedirectUrl: course.isPaid ? buildPaymentShareUrl({
          courseName: course.name,
          fullName: studentProfile?.name ?? `Estudante ${student.studentNumber}`,
          studentNumber: student.studentNumber,
          destinationUrl: canAccessBenefits ? course.communityUrl ?? null : null,
          paymentProofPath,
          ticketPath,
          publicApiBaseUrl,
          publicAppUrl
        }) : null
      };
    });

    protectedApp.get("/enrollments/:id/ticket.pdf", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          502: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: (request.params as { id: number }).id },
        include: {
          course: true,
          student: true
        }
      });

      if (!enrollment) {
        return reply.code(404).send({ message: "Enrollment not found" });
      }

      const access = await getCourseEnrollmentAccess(request, opts.env, enrollment);
      if (!access.allowed) {
        return reply.status(access.status).send({ message: access.message });
      }

      const fullName = normalizeFreeText(enrollment.studentName ?? enrollment.student?.name) ?? `Estudante ${enrollment.studentNumber}`;
      const studentCourse = normalizeFreeText(enrollment.studentCourse ?? enrollment.student?.course);
      const paymentPhone = normalizeFreeText(enrollment.paymentPhone);
      const paymentProofPath = enrollment.paymentProof
        ? `${publicApiBaseUrl ?? ""}/courses/enrollments/${enrollment.id}/payment-proof`
        : null;
      const ticketPath = `${publicApiBaseUrl ?? ""}/courses/enrollments/${enrollment.id}/ticket.pdf`;

      try {
        const pdfBuffer = await renderCourseEnrollmentTicketPdf({
          courseName: enrollment.course.name,
          courseDescription: enrollment.course.description,
          companyName: enrollment.course.companyName,
          companyCategory: enrollment.course.companyCategory,
          courseAccessUrl: `${publicAppUrl}/cursos/inscricoes/${enrollment.id}`,
          studentName: fullName,
          studentNumber: enrollment.studentNumber,
          studentCourse,
          paymentStatus: enrollment.paymentStatus,
          paymentPhone,
          enrolledAt: enrollment.createdAt,
          siteUrl: publicAppUrl,
          ticketUrl: toAbsoluteUrl(publicApiBaseUrl, ticketPath),
          proofUrl: toAbsoluteUrl(publicApiBaseUrl, paymentProofPath),
          communityUrl: canAccessEnrollmentBenefits(enrollment.paymentStatus) ? enrollment.course.communityUrl ?? null : null
        });

        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename="uor-connect-curso-${enrollment.courseId}-inscricao-${enrollment.id}.pdf"`);
        return reply.send(pdfBuffer);
      } catch (error) {
        request.log.error({ err: error }, "course enrollment ticket render failed");
        return reply.status(502).send({
          message: "Falha ao gerar o talão PDF localmente. Verifica se o Chromium do Playwright está instalado neste ambiente.",
        });
      }
    });

    protectedApp.post("/:id/like", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
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
    }, async (request: FastifyRequest<{ Params: { id: number } }>, reply: FastifyReply) => {
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const course = await prisma.course.findUnique({ where: { id: request.params.id } });

      if (!course) {
        return reply.status(404).send({ message: "Course not found" });
      }

      const existing = await prisma.courseLike.findUnique({
        where: {
          studentId_courseId: {
            studentId: student.id,
            courseId: course.id
          }
        }
      });

      if (existing) {
        await prisma.courseLike.delete({ where: { id: existing.id } });
        return {
          liked: false,
          likesCount: await prisma.courseLike.count({ where: { courseId: course.id } })
        };
      }

      await prisma.courseLike.create({
        data: {
          studentId: student.id,
          courseId: course.id
        }
      });

      return {
        liked: true,
        likesCount: await prisma.courseLike.count({ where: { courseId: course.id } })
      };
    });
  });
}
