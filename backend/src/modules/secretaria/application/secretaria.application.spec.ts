import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SecretariaGateway } from "../domain/gateway";
import { SecretariaCryptoKeyring } from "../infra/secretaria-crypto";
import { LiveSecretariaApplication } from "./secretaria.application";

function keyring() {
  return SecretariaCryptoKeyring.fromConfig("v1", `v1:${randomBytes(32).toString("base64")}`);
}

function gateway(): SecretariaGateway {
  return {
    authenticate: vi.fn(),
    validateSession: vi.fn(),
    getProfile: vi.fn(),
    getContactDetails: vi.fn(),
    getPhoto: vi.fn(),
    getConsents: vi.fn(),
    getDataset: vi.fn(),
    prepareContactDetails: vi.fn(),
    updateContactDetails: vi.fn(),
    preparePhoto: vi.fn(),
    updatePhoto: vi.fn(),
    preparePaymentReference: vi.fn(),
    generatePaymentReference: vi.fn(),
    verifyPaymentReference: vi.fn(),
    logout: vi.fn(),
  };
}

describe("LiveSecretariaApplication command controls", () => {
  it("falha fechada quando a escrita de referência está desativada", async () => {
    const crypto = keyring();
    const app = new LiveSecretariaApplication(gateway(), crypto, {
      paymentReferenceEnabled: false,
      contactDetailsEnabled: false,
      photoEnabled: false,
      confirmationTtlSeconds: 300,
      commandLeaseSeconds: 300,
    });

    expect(app.capabilities().find((capability) => capability.key === "paymentReference")).toMatchObject({ status: "disabled" });
    expect(app.capabilities().find((capability) => capability.key === "contactDetails" && capability.mode === "write")).toMatchObject({ status: "disabled" });
    expect(app.capabilities().find((capability) => capability.key === "photo" && capability.mode === "write")).toMatchObject({ status: "disabled" });
    await expect(app.preparePaymentReference({ id: 1, studentNumber: "20240001" }, [`scr_${"a".repeat(43)}`], "idempotency-test"))
      .rejects.toMatchObject({ code: "SECRETARIA_CAPABILITY_DISABLED" });
    await expect(app.prepareContactDetails({ id: 1, studentNumber: "20240001" }, { mobile: "+244 900 000 000" }, "contact-details-test"))
      .rejects.toMatchObject({ code: "SECRETARIA_CAPABILITY_DISABLED" });
    await expect(app.preparePhoto(
      { id: 1, studentNumber: "20240001" },
      { body: Buffer.from([0xff, 0xd8, 0xff]), sha256: "invalid", width: 64, height: 64 },
      "photo-test",
    )).rejects.toMatchObject({ code: "SECRETARIA_CAPABILITY_DISABLED" });
    app.stop();
  });
});
