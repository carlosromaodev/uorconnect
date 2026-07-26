import { describe, expect, it } from "vitest";
import type { PersistedMoodleConnection } from "../domain/repository";
import { connectionView } from "./moodle-presenters";

function connection(overrides: Partial<PersistedMoodleConnection> = {}): PersistedMoodleConnection {
  const now = new Date("2026-07-22T10:00:00.000Z");
  return {
    studentId: 7,
    status: "DEGRADED",
    moodleUserId: null,
    profilePublicId: "2fe7502c-adbb-4cad-8ef8-c2701fb6471a",
    moodleStudentNumber: null,
    displayName: null,
    email: null,
    timezone: null,
    profileSyncedAt: null,
    credentialsEnvelope: "encrypted-credentials",
    sessionEnvelope: null,
    connectionGeneration: 1,
    sessionVersion: 0,
    activeSnapshotVersion: null,
    activeSyncRunId: null,
    connectionAttemptId: null,
    connectionAttemptLeaseUntil: null,
    sessionExpiresAt: null,
    reauthLeaseOwner: null,
    reauthLeaseUntil: null,
    failedReauthCount: 0,
    nextReauthAt: null,
    lastAuthenticatedAt: null,
    lastSuccessfulSyncAt: null,
    lastUsedAt: null,
    lastErrorCode: "MOODLE_UNAVAILABLE",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("connectionView", () => {
  it("não anuncia ligação ativa quando a primeira autenticação falhou sem sessão", () => {
    expect(connectionView(connection())).toMatchObject({
      status: "DEGRADED",
      connected: false,
      credentialsStored: true,
      retryable: true,
    });
  });

  it("mantém uma sessão anterior utilizável durante degradação transitória", () => {
    expect(connectionView(connection({ sessionEnvelope: "encrypted-session" })).connected).toBe(true);
  });
});
