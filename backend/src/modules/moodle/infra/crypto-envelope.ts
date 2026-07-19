import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { MoodleGatewayFailure } from "../domain/gateway";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export type MoodleEnvelopePurpose = "credentials" | "session" | "material-locator";

export type MoodleEnvelopeContext = {
  studentId: string;
  purpose: MoodleEnvelopePurpose;
};

export type MoodleEnvelopeInfo = {
  version: typeof ENVELOPE_VERSION;
  keyId: string;
  requiresRotation: boolean;
};

export type MoodleDecryptResult<T> = {
  value: T;
  info: MoodleEnvelopeInfo;
  /** Present when the value was read with an inactive key. */
  rotatedEnvelope: string | null;
};

function configurationError(cause?: unknown): MoodleGatewayFailure {
  return new MoodleGatewayFailure("MOODLE_CONFIGURATION_INVALID", { cause });
}

function decodeConfiguredKey(encoded: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw configurationError();
  }

  const key = Buffer.from(encoded, "base64");
  const canonical = key.toString("base64");
  if (key.length !== KEY_BYTES || canonical !== encoded) {
    key.fill(0);
    throw configurationError();
  }
  return key;
}

function validateContext(context: MoodleEnvelopeContext): void {
  if (!context.studentId || context.studentId.length > 160 || /[\u0000-\u001f]/.test(context.studentId)) {
    throw configurationError();
  }
}

function buildAad(context: MoodleEnvelopeContext): Buffer {
  validateContext(context);
  // JSON array keeps field boundaries unambiguous if identifiers contain separators.
  return Buffer.from(JSON.stringify(["uor-connect", "moodle", ENVELOPE_VERSION, context.purpose, context.studentId]));
}

function decodeEnvelopePart(value: string, expectedBytes?: number): Buffer {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new MoodleGatewayFailure("MOODLE_ENVELOPE_INVALID");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    decoded.fill(0);
    throw new MoodleGatewayFailure("MOODLE_ENVELOPE_INVALID");
  }
  return decoded;
}

function splitEnvelope(envelope: string): {
  version: typeof ENVELOPE_VERSION;
  keyId: string;
  ivPart: string;
  tagPart: string;
  ciphertextPart: string;
} {
  const parts = envelope.split(".");
  if (
    parts.length !== 5
    || parts[0] !== ENVELOPE_VERSION
    || !KEY_ID_PATTERN.test(parts[1] ?? "")
  ) {
    throw new MoodleGatewayFailure("MOODLE_ENVELOPE_INVALID");
  }

  return {
    version: ENVELOPE_VERSION,
    keyId: parts[1],
    ivPart: parts[2],
    tagPart: parts[3],
    ciphertextPart: parts[4],
  };
}

export class MoodleCryptoKeyring {
  readonly activeKeyId: string;
  readonly #keys: Map<string, Buffer>;

  constructor(options: { activeKeyId: string; keys: ReadonlyMap<string, Uint8Array> }) {
    if (!KEY_ID_PATTERN.test(options.activeKeyId) || !options.keys.has(options.activeKeyId)) {
      throw configurationError();
    }

    this.activeKeyId = options.activeKeyId;
    this.#keys = new Map();
    for (const [keyId, source] of options.keys) {
      if (!KEY_ID_PATTERN.test(keyId) || source.byteLength !== KEY_BYTES || this.#keys.has(keyId)) {
        this.destroy();
        throw configurationError();
      }
      this.#keys.set(keyId, Buffer.from(source));
    }
  }

  static fromConfig(activeKeyId: string, serializedKeys: string): MoodleCryptoKeyring {
    const parsed = new Map<string, Buffer>();
    try {
      const entries = serializedKeys.split(",").map((entry) => entry.trim()).filter(Boolean);
      if (entries.length === 0) throw configurationError();

      for (const entry of entries) {
        const separator = entry.indexOf(":");
        const keyId = entry.slice(0, separator);
        const encoded = entry.slice(separator + 1);
        if (separator < 1 || !KEY_ID_PATTERN.test(keyId) || parsed.has(keyId)) {
          throw configurationError();
        }
        parsed.set(keyId, decodeConfiguredKey(encoded));
      }

      return new MoodleCryptoKeyring({ activeKeyId, keys: parsed });
    } finally {
      for (const key of parsed.values()) key.fill(0);
    }
  }

  encryptJson(value: unknown, context: MoodleEnvelopeContext): string {
    const key = this.#keys.get(this.activeKeyId);
    if (!key) throw new MoodleGatewayFailure("MOODLE_KEY_UNAVAILABLE");

    let plaintext: Buffer;
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw configurationError();
      plaintext = Buffer.from(serialized, "utf8");
    } catch (error) {
      if (error instanceof MoodleGatewayFailure) throw error;
      throw configurationError(error);
    }

    const iv = randomBytes(IV_BYTES);
    const aad = buildAad(context);
    try {
      const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
      cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      try {
        return [
          ENVELOPE_VERSION,
          this.activeKeyId,
          iv.toString("base64url"),
          tag.toString("base64url"),
          ciphertext.toString("base64url"),
        ].join(".");
      } finally {
        ciphertext.fill(0);
        tag.fill(0);
      }
    } finally {
      plaintext.fill(0);
      aad.fill(0);
      iv.fill(0);
    }
  }

  decryptJson<T>(envelope: string, context: MoodleEnvelopeContext): T {
    return this.decryptJsonWithRotation<T>(envelope, context, false).value;
  }

  decryptJsonWithRotation<T>(
    envelope: string,
    context: MoodleEnvelopeContext,
    rotate = true,
  ): MoodleDecryptResult<T> {
    const parsed = splitEnvelope(envelope);
    const key = this.#keys.get(parsed.keyId);
    if (!key) throw new MoodleGatewayFailure("MOODLE_KEY_UNAVAILABLE");

    const iv = decodeEnvelopePart(parsed.ivPart, IV_BYTES);
    const tag = decodeEnvelopePart(parsed.tagPart, TAG_BYTES);
    const ciphertext = decodeEnvelopePart(parsed.ciphertextPart);
    const aad = buildAad(context);
    let plaintext: Buffer | null = null;

    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(aad);
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      let value: T;
      try {
        value = JSON.parse(plaintext.toString("utf8")) as T;
      } catch (error) {
        throw new MoodleGatewayFailure("MOODLE_ENVELOPE_INVALID", { cause: error });
      }

      const requiresRotation = parsed.keyId !== this.activeKeyId;
      return {
        value,
        info: { version: ENVELOPE_VERSION, keyId: parsed.keyId, requiresRotation },
        rotatedEnvelope: rotate && requiresRotation ? this.encryptJson(value, context) : null,
      };
    } catch (error) {
      if (error instanceof MoodleGatewayFailure) throw error;
      throw new MoodleGatewayFailure("MOODLE_ENVELOPE_INVALID", { cause: error });
    } finally {
      plaintext?.fill(0);
      ciphertext.fill(0);
      tag.fill(0);
      iv.fill(0);
      aad.fill(0);
    }
  }

  inspect(envelope: string): MoodleEnvelopeInfo {
    const parsed = splitEnvelope(envelope);
    if (!this.#keys.has(parsed.keyId)) throw new MoodleGatewayFailure("MOODLE_KEY_UNAVAILABLE");
    return {
      version: ENVELOPE_VERSION,
      keyId: parsed.keyId,
      requiresRotation: parsed.keyId !== this.activeKeyId,
    };
  }

  destroy(): void {
    for (const key of this.#keys?.values() ?? []) key.fill(0);
    this.#keys?.clear();
  }
}
