import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import QRCode from "qrcode";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";
import {
  applyCookieAudienceFilters,
  applyTemplate,
  audienceTypeLabel,
  buildStudentClassButtons,
  buildStudentCourseButtons,
  communicationAudienceSchema,
  communicationAudienceTypeSchema,
  normalizeMessage,
  normalizePhoneForWhatsApp,
  pickString,
  resolveAudienceCandidates,
  resolveRecipients,
  stringifyProviderPayload,
  type CommunicationAudienceInput,
  type CommunicationAudienceType,
} from "../../communication/audience";

const whatsappPreviewBodySchema = z.object({
  audience: communicationAudienceSchema,
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

const whatsappMediaSchema = z.object({
  url: z.string().trim().min(8).max(4000),
  fileName: z.string().trim().min(2).max(160).default("documento-uor-connect.pdf"),
  mimeType: z.string().trim().min(3).max(120).default("application/pdf"),
  type: z.enum(["image", "video", "document"]).default("document"),
  caption: z.string().trim().max(1000).optional(),
}).optional();

const whatsappSendBodySchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  message: z.string().trim().min(2).max(3500),
  audience: communicationAudienceSchema,
  instanceId: z.coerce.number().int().positive().optional(),
  delay: z.coerce.number().int().min(0).max(20000).optional(),
  media: whatsappMediaSchema,
});

const whatsappRecipientPreviewSchema = z.object({
  studentId: z.number().nullable(),
  studentNumber: z.string().nullable(),
  name: z.string().nullable(),
  course: z.string().nullable(),
  classCode: z.string().nullable(),
  phone: z.string(),
  providerTo: z.string(),
  sources: z.array(z.string()),
});

