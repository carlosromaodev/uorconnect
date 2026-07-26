import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../../../shared/prisma";
import type { UorStudentOfficialDataRepository } from "../application/ports";
import { UorStudentError } from "../domain/errors";

type Database = typeof prisma;

type CursorPayload = { version: 1; domain: string; snapshotVersion: number; offset: number };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export class PrismaUorStudentOfficialDataRepository implements UorStudentOfficialDataRepository {
  readonly #key: Buffer;

  constructor(secret: string, private readonly db: Database = prisma) {
    this.#key = createHash("sha256").update(`uor-student-cursor:${secret}`).digest();
  }

  async getDataset(input: Parameters<UorStudentOfficialDataRepository["getDataset"]>[0]) {
    const connection = await this.db.secretariaConnection.findFirst({
      where: {
        studentId: input.student.id,
        student: {
          institutionCode: input.student.institutionCode,
          studentNumber: input.student.studentNumber,
          deletedAt: null,
        },
      },
      select: { activeSnapshotVersion: true },
    });
    if (connection?.activeSnapshotVersion === null || connection?.activeSnapshotVersion === undefined) {
      return this.#empty(input.domain, input.limit);
    }
    const snapshot = await this.db.secretariaSnapshot.findFirst({
      where: {
        studentId: input.student.id,
        snapshotVersion: connection.activeSnapshotVersion,
        domain: input.domain,
      },
    });
    if (!snapshot) return this.#empty(input.domain, input.limit);
    const dataset = this.#parseDataset(snapshot.payloadJson, input.domain);
    const offset = input.cursor
      ? this.#decodeCursor(input.cursor, input.domain, snapshot.snapshotVersion)
      : 0;
    if (offset > dataset.items.length) {
      throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400);
    }
    const selected = dataset.items.slice(offset, offset + input.limit);
    const nextOffset = offset + selected.length;
    const hasMore = nextOffset < dataset.items.length;
    const stale = snapshot.coverage === "stale" || dataset.coverage === "stale";
    return {
      domain: input.domain,
      items: selected.map((attributes, index) => ({
        id: this.#itemId(input.student.id, input.domain, snapshot.snapshotVersion, offset + index, attributes),
        attributes,
      })),
      pagination: {
        limit: input.limit,
        hasMore,
        nextCursor: hasMore ? this.#encodeCursor({ version: 1, domain: input.domain, snapshotVersion: snapshot.snapshotVersion, offset: nextOffset }) : null,
        total: dataset.total,
      },
      provenance: {
        source: "secretaria_uor" as const,
        observedAt: snapshot.observedAt.toISOString(),
        coverage: stale ? "stale" as const : dataset.coverage === "live" || dataset.coverage === "fresh" ? "exact" as const : "partial" as const,
        stale,
      },
      snapshotVersion: snapshot.snapshotVersion,
    };
  }

  #parseDataset(value: string, expectedDomain: string) {
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw new UorStudentError("UOR_STUDENT_SNAPSHOT_INVALID", "O snapshot institucional guardado é inválido.", 500); }
    if (!parsed || typeof parsed !== "object") {
      throw new UorStudentError("UOR_STUDENT_SNAPSHOT_INVALID", "O snapshot institucional guardado é inválido.", 500);
    }
    const record = parsed as Record<string, unknown>;
    if (record.domain !== expectedDomain || !Array.isArray(record.items) || !record.items.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      throw new UorStudentError("UOR_STUDENT_SNAPSHOT_INVALID", "O snapshot institucional não corresponde ao contrato esperado.", 500);
    }
    return {
      items: record.items as Array<Record<string, unknown>>,
      total: typeof record.total === "number" && Number.isInteger(record.total) && record.total >= record.items.length
        ? record.total
        : record.items.length,
      coverage: typeof record.coverage === "string" ? record.coverage : "changed",
    };
  }

  #empty(domain: string, limit: number) {
    return {
      domain,
      items: [],
      pagination: { limit, hasMore: false, nextCursor: null, total: null },
      provenance: { source: "secretaria_uor" as const, observedAt: null, coverage: "not_synced" as const, stale: false },
      snapshotVersion: null,
    };
  }

  #itemId(studentId: number, domain: string, version: number, index: number, attributes: Record<string, unknown>) {
    return `usi_${createHmac("sha256", this.#key)
      .update(`${studentId}:${domain}:${version}:${index}:${stableJson(attributes)}`)
      .digest("base64url")}`;
  }

  #encodeCursor(payload: CursorPayload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.#key).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
  }

  #decodeCursor(cursor: string, domain: string, snapshotVersion: number) {
    const [encoded, signature, extra] = cursor.split(".");
    if (!encoded || !signature || extra) throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400);
    const expected = createHmac("sha256", this.#key).update(encoded).digest();
    let received: Buffer;
    try { received = Buffer.from(signature, "base64url"); }
    catch { throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400); }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400);
    }
    let payload: CursorPayload;
    try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CursorPayload; }
    catch { throw new UorStudentError("UOR_STUDENT_CURSOR_INVALID", "O cursor de paginação é inválido.", 400); }
    if (payload.version !== 1 || payload.domain !== domain || payload.snapshotVersion !== snapshotVersion || !Number.isInteger(payload.offset) || payload.offset < 0) {
      throw new UorStudentError("UOR_STUDENT_SNAPSHOT_CHANGED", "Os dados mudaram durante a paginação; reinicia a consulta.", 409, true);
    }
    return payload.offset;
  }
}
