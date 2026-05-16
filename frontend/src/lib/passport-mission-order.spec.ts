import { describe, expect, it } from "vitest";
import { orderPassportMissionsForMap } from "./passport-mission-order";

describe("passport mission order", () => {
  it("mantem Convidar colegas em segundo lugar mesmo quando a API envia fora de ordem", () => {
    const missions = orderPassportMissionsForMap([
      { key: "event-checkin", label: "Check-in" },
      { key: "stand-visit", label: "Stand" },
      { key: "affiliate-invite", label: "Convidar colegas" },
      { key: "accept-challenge", label: "Aceitar o desafio" },
    ]);

    expect(missions.map((mission) => mission.key).slice(0, 3)).toEqual([
      "accept-challenge",
      "affiliate-invite",
      "event-checkin",
    ]);
  });
});
