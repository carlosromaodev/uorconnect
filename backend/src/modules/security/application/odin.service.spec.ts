import { describe, expect, it } from "vitest";
import {
  buildOdinRiskSnapshot,
  detectExhibitorDeviceMisuse,
  normalizeOdinDeviceId,
  type OdinRawEvent,
} from "./odin.service";

const baseDate = new Date("2026-05-18T09:00:00.000Z");

function event(input: Partial<OdinRawEvent> & Pick<OdinRawEvent, "deviceId" | "eventType" | "createdAt">): OdinRawEvent {
  return {
    id: Math.floor(Math.random() * 100_000),
    deviceId: input.deviceId,
    studentId: input.studentId ?? null,
    studentNumber: input.studentNumber ?? null,
    studentName: input.studentName ?? null,
    studentCourse: input.studentCourse ?? null,
    eventType: input.eventType,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: input.createdAt,
  };
}

describe("ODIN device risk analysis", () => {
  it("normalizes only opaque first-party device cookies", () => {
    expect(normalizeOdinDeviceId("  odin_abc-123_DEF  ")).toBe("odin_abc-123_DEF");
    expect(normalizeOdinDeviceId("short")).toBeNull();
    expect(normalizeOdinDeviceId("../../../session")).toBeNull();
    expect(normalizeOdinDeviceId("x".repeat(97))).toBeNull();
  });

  it("flags multi-account devices that vote on the same project", () => {
    const snapshot = buildOdinRiskSnapshot({
      generatedAt: baseDate,
      events: [
        event({
          id: 1,
          deviceId: "device-000000000001",
          studentId: 10,
          studentNumber: "20260010",
          studentName: "Ana",
          eventType: "LOGIN_SUCCESS",
          createdAt: new Date("2026-05-18T08:50:00.000Z"),
        }),
        event({
          id: 2,
          deviceId: "device-000000000001",
          studentId: 10,
          studentNumber: "20260010",
          eventType: "PROJECT_VOTE",
          targetType: "Submission",
          targetId: 77,
          targetLabel: "UOR Connect",
          createdAt: new Date("2026-05-18T08:51:00.000Z"),
        }),
        event({
          id: 3,
          deviceId: "device-000000000001",
          studentId: 11,
          studentNumber: "20260011",
          studentName: "Bruno",
          eventType: "LOGIN_SUCCESS",
          createdAt: new Date("2026-05-18T08:52:00.000Z"),
        }),
        event({
          id: 4,
          deviceId: "device-000000000001",
          studentId: 11,
          studentNumber: "20260011",
          eventType: "PROJECT_VOTE",
          targetType: "Submission",
          targetId: 77,
          targetLabel: "UOR Connect",
          createdAt: new Date("2026-05-18T08:53:00.000Z"),
        }),
      ],
    });

    expect(snapshot.stats.multiAccountDevices).toBe(1);
    expect(snapshot.stats.suspiciousDevices).toBe(1);
    expect(snapshot.devices[0]).toEqual(expect.objectContaining({
      deviceId: "device-000000000001",
      distinctStudents: 2,
      distinctProjectsVoted: 1,
      riskLevel: "HIGH",
    }));
    expect(snapshot.devices[0].reasons).toEqual(expect.arrayContaining([
      expect.stringContaining("2 contas"),
      expect.stringContaining("mesmo projeto"),
    ]));
    expect(snapshot.projects[0]).toEqual(expect.objectContaining({
      submissionId: 77,
      submissionName: "UOR Connect",
      suspiciousVotes: 2,
    }));
    expect(snapshot.devices[0].loginTimeline).toEqual([
      expect.objectContaining({
        studentNumber: "20260010",
        loginAt: "2026-05-18T08:50:00.000Z",
      }),
      expect.objectContaining({
        studentNumber: "20260011",
        loginAt: "2026-05-18T08:52:00.000Z",
      }),
    ]);
    expect(snapshot.devices[0].students[0]).toEqual(expect.objectContaining({
      firstLoginAt: "2026-05-18T08:52:00.000Z",
      lastLoginAt: "2026-05-18T08:52:00.000Z",
    }));
  });

  it("raises velocity risk when a device casts many votes in ten minutes", () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      event({
        id: index + 1,
        deviceId: "device-000000000099",
        studentId: 100 + index,
        studentNumber: `20260${100 + index}`,
        eventType: "PROJECT_VOTE",
        targetType: "Submission",
        targetId: 50 + index,
        targetLabel: `Projeto ${index + 1}`,
        createdAt: new Date(baseDate.getTime() + index * 60_000),
      }),
    );

    const snapshot = buildOdinRiskSnapshot({ generatedAt: baseDate, events });

    expect(snapshot.devices[0].riskScore).toBeGreaterThanOrEqual(70);
    expect(snapshot.devices[0].reasons).toEqual(expect.arrayContaining([
      expect.stringContaining("5 votos em 10 minutos"),
    ]));
    expect(snapshot.stats.suspectVotes).toBe(5);
  });

  it("detects exhibitor devices used to vote outside their own project", () => {
    const events = [
      event({
        id: 1,
        deviceId: "device-exhibitor-001",
        studentId: 10,
        studentNumber: "20260010",
        studentName: "Ana Expositora",
        eventType: "LOGIN_SUCCESS",
        createdAt: new Date("2026-05-18T09:00:00.000Z"),
      }),
      event({
        id: 2,
        deviceId: "device-exhibitor-001",
        studentId: 20,
        studentNumber: "20260020",
        studentName: "Colega A",
        eventType: "PROJECT_VOTE",
        targetType: "Submission",
        targetId: 77,
        targetLabel: "Projeto da Ana",
        createdAt: new Date("2026-05-18T09:01:00.000Z"),
      }),
      event({
        id: 3,
        deviceId: "device-exhibitor-001",
        studentId: 21,
        studentNumber: "20260021",
        studentName: "Colega B",
        eventType: "PROJECT_VOTE",
        targetType: "Submission",
        targetId: 88,
        targetLabel: "Projeto concorrente",
        createdAt: new Date("2026-05-18T09:02:00.000Z"),
      }),
      event({
        id: 4,
        deviceId: "device-exhibitor-001",
        studentId: 22,
        studentNumber: "20260022",
        studentName: "Colega C",
        eventType: "PROJECT_VOTE",
        targetType: "Submission",
        targetId: 89,
        targetLabel: "Outro projeto",
        createdAt: new Date("2026-05-18T09:03:00.000Z"),
      }),
    ];

    const signals = detectExhibitorDeviceMisuse(events, [
      {
        submissionId: 77,
        submissionName: "Projeto da Ana",
        studentId: 10,
        studentNumber: "20260010",
        memberName: "Ana Expositora",
      },
    ]);

    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual(expect.objectContaining({
      deviceId: "device-exhibitor-001",
      outsideVotes: 2,
      distinctAccounts: 4,
      severity: "HIGH",
    }));
    expect(signals[0].outsideProjects).toEqual([
      expect.objectContaining({ submissionId: 88, submissionName: "Projeto concorrente", votes: 1 }),
      expect.objectContaining({ submissionId: 89, submissionName: "Outro projeto", votes: 1 }),
    ]);
    expect(signals[0].message).toContain("ODIN");
    expect(signals[0].message).toContain("possível suspensão");
  });
});
