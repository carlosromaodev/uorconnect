import { z } from "zod";

export const TRAINER_ACCESS_CODE_PURPOSE = "TRAINER_REGISTRATION";
export const TRAINER_VERIFIED_PHONE_WINDOW_MS = 30 * 60_000;

export const trainerRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type TrainerRequestStatus = z.infer<typeof trainerRequestStatusSchema>;

const optionalUrlSchema = z
  .string()
  .trim()
  .url("Informe um link valido.")
  .max(300)
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalTextSchema = z
  .string()
  .trim()
  .max(180)
  .optional()
  .nullable()
  .transform((value) => value || null);

export const trainerPhoneSchema = z
  .string()
  .trim()
  .min(8, "Informe um telefone valido.")
  .max(30, "Informe um telefone valido.");

export const trainerRegistrationSubmitSchema = z.object({
  phone: trainerPhoneSchema,
  name: z.string().trim().min(3, "Informe o nome completo.").max(160),
  email: z
    .string()
    .trim()
    .email("Informe um email valido.")
    .max(180)
    .optional()
    .nullable()
    .transform((value) => value || null),
  specialty: z.string().trim().min(3, "Informe a area de formacao.").max(180),
  bio: z.string().trim().min(20, "Escreva uma mini biografia profissional.").max(900),
  linkedinUrl: optionalUrlSchema,
  portfolioUrl: optionalUrlSchema,
  organization: optionalTextSchema,
  selectedCourseId: z.coerce.number().int().positive("Escolha o curso que pretende ministrar."),
});

export const trainerApprovalSchema = z.object({
  selectedCourseId: z.coerce.number().int().positive("Escolha um curso antes de aprovar."),
  note: z.string().trim().max(400).optional().nullable().transform((value) => value || null),
});

export const trainerRejectSchema = z.object({
  note: z.string().trim().min(3, "Informe um motivo curto para a recusa.").max(400),
});

export function canTrainerAccessDashboard(status: string | null | undefined) {
  return status === "APPROVED";
}

export function isPendingTrainerStatus(status: string | null | undefined) {
  return status === "PENDING";
}

function isConfirmedPayment(status: string | null | undefined) {
  return status === "CONFIRMED_BY_ADMIN" || status === "CONFIRMED" || status === "APPROVED";
}

function isRejectedPayment(status: string | null | undefined) {
  return status === "REJECTED" || status === "CANCELED";
}

function isPendingPayment(status: string | null | undefined) {
  return !isConfirmedPayment(status) && !isRejectedPayment(status);
}

export function buildTrainerDashboardPayload(input: {
  request: {
    id: number;
    name: string;
    phone?: string | null;
    status: string;
    selectedCourseId: number;
    updatedAt: Date;
  };
  course: {
    id: number;
    name: string;
    description: string;
    companyName: string;
    companyCategory: string;
    isPublished: boolean;
  };
  enrollments: Array<{
    paymentStatus: string | null;
  }>;
}) {
  const totalEnrollments = input.enrollments.length;
  const confirmedPayments = input.enrollments.filter((item) => isConfirmedPayment(item.paymentStatus)).length;
  const rejectedPayments = input.enrollments.filter((item) => isRejectedPayment(item.paymentStatus)).length;
  const pendingPayments = input.enrollments.filter((item) => isPendingPayment(item.paymentStatus)).length;

  return {
    trainer: {
      id: input.request.id,
      name: input.request.name,
      status: input.request.status,
    },
    course: {
      id: input.course.id,
      name: input.course.name,
      description: input.course.description,
      companyName: input.course.companyName,
      companyCategory: input.course.companyCategory,
      isPublished: input.course.isPublished,
    },
    metrics: {
      totalEnrollments,
      confirmedPayments,
      pendingPayments,
      rejectedPayments,
    },
    updatedAt: input.request.updatedAt.toISOString(),
  };
}
