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

  it("isola payloads de comando das credenciais e da sessão", () => {
    const crypto = keyring();
    const commandContext = { studentId: 1, institutionCode: "UOR", generation: 4, purpose: "command" as const };
    const envelope = crypto.encryptJson({ chargeRefs: ["scr_opaque"] }, commandContext);

    expect(envelope).not.toContain("scr_opaque");
    expect(crypto.decryptJson(envelope, commandContext)).toEqual({ chargeRefs: ["scr_opaque"] });
    expect(() => crypto.decryptJson(envelope, { ...commandContext, purpose: "session" })).toThrow(/dados protegidos/i);
    expect(() => crypto.decryptJson(envelope, { ...commandContext, purpose: "command_result" })).toThrow(/dados protegidos/i);
    const references = crypto.opaqueReferenceCandidates(["internal-id", "finance-id", "input-id"]);
    expect(references).toHaveLength(1);
    expect(references[0]).toMatch(/^scr_[A-Za-z0-9_-]{43}$/);
    expect(references[0]).not.toContain("internal-id");
    expect(crypto.opaqueReferenceCandidates(["internal-id", "finance-id", "input-id"])).toEqual(references);
    crypto.destroy();
  });
});
