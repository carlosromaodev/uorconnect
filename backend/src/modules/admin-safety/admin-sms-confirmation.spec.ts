import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_DANGER_CONFIRMATION_PHONE,
  hashAdminSmsConfirmationCode,
  requestAdminSmsConfirmation,
  verifyAdminSmsConfirmation,
} from "./admin-sms-confirmation";

const prismaMock = vi.hoisted(() => ({
  studentAccessCode: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../../shared/prisma", () => ({
  prisma: prismaMock,
}));

const env = {
  JWT_SECRET: "test-secret",
  OMBALA_API_BASE_URL: "https://sms.example.test",
  OMBALA_API_TOKEN: "token",
  OMBALA_SMS_DEFAULT_SENDER: "UOR CONNECT",
} as never;

describe("admin SMS confirmation", () => {
  it("sends a one-time code to the protected admin phone", async () => {
    prismaMock.studentAccessCode.create.mockResolvedValue({
      id: 10,
      phone: ADMIN_DANGER_CONFIRMATION_PHONE,
      codeLast4: "1234",
      expiresAt: new Date("2026-05-11T10:10:00.000Z"),
      deliveryStatus: "SENT",
    });

    const sent: Array<{ to: string; message: string }> = [];
    const result = await requestAdminSmsConfirmation({
      env,
      operation: "PASSPORT_CHALLENGE_RESET",
      actorStudentNumber: "20240001",
      sendMessage: async (payload) => {
        sent.push({ to: payload.to, message: payload.message });
        return { ok: true, status: 200, payload: { id: "sms-1" } };
      },
      generateCode: () => "991234",
      now: new Date("2026-05-11T10:00:00.000Z"),
    });

    expect(sent).toEqual([
      expect.objectContaining({
        to: "937624785",
        message: expect.stringContaining("991234"),
      }),
    ]);
    expect(prismaMock.studentAccessCode.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        phone: ADMIN_DANGER_CONFIRMATION_PHONE,
        purpose: "ADMIN_DANGER:PASSPORT_CHALLENGE_RESET",
      }),
      data: expect.objectContaining({ deliveryStatus: "REVOKED" }),
    });
    expect(result).toEqual(expect.objectContaining({
      phone: ADMIN_DANGER_CONFIRMATION_PHONE,
      codeLast4: "1234",
    }));
  });

  it("consumes only the matching active code for the requested operation", async () => {
    const codeHash = hashAdminSmsConfirmationCode({
      env,
      operation: "PROJECT_VOTES_RESET",
      phone: ADMIN_DANGER_CONFIRMATION_PHONE,
      code: "321654",
    });
    prismaMock.studentAccessCode.findFirst.mockResolvedValue({
      id: 42,
      codeHash,
      expiresAt: new Date("2026-05-11T10:10:00.000Z"),
    });

    const result = await verifyAdminSmsConfirmation({
      env,
      operation: "PROJECT_VOTES_RESET",
      code: "321654",
      now: new Date("2026-05-11T10:04:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(prismaMock.studentAccessCode.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({ usedAt: new Date("2026-05-11T10:04:00.000Z") }),
    });
  });
});
