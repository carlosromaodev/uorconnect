import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const adminPassportTab = readFileSync(path.join(__dirname, "AdminPassportTab.tsx"), "utf8");

describe("admin passport exhibitor challenge list", () => {
  it("shows every submitted challenge instead of truncating the review queue to five", () => {
    expect(adminPassportTab).not.toContain("challenges.slice(0, 5)");
    expect(adminPassportTab).toContain("visibleChallenges.map");
    expect(adminPassportTab).toContain("max-h-[620px]");
  });
});
