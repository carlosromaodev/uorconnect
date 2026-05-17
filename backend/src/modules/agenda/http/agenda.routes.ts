import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PrismaAgendaRepository } from "../infra/prisma.agenda.repository";
import { GetAgendaLiveState, isGeneralAgendaTheme } from "../use-cases/get-live-state";
import { CreateAgendaItem, DeleteAgendaItem, GetAgendaLiveConfig, ListAgendaItems, UpdateAgendaItem, UpdateAgendaLiveConfig } from "../use-cases/manage-agenda";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";

export async function agendaRoutes(app: FastifyInstance, opts: { env: Env }) {
  const repository = new PrismaAgendaRepository();
  const listAgendaItems = new ListAgendaItems(repository);
  const getAgendaLiveState = new GetAgendaLiveState(repository);
  const createAgendaItem = new CreateAgendaItem(repository);
  const updateAgendaItem = new UpdateAgendaItem(repository);
  const deleteAgendaItem = new DeleteAgendaItem(repository);
  const getAgendaLiveConfig = new GetAgendaLiveConfig(repository);
  const updateAgendaLiveConfig = new UpdateAgendaLiveConfig(repository);

  const agendaSchema = z.object({
    id: z.number(),
    day: z.string(),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    title: z.string(),
    local: z.string(),
    speaker: z.string(),
    description: z.string(),
    type: z.string(),
    theme: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date()
  });

  const agendaInputSchema = z.object({
    day: z.enum(["DAY1", "DAY2"]),
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    title: z.string().min(3),
    local: z.string().min(2),
    speaker: z.string(),
    description: z.string().min(3),
    type: z.enum(["PANEL", "WORKSHOP", "PRESENTATION", "CEREMONY", "BREAK"]),
    theme: z.string().min(2)
  });

  const agendaLiveSchema = z.object({
    current: agendaSchema.nullable(),
    next: agendaSchema.nullable(),
    mode: z.enum(["AGENDA", "MANUAL"]),
    source: z.enum(["agenda", "admin"])
  });
  const agendaLiveConfigCurrentSchema = agendaInputSchema;
  const agendaLiveConfigInputSchema = z.object({
    mode: z.enum(["AGENDA", "MANUAL"]),
    current: agendaLiveConfigCurrentSchema.nullable()
  });
  const agendaLiveConfigSchema = z.object({
    key: z.string(),
    mode: z.enum(["AGENDA", "MANUAL"]),
    current: agendaLiveConfigCurrentSchema.nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date()
  });

  app.get("/", {
    schema: {
      response: {
        200: z.array(agendaSchema)
      }
    }
  }, async () => {
    const items = await listAgendaItems.execute();
    return items.map((item) => ({ ...item, date: item.date.toISOString() }));
  });

  app.get("/live", {
    schema: {
      response: {
        200: agendaLiveSchema
      }
    }
  }, async () => {
    const [live, config] = await Promise.all([
      getAgendaLiveState.execute(),
      getAgendaLiveConfig.execute()
    ]);

    const manualCurrent = config.mode === "MANUAL" && config.title && config.local && config.description && config.type && config.theme && isGeneralAgendaTheme(config.theme) && config.day && config.date && config.startTime && config.endTime
      ? {
          id: live.current?.id ?? 0,
          day: config.day,
          date: config.date.toISOString(),
          startTime: config.startTime,
          endTime: config.endTime,
          title: config.title,
          local: config.local,
          speaker: config.speaker ?? "",
          description: config.description,
          type: config.type,
          theme: config.theme,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }
      : null;

    return {
      current: manualCurrent ?? (live.current ? { ...live.current, date: live.current.date.toISOString() } : null),
      next: live.next ? { ...live.next, date: live.next.date.toISOString() } : null,
      mode: manualCurrent ? "MANUAL" : "AGENDA",
      source: manualCurrent ? "admin" : "agenda"
    };
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["SCHEDULE"]);

    adminApp.post("/", {
      schema: {
        body: agendaInputSchema,
        response: {
          201: agendaSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      const payload = request.body as z.infer<typeof agendaInputSchema>;
      const created = await createAgendaItem.execute({ ...payload, date: new Date(payload.date) });
      return reply.code(201).send({ ...created, date: created.date.toISOString() });
    });

    adminApp.get("/live-config", {
      config: requireAdminPermission(["LIVE"]),
      schema: {
        response: {
          200: agendaLiveConfigSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
    }, async () => {
      const config = await getAgendaLiveConfig.execute();
      return {
        key: config.key,
        mode: config.mode === "MANUAL" ? "MANUAL" : "AGENDA",
        current: config.title && config.local && config.description && config.type && config.theme && config.day && config.date && config.startTime && config.endTime
          ? {
              day: config.day as "DAY1" | "DAY2",
              date: config.date.toISOString(),
              startTime: config.startTime,
              endTime: config.endTime,
              title: config.title,
              local: config.local,
              speaker: config.speaker ?? "",
              description: config.description,
              type: config.type as "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK",
              theme: config.theme
            }
          : null,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      };
    });

    adminApp.put("/live-config", {
      config: requireAdminPermission(["LIVE"]),
      schema: {
        body: agendaLiveConfigInputSchema,
        response: {
          200: agendaLiveConfigSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      const payload = request.body as z.infer<typeof agendaLiveConfigInputSchema>;

      try {
        const updated = await updateAgendaLiveConfig.execute({
          mode: payload.mode,
          current: payload.current ? { ...payload.current, date: new Date(payload.current.date) } : null
        });

        return reply.send({
          key: updated.key,
          mode: updated.mode === "MANUAL" ? "MANUAL" : "AGENDA",
          current: updated.title && updated.local && updated.description && updated.type && updated.theme && updated.day && updated.date && updated.startTime && updated.endTime
            ? {
                day: updated.day as "DAY1" | "DAY2",
                date: updated.date.toISOString(),
                startTime: updated.startTime,
                endTime: updated.endTime,
                title: updated.title,
                local: updated.local,
                speaker: updated.speaker ?? "",
                description: updated.description,
                type: updated.type as "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK",
                theme: updated.theme
              }
            : null,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt
        });
      } catch (error) {
        return reply.code(400).send({ message: error instanceof Error ? error.message : "Não foi possível guardar a configuração do Ao Vivo." });
      }
    });

    adminApp.patch("/:id", {
      schema: {
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: agendaInputSchema,
        response: {
          200: agendaSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() })
        }
      }
    }, async (request, reply) => {
      const payload = request.body as z.infer<typeof agendaInputSchema>;
      try {
        const updated = await updateAgendaItem.execute((request.params as { id: number }).id, { ...payload, date: new Date(payload.date) });
        return { ...updated, date: updated.date.toISOString() };
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Agenda item not found" });
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
        await deleteAgendaItem.execute((request.params as { id: number }).id);
        return { success: true };
      } catch (error) {
        return reply.code(404).send({ message: error instanceof Error ? error.message : "Agenda item not found" });
      }
    });
  });
}
