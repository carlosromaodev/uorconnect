import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MoodleGatewayFailure } from "../domain/gateway";
import { MoodleCryptoKeyring } from "./crypto-envelope";

const context = { studentId: "student-a", purpose: "credentials" as const };

function keyring(activeKeyId = "new", includeOld = true) {
  const keys = new Map<string, Uint8Array>([["new", randomBytes(32)]]);
  if (includeOld) keys.set("old", randomBytes(32));
  return new MoodleCryptoKeyring({ activeKeyId, keys });
}

describe("MoodleCryptoKeyring", () => {
  it("encrypts and decrypts an authenticated JSON envelope", () => {
    const crypto = keyring();
    const envelope = crypto.encryptJson({ username: "anonymous", password: "test-only" }, context);

    expect(envelope).toMatch(/^v1\.new\./);
    expect(envelope).not.toContain("anonymous");
    expect(crypto.decryptJson(envelope, context)).toEqual({
      username: "anonymous",
      password: "test-only",
    });
  });

  it.each(["ciphertext", "tag", "student AAD", "purpose AAD"])(
    "rejects tampered %s without leaking plaintext",
    (target) => {
      const crypto = keyring();
      const envelope = crypto.encryptJson({ password: "never-in-an-error" }, context);
      const parts = envelope.split(".");
      let altered = envelope;
      let alteredContext: { studentId: string; purpose: "credentials" | "session" } = context;

      if (target === "ciphertext") {
        parts[4] = `${parts[4][0] === "A" ? "B" : "A"}${parts[4].slice(1)}`;
        altered = parts.join(".");
      } else if (target === "tag") {
        parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
        altered = parts.join(".");
      } else if (target === "student AAD") {
        alteredContext = { ...context, studentId: "student-b" };
      } else {
        alteredContext = { ...context, purpose: "session" };
      }

      try {
        crypto.decryptJson(altered, alteredContext);
        throw new Error("expected decryption to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(MoodleGatewayFailure);
        expect((error as MoodleGatewayFailure).code).toBe("MOODLE_ENVELOPE_INVALID");
        expect((error as Error).message).not.toContain("never-in-an-error");
      }
    },
  );

  it("reads an old key and produces a replacement under the active key", () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const old = new MoodleCryptoKeyring({ activeKeyId: "old", keys: new Map([["old", oldKey]]) });
    const envelope = old.encryptJson({ cookies: [] }, { studentId: "s-1", purpose: "session" });
    const rotating = new MoodleCryptoKeyring({
      activeKeyId: "new",
      keys: new Map([["old", oldKey], ["new", newKey]]),
    });

    const result = rotating.decryptJsonWithRotation<{ cookies: unknown[] }>(
      envelope,
      { studentId: "s-1", purpose: "session" },
    );

    expect(result.info).toEqual({ version: "v1", keyId: "old", requiresRotation: true });
    expect(result.rotatedEnvelope).toMatch(/^v1\.new\./);
    expect(rotating.decryptJson(result.rotatedEnvelope!, { studentId: "s-1", purpose: "session" }))
      .toEqual({ cookies: [] });
  });

  it("binds material locators to their own purpose and student", () => {
    const crypto = keyring();
    const locator = { kind: "course-module", courseModuleKey: "900" };
    const envelope = crypto.encryptJson(locator, {
      studentId: "student-a",
      purpose: "material-locator",
    });

    expect(crypto.decryptJson(envelope, {
      studentId: "student-a",
      purpose: "material-locator",
    })).toEqual(locator);
    expect(() => crypto.decryptJson(envelope, {
      studentId: "student-a",
      purpose: "session",
    })).toThrowError(expect.objectContaining({ code: "MOODLE_ENVELOPE_INVALID" }));
    expect(() => crypto.decryptJson(envelope, {
      studentId: "student-b",
      purpose: "material-locator",
    })).toThrowError(expect.objectContaining({ code: "MOODLE_ENVELOPE_INVALID" }));
  });

  it("parses a strict base64 keyring configuration", () => {
    const first = randomBytes(32).toString("base64");
    const second = randomBytes(32).toString("base64");
    const crypto = MoodleCryptoKeyring.fromConfig("k2", `k1:${first},k2:${second}`);

    expect(crypto.inspect(crypto.encryptJson({ ok: true }, context))).toEqual({
      version: "v1",
      keyId: "k2",
      requiresRotation: false,
    });
    expect(() => MoodleCryptoKeyring.fromConfig("missing", `k1:${first}`)).toThrowError(
      expect.objectContaining({ code: "MOODLE_CONFIGURATION_INVALID" }),
    );
  });
});
