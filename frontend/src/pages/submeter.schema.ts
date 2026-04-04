/**
 * submeter.schema.ts
 *
 * Schema Zod separado para o formulário de submissão de expositor.
 * — Email removido (já está no backend via autenticação)
 * — Descrição opcional (validada apenas se preenchida)
 */

import { z } from "zod";

// ── Tipos exportados ────────────────────────────────────────────────────

export type SubmissionKindSchema = "projeto" | "negocio" | "produto";

/** Campos gerenciados pelo schema Zod */
export interface SubmeterSchemaFields {
  leaderName: string;
  phoneDigits: string;
  academicCourse: string;
  name: string;
  description: string;
  area: string;
  advisor: string;
  organizationName: string;
  stage: string;
  category: string;
  productType: string;
  priceAverage: string;
  repoUrl: string;
  websiteUrl: string;
  observations: string;
  agreeRules: boolean;
  paymentConfirmed: boolean;
  paymentProof: string;
  members: string[];
  needs: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

const urlSchema = z.string().url("Usa um link válido.");
const positiveNumberRegex = /^\d+(?:[.,]\d+)?$/;

function optionalUrlField() {
  return z.string().trim().refine(
    (value) => value.length === 0 || urlSchema.safeParse(value).success,
    "Usa um link válido."
  );
}

// ── Schema principal ─────────────────────────────────────────────────────

/**
 * Constrói o schema Zod para o formulário de acordo com o tipo de candidatura.
 * Mensagens de erro seguem o estilo "⚠ " definido no prompt.
 */
export function buildSubmeterSchema(kind: SubmissionKindSchema) {
  return z
    .object({
      // Identificação — email removido (vem do backend via sessão autenticada)
      leaderName: z
        .string()
        .trim()
        .min(3, "⚠ Nome deve ter entre 3 e 100 caracteres")
        .max(100, "⚠ Nome deve ter entre 3 e 100 caracteres")
        .regex(/^[\p{L}\s'-]+$/u, "⚠ Apenas letras e espaços são permitidos"),

      phoneDigits: z
        .string()
        .regex(/^\d{8}$/, "⚠ Número inválido — use o formato +244 9XX XXX XXX"),

      academicCourse: z
        .string()
        .trim()
        .min(2, "⚠ Seleccione o curso académico."),

      // Candidatura
      name: z
        .string()
        .trim()
        .min(3, "⚠ Nome deve ter entre 3 e 100 caracteres")
        .max(100, "⚠ Nome deve ter entre 3 e 100 caracteres"),

      // Descrição opcional — se preenchida deve ter pelo menos 10 chars
      description: z
        .string()
        .trim()
        .max(500, "⚠ Máximo de 500 caracteres.")
        .refine(
          (value) => value.length === 0 || value.length >= 10,
          "⚠ Se preenchida, a descrição deve ter pelo menos 10 caracteres"
        ),

      area: z.string().trim().min(2, "⚠ Seleccione o tipo de expositor"),

      // Campos condicionais — validação via superRefine abaixo
      advisor: z.string().trim(),
      organizationName: z.string().trim(),
      stage: z.string().trim(),
      category: z.string().trim(),
      productType: z.string().trim(),
      priceAverage: z
        .string()
        .trim()
        .refine(
          (value) => value.length === 0 || positiveNumberRegex.test(value),
          "⚠ Valor deve ser um número positivo",
        ),

      // URLs opcionais
      repoUrl: optionalUrlField(),
      websiteUrl: optionalUrlField(),

      observations: z.string().max(500, "⚠ Máximo de 500 caracteres."),

      // Confirmações
      agreeRules: z.literal(true, {
        errorMap: () => ({ message: "⚠ Aceita as regras para continuar." }),
      }),
      paymentConfirmed: z.literal(true, {
        errorMap: () => ({ message: "⚠ Confirma o pagamento para continuar." }),
      }),

      // Comprovativo — aceita data-URL ou URL https
      paymentProof: z
        .string()
        .regex(
          /^(data:|https?:\/\/)/,
          "⚠ Seleccione um ficheiro válido (PDF, PNG, JPG ou WEBP)"
        ),

      // Equipa
      members: z
        .array(z.string().trim().min(2))
        .min(1, "⚠ Adiciona pelo menos um membro.")
        .max(5, "⚠ Máximo de 5 membros."),

      needs: z.array(
        z.enum([
          "Tomada elétrica",
          "Projetor multimédia",
          "Ligação à internet",
          "Mesa de exposição",
          "Espaço extra",
        ])
      ),
    })
    .superRefine((value, ctx) => {
      // Curso oficial obrigatório para projetos académicos
      if (kind === "projeto" && value.academicCourse.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["academicCourse"],
          message: "⚠ Seleciona um curso oficial da UOR.",
        });
      }

      // Orientador obrigatório para projetos
      if (kind === "projeto" && !value.advisor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["advisor"],
          message: "⚠ Informa o docente orientador.",
        });
      }

      // Entidade obrigatória para negócios e produtos
      if (kind !== "projeto" && !value.organizationName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organizationName"],
          message: "⚠ Informa a entidade responsável.",
        });
      }

      // Estágio obrigatório para negócios
      if (kind === "negocio" && !value.stage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stage"],
          message: "⚠ Seleciona o estágio do negócio.",
        });
      }

      // Categoria obrigatória para produtos
      if (kind === "produto" && !value.category) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["category"],
          message: "⚠ Seleciona a categoria do produto.",
        });
      }

      // Tipo de produto obrigatório
      if (kind === "produto" && !value.productType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["productType"],
          message: "⚠ Seleciona o tipo do produto.",
        });
      }

      // Preço médio estimado obrigatório para produtos
      if (kind === "produto" && !value.priceAverage) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["priceAverage"],
          message: "⚠ Informa a média de preço estimado.",
        });
      }
    });
}

export type SubmeterSchemaOutput = z.infer<ReturnType<typeof buildSubmeterSchema>>;
