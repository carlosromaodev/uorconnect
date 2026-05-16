import crypto from "node:crypto";

export const COMMUNICATION_APPROVAL_MIN_RECIPIENTS = 25;

type ApprovalChannel = "SMS" | "WHATSAPP";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function approvalAudienceSnapshot(audience: unknown) {
  if (!audience || typeof audience !== "object" || Array.isArray(audience)) return audience;
  const { includeProviderTos: _includeProviderTos, excludeProviderTos: _excludeProviderTos, ...rest } = audience as Record<string, unknown>;
  return rest;
}

export function isCampaignApprovalRequired(totalRecipients: number) {
  return totalRecipients >= COMMUNICATION_APPROVAL_MIN_RECIPIENTS;
}

export function buildCampaignApprovalToken(input: {
  channel: ApprovalChannel;
  audience: unknown;
  secret: string;
}) {
  return crypto
    .createHmac("sha256", input.secret)
    .update(stableJson({
      channel: input.channel,
      audience: approvalAudienceSnapshot(input.audience),
      minRecipients: COMMUNICATION_APPROVAL_MIN_RECIPIENTS,
      version: 1,
    }))
    .digest("hex");
}

export function isValidCampaignApprovalToken(input: {
  channel: ApprovalChannel;
  audience: unknown;
  secret: string;
  token?: string | null;
}) {
  if (!input.token) return false;
  const expected = buildCampaignApprovalToken(input);
  if (input.token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.token));
}
