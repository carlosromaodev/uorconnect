import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { MoodleError } from "../domain/errors";

type CursorPayload = {
  v: 1;
  snapshotVersion: number;
  normalizedText: string;
  publicId: string;
  audienceHash: string;
  expiresAt: number;
};

export type MoodleCursorAudience = {
  studentId: number;
  collection: "courses" | "sections" | "materials";
  courseId: string | null;
};

type MoodleCursorEncodeInput = Omit<CursorPayload, "v" | "expiresAt" | "audienceHash"> & {
  audience: MoodleCursorAudience;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const keyIdPattern = /^[A-Za-z0-9_-]{1,32}$/;

function decodeKey(encoded: string): Buffer {
  const value = Buffer.from(encoded, "base64");
  if (value.length !== 32 || value.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    value.fill(0);
    throw new MoodleError("MOODLE_MISCONFIGURED", "A integração Moodle não está configurada corretamente.", 503, false, "contact_support");
  }
  return value;
}

function derivedKey(source: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", source, Buffer.alloc(0), "uor-connect:moodle:cursor:v1", 32));
}

function invalidCursor(): MoodleError {
  return new MoodleError("MOODLE_CURSOR_INVALID", "O cursor informado é inválido.", 400);
}

function validateAudience(audience: MoodleCursorAudience): void {
  if (
    !Number.isSafeInteger(audience.studentId)
    || audience.studentId <= 0
    || !["courses", "sections", "materials"].includes(audience.collection)
    || (audience.courseId !== null && !uuidPattern.test(audience.courseId))
    || (audience.collection === "courses" && audience.courseId !== null)
    || (audience.collection === "sections" && audience.courseId === null)
  ) throw invalidCursor();
}

function audienceHash(key: Buffer, audience: MoodleCursorAudience): string {
  validateAudience(audience);
  return createHmac("sha256", key)
    .update("uor-connect:moodle:cursor-audience:v1\0")
    .update(JSON.stringify([audience.studentId, audience.collection, audience.courseId]))
    .digest("base64url");
}

export class MoodleCursorCodec {
  readonly #activeKeyId: string;
  readonly #keys = new Map<string, Buffer>();
  readonly #clock: () => Date;

  constructor(input: {
    activeKeyId: string;
    serializedKeys: string;
    clock?: () => Date;
  }) {
    this.#activeKeyId = input.activeKeyId;
    this.#clock = input.clock ?? (() => new Date());
    if (!keyIdPattern.test(input.activeKeyId)) throw invalidCursor();

    for (const entry of input.serializedKeys.split(",").map((item) => item.trim()).filter(Boolean)) {
      const separator = entry.indexOf(":");
      if (separator <= 0) throw invalidCursor();
      const keyId = entry.slice(0, separator);
      if (!keyIdPattern.test(keyId) || this.#keys.has(keyId)) throw invalidCursor();
      const source = decodeKey(entry.slice(separator + 1));
      try {
        this.#keys.set(keyId, derivedKey(source));
      } finally {
        source.fill(0);
      }
    }

    if (!this.#keys.has(this.#activeKeyId)) {
      this.destroy();
      throw new MoodleError("MOODLE_MISCONFIGURED", "A integração Moodle não está configurada corretamente.", 503, false, "contact_support");
    }
  }

  encode(input: MoodleCursorEncodeInput, ttlMs = 15 * 60_000): string {
    if (!Number.isInteger(input.snapshotVersion) || input.snapshotVersion < 0 || !uuidPattern.test(input.publicId)) {
      throw invalidCursor();
    }
    const key = this.#keys.get(this.#activeKeyId)!;
    const payload: CursorPayload = {
      v: 1,
      snapshotVersion: input.snapshotVersion,
      normalizedText: input.normalizedText.slice(0, 1_000),
      publicId: input.publicId,
      audienceHash: audienceHash(key, input.audience),
      expiresAt: this.#clock().getTime() + ttlMs,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", key).update(`${this.#activeKeyId}.${encoded}`).digest("base64url");
    return `${this.#activeKeyId}.${encoded}.${signature}`;
  }

  decode(token: string, audience: MoodleCursorAudience): CursorPayload {
    const [keyId, encoded, signature, ...extra] = token.split(".");
    if (extra.length > 0 || !keyId || !encoded || !signature || !keyIdPattern.test(keyId)) throw invalidCursor();
    const key = this.#keys.get(keyId);
    if (!key) throw invalidCursor();

    const expected = createHmac("sha256", key).update(`${keyId}.${encoded}`).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, "base64url");
    } catch {
      throw invalidCursor();
    }
    try {
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalidCursor();
    } finally {
      expected.fill(0);
      actual.fill(0);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw invalidCursor();
    }
    if (!parsed || typeof parsed !== "object") throw invalidCursor();
    const value = parsed as Partial<CursorPayload>;
    if (
      value.v !== 1
      || !Number.isInteger(value.snapshotVersion)
      || Number(value.snapshotVersion) < 0
      || typeof value.normalizedText !== "string"
      || value.normalizedText.length > 1_000
      || typeof value.publicId !== "string"
      || !uuidPattern.test(value.publicId)
      || typeof value.audienceHash !== "string"
      || !/^[A-Za-z0-9_-]{43}$/.test(value.audienceHash)
      || !Number.isFinite(value.expiresAt)
    ) throw invalidCursor();
    const expectedAudience = Buffer.from(audienceHash(key, audience), "base64url");
    const actualAudience = Buffer.from(value.audienceHash, "base64url");
    try {
      if (
        expectedAudience.length !== actualAudience.length
        || !timingSafeEqual(expectedAudience, actualAudience)
      ) throw invalidCursor();
    } finally {
      expectedAudience.fill(0);
      actualAudience.fill(0);
    }
    if (Number(value.expiresAt) <= this.#clock().getTime()) {
      throw new MoodleError("MOODLE_SNAPSHOT_CHANGED", "A página expirou; atualiza a lista.", 409, true);
    }
    return value as CursorPayload;
  }

  destroy(): void {
    for (const key of this.#keys.values()) key.fill(0);
    this.#keys.clear();
  }
}
