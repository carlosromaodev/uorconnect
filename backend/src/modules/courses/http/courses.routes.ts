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
  whatsAppUrl: z.string().nullable(),
  enrolledAt: z.string()
});

function normalizeFreeText(value?: string | null) {
  if (!value) return null;

  const cleaned = value
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function normalizePhoneForWhatsApp(value?: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("244")) return digits;
  if (digits.length === 9) return `244${digits}`;
  return digits.length >= 9 ? digits : null;
}

function buildWhatsAppUrl(phone: string | null, params: { courseName: string; fullName: string }) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  if (!normalizedPhone) return null;

  const firstName = params.fullName.split(" ").filter(Boolean)[0] ?? "estudante";
  const message = `Olá ${firstName}, aqui é a equipa do UOR Connect. Estamos a entrar em contacto sobre a tua inscrição no curso ${params.courseName}.`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export async function coursesRoutes(app: FastifyInstance, opts: { env: Env }) {
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

          return {
            id: entry.id,
            studentNumber: entry.studentNumber,
            fullName,
            course: studentCourse,
            phone,
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
        const payload = await loadCourseEnrollments((request.params as { id: number }).id);
        if (!payload) {
          return reply.code(404).send({ message: "Course not found" });
        }

        const generatedAt = new Date();

        try {
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

          reply.header("Content-Type", "application/pdf");
          reply.header("Content-Disposition", `attachment; filename="uor-connect-curso-${payload.course.id}-${generatedAt.toISOString().slice(0, 10)}.pdf"`);
          return reply.send(pdfBuffer);
        } catch (error) {
          request.log.error({ err: error }, "course enrollments pdf render failed");
          return reply.status(502).send({
            message: "Falha ao gerar o relatório PDF localmente. Verifica se o Chromium do Playwright está instalado neste ambiente.",
          });
        }
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

    protectedApp.post("/:id/enroll", {
    schema: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: {
        200: z.object({
          enrolled: z.boolean(),
          communityUrl: z.string().nullable(),
          studentCount: z.number()
        }),
        401: z.object({ message: z.string() }),
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
            studentCourse: studentProfile?.course ?? null
          }
        });
      }

      return {
        enrolled: true,
        communityUrl: course.communityUrl ?? null,
        studentCount: await prisma.courseEnrollment.count({ where: { courseId: course.id } })
      };
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

      const enrollment = await prisma.courseEnrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: student.id,
            courseId: course.id
          }
        }
      });

      if (!enrollment) {
        return reply.status(403).send({ message: "Precisas estar inscrito neste curso para curtir." });
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
