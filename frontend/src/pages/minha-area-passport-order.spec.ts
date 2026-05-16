import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMinhaAreaSource() {
  return readFileSync(join(process.cwd(), "src/pages/MinhaArea.tsx"), "utf8");
}

describe("MinhaArea passport derived state order", () => {
  it("initializes passportJoined before fallback missions read it", () => {
    const source = readMinhaAreaSource();

    const passportJoinedIndex = source.indexOf("const passportJoined = Boolean");
    const fallbackMissionsIndex = source.indexOf("const fallbackPassportMissions");

    expect(passportJoinedIndex).toBeGreaterThan(-1);
    expect(fallbackMissionsIndex).toBeGreaterThan(-1);
    expect(passportJoinedIndex).toBeLessThan(fallbackMissionsIndex);
  });

  it("uses joinedAt to repair accept-challenge state before drawing the map", () => {
    const source = readMinhaAreaSource();
    const repairIndex = source.indexOf("const passportAcceptMissionNeedsJoinRepair");
    const missionsIndex = source.indexOf("const passportMissions = orderPassportMissionsForMap");

    expect(repairIndex).toBeGreaterThan(-1);
    expect(missionsIndex).toBeGreaterThan(-1);
    expect(repairIndex).toBeLessThan(missionsIndex);
    expect(source).toContain('passportJoined && mission.key === "accept-challenge"');
    expect(source).toContain('normalizePassportStatus(passportAcceptMissionFromSummary.status) !== "done"');
  });

  it("keeps the local challenge map fallback complete when the server is unavailable", () => {
    const source = readMinhaAreaSource();
    const fallbackStart = source.indexOf("const fallbackPassportMissions");
    const fallbackEnd = source.indexOf("const passportMissions", fallbackStart);
    const fallbackBlock = source.slice(fallbackStart, fallbackEnd);
    const fallbackMissionKeys =
      fallbackBlock.match(/key: "[^"]+"/g)?.map((match) =>
        match.replace('key: "', "").replace('"', ""),
      ) ?? [];

    expect(fallbackMissionKeys.length).toBeGreaterThan(11);
    expect(fallbackMissionKeys.slice(0, 2)).toEqual([
      "accept-challenge",
      "affiliate-invite",
    ]);
    expect(fallbackMissionKeys).toEqual(
      expect.arrayContaining([
        "accept-challenge",
        "affiliate-invite",
        "event-checkin",
        "workshop-checkin",
        "workshop-master-combo",
        "stand-visit",
        "stand-explorer-combo",
        "exhibitor-challenge",
        "cross-course-networking",
        "networking-triad-combo",
        "nucleus-member-bonus",
        "fair-surprise",
        "journey-complete",
      ]),
    );
  });
});
