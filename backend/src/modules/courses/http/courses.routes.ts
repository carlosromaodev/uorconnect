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
import { adminGuard, getAdminAccessResult } from "../../auth/http/admin.middleware";
import { prisma } from "../../../shared/prisma";
import type { Env } from "../../../config/env";
import { renderCourseEnrollmentsPdf } from "./course-enrollments-report";
import { renderCourseEnrollmentTicketPdf } from "./course-enrollment-ticket";
import { normalizeAngolaPhone } from "../../auth/domain/student-format";
import {
  buildEnrollmentReference,
  buildPaymentShareUrl,
  buildStudentEnrollmentListItem,
  buildStudentEnrollmentReceipt,
  buildWhatsAppUrl,
  getEnrollmentStatusLabel,
  toAbsoluteUrl,
} from "./course-enrollment-helpers";
import { enqueuePdfJob, getPdfJob, getPdfJobResult } from "../../../shared/pdf-job-queue";
import { sendWhatsAppAutomationEvent } from "../../whatsapp/http/whatsapp.routes";

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
  paymentProofPath: z.string().nullable(),
  whatsAppUrl: z.string().nullable(),
  enrolledAt: z.string()
});

const courseEnrollmentStatusSchema = z.enum(["PENDING", "CONFIRMED", "REJECTED", "CANCELED"]);
const enrollmentsPagedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(10).max(200).default(50),
  search: z.string().trim().max(120).optional(),
  paymentStatus: courseEnrollmentStatusSchema.optional(),
});

const paidCourseEnrollmentSchema = z.object({
  paymentProof: z.string().regex(/^(data:|https?:\/\/)/, "Anexa o comprovativo do pagamento."),
  paymentConfirmed: z.literal(true),
  paymentPhone: z.string().min(8).max(20)
});

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

function sendStoredEnrollmentProof(reply: FastifyReply, enrollment: { id: number; paymentProof: string | null }) {
  if (!enrollment.paymentProof) {
    return reply.code(409).send({ message: "Comprovativo indisponível para esta inscrição." });
  }

  const stored = enrollment.paymentProof;
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

    return listCourses.execute(includeDrafts);
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);

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

      const generateCourseEnrollmentsPdf = async (courseId: number) => {
        const payload = await loadCourseEnrollments(courseId);
        if (!payload) {
          throw new Error("Course not found");
        }

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
              status: z.enum(["queued", "processing", "completed", "failed"]),
              createdAt: z.string(),
              updatedAt: z.string(),
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

        const job = enqueuePdfJob({
          kind: `courses.enrollments.${courseId}`,
          execute: async () => {
            const { pdfBuffer, fileName } = await generateCourseEnrollmentsPdf(courseId);
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
        const job = getPdfJob(jobId);

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
        const job = getPdfJob(jobId);

        if (!job) {
          return reply.code(404).send({ message: "Job not found" });
        }

        if (job.status !== "completed") {
          return reply.code(409).send({ message: "PDF not ready yet" });
        }

        const result = getPdfJobResult(jobId);
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
          body: z.object({ status: courseEnrollmentStatusSchema }),
          response: {
            200: z.object({ enrollment: courseEnrollmentSchema }),
            401: z.object({ message: z.string() }),
            403: z.object({ message: z.string() }),
            404: z.object({ message: z.string() }),
          }
        }
      }, async (request, reply) => {
        const { enrollmentId } = request.params as { enrollmentId: number };
        const { status } = request.body as { status: z.infer<typeof courseEnrollmentStatusSchema> };

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
            paymentStatus: status,
            paymentSubmittedAt: status === "PENDING"
              ? existing.paymentSubmittedAt ?? new Date()
              : existing.paymentSubmittedAt,
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
              detalhe: updated.paymentStatus === "CONFIRMED"
                ? "A tua vaga foi confirmada pela equipa."
                : updated.paymentStatus === "REJECTED"
                  ? "A equipa marcou a inscrição como rejeitada. Revê os dados enviados."
                  : updated.paymentStatus === "CANCELED"
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
            paymentProofPath,
            whatsAppUrl: buildWhatsAppUrl(phone, { courseName: updated.course.name, fullName }),
            enrolledAt: updated.createdAt.toISOString(),
          }
        });
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
        paymentProofPath,
        ticketPath,
        whatsAppRedirectUrl: enrollment.course.isPaid ? buildPaymentShareUrl({
          courseName: enrollment.course.name,
          fullName: normalizeFreeText(enrollment.studentName ?? enrollment.student?.name) ?? `Estudante ${enrollment.studentNumber}`,
          studentNumber: enrollment.studentNumber,
          destinationUrl: enrollment.course.communityUrl ?? null,
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
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: (request.params as { id: number }).id },
      });

      if (!enrollment) {
        return reply.code(404).send({ message: "Enrollment not found" });
      }

      if (enrollment.studentId !== student.id) {
        const access = await getAdminAccessResult(request, opts.env);
        if (!access.allowed) {
          return reply.status(403).send({ message: "Access denied" });
        }
      }

      return sendStoredEnrollmentProof(reply, enrollment);
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
            paymentProof: course.isPaid ? body.paymentProof ?? null : null,
            paymentPhone: course.isPaid ? normalizedPaymentPhone : null,
            paymentStatus: course.isPaid ? "PENDING" : "CONFIRMED",
            paymentSubmittedAt: course.isPaid ? new Date() : null
          }
        });
      } else if (course.isPaid && body.paymentProof) {
        await prisma.courseEnrollment.update({
          where: { id: existing.id },
          data: {
            paymentProof: body.paymentProof,
            paymentPhone: normalizedPaymentPhone,
            paymentStatus: "PENDING",
            paymentSubmittedAt: new Date()
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
                ? "Recebemos o comprovativo e a equipa vai validar o pagamento."
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
        communityUrl: course.communityUrl ?? null,
        studentCount: await prisma.courseEnrollment.count({ where: { courseId: course.id } }),
        paymentStatus: finalEnrollment?.paymentStatus ?? null,
        paymentProofPath,
        ticketPath,
        receiptPath: finalEnrollment ? `/cursos/inscricoes/${finalEnrollment.id}` : null,
        whatsAppRedirectUrl: course.isPaid ? buildPaymentShareUrl({
          courseName: course.name,
          fullName: studentProfile?.name ?? `Estudante ${student.studentNumber}`,
          studentNumber: student.studentNumber,
          destinationUrl: course.communityUrl ?? null,
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
      const student = request.student;
      if (!student) return reply.status(401).send({ message: "Unauthorized" });

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

      if (enrollment.studentId !== student.id) {
        const access = await getAdminAccessResult(request, opts.env);
        if (!access.allowed) {
          return reply.status(403).send({ message: "Access denied" });
        }
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
          communityUrl: enrollment.course.communityUrl ?? null
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