const whatsappCampaignSummarySchema = z.object({
  id: z.number(),
  title: z.string().nullable(),
  instanceId: z.number().nullable(),
  instanceName: z.string(),
  audienceType: z.string(),
  status: z.string(),
  totalRecipients: z.number(),
  successCount: z.number(),
  failedCount: z.number(),
  mediaUrl: z.string().nullable(),
  createdByStudentNumber: z.string(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
});

const whatsappInstanceSchema = z.object({
  id: z.number(),
  name: z.string(),
  label: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  status: z.string(),
  qrCode: z.string().nullable(),
  pairingCode: z.string().nullable(),
  baseUrl: z.string().nullable(),
  hasCustomApiKey: z.boolean(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  lastConnectedAt: z.string().nullable(),
  lastCheckedAt: z.string().nullable(),
  createdByStudentNumber: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const whatsappInstanceInputSchema = z.object({
  name: z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9_-]+$/, "Usa apenas letras, números, _ ou - no nome da instância."),
  label: z.string().trim().max(80).optional(),
  phoneNumber: z.string().trim().max(24).optional(),
  baseUrl: z.string().trim().url().optional(),
  apiKey: z.string().trim().min(6).max(240).optional(),
  token: z.string().trim().min(6).max(240).optional(),
  isDefault: z.boolean().optional(),
});

const whatsappAudienceButtonSchema = z.object({
  type: communicationAudienceTypeSchema,
  label: z.string(),
  total: z.number(),
  sendable: z.number(),
});

const whatsappStudentCourseButtonSchema = z.object({
  course: z.string(),
  total: z.number(),
  sendable: z.number(),
});

const whatsappStudentClassButtonSchema = z.object({
  classCode: z.string(),
  total: z.number(),
  sendable: z.number(),
});

const whatsappAutomationEventKeys = [
  "COURSE_ENROLLMENT_CREATED",
  "COURSE_ENROLLMENT_STATUS_UPDATED",
  "SUBMISSION_CREATED",
  "SUBMISSION_CONTEXT_AUDIENCE",
  "SUBMISSION_STATUS_UPDATED",
  "SUBMISSION_ENGAGEMENT_MILESTONE",
  "SUBMISSION_MARKED_WINNER",
  "CERTIFICATE_ISSUED",
  "ATTENDANCE_CHECKED_IN",
  "LIVE_CHAT_CONTEXT_AUDIENCE",
] as const;

const whatsappAutomationEventKeySchema = z.enum(whatsappAutomationEventKeys);

const whatsappAutomationDefinitionByKey = {
  COURSE_ENROLLMENT_CREATED: {
    label: "Inscrição em curso recebida",
    description: "Dispara quando o estudante conclui ou atualiza a inscrição num curso.",
    defaultTitle: "Inscrição recebida - {{curso}}",
    defaultMessage: [
      "Olá {{nome}}, recebemos a tua inscrição no curso {{curso}}.",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
  COURSE_ENROLLMENT_STATUS_UPDATED: {
    label: "Inscrição em curso atualizada",
    description: "Dispara quando a equipa confirma, rejeita ou cancela o estado da inscrição.",
    defaultTitle: "Inscrição atualizada - {{curso}}",
    defaultMessage: [
      "Olá {{nome}}, a tua inscrição no curso {{curso}} foi atualizada para {{estado}}.",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
  SUBMISSION_CREATED: {
    label: "Candidatura recebida",
    description: "Dispara quando o estudante submete um projeto, negócio ou produto.",
    defaultTitle: "Candidatura recebida - {{referencia}}",
    defaultMessage: [
      "Olá {{nome}}, recebemos a candidatura {{titulo}} no UOR Connect.",
      "Referência: {{referencia}}",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
  SUBMISSION_CONTEXT_AUDIENCE: {
    label: "Aviso para turma/curso da candidatura",
    description: "Dispara, após aprovação/configuração do admin, para estudantes da mesma turma e/ou curso quando uma candidatura é submetida.",
    defaultTitle: "Nova exposição na tua turma",
    defaultMessage: [
      "Olá {{nome}}, {{colega}} da turma {{turma}} submeteu {{titulo}} no UOR Connect.",
      "Curso: {{curso}}",
      "{{link}}",
    ].join("\n"),
  },
  SUBMISSION_STATUS_UPDATED: {
    label: "Candidatura atualizada",
    description: "Dispara quando a organização aprova, exclui ou devolve a candidatura para análise.",
    defaultTitle: "Estado da candidatura - {{referencia}}",
    defaultMessage: [
      "Olá {{nome}}, a candidatura {{titulo}} foi atualizada para {{estado}}.",
      "Referência: {{referencia}}",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
  SUBMISSION_ENGAGEMENT_MILESTONE: {
    label: "Projeto em destaque",
    description: "Dispara quando um projeto ultrapassa 3 curtidas ou 3 comentários.",
    defaultTitle: "Projeto em destaque - {{titulo}}",
    defaultMessage: [
      "Olá {{nome}}, o teu projeto {{titulo}} começou a ganhar destaque no UOR Connect.",
      "{{detalhe}}",
      "Referência: {{referencia}}",
      "{{link}}",
    ].join("\n"),
  },
  SUBMISSION_MARKED_WINNER: {
    label: "Candidatura vencedora",
    description: "Dispara quando uma candidatura é destacada como vencedora.",
    defaultTitle: "Parabéns - {{titulo}}",
    defaultMessage: [
      "Olá {{nome}}, a candidatura {{titulo}} foi destacada como vencedora.",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
  CERTIFICATE_ISSUED: {
    label: "Certificado emitido",
    description: "Dispara quando um certificado fica disponível para o estudante.",
    defaultTitle: "Certificado disponível - {{certificado}}",
    defaultMessage: [
      "Olá {{nome}}, o certificado {{certificado}} já está disponível no UOR Connect.",
      "Validar: {{validacao_url}}",
      "{{pdf_url}}",
    ].join("\n"),
  },
  ATTENDANCE_CHECKED_IN: {
    label: "Presença registada",
    description: "Dispara quando o check-in do estudante é registado num evento.",
    defaultTitle: "Check-in registado - {{evento}}",
    defaultMessage: [
      "Olá {{nome}}, a tua presença foi registada em {{evento}}.",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
  LIVE_CHAT_CONTEXT_AUDIENCE: {
    label: "Aviso de interação ao vivo por turma/curso",
    description: "Dispara, após aprovação/configuração do admin, para estudantes da mesma turma e/ou curso quando há uma interação relevante no Ao Vivo.",
    defaultTitle: "Nova interação ao vivo",
    defaultMessage: [
      "Olá {{nome}}, {{colega}} publicou uma nova interação no Ao Vivo para estudantes da turma {{turma}}.",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"),
  },
} as const satisfies Record<z.infer<typeof whatsappAutomationEventKeySchema>, {
  label: string;
  description: string;
  defaultTitle: string;
  defaultMessage: string;
}>;

const whatsappAutomationSettingSchema = z.object({
  eventKey: whatsappAutomationEventKeySchema,
  label: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  title: z.string(),
  message: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const whatsappAutomationUpdateSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().max(120).optional(),
  message: z.string().trim().max(3500).optional(),
});

type WhatsAppAutomationEventKey = z.infer<typeof whatsappAutomationEventKeySchema>;
type WhatsAppAutomationDefinition = typeof whatsappAutomationDefinitionByKey[WhatsAppAutomationEventKey];
type WhatsAppAutomationContext = {
  phone?: string | null;
  studentId?: number | null;
  studentNumber?: string | null;
  recipientName?: string | null;
  recipientCourse?: string | null;
  media?: {
    url: string;
    fileName: string;
    mimeType?: string;
    type?: "image" | "video" | "document";
    caption?: string;
  };
  values?: Record<string, string | null | undefined>;
};

function getDefaultAutomationEnabled(eventKey: WhatsAppAutomationEventKey) {
  return eventKey !== "SUBMISSION_CONTEXT_AUDIENCE" && eventKey !== "LIVE_CHAT_CONTEXT_AUDIENCE";
}

type EvolutionRequestResult = {
  ok: boolean;
  status: number;
  payload: unknown;
};

type EvolutionInstanceConfig = {
  baseUrl?: string | null;
  apiKey?: string | null;
};

const CONNECTED_WHATSAPP_INSTANCE_STATUSES = new Set(["OPEN", "CONNECTED", "ONLINE"]);
const PENDING_WHATSAPP_INSTANCE_STATUSES = new Set(["CREATED", "CONNECTING", "PAIRING"]);
const CONNECTION_CODE_FETCH_DELAY_MS = 1500;
const CONNECTION_CODE_FETCH_ATTEMPTS = 3;

type WhatsAppInstanceSelectionCandidate = {
  status: string;
  isDefault: boolean;
};

function pickRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeWhatsAppInstanceStatus(value?: string | null) {
  return value?.trim().toUpperCase() ?? "UNKNOWN";
}

export function isConnectedWhatsAppInstanceStatus(value?: string | null) {
  return CONNECTED_WHATSAPP_INSTANCE_STATUSES.has(normalizeWhatsAppInstanceStatus(value));
}

export function pickPreferredWhatsAppInstance<T extends WhatsAppInstanceSelectionCandidate>(instances: T[]) {
  const connectedDefault = instances.find((instance) =>
    instance.isDefault && isConnectedWhatsAppInstanceStatus(instance.status));
  if (connectedDefault) return connectedDefault;

  const connected = instances.find((instance) => isConnectedWhatsAppInstanceStatus(instance.status));
  if (connected) return connected;

  return instances.find((instance) => instance.isDefault) ?? instances[0] ?? null;
}

function formatInstance(instance: {
  id: number;
  name: string;
  label: string | null;
  phoneNumber: string | null;
  status: string;
  qrCode: string | null;
  pairingCode: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  isDefault: boolean;
  isActive: boolean;
  lastConnectedAt: Date | null;
  lastCheckedAt: Date | null;
  createdByStudentNumber: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: instance.id,
    name: instance.name,
    label: instance.label,
    phoneNumber: instance.phoneNumber,
    status: instance.status,
    qrCode: instance.qrCode,
    pairingCode: instance.pairingCode,
    baseUrl: instance.baseUrl,
    hasCustomApiKey: Boolean(instance.apiKey),
    isDefault: instance.isDefault,
    isActive: instance.isActive,
    lastConnectedAt: instance.lastConnectedAt?.toISOString() ?? null,
    lastCheckedAt: instance.lastCheckedAt?.toISOString() ?? null,
    createdByStudentNumber: instance.createdByStudentNumber,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const direct = pickString(record.id)
    ?? pickString(record.messageId)
    ?? pickString(record.message_id);

  if (direct) return direct;

  const key = record.key;
  if (key && typeof key === "object") {
    const keyId = pickString((key as Record<string, unknown>).id);
    if (keyId) return keyId;
  }

  const nestedData = record.data ?? record.message;
  if (nestedData && typeof nestedData === "object") {
    return extractProviderMessageId(nestedData);
  }

  return null;
}

export function extractProviderMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed || null;
  }

  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const nested = extractProviderMessage(record.response)
    ?? extractProviderMessage(record.data);

  if (nested) return nested;

  const direct = pickString(record.message)
    ?? pickString(record.error)
    ?? pickString(record.response);

  if (direct) return direct;

  return typeof record.status === "number"
    ? `status ${record.status}`
    : pickString(record.status);
}

function isConnectionClosedProviderPayload(payload: unknown) {
  const message = extractProviderMessage(payload);
  if (!message) return false;

  return /connection closed|closed connection|not connected|socket closed|disconnected/i.test(message);
}

function findFirstNestedRecord(
  value: unknown,
  predicate: (record: Record<string, unknown>) => boolean,
  depth = 0,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || depth > 8) return null;

  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (predicate(record)) return record;

    for (const child of Object.values(record)) {
      const nested = findFirstNestedRecord(child, predicate, depth + 1);
      if (nested) return nested;
    }

    return null;
  }

  for (const item of value) {
    const nested = findFirstNestedRecord(item, predicate, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function extractActionableMessageText(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 8) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractActionableMessageText(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = pickString(record.conversation)
    ?? pickString(record.text)
    ?? pickString((record.extendedTextMessage as Record<string, unknown>)?.text)
    ?? pickString((record.imageMessage as Record<string, unknown>)?.caption)
    ?? pickString((record.videoMessage as Record<string, unknown>)?.caption)
    ?? pickString((record.documentMessage as Record<string, unknown>)?.caption)
    ?? pickString((record.buttonsResponseMessage as Record<string, unknown>)?.selectedDisplayText)
    ?? pickString((record.buttonsResponseMessage as Record<string, unknown>)?.selectedButtonId)
    ?? pickString((record.listResponseMessage as Record<string, unknown>)?.title)
    ?? pickString((record.listResponseMessage as Record<string, unknown>)?.description)
    ?? pickString((record.listResponseMessage as Record<string, unknown>)?.singleSelectReply
      ? ((record.listResponseMessage as Record<string, unknown>).singleSelectReply as Record<string, unknown>)?.selectedRowId
      : undefined)
    ?? pickString((record.templateButtonReplyMessage as Record<string, unknown>)?.selectedDisplayText)
    ?? pickString((record.templateButtonReplyMessage as Record<string, unknown>)?.selectedId)
    ?? pickString((record.interactiveResponseMessage as Record<string, unknown>)?.body
      ? (((record.interactiveResponseMessage as Record<string, unknown>).body as Record<string, unknown>)?.text)
      : undefined);

  if (direct) return direct;

  for (const child of Object.values(record)) {
    const nested = extractActionableMessageText(child, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function extractConnectionState(payload: unknown) {
  if (!payload || typeof payload !== "object") return "UNKNOWN";
  const record = payload as Record<string, unknown>;
  const instance = record.instance;

  const state = pickString(record.state)
    ?? pickString(record.status)
    ?? (instance && typeof instance === "object" ? pickString((instance as Record<string, unknown>).state) : null)
    ?? (instance && typeof instance === "object" ? pickString((instance as Record<string, unknown>).status) : null);

  return state?.toUpperCase() ?? "UNKNOWN";
}

function normalizeWebhookEventName(value?: string | null) {
  return value?.trim().replace(/[.\-\s]+/g, "_").toUpperCase() ?? "";
}

function extractInstanceNameFromValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  const record = pickRecord(value);
  if (!record) return null;

  return pickString(record.instanceName)
    ?? pickString(record.name)
    ?? pickString(record.instance)
    ?? null;
}

function resolveWebhookInstanceName(
  body: Record<string, unknown>,
  dataRecord: Record<string, unknown>,
  messageEnvelope: Record<string, unknown>,
) {
  return extractInstanceNameFromValue(body.instance)
    ?? pickString(body.instanceName)
    ?? extractInstanceNameFromValue(dataRecord.instance)
    ?? pickString(dataRecord.instanceName)
    ?? extractInstanceNameFromValue(messageEnvelope.instance)
    ?? pickString(messageEnvelope.instanceName)
    ?? null;
}

async function toQrDataUrl(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^data:image\//i.test(normalized)) return normalized;
  if (/^iVBORw0KGgo/i.test(normalized)) return `data:image/png;base64,${normalized}`;
  if (/^\/9j\//i.test(normalized)) return `data:image/jpeg;base64,${normalized}`;
  return QRCode.toDataURL(normalized, {
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
  });
}

function collectStringsByKey(value: unknown, keys: Set<string>, depth = 0): string[] {
  if (!value || typeof value !== "object" || depth > 5) return [];

  const record = value as Record<string, unknown>;
  const direct = Object.entries(record)
    .filter(([key, item]) => keys.has(key.toLowerCase()) && typeof item === "string")
    .map(([, item]) => (item as string).trim())
    .filter(Boolean);

  const nested = Object.values(record).flatMap((item) => collectStringsByKey(item, keys, depth + 1));
  return [...direct, ...nested];
}

function pickQrCandidate(payload: unknown) {
  const imageCandidates = collectStringsByKey(payload, new Set(["base64", "qrcode", "qrcodebase64"]));
  const tokenCandidates = collectStringsByKey(payload, new Set(["code", "qr", "qrcode", "qrcodecode"]));
  const candidates = [...imageCandidates, ...tokenCandidates];
  return candidates.find((item) => item.length > 20 || /^data:image\//i.test(item) || /^iVBORw0KGgo/i.test(item)) ?? null;
}

function extractQrPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { code: null as string | null, pairingCode: null as string | null };
  }

  const record = payload as Record<string, unknown>;
  const qrcode = record.qrcode;
  const base64 = record.base64;

  const code = pickQrCandidate(payload)
    ?? pickString(record.code)
    ?? pickString(record.qr)
    ?? pickString(record.qrCode)
    ?? (typeof qrcode === "string" ? qrcode : null)
    ?? (typeof qrcode === "object" && qrcode ? pickString((qrcode as Record<string, unknown>).code) : null)
    ?? (typeof qrcode === "object" && qrcode ? pickString((qrcode as Record<string, unknown>).base64) : null)
    ?? pickString(base64);

  return {
    code,
    pairingCode: pickString(record.pairingCode)
      ?? pickString(record.pairing_code)
      ?? collectStringsByKey(payload, new Set(["pairingcode", "pairing_code"]))[0]
      ?? null,
  };
}

function normalizeInstanceName(value: string) {
  return value.trim().replace(/\s+/g, "-");
}

function normalizeOwnerNumber(value?: string | null) {
  if (!value) return null;
  const normalized = normalizePhoneForWhatsApp(value)?.providerTo;
  const fallback = value.replace(/\D/g, "");
  return normalized ?? (fallback || null);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFallbackEvolutionResult(message: string): EvolutionRequestResult {
  return {
    ok: false,
    status: 0,
    payload: { message },
  };
}

async function fetchConnectionArtifacts(
  client: EvolutionApiClient,
  instanceName: string,
  ownerNumber?: string | null,
  attempts = CONNECTION_CODE_FETCH_ATTEMPTS,
) {
  const connectPlan = ownerNumber ? [null, ownerNumber, null] : [null, null, null];
  const totalAttempts = Math.max(1, Math.min(attempts, connectPlan.length));

  let providerResponse = buildFallbackEvolutionResult("A Evolution API não respondeu ao pedido de conexão.");
  let qrToken: string | null = null;
  let pairingCode: string | null = null;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const number = connectPlan[attempt];
    providerResponse = await client.connect(instanceName, number);

    const extracted = extractQrPayload(providerResponse.payload);
    qrToken = extracted.code ?? qrToken;
    pairingCode = extracted.pairingCode ?? pairingCode;

    if (!providerResponse.ok || qrToken || pairingCode) break;
    if (attempt < totalAttempts - 1) await sleep(CONNECTION_CODE_FETCH_DELAY_MS);
  }

  return {
    providerResponse,
    qrCode: await toQrDataUrl(qrToken),
    pairingCode,
  };
}

function resolveStoredInstanceStatus(input: {
  providerOk: boolean;
  currentState?: string | null;
  qrCode?: string | null;
  pairingCode?: string | null;
}) {
  if (!input.providerOk) return "ERROR";

  const normalizedState = normalizeWhatsAppInstanceStatus(input.currentState);
  if (isConnectedWhatsAppInstanceStatus(normalizedState)) return normalizedState;
  if (input.qrCode || input.pairingCode) return "PAIRING";
  if (normalizedState !== "UNKNOWN") return normalizedState;
  return "CONNECTING";
}

class EvolutionApiClient {
  constructor(private readonly env: Env, private readonly config?: EvolutionInstanceConfig) {}

  private get baseUrl() {
    return (this.config?.baseUrl?.trim() || this.env.EVOLUTION_API_BASE_URL).replace(/\/$/, "");
  }

  private get apiKey() {
    return this.config?.apiKey?.trim() || this.env.EVOLUTION_API_KEY?.trim() || null;
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.baseUrl);
  }

  async createInstance(input: { instanceName: string; token?: string | null; number?: string | null }) {
    return this.request("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName: input.instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        rejectCall: true,
        msgCall: "Olá! Este número é usado para comunicações oficiais do UOR Connect.",
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: true,
        readStatus: true,
        ...(input.token ? { token: input.token } : {}),
        ...(input.number ? { number: input.number } : {}),
      }),
    });
  }

  async connect(instanceName: string, number?: string | null) {
    const query = number ? `?number=${encodeURIComponent(number)}` : "";
    return this.request(`/instance/connect/${encodeURIComponent(instanceName)}${query}`);
  }

  async connectionState(instanceName: string) {
    return this.request(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
  }

  async deleteInstance(instanceName: string) {
    return this.request(`/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
    });
  }

  async sendText(instanceName: string, input: { number: string; text: string; delay?: number }) {
    return this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        number: input.number,
        text: input.text,
        linkPreview: true,
        ...(input.delay ? { delay: input.delay } : {}),
      }),
    });
  }

  async sendMedia(instanceName: string, input: {
    number: string;
    mediatype: "image" | "video" | "document";
    mimetype: string;
    caption: string;
    media: string;
    fileName: string;
    delay?: number;
  }) {
    return this.request(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        number: input.number,
        mediatype: input.mediatype,
        mimetype: input.mimetype,
        caption: input.caption,
        media: input.media,
        fileName: input.fileName,
        linkPreview: true,
        ...(input.delay ? { delay: input.delay } : {}),
      }),
    });
  }

  async sendButtons(instanceName: string, input: {
    number: string;
    text: string;
    buttons: Array<{ displayText: string; id: string }>;
    footerText?: string;
  }) {
    return this.request(`/message/sendButtons/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        number: input.number,
        text: input.text,
        buttons: input.buttons,
        ...(input.footerText ? { footerText: input.footerText } : {}),
      }),
    });
  }

  async sendList(instanceName: string, input: {
    number: string;
    title: string;
    description: string;
    buttonText: string;
    footerText?: string;
    sections: Array<{
      title: string;
      rows: Array<{ title: string; description?: string; rowId: string }>;
    }>;
  }) {
    return this.request(`/message/sendList/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        number: input.number,
        title: input.title,
        description: input.description,
        buttonText: input.buttonText,
        sections: input.sections,
        ...(input.footerText ? { footerText: input.footerText } : {}),
      }),
    });
  }

  async setWebhook(instanceName: string, input: { url: string; enabled: boolean; events?: string[] }) {
    return this.request(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      body: JSON.stringify({
        enabled: input.enabled,
        url: input.url,
        webhook_by_events: false,
        webhook_base64: false,
        webhookByEvents: false,
        webhookBase64: false,
        events: input.events ?? ["MESSAGES_UPSERT"],
      }),
    });
  }

  private async request(path: string, init?: RequestInit): Promise<EvolutionRequestResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        status: 0,
        payload: { message: "EVOLUTION_API_KEY não configurado." },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          apikey: this.apiKey,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });

      const raw = await response.text();
      let payload: unknown = null;

      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        payload,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {
          message: error instanceof Error ? error.message : "Falha de rede ao comunicar com a Evolution API",
        },
      };
    }
  }
}

async function resolveDefaultInstance(instanceId?: number) {
  if (instanceId) {
    return prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, isActive: true },
    });
  }

  const instances = await prisma.whatsAppInstance.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  return pickPreferredWhatsAppInstance(instances);
}

async function buildAudienceStats(type: CommunicationAudienceType) {
  const candidates = await resolveAudienceCandidates({ type });
  const resolved = resolveRecipients(candidates);
  return {
    total: candidates.length,
    sendable: resolved.recipients.length,
  };
}

async function buildCampaignSummary(campaign: {
  id: number;
  title: string | null;
  instanceId: number | null;
  instanceName: string;
  audienceType: string;
  status: string;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  mediaUrl: string | null;
  createdByStudentNumber: string;
  createdAt: Date;
  sentAt: Date | null;
}) {
  return {
    ...campaign,
    createdAt: campaign.createdAt.toISOString(),
    sentAt: campaign.sentAt?.toISOString() ?? null,
  };
}

function getPublicAppBaseUrl(env: Env) {
  const explicit = env.PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const fallback = env.CORS_ORIGIN
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith("http"));

  return fallback?.replace(/\/$/, "") ?? null;
}

function normalizeAutomationTemplate(value: string | null | undefined, fallback: string) {
  const normalized = value?.replace(/\r\n/g, "\n").trim();
  return normalized ? normalized : fallback;
}

export function renderWhatsAppAutomationTemplate(
  template: string,
  values: Record<string, string | null | undefined>,
) {
  const rendered = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const value = values[key];
    return typeof value === "string" ? value : "";
  });

  return rendered
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function renderWhatsAppAudienceTemplate(
  template: string,
  values: Record<string, string | null | undefined>,
) {
  const recipientKeys = new Set(["nome", "numero", "curso", "turma"]);
  const rendered = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (placeholder, rawKey: string) => {
    const key = rawKey.trim();
    if (recipientKeys.has(key.toLowerCase())) return placeholder;
    const value = values[key];
    return typeof value === "string" ? value : "";
  });

  return rendered
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function buildWhatsAppAutomationValues(context: WhatsAppAutomationContext) {
  return {
    nome: context.recipientName?.trim() || "estudante",
    numero: context.studentNumber?.trim() || "",
    curso: context.recipientCourse?.trim() || "",
    titulo: "",
    referencia: "",
    estado: "",
    detalhe: "",
    link: "",
    evento: "",
    certificado: "",
    validacao_url: "",
    pdf_url: "",
    ...(context.values ?? {}),
  };
}

function serializeWhatsAppAutomationSetting(setting: {
  eventKey: string;
  label: string;
  description: string;
  enabled: boolean;
  customTitle: string | null;
  customMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const eventKey = whatsappAutomationEventKeySchema.parse(setting.eventKey);
  const definition = whatsappAutomationDefinitionByKey[eventKey];

  return {
    eventKey,
    label: definition.label,
    description: definition.description,
    enabled: setting.enabled,
    title: normalizeAutomationTemplate(setting.customTitle, definition.defaultTitle),
    message: normalizeAutomationTemplate(setting.customMessage, definition.defaultMessage),
    createdAt: setting.createdAt.toISOString(),
    updatedAt: setting.updatedAt.toISOString(),
  };
}

async function ensureWhatsAppAutomationSettings() {
  await prisma.$transaction(
    whatsappAutomationEventKeys.map((eventKey) => {
      const definition = whatsappAutomationDefinitionByKey[eventKey];
      return prisma.whatsAppAutomationSetting.upsert({
        where: { eventKey },
        create: {
          eventKey,
          label: definition.label,
          description: definition.description,
          enabled: getDefaultAutomationEnabled(eventKey),
        },
        update: {
          label: definition.label,
          description: definition.description,
        },
      });
    }),
  );

  const settings = await prisma.whatsAppAutomationSetting.findMany({
    where: { eventKey: { in: [...whatsappAutomationEventKeys] } },
  });

  const byEventKey = new Map(settings.map((setting) => [setting.eventKey, setting]));

  return whatsappAutomationEventKeys
    .map((eventKey) => byEventKey.get(eventKey))
    .filter((setting): setting is NonNullable<typeof setting> => Boolean(setting));
}

async function upsertWhatsAppAutomationSetting(
  eventKey: WhatsAppAutomationEventKey,
  input: { enabled: boolean; title?: string; message?: string },
) {
  const definition = whatsappAutomationDefinitionByKey[eventKey];

  return prisma.whatsAppAutomationSetting.upsert({
    where: { eventKey },
    create: {
      eventKey,
      label: definition.label,
      description: definition.description,
      enabled: input.enabled,
      customTitle: input.title?.trim() ? input.title.trim() : null,
      customMessage: input.message?.trim() ? input.message.trim() : null,
    },
    update: {
      label: definition.label,
      description: definition.description,
      enabled: input.enabled,
      ...(input.title !== undefined ? { customTitle: input.title.trim() ? input.title.trim() : null } : {}),
      ...(input.message !== undefined ? { customMessage: input.message.trim() ? input.message.trim() : null } : {}),
    },
  });
}

export async function sendWhatsAppAutomationEvent(
  env: Env,
  eventKey: WhatsAppAutomationEventKey,
  context: WhatsAppAutomationContext,
) {
  const definition = whatsappAutomationDefinitionByKey[eventKey];
  const setting = await prisma.whatsAppAutomationSetting.upsert({
    where: { eventKey },
    create: {
      eventKey,
      label: definition.label,
      description: definition.description,
      enabled: getDefaultAutomationEnabled(eventKey),
    },
    update: {
      label: definition.label,
      description: definition.description,
    },
  });

  if (!setting.enabled) {
    return {
      ok: false,
      skipped: true,
      reason: `Automação ${eventKey} desativada.`,
    };
  }

  const values = buildWhatsAppAutomationValues(context);
  const title = renderWhatsAppAutomationTemplate(
    normalizeAutomationTemplate(setting.customTitle, definition.defaultTitle),
    values,
  ).replace(/\s+/g, " ").trim() || definition.label;
  const message = renderWhatsAppAutomationTemplate(
    normalizeAutomationTemplate(setting.customMessage, definition.defaultMessage),
    values,
  );

  if (!message) {
    return {
      ok: false,
      skipped: true,
      reason: `Automação ${eventKey} sem mensagem configurada.`,
    };
  }

  return sendOperationalWhatsApp(env, {
    title,
    message,
    phone: context.phone,
    studentId: context.studentId,
    studentNumber: context.studentNumber,
    recipientName: context.recipientName,
    recipientCourse: context.recipientCourse,
    media: context.media,
  });
}

export async function sendWhatsAppAudienceAutomationEvent(
  env: Env,
  eventKey: WhatsAppAutomationEventKey,
  context: WhatsAppAutomationContext & {
    audience: CommunicationAudienceInput;
    excludeStudentId?: number | null;
    delay?: number;
  },
) {
  const definition = whatsappAutomationDefinitionByKey[eventKey];
  const setting = await prisma.whatsAppAutomationSetting.upsert({
    where: { eventKey },
    create: {
      eventKey,
      label: definition.label,
      description: definition.description,
      enabled: getDefaultAutomationEnabled(eventKey),
    },
    update: {
      label: definition.label,
      description: definition.description,
    },
  });

  if (!setting.enabled) {
    return { ok: false, skipped: true, reason: `Automação ${eventKey} desativada.` };
  }

  const instance = await resolveDefaultInstance();
  if (!instance) {
    return { ok: false, skipped: true, reason: "Nenhuma instância WhatsApp ativa." };
  }

  if (!isConnectedWhatsAppInstanceStatus(instance.status)) {
    return { ok: false, skipped: true, reason: "Nenhuma instância WhatsApp conectada está disponível." };
  }

  const client = new EvolutionApiClient(env, instance);
  if (!client.isConfigured) {
    return { ok: false, skipped: true, reason: "Evolution API não configurada." };
  }

  const rawCandidates = await resolveAudienceCandidates(context.audience);
  const candidates = typeof context.excludeStudentId === "number"
    ? rawCandidates.filter((candidate) => candidate.studentId !== context.excludeStudentId)
    : rawCandidates;
  const consentFiltered = await applyCookieAudienceFilters(candidates, {
    ...context.audience,
    cookieMarketingOptIn: true,
  });
  const resolved = resolveRecipients(consentFiltered.candidates);

  if (resolved.recipients.length === 0) {
    return { ok: false, skipped: true, reason: "Nenhum destinatário com consentimento e WhatsApp válido." };
  }

  const values = buildWhatsAppAutomationValues(context);
  const title = renderWhatsAppAutomationTemplate(
    normalizeAutomationTemplate(setting.customTitle, definition.defaultTitle),
    values,
  ).replace(/\s+/g, " ").trim() || definition.label;
  const messageTemplate = renderWhatsAppAudienceTemplate(
    normalizeAutomationTemplate(setting.customMessage, definition.defaultMessage),
    values,
  );

  if (!messageTemplate) {
    return { ok: false, skipped: true, reason: `Automação ${eventKey} sem mensagem configurada.` };
  }

  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      title,
      message: messageTemplate,
      instanceId: instance.id,
      instanceName: instance.name,
      audienceType: eventKey,
      audienceFiltersJson: JSON.stringify({
        ...context.audience,
        excludeStudentId: context.excludeStudentId ?? null,
        consent: "marketing",
      }),
      mediaUrl: context.media?.url ?? null,
      mediaType: context.media?.type ?? null,
      mediaMimeType: context.media?.mimeType ?? null,
      mediaFileName: context.media?.fileName ?? null,
      totalRecipients: resolved.recipients.length,
      status: "PROCESSING",
      createdByStudentNumber: "system",
    },
    select: { id: true },
  });

  await prisma.whatsAppCampaignRecipient.createMany({
    data: resolved.recipients.map((recipient) => ({
      campaignId: campaign.id,
      studentId: recipient.studentId,
      studentNumber: recipient.studentNumber,
      recipientName: recipient.name,
      recipientCourse: recipient.course,
      phone: recipient.phone,
      providerTo: recipient.providerTo,
      status: "QUEUED",
    })),
  });

  let successCount = 0;
  let failedCount = 0;
  let connectionClosedObserved = false;
  const concurrency = 3;

  for (let i = 0; i < resolved.recipients.length; i += concurrency) {
    const chunk = resolved.recipients.slice(i, i + concurrency);

    await Promise.all(chunk.map(async (recipient) => {
      const renderedMessage = applyTemplate(messageTemplate, recipient);
      const providerResponse = context.media
        ? await client.sendMedia(instance.name, {
          number: recipient.providerTo,
          mediatype: context.media.type ?? "document",
          mimetype: context.media.mimeType ?? "application/pdf",
          media: context.media.url,
          fileName: context.media.fileName,
          caption: context.media.caption?.trim() || renderedMessage,
          delay: context.delay,
        })
        : await client.sendText(instance.name, {
          number: recipient.providerTo,
          text: renderedMessage,
          delay: context.delay,
        });

      const baseUpdate = {
        providerResponseJson: stringifyProviderPayload(providerResponse.payload),
        providerMessageId: extractProviderMessageId(providerResponse.payload),
        sentAt: new Date(),
      };

      if (providerResponse.ok) {
        successCount += 1;
        await prisma.whatsAppCampaignRecipient.update({
          where: { campaignId_phone: { campaignId: campaign.id, phone: recipient.phone } },
          data: { ...baseUpdate, status: "SENT", errorMessage: null },
        });
        return;
      }

      failedCount += 1;
      if (isConnectionClosedProviderPayload(providerResponse.payload)) connectionClosedObserved = true;
      const reason = extractProviderMessage(providerResponse.payload)
        ?? `Falha na Evolution API (status ${providerResponse.status || "desconhecido"}).`;
      await prisma.whatsAppCampaignRecipient.update({
        where: { campaignId_phone: { campaignId: campaign.id, phone: recipient.phone } },
        data: { ...baseUpdate, status: "FAILED", errorMessage: reason },
      });
    }));
  }

  const status = failedCount === 0 ? "SENT" : successCount === 0 ? "FAILED" : "PARTIAL";

  await prisma.whatsAppCampaign.update({
    where: { id: campaign.id },
    data: { status, successCount, failedCount, sentAt: new Date() },
  });

  if (connectionClosedObserved) {
    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: { status: "CLOSE", lastCheckedAt: new Date() },
    }).catch(() => null);
  }

  return {
    ok: failedCount === 0,
    skipped: false,
    campaignId: campaign.id,
    status,
    successCount,
    failedCount,
    totalRecipients: resolved.recipients.length,
  };
}

export async function sendOperationalWhatsApp(env: Env, input: {
  title: string;
  message: string;
  phone?: string | null;
  studentId?: number | null;
  studentNumber?: string | null;
  recipientName?: string | null;
  recipientCourse?: string | null;
  media?: {
    url: string;
    fileName: string;
    mimeType?: string;
    type?: "image" | "video" | "document";
    caption?: string;
  };
}) {
  const normalizedPhone = normalizePhoneForWhatsApp(input.phone);
  if (!normalizedPhone) {
    return { ok: false, skipped: true, reason: "Telefone ausente ou inválido para WhatsApp." };
  }

  const instance = await resolveDefaultInstance();
  if (!instance) {
    return { ok: false, skipped: true, reason: "Nenhuma instância WhatsApp ativa." };
  }

  if (!isConnectedWhatsAppInstanceStatus(instance.status)) {
    return {
      ok: false,
      skipped: true,
      reason: "Nenhuma instância WhatsApp conectada está disponível para o envio operacional.",
    };
  }

  const client = new EvolutionApiClient(env, instance);
  if (!client.isConfigured) {
    return { ok: false, skipped: true, reason: "Evolution API não configurada." };
  }

  const renderedMessage = normalizeMessage(input.message);
  const providerResponse = input.media
    ? await client.sendMedia(instance.name, {
      number: normalizedPhone.providerTo,
      mediatype: input.media.type ?? "document",
      mimetype: input.media.mimeType ?? "application/pdf",
      media: input.media.url,
      fileName: input.media.fileName,
      caption: input.media.caption?.trim() || renderedMessage,
    })
    : await client.sendText(instance.name, {
      number: normalizedPhone.providerTo,
      text: renderedMessage,
    });

  const providerError = extractProviderMessage(providerResponse.payload)
    ?? `Falha na Evolution API (status ${providerResponse.status || "desconhecido"}).`;

  if (!providerResponse.ok && isConnectionClosedProviderPayload(providerResponse.payload)) {
    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: {
        status: "CLOSE",
        lastCheckedAt: new Date(),
      },
    }).catch(() => null);
  }

  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      title: input.title,
      message: renderedMessage,
      instanceId: instance.id,
      instanceName: instance.name,
      audienceType: "OPERATIONAL",
      audienceFiltersJson: JSON.stringify({
        studentNumber: input.studentNumber,
        phone: normalizedPhone.phone,
      }),
      mediaUrl: input.media?.url ?? null,
      mediaType: input.media?.type ?? null,
      mediaMimeType: input.media?.mimeType ?? null,
      mediaFileName: input.media?.fileName ?? null,
      totalRecipients: 1,
      successCount: providerResponse.ok ? 1 : 0,
      failedCount: providerResponse.ok ? 0 : 1,
      status: providerResponse.ok ? "SENT" : "FAILED",
      createdByStudentNumber: "system",
      sentAt: new Date(),
      recipients: {
        create: {
          studentId: input.studentId ?? null,
          studentNumber: input.studentNumber ?? null,
          recipientName: input.recipientName ?? null,
          recipientCourse: input.recipientCourse ?? null,
          phone: normalizedPhone.phone,
          providerTo: normalizedPhone.providerTo,
          status: providerResponse.ok ? "SENT" : "FAILED",
          providerMessageId: extractProviderMessageId(providerResponse.payload),
          providerResponseJson: stringifyProviderPayload(providerResponse.payload),
          errorMessage: providerResponse.ok ? null : providerError,
          sentAt: new Date(),
        },
      },
    },
    select: { id: true },
  });

  return {
    ok: providerResponse.ok,
    skipped: false,
    campaignId: campaign.id,
    reason: providerResponse.ok ? null : providerError,
  };
}

export async function whatsappRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.register(async (adminApp) => {
      adminApp.register(adminGuard);

      adminApp.get("/admin/overview", {
        schema: {
          response: {
            200: z.object({
              integration: z.object({
                configured: z.boolean(),
                baseUrl: z.string(),
                providerStatus: z.string(),
                providerMessage: z.string().nullable(),
                publicAppUrl: z.string().nullable(),
              }),
              automations: z.array(whatsappAutomationSettingSchema),
              instances: z.array(whatsappInstanceSchema),
              audiences: z.object({
                allStudents: z.object({ total: z.number(), sendable: z.number() }),
                studentClass: z.object({ total: z.number(), sendable: z.number() }),
                courseEnrolled: z.object({ total: z.number(), sendable: z.number() }),
                exhibitors: z.object({ total: z.number(), sendable: z.number() }),
                winners: z.object({ total: z.number(), sendable: z.number() }),
                marketingConsented: z.object({ total: z.number(), sendable: z.number() }),
                activeLast7Days: z.object({ total: z.number(), sendable: z.number() }),
              }),
              campaigns: z.array(whatsappCampaignSummarySchema),
            }),
          },
        },
      }, async (request) => {
        const [instances, campaigns, allStudents, studentClass, courseEnrolled, exhibitors, winners, automations] = await Promise.all([
          prisma.whatsAppInstance.findMany({
            where: { isActive: true },
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          }),
          prisma.whatsAppCampaign.findMany({
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              title: true,
              instanceId: true,
              instanceName: true,
              audienceType: true,
              status: true,
              totalRecipients: true,
              successCount: true,
              failedCount: true,
              mediaUrl: true,
              createdByStudentNumber: true,
              createdAt: true,
              sentAt: true,
            },
          }),
          buildAudienceStats("ALL_STUDENTS"),
          buildAudienceStats("STUDENT_CLASS"),
          buildAudienceStats("COURSE_ENROLLED"),
          buildAudienceStats("EXHIBITORS"),
          buildAudienceStats("WINNERS"),
          ensureWhatsAppAutomationSettings(),
        ]);

        const allCandidates = await resolveAudienceCandidates({ type: "ALL_STUDENTS" });
        const marketingConsented = await applyCookieAudienceFilters(allCandidates, {
          type: "ALL_STUDENTS",
          cookieMarketingOptIn: true,
        });
        const activeLast7Days = await applyCookieAudienceFilters(allCandidates, {
          type: "ALL_STUDENTS",
          activeWithinDays: 7,
        });

        const integrationClient = new EvolutionApiClient(opts.env);
        const publicAppUrl = getPublicAppBaseUrl(opts.env);

        return {
          integration: {
            configured: integrationClient.isConfigured,
            baseUrl: opts.env.EVOLUTION_API_BASE_URL,
            providerStatus: integrationClient.isConfigured ? "ready" : "not_configured",
            providerMessage: integrationClient.isConfigured ? null : "Define EVOLUTION_API_KEY no backend ou informa uma chave por instância.",
            publicAppUrl,
          },
          automations: automations.map(serializeWhatsAppAutomationSetting),
          instances: instances.map(formatInstance),
          audiences: {
            allStudents,
            studentClass,
            courseEnrolled,
            exhibitors,
            winners,
            marketingConsented: {
              total: marketingConsented.candidates.length,
              sendable: resolveRecipients(marketingConsented.candidates).recipients.length,
            },
            activeLast7Days: {
              total: activeLast7Days.candidates.length,
              sendable: resolveRecipients(activeLast7Days.candidates).recipients.length,
            },
          },
          campaigns: await Promise.all(campaigns.map(buildCampaignSummary)),
        };
      });

      adminApp.put("/admin/automations/:eventKey", {
        schema: {
          params: z.object({ eventKey: whatsappAutomationEventKeySchema }),
          body: whatsappAutomationUpdateSchema,
          response: {
            200: whatsappAutomationSettingSchema,
          },
        },
      }, async (request) => {
        const { eventKey } = request.params as { eventKey: WhatsAppAutomationEventKey };
        const body = request.body as z.infer<typeof whatsappAutomationUpdateSchema>;

        const setting = await upsertWhatsAppAutomationSetting(eventKey, {
          enabled: body.enabled,
          title: body.title,
          message: body.message,
        });

        return serializeWhatsAppAutomationSetting(setting);
      });

      adminApp.get("/admin/filters", {
        schema: {
          response: {
            200: z.object({
              audienceButtons: z.array(whatsappAudienceButtonSchema),
              studentClassButtons: z.array(whatsappStudentClassButtonSchema),
              studentCourseButtons: z.array(whatsappStudentCourseButtonSchema),
              updatedAt: z.string(),
            }),
          },
        },
      }, async () => {
        const audienceTypes: CommunicationAudienceType[] = [
          "ALL_STUDENTS",
          "STUDENT_CLASS",
          "STUDENT_COURSE",
          "STUDENT_CLASS_OR_COURSE",
          "COURSE_ENROLLED",
          "EXHIBITORS",
          "COURSE_OR_EXHIBITORS",
          "WINNERS",
          "SELECTED_STUDENTS",
        ];

        const audienceButtons = await Promise.all(
          audienceTypes.map(async (type) => {
            const candidates = await resolveAudienceCandidates({ type });
            const resolved = resolveRecipients(candidates);
            return {
              type,
              label: audienceTypeLabel(type),
              total: candidates.length,
              sendable: resolved.recipients.length,
            };
          }),
        );

        return {
          audienceButtons,
          studentClassButtons: await buildStudentClassButtons(),
          studentCourseButtons: await buildStudentCourseButtons(),
          updatedAt: new Date().toISOString(),
        };
      });

      adminApp.get("/admin/campaigns", {
        schema: {
          querystring: z.object({
            page: z.coerce.number().int().min(0).optional(),
            pageSize: z.coerce.number().int().min(1).max(100).optional(),
          }),
          response: {
            200: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              campaigns: z.array(whatsappCampaignSummarySchema),
            }),
          },
        },
      }, async (request) => {
        const query = request.query as { page?: number; pageSize?: number };
        const page = query.page ?? 0;
        const pageSize = query.pageSize ?? 20;

        const [total, campaigns] = await Promise.all([
          prisma.whatsAppCampaign.count(),
          prisma.whatsAppCampaign.findMany({
            orderBy: { createdAt: "desc" },
            skip: page * pageSize,
            take: pageSize,
            select: {
              id: true,
              title: true,
              instanceId: true,
              instanceName: true,
              audienceType: true,
              status: true,
              totalRecipients: true,
              successCount: true,
              failedCount: true,
              mediaUrl: true,
              createdByStudentNumber: true,
              createdAt: true,
              sentAt: true,
            },
          }),
        ]);

        return {
          page,
          pageSize,
          total,
          campaigns: await Promise.all(campaigns.map(buildCampaignSummary)),
        };
      });

      adminApp.get("/admin/campaigns/:id/failures", {
        schema: {
          params: z.object({ id: z.coerce.number().int() }),
          response: {
            200: z.object({
              campaignId: z.number(),
              title: z.string().nullable(),
              message: z.string(),
              instanceName: z.string(),
              failures: z.array(z.object({
                phone: z.string(),
                providerTo: z.string(),
                errorMessage: z.string().nullable(),
                studentNumber: z.string().nullable(),
              })),
            }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };

        const campaign = await prisma.whatsAppCampaign.findUnique({
          where: { id },
          select: {
            id: true,
            title: true,
            message: true,
            instanceName: true,
            recipients: {
              where: { status: "FAILED" },
              select: {
                phone: true,
                providerTo: true,
                errorMessage: true,
                studentNumber: true,
              },
            },
          },
        });

        if (!campaign) {
          return reply.code(404).send({ message: "Campanha não encontrada." });
        }

        return {
          campaignId: campaign.id,
          title: campaign.title,
          message: campaign.message,
          instanceName: campaign.instanceName,
          failures: campaign.recipients,
        };
      });

      adminApp.post("/admin/instances", {
        schema: {
          body: whatsappInstanceInputSchema,
          response: {
            201: z.object({
              instance: whatsappInstanceSchema,
              provider: z.object({
                ok: z.boolean(),
                status: z.number(),
                message: z.string().nullable(),
              }),
            }),
            400: z.object({ message: z.string() }),
            409: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = request.body as z.infer<typeof whatsappInstanceInputSchema>;
        const name = normalizeInstanceName(body.name);
        const client = new EvolutionApiClient(opts.env, {
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
        });

        if (!client.isConfigured) {
          return reply.code(400).send({
            message: "Configura EVOLUTION_API_KEY no backend ou informa a chave da instância.",
          });
        }

        const existingByName = await prisma.whatsAppInstance.findUnique({ where: { name } });
        if (existingByName?.isActive) {
          return reply.code(409).send({
            message: `Já existe uma instância WhatsApp com o nome "${name}". Usa o botão Conectar nessa instância ou escolhe outro nome.`,
          });
        }

        const providerResponse = await client.createInstance({
          instanceName: name,
          token: body.token,
        });
        const { code, pairingCode } = extractQrPayload(providerResponse.payload);
        const qrCode = await toQrDataUrl(code);

        if (!providerResponse.ok && ![400, 403, 409].includes(providerResponse.status)) {
          return reply.code(400).send({
            message: extractProviderMessage(providerResponse.payload) ?? "A Evolution API recusou a criação da instância.",
          });
        }

        const existingDefault = await prisma.whatsAppInstance.findFirst({ where: { isDefault: true, isActive: true } });
        const shouldBeDefault = body.isDefault ?? !existingDefault;

        const instance = await prisma.$transaction(async (tx) => {
          if (shouldBeDefault) {
            await tx.whatsAppInstance.updateMany({ data: { isDefault: false } });
          }

          const data = {
            label: body.label?.trim() || null,
            phoneNumber: body.phoneNumber?.trim() || null,
            baseUrl: body.baseUrl?.trim() || null,
            apiKey: body.apiKey?.trim() || null,
            status: providerResponse.ok ? (qrCode || pairingCode ? "PAIRING" : "CREATED") : "LOCAL",
            isDefault: shouldBeDefault,
            isActive: true,
            qrCode,
            pairingCode,
            lastCheckedAt: null,
          };

          if (existingByName) {
            return tx.whatsAppInstance.update({
              where: { id: existingByName.id },
              data,
            });
          }

          return tx.whatsAppInstance.create({
            data: {
              name,
              ...data,
              createdByStudentNumber: request.student?.studentNumber ?? "unknown",
            },
          });
        }).catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return null;
          }
          throw error;
        });

        if (!instance) {
          return reply.code(409).send({
            message: `Já existe uma instância WhatsApp com o nome "${name}". Atualiza a lista e usa a instância existente.`,
          });
        }

        return reply.code(201).send({
          instance: formatInstance(instance),
          provider: {
            ok: providerResponse.ok,
            status: providerResponse.status,
            message: extractProviderMessage(providerResponse.payload),
          },
        });
      });

      adminApp.post("/admin/instances/:id/connect", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: z.object({
              instance: whatsappInstanceSchema,
              provider: z.object({
                ok: z.boolean(),
                status: z.number(),
                message: z.string().nullable(),
              }),
            }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const existing = await prisma.whatsAppInstance.findFirst({ where: { id, isActive: true } });
        if (!existing) return reply.code(404).send({ message: "Instância não encontrada." });

        const client = new EvolutionApiClient(opts.env, existing);
        const { providerResponse, qrCode, pairingCode } = await fetchConnectionArtifacts(
          client,
          existing.name,
          normalizeOwnerNumber(existing.phoneNumber),
        );
        const nextQrCode = qrCode ?? existing.qrCode;
        const nextPairingCode = pairingCode ?? existing.pairingCode;

        const instance = await prisma.whatsAppInstance.update({
          where: { id: existing.id },
          data: {
            qrCode: nextQrCode,
            pairingCode: nextPairingCode,
            status: resolveStoredInstanceStatus({
              providerOk: providerResponse.ok,
              qrCode: nextQrCode,
              pairingCode: nextPairingCode,
            }),
            lastCheckedAt: new Date(),
          },
        });

        return {
          instance: formatInstance(instance),
          provider: {
            ok: providerResponse.ok,
            status: providerResponse.status,
            message: extractProviderMessage(providerResponse.payload),
          },
        };
      });

      adminApp.post("/admin/instances/:id/status", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: z.object({
              instance: whatsappInstanceSchema,
              provider: z.object({
                ok: z.boolean(),
                status: z.number(),
                message: z.string().nullable(),
              }),
            }),
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const existing = await prisma.whatsAppInstance.findFirst({ where: { id, isActive: true } });
        if (!existing) return reply.code(404).send({ message: "Instância não encontrada." });

        const client = new EvolutionApiClient(opts.env, existing);
        const providerResponse = await client.connectionState(existing.name);
        const state = normalizeWhatsAppInstanceStatus(extractConnectionState(providerResponse.payload));
        const connected = ["OPEN", "CONNECTED", "ONLINE"].includes(state);
        let qrCode = connected ? null : existing.qrCode;
        let pairingCode = connected ? null : existing.pairingCode;
        let providerMessage = extractProviderMessage(providerResponse.payload);
        let providerStatus = providerResponse.status;

        if (
          providerResponse.ok
          && !connected
          && !qrCode
          && !pairingCode
          && PENDING_WHATSAPP_INSTANCE_STATUSES.has(state)
        ) {
          const artifactResponse = await fetchConnectionArtifacts(
            client,
            existing.name,
            normalizeOwnerNumber(existing.phoneNumber),
            2,
          );

          qrCode = artifactResponse.qrCode ?? qrCode;
          pairingCode = artifactResponse.pairingCode ?? pairingCode;
          providerStatus = artifactResponse.providerResponse.status || providerStatus;
          providerMessage = extractProviderMessage(artifactResponse.providerResponse.payload) ?? providerMessage;
        }

        const instance = await prisma.whatsAppInstance.update({
          where: { id: existing.id },
          data: {
            status: resolveStoredInstanceStatus({
              providerOk: providerResponse.ok,
              currentState: state,
              qrCode,
              pairingCode,
            }),
            lastCheckedAt: new Date(),
            lastConnectedAt: connected ? new Date() : existing.lastConnectedAt,
            qrCode,
            pairingCode,
          },
        });

        return {
          instance: formatInstance(instance),
          provider: {
            ok: providerResponse.ok,
            status: providerStatus,
            message: providerMessage,
          },
        };
      });

      adminApp.post("/admin/instances/:id/default", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: whatsappInstanceSchema,
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const existing = await prisma.whatsAppInstance.findFirst({ where: { id, isActive: true } });
        if (!existing) return reply.code(404).send({ message: "Instância não encontrada." });

        const instance = await prisma.$transaction(async (tx) => {
          await tx.whatsAppInstance.updateMany({ data: { isDefault: false } });
          return tx.whatsAppInstance.update({
            where: { id },
            data: { isDefault: true },
          });
        });

        return formatInstance(instance);
      });

      adminApp.delete("/admin/instances/:id", {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          response: {
            200: whatsappInstanceSchema,
            404: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const { id } = request.params as { id: number };
        const existing = await prisma.whatsAppInstance.findFirst({ where: { id, isActive: true } });
        if (!existing) return reply.code(404).send({ message: "Instância não encontrada." });

        const client = new EvolutionApiClient(opts.env, existing);
        await client.deleteInstance(existing.name).catch(() => null);

        const instance = await prisma.whatsAppInstance.update({
          where: { id },
          data: { isActive: false, isDefault: false, status: "DISABLED" },
        });

        return formatInstance(instance);
      });

      adminApp.post("/admin/preview", {
        schema: {
          body: whatsappPreviewBodySchema,
          response: {
            200: z.object({
              totalCandidates: z.number(),
              filteredCandidates: z.number(),
              totalRecipients: z.number(),
              skippedCount: z.number(),
              recipients: z.array(whatsappRecipientPreviewSchema),
              skipped: z.array(z.object({
                studentId: z.number().nullable(),
                studentNumber: z.string().nullable(),
                name: z.string().nullable(),
                course: z.string().nullable(),
                classCode: z.string().nullable(),
                phone: z.string().nullable(),
                source: z.string(),
                reason: z.string(),
              })),
            }),
          },
        },
      }, async (request) => {
        const body = request.body as z.infer<typeof whatsappPreviewBodySchema>;
        const rawCandidates = await resolveAudienceCandidates(body.audience);
        const cookieFiltered = await applyCookieAudienceFilters(rawCandidates, body.audience);
        const resolved = resolveRecipients(cookieFiltered.candidates, body.search);
        const skipped = [...cookieFiltered.skipped, ...resolved.skipped];
        const limit = body.limit ?? 120;

        return {
          totalCandidates: rawCandidates.length,
          filteredCandidates: resolved.filteredTotal,
          totalRecipients: resolved.recipients.length,
          skippedCount: skipped.length,
          recipients: resolved.recipients.slice(0, limit),
          skipped: skipped.slice(0, Math.min(limit, 80)),
        };
      });

      adminApp.post("/admin/send", {
        schema: {
          body: whatsappSendBodySchema,
          response: {
            200: z.object({
              campaignId: z.number(),
              status: z.string(),
              totalCandidates: z.number(),
              totalRecipients: z.number(),
              skippedCount: z.number(),
              successCount: z.number(),
              failedCount: z.number(),
              instanceName: z.string(),
              failures: z.array(z.object({
                phone: z.string(),
                providerTo: z.string(),
                reason: z.string(),
              })),
            }),
            400: z.object({ message: z.string() }),
          },
        },
      }, async (request, reply) => {
        const body = request.body as z.infer<typeof whatsappSendBodySchema>;
        const instance = await resolveDefaultInstance(body.instanceId);
        const explicitInstanceSelected = typeof body.instanceId === "number";

        if (!instance) {
          return reply.code(400).send({
            message: "Nenhuma instância WhatsApp ativa. Cria e conecta um telefone na aba WhatsApp.",
          });
        }

        if (!isConnectedWhatsAppInstanceStatus(instance.status)) {
          request.log.warn({
            instanceId: instance.id,
            instanceName: instance.name,
            instanceStatus: instance.status,
            explicitInstanceSelected,
          }, "WhatsApp admin send blocked because the selected instance is not connected");

          return reply.code(400).send({
            message: explicitInstanceSelected
              ? `A instância escolhida (${instance.name}) está ${instance.status}. Atualiza o estado ou seleciona um telefone ligado.`
              : "Nenhuma instância WhatsApp conectada está disponível. Liga um telefone na aba WhatsApp antes de enviar.",
          });
        }

        const client = new EvolutionApiClient(opts.env, instance);
        if (!client.isConfigured) {
          return reply.code(400).send({
            message: "Evolution API não configurada para esta instância.",
          });
        }

        const rawCandidates = await resolveAudienceCandidates(body.audience);
        const cookieFiltered = await applyCookieAudienceFilters(rawCandidates, body.audience);
        const resolved = resolveRecipients(cookieFiltered.candidates);
        const skipped = [...cookieFiltered.skipped, ...resolved.skipped];

        if (resolved.recipients.length === 0) {
          return reply.code(400).send({
            message: "Nenhum destinatário WhatsApp válido encontrado para esta audiência.",
          });
        }

        request.log.info({
          audienceType: body.audience.type,
          instanceId: instance.id,
          instanceName: instance.name,
          totalRecipients: resolved.recipients.length,
          media: Boolean(body.media),
        }, "Starting WhatsApp admin campaign");

        const campaign = await prisma.whatsAppCampaign.create({
          data: {
            title: body.title?.trim() || null,
            message: normalizeMessage(body.message),
            instanceId: instance.id,
            instanceName: instance.name,
            audienceType: body.audience.type,
            audienceFiltersJson: JSON.stringify(body.audience),
            mediaUrl: body.media?.url ?? null,
            mediaType: body.media?.type ?? null,
            mediaMimeType: body.media?.mimeType ?? null,
            mediaFileName: body.media?.fileName ?? null,
            totalRecipients: resolved.recipients.length,
            status: "PROCESSING",
            createdByStudentNumber: request.student?.studentNumber ?? "unknown",
          },
          select: { id: true },
        });

        await prisma.whatsAppCampaignRecipient.createMany({
          data: resolved.recipients.map((recipient) => ({
            campaignId: campaign.id,
            studentId: recipient.studentId,
            studentNumber: recipient.studentNumber,
            recipientName: recipient.name,
            recipientCourse: recipient.course,
            phone: recipient.phone,
            providerTo: recipient.providerTo,
            status: "QUEUED",
          })),
        });

        const failures: Array<{ phone: string; providerTo: string; reason: string }> = [];
        let successCount = 0;
        let failedCount = 0;
        let connectionClosedObserved = false;
        const concurrency = 3;

        for (let i = 0; i < resolved.recipients.length; i += concurrency) {
          const chunk = resolved.recipients.slice(i, i + concurrency);

          await Promise.all(chunk.map(async (recipient) => {
            const renderedMessage = applyTemplate(normalizeMessage(body.message), recipient);
            const providerResponse = body.media
              ? await client.sendMedia(instance.name, {
                number: recipient.providerTo,
                mediatype: body.media.type,
                mimetype: body.media.mimeType,
                media: body.media.url,
                fileName: body.media.fileName,
                caption: body.media.caption?.trim() || renderedMessage,
                delay: body.delay,
              })
              : await client.sendText(instance.name, {
                number: recipient.providerTo,
                text: renderedMessage,
                delay: body.delay,
              });

            const baseUpdate = {
              providerResponseJson: stringifyProviderPayload(providerResponse.payload),
              providerMessageId: extractProviderMessageId(providerResponse.payload),
              sentAt: new Date(),
            };

            if (providerResponse.ok) {
              successCount += 1;
              await prisma.whatsAppCampaignRecipient.update({
                where: {
                  campaignId_phone: {
                    campaignId: campaign.id,
                    phone: recipient.phone,
                  },
                },
                data: {
                  ...baseUpdate,
                  status: "SENT",
                  errorMessage: null,
                },
              });
              return;
            }

            failedCount += 1;
            const reason = extractProviderMessage(providerResponse.payload)
              ?? `Falha na Evolution API (status ${providerResponse.status || "desconhecido"}).`;
            if (isConnectionClosedProviderPayload(providerResponse.payload)) {
              connectionClosedObserved = true;
            }

            failures.push({
              phone: recipient.phone,
              providerTo: recipient.providerTo,
              reason,
            });

            await prisma.whatsAppCampaignRecipient.update({
              where: {
                campaignId_phone: {
                  campaignId: campaign.id,
                  phone: recipient.phone,
                },
              },
              data: {
                ...baseUpdate,
                status: "FAILED",
                errorMessage: reason,
              },
            });
          }));
        }

        const status = failedCount === 0
          ? "SENT"
          : successCount === 0
            ? "FAILED"
            : "PARTIAL";

        await prisma.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: {
            status,
            successCount,
            failedCount,
            sentAt: new Date(),
          },
        });

        if (connectionClosedObserved) {
          await prisma.whatsAppInstance.update({
            where: { id: instance.id },
            data: {
              status: "CLOSE",
              lastCheckedAt: new Date(),
            },
          }).catch(() => null);
        }

        const logPayload = {
          campaignId: campaign.id,
          status,
          instanceId: instance.id,
          instanceName: instance.name,
          successCount,
          failedCount,
          sampleFailure: failures[0]?.reason ?? null,
        };

        if (failedCount > 0) {
          request.log.warn(logPayload, "WhatsApp admin campaign completed with failures");
        } else {
          request.log.info(logPayload, "WhatsApp admin campaign completed successfully");
        }

        return {
          campaignId: campaign.id,
          status,
          totalCandidates: rawCandidates.length,
          totalRecipients: resolved.recipients.length,
          skippedCount: skipped.length,
          successCount,
          failedCount,
          instanceName: instance.name,
          failures: failures.slice(0, 80),
        };
      });
    });
  });
}
