import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

type PlatformContext = "student" | "events" | "direction";

const platformContextDataSchema = z.object({
  product: z.enum(["student", "events", "direction"]),
  status: z.literal("migration_started"),
  publicPath: z.string(),
  apiPath: z.string(),
  legacyApiPath: z.string(),
  responsibilities: z.array(z.string()),
  sharedServices: z.array(z.string()),
});

const platformContextResponseSchema = z.object({
  data: platformContextDataSchema,
  meta: z.object({
    source: z.literal("uorconnect-sdd-v1.0"),
    coverage: z.literal("partial"),
    traceId: z.string(),
  }),
});

const contexts: Record<PlatformContext, z.infer<typeof platformContextDataSchema>> = {
  student: {
    product: "student",
    status: "migration_started",
    publicPath: "/estudante",
    apiPath: "/api/v1/student",
    legacyApiPath: "/student",
    responsibilities: [
      "vida académica individual",
      "orquestração autorizada de Moodle e Secretaria",
      "prioridades, alertas, agenda, finanças e percurso do estudante",
    ],
    sharedServices: ["auth", "profile", "notifications", "files", "audit", "permissions"],
  },
  events: {
    product: "events",
    status: "migration_started",
    publicPath: "/eventos",
    apiPath: "/api/v1/events",
    legacyApiPath: "/events",
    responsibilities: [
      "eventos académicos",
      "projetos, votação, ranking e certificados",
      "passaporte digital, QR Codes e gamificação",
    ],
    sharedServices: ["auth", "profile", "notifications", "files", "audit", "permissions"],
  },
  direction: {
    product: "direction",
    status: "migration_started",
    publicPath: "/direcao",
    apiPath: "/api/v1/direction",
    legacyApiPath: "/direction",
    responsibilities: [
      "indicadores institucionais agregados",
      "relatórios académicos, financeiros e operacionais",
      "auditoria e acesso restrito por finalidade",
    ],
    sharedServices: ["auth", "profile", "notifications", "files", "audit", "permissions"],
  },
};

export async function platformContextRoutes(
  app: FastifyInstance,
  options: { context: PlatformContext },
) {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.get(
    "/",
    {
      schema: {
        response: {
          200: platformContextResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      return {
        data: contexts[options.context],
        meta: {
          source: "uorconnect-sdd-v1.0",
          coverage: "partial",
          traceId: _request.id,
        },
      };
    },
  );
}
