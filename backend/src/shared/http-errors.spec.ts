import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { registerPortugueseErrorHandler } from "./http-errors";

function buildTestApp() {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerPortugueseErrorHandler(app);
  return app;
}

describe("Portuguese HTTP error handling", () => {
  it("does not expose response schema serialization errors in English", async () => {
    const app = buildTestApp();
    app.get("/broken-response", {
      schema: {
        response: {
          200: z.object({ ok: z.boolean() }),
        },
      },
    }, async () => ({ ok: "yes" } as unknown as { ok: boolean }));

    const response = await app.inject({ method: "GET", url: "/broken-response" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: "O servidor devolveu uma resposta inesperada. A equipa técnica já foi notificada. Tenta novamente.",
    });
    expect(response.body).not.toMatch(/Response doesn't match|schema/i);
  });

  it("returns request validation errors in Portuguese", async () => {
    const app = buildTestApp();
    app.post("/validate-body", {
      schema: {
        body: z.object({ name: z.string().min(3) }),
      },
    }, async () => ({ ok: true }));

    const response = await app.inject({
      method: "POST",
      url: "/validate-body",
      payload: { name: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "Dados inválidos. Revê os campos e tenta novamente.",
    });
  });
});
