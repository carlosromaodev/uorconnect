import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { SecretariaError } from "../domain/errors";

const VERSION = "v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;

export type SecretariaEnvelopePurpose = "credentials" | "session" | "command" | "command_result";
export type SecretariaEnvelopeContext = {
  studentId: number;
  institutionCode: string;
  generation: number;
  purpose: SecretariaEnvelopePurpose;
};

function configurationError(cause?: unknown) {
  return new SecretariaError(
    "SECRETARIA_CONFIGURATION_INVALID",
    "A proteção da integração Secretaria não está configurada corretamente.",
    503,
    false,
    "contact_support",
    { cause },
  );
}

function aad(context: SecretariaEnvelopeContext) {
  return Buffer.from(JSON.stringify([
    "uor-estudante",
    "secretaria",
    VERSION,
    context.purpose,
    context.institutionCode,
    context.studentId,
    context.generation,
  ]));
}

export class SecretariaCryptoKeyring {
  readonly #keys = new Map<string, Buffer>();

  private constructor(readonly activeKeyId: string, keys: Map<string, Buffer>) {
    for (const [keyId, key] of keys) this.#keys.set(keyId, Buffer.from(key));
  }

  static fromConfig(activeKeyId: string, serialized: string) {
    if (!KEY_ID.test(activeKeyId)) throw configurationError();
    const keys = new Map<string, Buffer>();
    try {
      for (const entry of serialized.split(",").map((value) => value.trim()).filter(Boolean)) {
        const separator = entry.indexOf(":");
        const keyId = entry.slice(0, separator);
        const encoded = entry.slice(separator + 1);
        if (separator < 1 || !KEY_ID.test(keyId) || keys.has(keyId)) throw configurationError();
        const key = Buffer.from(encoded, "base64");
        if (key.length !== KEY_BYTES || key.toString("base64") !== encoded) {
          key.fill(0);
          throw configurationError();
        }
        keys.set(keyId, key);
      }
      if (!keys.has(activeKeyId)) throw configurationError();
      return new SecretariaCryptoKeyring(activeKeyId, keys);
    } finally {
      for (const key of keys.values()) key.fill(0);
    }
  }

  encryptJson(value: unknown, context: SecretariaEnvelopeContext): string {
    const key = this.#keys.get(this.activeKeyId);
    if (!key) throw configurationError();
    const plaintext = Buffer.from(JSON.stringify(value));
    const iv = randomBytes(IV_BYTES);
    const associated = aad(context);
    try {
      const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
      cipher.setAAD(associated);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      try {
        return [VERSION, this.activeKeyId, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
      } finally {
        ciphertext.fill(0);
        tag.fill(0);
      }
    } finally {
      plaintext.fill(0);
      iv.fill(0);
      associated.fill(0);
    }
  }

  decryptJson<T>(envelope: string, context: SecretariaEnvelopeContext): T {
    const parts = envelope.split(".");
    if (parts.length !== 5 || parts[0] !== VERSION || !KEY_ID.test(parts[1] ?? "")) {
      throw new SecretariaError("SECRETARIA_ENVELOPE_INVALID", "Não foi possível ler os dados protegidos da Secretaria.", 503, false, "contact_support");
    }
    const key = this.#keys.get(parts[1]);
    if (!key) throw new SecretariaError("SECRETARIA_KEY_UNAVAILABLE", "A chave da integração Secretaria não está disponível.", 503, false, "contact_support");
    const iv = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    const ciphertext = Buffer.from(parts[4], "base64url");
    const associated = aad(context);
    let plaintext: Buffer | null = null;
    try {
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) throw new Error("invalid envelope");
      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(associated);
      decipher.setAuthTag(tag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(plaintext.toString("utf8")) as T;
    } catch (error) {
      throw new SecretariaError("SECRETARIA_ENVELOPE_INVALID", "Não foi possível ler os dados protegidos da Secretaria.", 503, false, "contact_support", { cause: error });
    } finally {
      plaintext?.fill(0);
      iv.fill(0);
      tag.fill(0);
      ciphertext.fill(0);
      associated.fill(0);
    }
  }

  opaqueReferenceCandidates(value: unknown, options: { purpose?: string; prefix?: string } = {}): string[] {
    const purpose = options.purpose ?? "payment-charge-ref";
    const prefix = options.prefix ?? "scr";
    if (!/^[a-z]{3}$/.test(prefix) || !/^[a-z0-9-]{3,64}$/.test(purpose)) throw configurationError();
    const payload = Buffer.from(JSON.stringify(["uor-estudante", "secretaria", VERSION, purpose, value]));
    try {
      const ordered = [this.activeKeyId, ...[...this.#keys.keys()].filter((keyId) => keyId !== this.activeKeyId)];
      return ordered.map((keyId) => {
        const key = this.#keys.get(keyId);
        if (!key) throw configurationError();
        return `${prefix}_${createHmac("sha256", key).update(payload).digest("base64url")}`;
      });
    } finally {
      payload.fill(0);
    }
  }

  destroy() {
    for (const key of this.#keys.values()) key.fill(0);
    this.#keys.clear();
  }
}
