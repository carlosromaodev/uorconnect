import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaSpeakerRepository } from "../infra/prisma.speaker.repository";
import { CreateSpeaker, DeleteSpeaker, ListSpeakers, UpdateSpeaker } from "../use-cases/manage-speakers";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";

export async function speakerRoutes(app: FastifyInstance, opts: { env: Env }) {
  const repository = new PrismaSpeakerRepository();
  const listSpeakers = new ListSpeakers(repository);
  const createSpeaker = new CreateSpeaker(repository);
  const updateSpeaker = new UpdateSpeaker(repository);
  const deleteSpeaker = new DeleteSpeaker(repository);

  const speakerSchema = z.object({
    id: z.number(),
    name: z.string(),
    bio: z.string(),
    specialty: z.string(),
    talk: z.string(),
    day: z.string(),
    linkedin: z.string(),
    avatarUrl: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date()
  });

  const speakerInputSchema = z.object({
    name: z.string().min(3),
    bio: z.string().min(3),
    specialty: z.string().min(2),
    talk: z.string().min(2),
    day: z.string().min(2),
    linkedin: z.string(),
    avatarUrl: z.string().nullable().optional()
  });

  app.get("/", {
    schema: {
      response: {
        200: z.array(speakerSchema)
      }
    }
  }, async () => {
    return listSpeakers.execute();
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);

    adminApp.post("/", {
      schema: {
        body: speakerInputSchema,
        response: {
          201: speakerSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      const created = await createSpeaker.execute(request.body as z.infer<typeof speakerInputSchema>);
      return reply.code(201).send(created);
    });

    adminApp.patch("/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: speakerInputSchema,
        response: {
          200: speakerSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      try {
        return await updateSpeaker.execute((request.params as { id: number }).id, request.body as z.infer<typeof speakerInputSchema>);
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Speaker not found" });
      }
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
        await deleteSpeaker.execute((request.params as { id: number }).id);
        return { success: true };
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Speaker not found" });
      }
    });
  });
}
