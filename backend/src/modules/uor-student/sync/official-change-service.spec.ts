import { describe, expect, it } from "vitest";
import { UorStudentOfficialChangeApplication } from "./official-change-service";

const student = { id: 7, institutionCode: "UOR", studentNumber: "20260007" };
const observedAt = new Date("2026-07-22T12:00:00.000Z");

function database(preference?: { status: string; payloadJson: string } | null) {
  const snapshots = [
    { id: "old", studentId: 7, domain: "academic.grades", snapshotVersion: 1, payloadJson: "{}", itemCount: 2, coverage: "live", sourceHash: "before", observedAt, createdAt: observedAt },
    { id: "new", studentId: 7, domain: "academic.grades", snapshotVersion: 2, payloadJson: "{}", itemCount: 3, coverage: "live", sourceHash: "after", observedAt, createdAt: observedAt },
    { id: "same-old", studentId: 7, domain: "academic.classes", snapshotVersion: 1, payloadJson: "{}", itemCount: 1, coverage: "live", sourceHash: "same", observedAt, createdAt: observedAt },
    { id: "same-new", studentId: 7, domain: "academic.classes", snapshotVersion: 2, payloadJson: "{}", itemCount: 1, coverage: "live", sourceHash: "same", observedAt, createdAt: observedAt },
  ];
  const changes: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const alerts: Array<Record<string, unknown>> = [];
  const tx = {
    uorStudentOfficialChange: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        if (!changes.some((item) => item.studentId === create.studentId && item.domain === create.domain && item.currentVersion === create.currentVersion)) changes.push({ id: "change-1", ...create });
      },
    },
    uorStudentAggregate: { findFirst: async () => preference ?? null },
    uorStudentNotification: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        if (!notifications.some((item) => item.deduplicationKey === create.deduplicationKey)) notifications.push(create);
      },
    },
  };
  return {
    changes,
    notifications,
    client: {
      secretariaSnapshot: {
        findMany: async ({ where }: { where: { snapshotVersion: number | { lt: number } } }) => {
          const version = where.snapshotVersion;
          if (typeof version === "number") {
            return snapshots.filter((item) => item.snapshotVersion === version);
          }
          return snapshots
            .filter((item) => item.snapshotVersion < version.lt)
            .sort((a, b) => b.snapshotVersion - a.snapshotVersion);
        },
      },
      $transaction: async (callback: (value: typeof tx) => Promise<void>) => callback(tx),
      uorStudentOfficialChange: { findFirst: async () => null, findMany: async () => [] },
      uorStudentOperationalAlert: {
        upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const current = alerts.find((item) => item.deduplicationKey === create.deduplicationKey);
          if (!current) {
            const created = { occurrences: 1, status: "OPEN", ...create };
            alerts.push(created);
            return created;
          }
          const increment = (update.occurrences as { increment?: number } | undefined)?.increment ?? 0;
          current.occurrences = Number(current.occurrences) + increment;
          current.status = update.status;
          current.lastDetectedAt = update.lastDetectedAt;
          return current;
        },
      },
    },
    alerts,
  };
}

describe("UorStudentOfficialChangeApplication", () => {
  it("grava apenas domínios alterados e suprime notificações duplicadas", async () => {
    const db = database(null);
    const service = new UorStudentOfficialChangeApplication(db.client as never, () => observedAt);

    await service.record({ student, snapshotVersion: 2 });
    await service.record({ student, snapshotVersion: 2 });

    expect(db.changes).toHaveLength(1);
    expect(db.changes[0]).toMatchObject({ domain: "academic.grades", event: "grade_changed", previousVersion: 1, currentVersion: 2 });
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]?.payloadJson).not.toContain("before");
    expect(db.notifications[0]?.payloadJson).not.toContain("after");
  });

  it("respeita a preferência desativada do estudante", async () => {
    const db = database({ status: "DISABLED", payloadJson: JSON.stringify({ channels: ["in_app"] }) });
    const service = new UorStudentOfficialChangeApplication(db.client as never, () => observedAt);

    await service.record({ student, snapshotVersion: 2 });

    expect(db.changes).toHaveLength(1);
    expect(db.notifications).toHaveLength(0);
  });

  it("abre um alerta técnico deduplicado e ignora falhas operacionais comuns", async () => {
    const db = database(null);
    const service = new UorStudentOfficialChangeApplication(db.client as never, () => observedAt);

    await service.recordFailure({ student, provider: "secretaria", errorCode: "SECRETARIA_UPSTREAM_CHANGED" });
    await service.recordFailure({ student, provider: "secretaria", errorCode: "SECRETARIA_UPSTREAM_CHANGED" });
    await service.recordFailure({ student, provider: "secretaria", errorCode: "SECRETARIA_AUTH_FAILED" });

    expect(db.alerts).toEqual([
      expect.objectContaining({
        institutionCode: "UOR",
        provider: "secretaria",
        domain: "upstream_contract",
        code: "SECRETARIA_UPSTREAM_CHANGED",
        severity: "HIGH",
        status: "OPEN",
        occurrences: 2,
      }),
    ]);
  });
});
