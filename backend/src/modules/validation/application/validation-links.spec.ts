import { describe, expect, it } from "vitest";
import type { Env } from "../../../config/env";
import { buildValidationQrUrl, buildValidationUrl, extractValidationToken } from "./validation-links";

describe("validation-links", () => {
  it("builds public validation links from configured app and api URLs", () => {
    const env = {
      PUBLIC_APP_URL: "https://portal.uor.test/",
      PUBLIC_API_URL: "https://api.uor.test/",
    } as Env;

    expect(buildValidationUrl(env, "cert_123")).toBe("https://portal.uor.test/validar/cert_123");
    expect(buildValidationQrUrl(env, "cert_123")).toBe("https://api.uor.test/validation/cert_123/qr.svg");
  });

  it("uses the frontend api proxy as the QR fallback", () => {
    const env = {} as Env;

    expect(buildValidationQrUrl(env, "att_123")).toBe("/api/validation/att_123/qr.svg");
  });

  it("extracts tokens from raw values and validation URLs", () => {
    expect(extractValidationToken("att_123")).toBe("att_123");
    expect(extractValidationToken("https://uorconnect.space/validar/cert_abc")).toBe("cert_abc");
    expect(extractValidationToken("https://uorconnect.space/#/validar/cert_xyz")).toBe("cert_xyz");
  });
});
