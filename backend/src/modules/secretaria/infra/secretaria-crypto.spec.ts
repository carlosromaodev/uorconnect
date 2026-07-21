import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecretariaCryptoKeyring } from "./secretaria-crypto";

function keyring() {
  return SecretariaCryptoKeyring.fromConfig("v1", `v1:${randomBytes(32).toString("base64")}`);
}

describe("SecretariaCryptoKeyring", () => {
  it("cifra e descifra credenciais apenas no contexto correto", () => {
    const crypto = keyring();
    const context = { studentId: 17, institutionCode: "UOR", generation: 3, purpose: "credentials" as const };
    const envelope = crypto.encryptJson({ username: "student", password: "test-only" }, context);

    expect(envelope).not.toContain("student");
    expect(envelope).not.toContain("test-only");
    expect(crypto.decryptJson(envelope, context)).toEqual({ username: "student", password: "test-only" });
    expect(() => crypto.decryptJson(envelope, { ...context, studentId: 18 })).toThrow(/dados protegidos/i);
    crypto.destroy();
  });

  it("rejeita adulteração do ciphertext", () => {
    const crypto = keyring();
    const context = { studentId: 1, institutionCode: "UOR", generation: 1, purpose: "session" as const };
    const envelope = crypto.encryptJson({ cookies: { session: "opaque" } }, context);
    const parts = envelope.split(".");
    parts[4] = `${parts[4].startsWith("A") ? "B" : "A"}${parts[4].slice(1)}`;
    const changed = parts.join(".");

    expect(() => crypto.decryptJson(changed, context)).toThrow(/dados protegidos/i);
    crypto.destroy();
  });
});
