import { createHash, randomInt } from "node:crypto";
import type { Env } from "../../config/env";
import { prisma } from "../../shared/prisma";

export const ADMIN_DANGER_CONFIRMATION_PHONE = "+244937624785";
const ADMIN_DANGER_PROVIDER_PHONE = "937624785";
const ADMIN_CONFIRMATION_TTL_MS = 10 * 60_000;

export type AdminDangerOperation =
  | "PASSPORT_CHALLENGE_RESET"
  | "PROJECT_VOTES_RESET";

type SmsProviderResult = {
  ok: boolean;
  status: number;
  payload: unknown;
};

type SendMessage = (payload: {
  from: string;
  to: string;
  message: string;
}) => Promise<SmsProviderResult>;

const operationLabels: Record<AdminDangerOperation, string> = {
  PASSPORT_CHALLENGE_RESET: "reiniciar o desafio do Passaporte Digital",
  PROJECT_VOTES_RESET: "remover todos os votos dos projectos",
};

function purposeForOperation(operation: AdminDangerOperation) {
  return `ADMIN_DANGER:${operation}`;
}

function generateAdminCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeSender(value?: string | null) {
  const sender = value?.trim().toUpperCase() || "UOR CONNECT";
  return /^[A-Z0-9 _-]{3,16}$/.test(sender) ? sender : "UOR CONNECT";
}

function stringifyProviderPayload(payload: unknown) {
  if (payload === undefined || payload === null) return null;
  if (typeof payload === "string") return payload.slice(0, 5_000);
  try {
    return JSON.stringify(payload).slice(0, 5_000);
  } catch {
    return String(payload).slice(0, 5_000);
  }
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const direct = record.id ?? record.message_id ?? record.messageId ?? record.uuid;
  if (typeof direct === "string" || typeof direct === "number") return String(direct);
  const nested = record.data;
  return nested && typeof nested === "object" ? extractProviderMessageId(nested) : null;
}

async function sendOmbalaAdminSms(env: Env, payload: { from: string; to: string; message: string }): Promise<SmsProviderResult> {
  const token = env.OMBALA_API_TOKEN?.trim();
  if (!token) {
    return { ok: false, status: 0, payload: { message: "OMBALA_API_TOKEN não configurado." } };
  }

  try {
    const response = await fetch(`${env.OMBALA_API_BASE_URL.replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let providerPayload: unknown = null;
    if (raw) {
      try {
        providerPayload = JSON.parse(raw);
      } catch {
        providerPayload = raw;
      }
    }
    return { ok: response.ok, status: response.status, payload: providerPayload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: { message: error instanceof Error ? error.message : "Falha de rede ao comunicar com o Ombala." },
    };
  }
}

export function hashAdminSmsConfirmationCode(input: {
  env: Pick<Env, "JWT_SECRET">;
  operation: AdminDangerOperation;
  phone: string;
  code: string;
}) {
  return createHash("sha256")
    .update(`${input.env.JWT_SECRET}:admin-danger:${input.operation}:${input.phone}:${input.code}`)
    .digest("hex");
}

export async function requestAdminSmsConfirmation(input: {
  env: Env;
  operation: AdminDangerOperation;
  actorStudentNumber?: string | null;
  now?: Date;
  generateCode?: () => string;
  sendMessage?: SendMessage;
}) {
  const now = input.now ?? new Date();
  const code = input.generateCode?.() ?? generateAdminCode();
  const expiresAt = new Date(now.getTime() + ADMIN_CONFIRMATION_TTL_MS);
  const sender = normalizeSender(input.env.OMBALA_SMS_DEFAULT_SENDER);
  const message = [
    `UOR Connect: codigo ${code} para ${operationLabels[input.operation]}.`,
    "Valido por 10 minutos. Se nao foste tu, ignora.",
  ].join(" ");
  const sendMessage = input.sendMessage ?? ((payload) => sendOmbalaAdminSms(input.env, payload));
  const providerResponse = await sendMessage({
    from: sender,
    to: ADMIN_DANGER_PROVIDER_PHONE,
    message,
  });

  if (!providerResponse.ok) {
    const payload = providerResponse.payload as Record<string, unknown> | null;
    const reason = typeof payload?.message === "string"
      ? payload.message
      : `status ${providerResponse.status || "desconhecido"}`;
    throw new Error(`Não foi possível enviar o código por SMS. ${reason}`);
  }

  const purpose = purposeForOperation(input.operation);
  await prisma.studentAccessCode.updateMany({
    where: {
      phone: ADMIN_DANGER_CONFIRMATION_PHONE,
      purpose,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      usedAt: now,
      deliveryStatus: "REVOKED",
      errorMessage: "Código substituído por novo pedido de confirmação administrativa.",
    },
  });

  const created = await prisma.studentAccessCode.create({
    data: {
      studentId: null,
      phone: ADMIN_DANGER_CONFIRMATION_PHONE,
      codeHash: hashAdminSmsConfirmationCode({
        env: input.env,
        operation: input.operation,
        phone: ADMIN_DANGER_CONFIRMATION_PHONE,
        code,
      }),
      codeLast4: code.slice(-4),
      expiresAt,
      sentAt: now,
      purpose,
      providerMessageId: extractProviderMessageId(providerResponse.payload),
      providerResponseJson: stringifyProviderPayload(providerResponse.payload),
      deliveryStatus: "SENT",
      errorMessage: null,
      usedAt: null,
    },
  });

  return {
    success: true,
    operation: input.operation,
    phone: ADMIN_DANGER_CONFIRMATION_PHONE,
    codeLast4: created.codeLast4,
    expiresAt: created.expiresAt.toISOString(),
  };
}

export async function verifyAdminSmsConfirmation(input: {
  env: Pick<Env, "JWT_SECRET">;
  operation: AdminDangerOperation;
  code: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const normalizedCode = input.code.replace(/\D/g, "");
  if (normalizedCode.length !== 6) {
    return { ok: false, message: "Código SMS inválido." };
  }

  const activeCode = await prisma.studentAccessCode.findFirst({
    where: {
      phone: ADMIN_DANGER_CONFIRMATION_PHONE,
      purpose: purposeForOperation(input.operation),
      usedAt: null,
      expiresAt: { gt: now },
      deliveryStatus: "SENT",
    },
    orderBy: { sentAt: "desc" },
  });

  const incomingHash = hashAdminSmsConfirmationCode({
    env: input.env,
    operation: input.operation,
    phone: ADMIN_DANGER_CONFIRMATION_PHONE,
    code: normalizedCode,
  });
  if (!activeCode || activeCode.codeHash !== incomingHash) {
    return { ok: false, message: "Código SMS incorreto ou expirado." };
  }

  await prisma.studentAccessCode.update({
    where: { id: activeCode.id },
    data: {
      usedAt: now,
      deliveryStatus: "USED",
    },
  });

  return { ok: true, message: "Código confirmado." };
}
