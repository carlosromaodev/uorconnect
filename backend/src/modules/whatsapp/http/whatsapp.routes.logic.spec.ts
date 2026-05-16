import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractProviderMessage,
  isConnectedWhatsAppInstanceStatus,
  pickPreferredWhatsAppInstance,
  renderWhatsAppAutomationTemplate,
} from "./whatsapp.routes";
import { communicationAudienceSchema } from "../../communication/audience";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function sliceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("whatsapp.routes instance selection", () => {
  it("prefers a connected instance over a closed default instance", () => {
    const selected = pickPreferredWhatsAppInstance([
      { isDefault: true, status: "CLOSE", name: "default-closed" },
      { isDefault: false, status: "OPEN", name: "fallback-open" },
    ]);

    expect(selected?.name).toBe("fallback-open");
  });

  it("keeps the default instance when no connected instance exists", () => {
    const selected = pickPreferredWhatsAppInstance([
      { isDefault: true, status: "PAIRING", name: "default-pairing" },
      { isDefault: false, status: "ERROR", name: "fallback-error" },
    ]);

    expect(selected?.name).toBe("default-pairing");
  });

  it("recognizes connected statuses case-insensitively", () => {
    expect(isConnectedWhatsAppInstanceStatus("open")).toBe(true);
    expect(isConnectedWhatsAppInstanceStatus("CONNECTED")).toBe(true);
    expect(isConnectedWhatsAppInstanceStatus("pairing")).toBe(false);
  });

  it("prefers the nested provider response message when Evolution wraps the real error", () => {
    expect(extractProviderMessage({
      status: 500,
      error: "Internal Server Error",
      response: {
        message: "Connection Closed",
      },
    })).toBe("Connection Closed");
  });

  it("renders automation templates and drops empty placeholder lines", () => {
    expect(renderWhatsAppAutomationTemplate([
      "Olá {{nome}}",
      "{{detalhe}}",
      "{{link}}",
    ].join("\n"), {
      nome: "Carlos",
      detalhe: "",
      link: "https://uorconnect.test/recibo",
    })).toBe([
      "Olá Carlos",
      "https://uorconnect.test/recibo",
    ].join("\n"));
  });

  it("accepts group representatives as a direct WhatsApp audience", () => {
    const parsed = communicationAudienceSchema.safeParse({
      type: "GROUP_REPRESENTATIVES",
      submissionStatuses: ["APPROVED"],
    });

    expect(parsed.success).toBe(true);
  });

  it("does not force marketing or profile consent gates on manual admin campaigns", () => {
    const source = readSource("src/modules/whatsapp/http/whatsapp.routes.ts");
    const previewRoute = sliceBetween(source, 'adminApp.post("/admin/preview"', 'adminApp.post("/admin/send"');
    const sendRoute = sliceBetween(source, 'adminApp.post("/admin/send"', "request.log.info({");

    expect(previewRoute).toContain("applyCookieAudienceFilters(rawCandidates, body.audience)");
    expect(previewRoute).not.toContain("cookieMarketingOptIn: true");
    expect(previewRoute).not.toContain("applyProfileCommunicationConsent");
    expect(sendRoute).toContain("applyCookieAudienceFilters(rawCandidates, body.audience)");
    expect(sendRoute).not.toContain("cookieMarketingOptIn: true");
    expect(sendRoute).not.toContain("applyProfileCommunicationConsent");
    expect(source).toContain('consent: body.audience.cookieMarketingOptIn ? "marketing_opt_in" : "admin_operational_no_consent_gate"');
  });
});
