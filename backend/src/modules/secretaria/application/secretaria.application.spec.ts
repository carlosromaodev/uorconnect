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
    getDataset: vi.fn(),
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
      confirmationTtlSeconds: 300,
      commandLeaseSeconds: 300,
    });

    expect(app.capabilities().find((capability) => capability.key === "paymentReference")).toMatchObject({ status: "disabled" });
    await expect(app.preparePaymentReference({ id: 1, studentNumber: "20240001" }, [`scr_${"a".repeat(43)}`], "idempotency-test"))
      .rejects.toMatchObject({ code: "SECRETARIA_CAPABILITY_DISABLED" });
    app.stop();
  });
});
