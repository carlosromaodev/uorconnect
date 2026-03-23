import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaGuideRepository } from "../infra/prisma.guide.repository";
import {
  CreateGuideStep,
  CreateGuideTip,
  CreateVenue,
  DeleteGuideStep,
  DeleteGuideTip,
  DeleteVenue,
  ListGuideContent,
  UpdateGuideStep,
  UpdateGuideTip,
  UpdateVenue
} from "../use-cases/manage-guide";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, getAdminAccessResult } from "../../auth/http/admin.middleware";

const stepSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  link: z.string().nullable(),
  linkText: z.string().nullable(),
  icon: z.string(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const tipSchema = z.object({
  id: z.number(),
  content: z.string(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const venueSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  capacity: z.string(),
  floor: z.string(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const stepInputSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(3),
  link: z.string().nullable().optional(),
  linkText: z.string().nullable().optional(),
  icon: z.string().min(2),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

const tipInputSchema = z.object({
  content: z.string().min(2),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

const venueInputSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  capacity: z.string().min(1),
  floor: z.string().min(1),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

export async function guideRoutes(app: FastifyInstance, opts: { env: Env }) {
  const repository = new PrismaGuideRepository();
  const listGuideContent = new ListGuideContent(repository);
  const createGuideStep = new CreateGuideStep(repository);
  const updateGuideStep = new UpdateGuideStep(repository);
  const deleteGuideStep = new DeleteGuideStep(repository);
  const createGuideTip = new CreateGuideTip(repository);
  const updateGuideTip = new UpdateGuideTip(repository);
  const deleteGuideTip = new DeleteGuideTip(repository);
  const createVenue = new CreateVenue(repository);
  const updateVenue = new UpdateVenue(repository);
  const deleteVenue = new DeleteVenue(repository);

  app.get("/", {
    schema: {
      querystring: z.object({ includeDrafts: z.coerce.boolean().optional() }),
      response: {
        200: z.object({ steps: z.array(stepSchema), tips: z.array(tipSchema), venues: z.array(venueSchema) }),
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

    return listGuideContent.execute(includeDrafts);
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);

    adminApp.post("/steps", { schema: { body: stepInputSchema, response: { 201: stepSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) } } }, async (request, reply) => {
      return reply.code(201).send(await createGuideStep.execute(request.body as z.infer<typeof stepInputSchema>));
    });
    adminApp.patch("/steps/:id", { schema: { params: z.object({ id: z.coerce.number().int().positive() }), body: stepInputSchema, response: { 200: stepSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) } } }, async (request, reply) => {
      try { return await updateGuideStep.execute((request.params as { id: number }).id, request.body as z.infer<typeof stepInputSchema>); }
      catch (error) { return reply.code(404).send({ message: error instanceof Error ? error.message : "Guide step not found" }); }
    });
    adminApp.delete("/steps/:id", { schema: { params: z.object({ id: z.coerce.number().int().positive() }), response: { 200: z.object({ success: z.literal(true) }), 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) } } }, async (request, reply) => {
      try { await deleteGuideStep.execute((request.params as { id: number }).id); return { success: true }; }
      catch (error) { return reply.code(404).send({ message: error instanceof Error ? error.message : "Guide step not found" }); }
    });

    adminApp.post("/tips", { schema: { body: tipInputSchema, response: { 201: tipSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) } } }, async (request, reply) => {
      return reply.code(201).send(await createGuideTip.execute(request.body as z.infer<typeof tipInputSchema>));
    });
    adminApp.patch("/tips/:id", { schema: { params: z.object({ id: z.coerce.number().int().positive() }), body: tipInputSchema, response: { 200: tipSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) } } }, async (request, reply) => {
      try { return await updateGuideTip.execute((request.params as { id: number }).id, request.body as z.infer<typeof tipInputSchema>); }
      catch (error) { return reply.code(404).send({ message: error instanceof Error ? error.message : "Guide tip not found" }); }
    });
    adminApp.delete("/tips/:id", { schema: { params: z.object({ id: z.coerce.number().int().positive() }), response: { 200: z.object({ success: z.literal(true) }), 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) } } }, async (request, reply) => {
      try { await deleteGuideTip.execute((request.params as { id: number }).id); return { success: true }; }
      catch (error) { return reply.code(404).send({ message: error instanceof Error ? error.message : "Guide tip not found" }); }
    });

    adminApp.post("/venues", { schema: { body: venueInputSchema, response: { 201: venueSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }) } } }, async (request, reply) => {
      return reply.code(201).send(await createVenue.execute(request.body as z.infer<typeof venueInputSchema>));
    });
    adminApp.patch("/venues/:id", { schema: { params: z.object({ id: z.coerce.number().int().positive() }), body: venueInputSchema, response: { 200: venueSchema, 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) } } }, async (request, reply) => {
      try { return await updateVenue.execute((request.params as { id: number }).id, request.body as z.infer<typeof venueInputSchema>); }
      catch (error) { return reply.code(404).send({ message: error instanceof Error ? error.message : "Venue not found" }); }
    });
    adminApp.delete("/venues/:id", { schema: { params: z.object({ id: z.coerce.number().int().positive() }), response: { 200: z.object({ success: z.literal(true) }), 401: z.object({ message: z.string() }), 403: z.object({ message: z.string() }), 404: z.object({ message: z.string() }) } } }, async (request, reply) => {
      try { await deleteVenue.execute((request.params as { id: number }).id); return { success: true }; }
      catch (error) { return reply.code(404).send({ message: error instanceof Error ? error.message : "Venue not found" }); }
    });
  });
}
