import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { type Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, getAdminProfileByStudentNumber, getJuryAdminProfileById, setDefaultAdminPermission } from "../../auth/http/admin.middleware";

const taskStatusSchema = z.enum(["todo", "in_progress", "in_review", "done"]);
const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const attachmentInputSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1).max(160),
  dataUrl: z.string().trim().regex(/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/).max(450_000),
  addedAt: z.string().datetime().optional(),
});

const taskInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1_200).optional().default(""),
  priority: taskPrioritySchema.optional().default("medium"),
  category: z.string().trim().max(80).optional().default(""),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
  assigneeName: z.string().trim().max(160).nullable().optional(),
  assigneePhone: z.string().trim().max(40).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  attachments: z.array(attachmentInputSchema).max(3).optional().default([]),
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1_200).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  category: z.string().trim().max(80).optional(),
  assigneeId: z.coerce.number().int().positive().nullable().optional(),
  assigneeName: z.string().trim().max(160).nullable().optional(),
  assigneePhone: z.string().trim().max(40).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  attachments: z.array(attachmentInputSchema).max(3).optional(),
});

const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataUrl: z.string(),
  addedAt: z.coerce.date(),
});

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  category: z.string(),
  assigneeId: z.number().nullable(),
  assigneeName: z.string().nullable(),
  assigneePhone: z.string().nullable(),
  dueDate: z.coerce.date().nullable(),
  attachments: z.array(attachmentSchema),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

type TaskInput = z.infer<typeof taskInputSchema>;
type TaskUpdate = z.infer<typeof taskUpdateSchema>;

async function resolveActor(request: FastifyRequest) {
  if (request.student) {
    const profile = await getAdminProfileByStudentNumber(request.student.studentNumber);
    return {
      studentNumber: request.student.studentNumber,
      name: profile ? `${profile.team} · ${profile.role}` : request.student.studentNumber,
    };
  }

  if (request.jury) {
    const profile = await getJuryAdminProfileById(request.jury.id);
    return {
      studentNumber: `jury-${request.jury.id}`,
      name: profile ? `${profile.team} · ${profile.role}` : `Júri ${request.jury.id}`,
    };
  }

  return { studentNumber: null, name: null };
}

async function resolveAssignee(input: {
  assigneeId?: number | null;
  assigneeName?: string | null;
  assigneePhone?: string | null;
}) {
  if (!input.assigneeId) {
    return {
      assigneeMembershipId: null,
      assigneeName: input.assigneeName?.trim() || null,
      assigneePhone: input.assigneePhone?.trim() || null,
    };
  }

  const membership = await prisma.teamMembership.findUnique({
    where: { id: input.assigneeId },
    select: { id: true, fullName: true, studentNumber: true, status: true },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new Error("Membro do núcleo não encontrado ou inativo.");
  }

  return {
    assigneeMembershipId: membership.id,
    assigneeName: membership.fullName,
    assigneePhone: membership.studentNumber,
  };
}

type TaskWithAttachments = Awaited<ReturnType<typeof prisma.adminTask.findMany>>[number] & {
  attachments: Array<{
    id: string;
    name: string;
    dataUrl: string;
    addedAt: Date;
  }>;
};

function toTaskResponse(task: TaskWithAttachments) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category,
    assigneeId: task.assigneeMembershipId,
    assigneeName: task.assigneeName,
    assigneePhone: task.assigneePhone,
    dueDate: task.dueDate,
    attachments: task.attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      dataUrl: attachment.dataUrl,
      addedAt: attachment.addedAt,
    })),
    createdBy: task.createdByName,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function mapAttachments(attachments: TaskInput["attachments"] | NonNullable<TaskUpdate["attachments"]>) {
  return attachments.map((attachment) => ({
    id: attachment.id || undefined,
    name: attachment.name,
    dataUrl: attachment.dataUrl,
    addedAt: attachment.addedAt ? new Date(attachment.addedAt) : undefined,
  }));
}

export async function adminTasksRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["TASKS"]);

    adminApp.get("/", {
      schema: {
        response: {
          200: z.array(taskSchema),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const tasks = await prisma.adminTask.findMany({
        include: { attachments: { orderBy: { addedAt: "asc" } } },
        orderBy: [{ createdAt: "desc" }],
      });
      return tasks.map(toTaskResponse);
    });

    adminApp.post("/", {
      schema: {
        body: taskInputSchema,
        response: {
          201: taskSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const body = request.body as TaskInput;
      const actor = await resolveActor(request);

      try {
        const assignee = await resolveAssignee(body);
        const task = await prisma.adminTask.create({
          data: {
            title: body.title,
            description: body.description,
            priority: body.priority,
            category: body.category,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            createdByStudentNumber: actor.studentNumber,
            createdByName: actor.name,
            ...assignee,
            attachments: {
              create: mapAttachments(body.attachments),
            },
          },
          include: { attachments: { orderBy: { addedAt: "asc" } } },
        });

        return reply.code(201).send(toTaskResponse(task));
      } catch (error) {
        return reply.code(400).send({ message: error instanceof Error ? error.message : "Não foi possível criar a tarefa." });
      }
    });

    adminApp.patch("/:id", {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: taskUpdateSchema,
        response: {
          200: taskSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as TaskUpdate;

      try {
        const assignee = body.assigneeId !== undefined
          ? await resolveAssignee(body)
          : {};

        const task = await prisma.$transaction(async (tx) => {
          if (body.attachments !== undefined) {
            await tx.adminTaskAttachment.deleteMany({ where: { taskId: params.id } });
          }

          await tx.adminTask.update({
            where: { id: params.id },
            data: {
              ...(body.title !== undefined ? { title: body.title } : {}),
              ...(body.description !== undefined ? { description: body.description } : {}),
              ...(body.status !== undefined ? { status: body.status } : {}),
              ...(body.priority !== undefined ? { priority: body.priority } : {}),
              ...(body.category !== undefined ? { category: body.category } : {}),
              ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
              ...assignee,
              ...(body.attachments !== undefined ? { attachments: { create: mapAttachments(body.attachments) } } : {}),
            },
          });

          return tx.adminTask.findUniqueOrThrow({
            where: { id: params.id },
            include: { attachments: { orderBy: { addedAt: "asc" } } },
          });
        });

        return toTaskResponse(task);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tarefa não encontrada.";
        if (/not found|record to update|No AdminTask found/i.test(message)) {
          return reply.code(404).send({ message: "Tarefa não encontrada." });
        }
        return reply.code(400).send({ message });
      }
    });

    adminApp.delete("/:id", {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = request.params as { id: string };

      try {
        await prisma.adminTask.delete({ where: { id: params.id } });
        return { success: true };
      } catch {
        return reply.code(404).send({ message: "Tarefa não encontrada." });
      }
    });
  });
}
