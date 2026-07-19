import { describe, expect, it, vi } from "vitest";
import type { MoodleRepository, PersistedMoodleConnection } from "../domain/repository";
import { DisabledMoodleApplication } from "./disabled-moodle.application";

describe("DisabledMoodleApplication", () => {
  it("mantém DELETE idempotente e purga segredos mesmo com a feature desligada", async () => {
    const tombstone = {
      studentId: 1,
      status: "DISCONNECTED",
      credentialsEnvelope: null,
      sessionEnvelope: null,
      lastAuthenticatedAt: null,
      lastSuccessfulSyncAt: null,
    } as PersistedMoodleConnection;
    const disconnectAndPurge = vi.fn().mockResolvedValue(tombstone);
    const app = new DisabledMoodleApplication({ disconnectAndPurge } as unknown as MoodleRepository);

    const result = await app.disconnect({ id: 1, studentNumber: "20260001" });

    expect(disconnectAndPurge).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({
      status: "DISCONNECTED",
      connected: false,
      credentialsStored: false,
      actionRequired: "connect",
    });
  });
});
