import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaHomeContentRepository } from "../infra/prisma.home-content.repository";
import {
  CreateHomeCourse,
  CreatePanelTopic,
  DeleteHomeCourse,
  DeletePanelTopic,
  ListHomeContent,
  UpdateHomeSocialConfig,
  UpdateHomeCourse,
  UpdatePanelTopic
} from "../use-cases/manage-home-content";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, getAdminAccessResult } from "../../auth/http/admin.middleware";

const courseSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  ctaText: z.string().nullable(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const panelSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  speaker: z.string(),
  time: z.string(),
  local: z.string(),
  day: z.string(),
  dateLabel: z.string(),
  icon: z.string(),
  type: z.string(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const courseInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(3),
  icon: z.string().min(2),
  ctaText: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

const panelInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(3),
  speaker: z.string().min(2),
  time: z.string().min(2),
  local: z.string().min(2),
  day: z.string().min(2),
  dateLabel: z.string().min(2),
  icon: z.string().min(2),
  type: z.string().min(2),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

const socialConfigSchema = z.object({
  key: z.string(),
  instagramUrl: z.string().url().nullable(),
  facebookUrl: z.string().url().nullable(),
  linkedinUrl: z.string().url().nullable(),
  courseEnrollmentEnabled: z.boolean(),
  firstYearContestEnabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const socialConfigInputSchema = z.object({
  instagramUrl: z.string().url().nullable().optional(),
  facebookUrl: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  courseEnrollmentEnabled: z.boolean().optional(),
  firstYearContestEnabled: z.boolean().optional()
});

export async function homeContentRoutes(app: FastifyInstance, opts: { env: Env }) {
  const repository = new PrismaHomeContentRepository();
  const listHomeContent = new ListHomeContent(repository);
  const createHomeCourse = new CreateHomeCourse(repository);
  const updateHomeCourse = new UpdateHomeCourse(repository);
  const deleteHomeCourse = new DeleteHomeCourse(repository);
  const createPanelTopic = new CreatePanelTopic(repository);
  const updatePanelTopic = new UpdatePanelTopic(repository);
  const deletePanelTopic = new DeletePanelTopic(repository);
  const updateHomeSocialConfig = new UpdateHomeSocialConfig(repository);

  app.get("/", {
    schema: {
      querystring: z.object({ includeDrafts: z.coerce.boolean().optional() }),
      response: {
        200: z.object({
          courses: z.array(courseSchema),
          panelTopics: z.array(panelSchema),
          socialConfig: socialConfigSchema
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

    return listHomeContent.execute(includeDrafts);
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);

    adminApp.post("/courses", { schema: { body: courseInputSchema, response: { 201: courseSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) } } }, async (request, reply) => {
      return reply.code(201).send(await createHomeCourse.execute(request.body as z.infer<typeof courseInputSchema>));
    });

    adminApp.patch("/courses/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: courseInputSchema,
        response: { 200: courseSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) }
      }
    }, async (request, reply) => {
      try {
        return await updateHomeCourse.execute((request.params as { id: number }).id, request.body as z.infer<typeof courseInputSchema>);
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Course not found" });
      }
    });

    adminApp.delete("/courses/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: { 200: z.object({ success: z.literal(true) }), 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) }
      }
    }, async (request, reply) => {
      try {
        await deleteHomeCourse.execute((request.params as { id: number }).id);
        return { success: true };
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Course not found" });
      }
    });

    adminApp.post("/panels", { schema: { body: panelInputSchema, response: { 201: panelSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) } } }, async (request, reply) => {
      return reply.code(201).send(await createPanelTopic.execute(request.body as z.infer<typeof panelInputSchema>));
    });

    adminApp.patch("/panels/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: panelInputSchema,
        response: { 200: panelSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) }
      }
    }, async (request, reply) => {
      try {
        return await updatePanelTopic.execute((request.params as { id: number }).id, request.body as z.infer<typeof panelInputSchema>);
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Panel topic not found" });
      }
    });

    adminApp.delete("/panels/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: { 200: z.object({ success: z.literal(true) }), 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) }
      }
    }, async (request, reply) => {
      try {
        await deletePanelTopic.execute((request.params as { id: number }).id);
        return { success: true };
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Panel topic not found" });
      }
    });

    adminApp.put("/social-config", {
      schema: {
        body: socialConfigInputSchema,
        response: { 200: socialConfigSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) }
      }
    }, async (request) => {
      return updateHomeSocialConfig.execute(request.body as z.infer<typeof socialConfigInputSchema>);
    });
  });
}
