import { prisma } from "../../../shared/prisma";
import type { UorStudentIdentity } from "../application/ports";

type Database = typeof prisma;

const EVENT_BY_DOMAIN: Record<string, string> = {
  "academic.grades": "grade_changed",
  "academic.classes": "schedule_changed",
  "academic.exams": "exam_changed",
  "finance.overview": "payment_changed",
  "finance.tuition": "payment_changed",
  "finance.debts": "payment_changed",
  "finance.charges": "payment_changed",
  "finance.references": "payment_changed",
  "finance.payments": "payment_changed",
  "finance.receipts": "payment_changed",
};

const ALERT_COPY: Record<string, { title: string; body: string }> = {
  grade_changed: { title: "Dados académicos atualizados", body: "Foram detetadas alterações nas classificações oficiais." },
  schedule_changed: { title: "Horário atualizado", body: "Foram detetadas alterações no horário oficial." },
  exam_changed: { title: "Épocas ou exames atualizados", body: "Foram detetadas alterações no calendário oficial de exames." },
  payment_changed: { title: "Situação financeira atualizada", body: "Foram detetadas alterações nos dados financeiros oficiais." },
};

type SnapshotSummary = {
  itemCount: number;
  coverage: string;
  observedAt: string;
};

function summary(snapshot: { itemCount: number; coverage: string; observedAt: Date }): SnapshotSummary {
  return { itemCount: snapshot.itemCount, coverage: snapshot.coverage, observedAt: snapshot.observedAt.toISOString() };
}

function preferenceChannels(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson) as { channels?: unknown };
    return Array.isArray(parsed.channels) ? parsed.channels.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export type UorStudentOfficialChangeView = {
  id: string;
  domain: string;
  event: string | null;
  previousVersion: number;
  currentVersion: number;
  before: SnapshotSummary;
  after: SnapshotSummary;
  source: "secretaria_uor";
  detectedAt: string;
};

export class UorStudentOfficialChangeApplication {
  constructor(private readonly db: Database = prisma, private readonly now: () => Date = () => new Date()) {}

  async record(input: { student: UorStudentIdentity; snapshotVersion: number }) {
    const current = await this.db.secretariaSnapshot.findMany({
      where: { studentId: input.student.id, snapshotVersion: input.snapshotVersion },
      orderBy: { domain: "asc" },
      take: 100,
    });
    if (!current.length) return;
    const historical = await this.db.secretariaSnapshot.findMany({
      where: { studentId: input.student.id, snapshotVersion: { lt: input.snapshotVersion } },
      orderBy: [{ snapshotVersion: "desc" }, { domain: "asc" }],
      take: 1_000,
    });
    const previousByDomain = new Map<string, (typeof historical)[number]>();
    for (const snapshot of historical) {
      if (!previousByDomain.has(snapshot.domain)) previousByDomain.set(snapshot.domain, snapshot);
    }

    for (const snapshot of current) {
      const previous = previousByDomain.get(snapshot.domain);
      if (!previous || previous.sourceHash === snapshot.sourceHash) continue;
      const event = EVENT_BY_DOMAIN[snapshot.domain] ?? null;
      await this.db.$transaction(async (tx) => {
        await tx.uorStudentOfficialChange.upsert({
          where: { studentId_domain_currentVersion: { studentId: input.student.id, domain: snapshot.domain, currentVersion: snapshot.snapshotVersion } },
          create: {
            studentId: input.student.id,
            institutionCode: input.student.institutionCode,
            domain: snapshot.domain,
            event,
            previousVersion: previous.snapshotVersion,
            currentVersion: snapshot.snapshotVersion,
            beforeJson: JSON.stringify(summary(previous)),
            afterJson: JSON.stringify(summary(snapshot)),
            detectedAt: this.now(),
          },
          update: {},
        });
        if (!event) return;
        const preference = await tx.uorStudentAggregate.findFirst({
          where: { ownerStudentId: input.student.id, institutionCode: input.student.institutionCode, category: "alert_preference", scopeKey: event },
          orderBy: { createdAt: "desc" },
          select: { status: true, payloadJson: true },
        });
        const inAppEnabled = !preference || (preference.status === "enabled" && preferenceChannels(preference.payloadJson).includes("in_app"));
        if (!inAppEnabled) return;
        const copy = ALERT_COPY[event];
        await tx.uorStudentNotification.upsert({
          where: { studentId_deduplicationKey: { studentId: input.student.id, deduplicationKey: `official-change:${snapshot.snapshotVersion}:${event}` } },
          create: {
            studentId: input.student.id,
            institutionCode: input.student.institutionCode,
            category: "official_change",
            deduplicationKey: `official-change:${snapshot.snapshotVersion}:${event}`,
            title: copy.title,
            body: copy.body,
            payloadJson: JSON.stringify({ event, snapshotVersion: snapshot.snapshotVersion, detectedAt: this.now().toISOString() }),
          },
          update: {},
        });
      });
    }
  }

  async recordFailure(input: { student: UorStudentIdentity; provider: "secretaria" | "moodle"; errorCode: string }) {
    const technicalCodes = new Set(["SECRETARIA_UPSTREAM_CHANGED", "SECRETARIA_VALIDATION_FAILED", "MOODLE_UPSTREAM_CHANGED", "MOODLE_PARSE_FAILED"]);
    if (!technicalCodes.has(input.errorCode)) return;
    const key = `${input.student.institutionCode}:${input.provider}:contract:${input.errorCode}`;
    await this.db.uorStudentOperationalAlert.upsert({
      where: { deduplicationKey: key },
      create: { institutionCode: input.student.institutionCode, provider: input.provider, domain: "upstream_contract", code: input.errorCode, severity: "HIGH", deduplicationKey: key, lastDetectedAt: this.now() },
      update: { status: "OPEN", occurrences: { increment: 1 }, lastDetectedAt: this.now(), resolvedAt: null, resolvedByStudentId: null, resolution: null },
    });
  }

  async list(input: { student: UorStudentIdentity; domain?: string; limit: number; cursor?: string }) {
    let anchor: { detectedAt: Date; id: string } | null = null;
    if (input.cursor) {
      anchor = await this.db.uorStudentOfficialChange.findFirst({
        where: { id: input.cursor, studentId: input.student.id, institutionCode: input.student.institutionCode },
        select: { detectedAt: true, id: true },
      });
      if (!anchor) return { items: [], nextCursor: null };
    }
    const rows = await this.db.uorStudentOfficialChange.findMany({
      where: {
        studentId: input.student.id,
        institutionCode: input.student.institutionCode,
        ...(input.domain ? { domain: input.domain } : {}),
        ...(anchor ? { OR: [{ detectedAt: { lt: anchor.detectedAt } }, { detectedAt: anchor.detectedAt, id: { lt: anchor.id } }] } : {}),
      },
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    const items = rows.slice(0, input.limit).map((row) => ({
      id: row.id,
      domain: row.domain,
      event: row.event,
      previousVersion: row.previousVersion,
      currentVersion: row.currentVersion,
      before: JSON.parse(row.beforeJson) as SnapshotSummary,
      after: JSON.parse(row.afterJson) as SnapshotSummary,
      source: "secretaria_uor" as const,
      detectedAt: row.detectedAt.toISOString(),
    }));
    return { items, nextCursor: rows.length > input.limit ? items.at(-1)?.id ?? null : null };
  }
}
