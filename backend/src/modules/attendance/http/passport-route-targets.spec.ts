import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isRepeatableUorConnectProjectQrAction } from "./attendance.routes";

function readRoutesSource() {
  return readFileSync("src/modules/attendance/http/attendance.routes.ts", "utf8");
}

describe("attendance passport route targets", () => {
  it("keeps project QR, exhibitor pass and nucleus pass as separate game actions", () => {
    const source = readRoutesSource();

    expect(source).toContain("ensureStandVisitQrActionForSubmission");
    expect(source).toContain("ensureExhibitorChallengeQrActionForCredential");
    expect(source).toContain("ensureNucleusMemberBonusQrActionForCredential");
    expect(source).toContain('type: "STAND_VISIT"');
    expect(source).toContain('type: "EXHIBITOR_CHALLENGE"');
    expect(source).toContain('type: "NUCLEUS_MEMBER_BONUS"');
    expect(source).toContain('member.category === "EXPOSITOR"');
    expect(source).toContain('member.category === "NUCLEO"');
  });

  it("marks only UOR Connect project QR actions as repeatable test scans", () => {
    expect(isRepeatableUorConnectProjectQrAction({
      type: "STAND_VISIT",
      label: "Stand do projeto: UOR Connect",
      eventLabel: "UOR Connect",
      targetMeta: JSON.stringify({ name: "UOR Connect" }),
    })).toBe(true);

    expect(isRepeatableUorConnectProjectQrAction({
      type: "EXHIBITOR_VOTE",
      label: "Votar no projeto",
      eventLabel: null,
      targetMeta: null,
    }, "UOR Connect")).toBe(true);

    expect(isRepeatableUorConnectProjectQrAction({
      type: "EXHIBITOR_CHALLENGE",
      label: "Desafio do expositor",
      eventLabel: null,
      targetMeta: JSON.stringify({ submissionName: "UOR Connect" }),
    })).toBe(true);

    expect(isRepeatableUorConnectProjectQrAction({
      type: "STAND_VISIT",
      label: "Stand do projeto: Smart Campus",
      eventLabel: "Smart Campus",
      targetMeta: JSON.stringify({ name: "Smart Campus" }),
    })).toBe(false);

    expect(isRepeatableUorConnectProjectQrAction({
      type: "NUCLEUS_MEMBER_BONUS",
      label: "Passe UOR Connect",
      eventLabel: "UOR Connect",
      targetMeta: JSON.stringify({ name: "UOR Connect" }),
    })).toBe(false);
  });
});
