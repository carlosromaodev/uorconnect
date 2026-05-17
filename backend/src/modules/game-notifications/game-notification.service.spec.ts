import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  composeExhibitorGameNotification,
  composePassportGameNotification,
  shouldSendGameNotifications,
  sanitizeGameMessage,
} from "./game-notification.service";

const repoRoot = path.resolve(__dirname, "../../../..");

describe("game notification messages", () => {
  it("humanizes passport point gains with clean WhatsApp/SMS text and numbered QR hints", () => {
    const notification = composePassportGameNotification({
      kind: "POINTS_GAINED",
      studentName: "Ana Maria",
      deltaPoints: 20,
      currentPoints: 85,
      qrDisplayCode: "QR-014",
      hint: "Procura o QR-021 perto da zona dos workshops.",
    });

    expect(notification.title).toBe("Passaporte Digital: +20 pontos");
    expect(notification.message).toContain("Ana");
    expect(notification.message).toContain("+20 pontos");
    expect(notification.message).toContain("QR-014");
    expect(notification.message).toContain("QR-021");
    expect(notification.message).not.toMatch(/{{|}}|undefined|null/);
    expect(notification.message).not.toMatch(/[ \t]{2,}/);
  });

  it("explains recovery after losses without sounding like a broken provider template", () => {
    const notification = composePassportGameNotification({
      kind: "NEGATIVE_BALANCE",
      studentName: "Ednauro Carvalho",
      deltaPoints: -30,
      currentPoints: -12,
      recoveryPriceKz: 300,
      recoveryPoints: 60,
    });

    expect(notification.title).toBe("Passaporte Digital: recuperar pontos");
    expect(notification.message).toContain("300 Kz");
    expect(notification.message).toContain("60 pontos");
    expect(notification.message).toContain("saldo esta negativo");
    expect(notification.message).toContain("stand da UOR Connect");
    expect(notification.message).not.toMatch(/{{|}}|undefined|null/);
  });

  it("humanizes exhibitor scoring events for project teams", () => {
    const notification = composeExhibitorGameNotification({
      kind: "POINTS_GAINED",
      projectName: "UOR Connect",
      studentName: "Carlos Romao",
      deltaPoints: 5,
      reason: "voto de estudante de outra universidade",
      currentScore: 128,
    });

    expect(notification.title).toBe("Desafio do Expositor: +5 pontos");
    expect(notification.message).toContain("UOR Connect");
    expect(notification.message).toContain("outra universidade");
    expect(notification.message).toContain("128 pontos");
    expect(notification.message).not.toMatch(/{{|}}|undefined|null/);
  });

  it("sanitizes empty placeholders, repeated spaces and unsupported control text", () => {
    expect(sanitizeGameMessage(" Ola  {{nome}}\n\n undefined  null  ")).toBe("Ola");
  });
});

describe("game notification triggers", () => {
  it("keeps passport hints and exhibitor vote notifications paused until the activity starts", () => {
    const env = { GAME_NOTIFICATIONS_START_AT: "2026-05-18T00:00:00+01:00" };

    expect(shouldSendGameNotifications(env, new Date("2026-05-17T23:59:59+01:00"))).toBe(false);
    expect(shouldSendGameNotifications(env, new Date("2026-05-18T00:00:00+01:00"))).toBe(true);
  });

  it("connects passport point results from QR scans to the game notifier", () => {
    const source = readFileSync(
      path.join(repoRoot, "backend/src/modules/attendance/http/attendance.routes.ts"),
      "utf8",
    );

    expect(source).toContain("notifyPassportGameEvent");
    expect(source).toContain("pointsAwarded");
    expect(source).toContain("PASSPORT_NEGATIVE_BALANCE");
  });

  it("connects exhibitor vote scoring to the game notifier", () => {
    const source = readFileSync(
      path.join(repoRoot, "backend/src/modules/interactions/http/interactions.routes.ts"),
      "utf8",
    );

    expect(source).toContain("notifyExhibitorGameEvent");
    expect(source).toContain("scoreDelta");
    expect(source).toContain("EXHIBITOR_POINTS_GAINED");
  });
});
