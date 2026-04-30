import { describe, expect, it } from "vitest";
import {
  extractProviderMessage,
  isConnectedWhatsAppInstanceStatus,
  pickPreferredWhatsAppInstance,
  renderWhatsAppAutomationTemplate,
} from "./whatsapp.routes";

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
});
