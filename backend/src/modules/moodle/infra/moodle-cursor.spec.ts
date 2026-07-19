import { afterEach, describe, expect, it } from "vitest";
import { MoodleCursorCodec } from "./moodle-cursor";

const key = Buffer.alloc(32, 7).toString("base64");
const created: MoodleCursorCodec[] = [];
const coursesAudience = { studentId: 7, collection: "courses" as const, courseId: null };

function codec(clock = () => new Date("2026-07-19T12:00:00.000Z")) {
  const value = new MoodleCursorCodec({ activeKeyId: "v1", serializedKeys: `v1:${key}`, clock });
  created.push(value);
  return value;
}

afterEach(() => {
  for (const item of created.splice(0)) item.destroy();
});

describe("MoodleCursorCodec", () => {
  it("round-trips a snapshot-bound cursor", () => {
    const value = codec();
    const token = value.encode({
      snapshotVersion: 4,
      normalizedText: "algoritmos",
      publicId: "550e8400-e29b-41d4-a716-446655440000",
      audience: coursesAudience,
    });
    expect(value.decode(token, coursesAudience)).toMatchObject({
      snapshotVersion: 4,
      normalizedText: "algoritmos",
      publicId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("rejects tampering", () => {
    const value = codec();
    const token = value.encode({
      snapshotVersion: 1,
      normalizedText: "curso",
      publicId: "550e8400-e29b-41d4-a716-446655440000",
      audience: coursesAudience,
    });
    expect(() => value.decode(`${token.slice(0, -1)}A`, coursesAudience)).toThrow(/cursor/i);
  });

  it("rejects an expired cursor as a snapshot conflict", () => {
    let now = new Date("2026-07-19T12:00:00.000Z");
    const value = codec(() => now);
    const token = value.encode({
      snapshotVersion: 1,
      normalizedText: "curso",
      publicId: "550e8400-e29b-41d4-a716-446655440000",
      audience: coursesAudience,
    }, 1_000);
    now = new Date("2026-07-19T12:00:02.000Z");
    try {
      value.decode(token, coursesAudience);
      throw new Error("expected cursor expiration");
    } catch (error) {
      expect(error).toMatchObject({ code: "MOODLE_SNAPSHOT_CHANGED", statusCode: 409 });
    }
  });

  it("não reutiliza cursor de courses em materials nem noutro estudante", () => {
    const value = codec();
    const token = value.encode({
      snapshotVersion: 4,
      normalizedText: "algoritmos",
      publicId: "550e8400-e29b-41d4-a716-446655440000",
      audience: coursesAudience,
    });
    expect(() => value.decode(token, {
      studentId: 7,
      collection: "materials",
      courseId: null,
    })).toThrow(/cursor/i);
    expect(() => value.decode(token, {
      studentId: 8,
      collection: "courses",
      courseId: null,
    })).toThrow(/cursor/i);
  });

  it("prende cursor de sections ao courseId", () => {
    const value = codec();
    const audience = {
      studentId: 7,
      collection: "sections" as const,
      courseId: "550e8400-e29b-41d4-a716-446655440000",
    };
    const token = value.encode({
      snapshotVersion: 4,
      normalizedText: "1",
      publicId: "550e8400-e29b-41d4-a716-446655440001",
      audience,
    });
    expect(() => value.decode(token, {
      ...audience,
      courseId: "550e8400-e29b-41d4-a716-446655440099",
    })).toThrow(/cursor/i);
  });
});
