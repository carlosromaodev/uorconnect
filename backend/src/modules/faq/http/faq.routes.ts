import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaFaqRepository } from "../infra/prisma.faq.repository";
import { CreateFaqItem, DeleteFaqItem, ListFaqItems, UpdateFaqItem } from "../use-cases/manage-faq";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, getAdminAccessResult, setDefaultAdminPermission } from "../../auth/http/admin.middleware";

const faqSchema = z.object({
  id: z.number(),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number(),
  isPublished: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

const faqInputSchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(3),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional()
});

export async function faqRoutes(app: FastifyInstance, opts: { env: Env }) {
  const repository = new PrismaFaqRepository();
  const listFaqItems = new ListFaqItems(repository);
  const createFaqItem = new CreateFaqItem(repository);
  const updateFaqItem = new UpdateFaqItem(repository);
  const deleteFaqItem = new DeleteFaqItem(repository);

  app.get("/", {
    schema: {
      querystring: z.object({ includeDrafts: z.coerce.boolean().optional() }),
      response: {
        200: z.array(faqSchema),
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

    return listFaqItems.execute(includeDrafts);
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["FAQ"]);

    adminApp.post("/", {
      schema: {
        body: faqInputSchema,
        response: {
          201: faqSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      const item = await createFaqItem.execute(request.body as z.infer<typeof faqInputSchema>);
      return reply.code(201).send(item);
    });

    adminApp.patch("/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: faqInputSchema,
        response: {
          200: faqSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      try {
        return await updateFaqItem.execute((request.params as { id: number }).id, request.body as z.infer<typeof faqInputSchema>);
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "FAQ not found" });
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
        await deleteFaqItem.execute((request.params as { id: number }).id);
        return reply.send({ success: true });
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "FAQ not found" });
      }
    });
  });
}
