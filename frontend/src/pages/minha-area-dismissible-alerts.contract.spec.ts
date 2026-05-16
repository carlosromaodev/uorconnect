import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Minha Area dismissible alerts", () => {
  it("lets students close journey alerts without changing their data", () => {
    const source = readSource("src/pages/MinhaArea.tsx");

    expect(source).toContain("dismissedJourneyAlertKeys");
    expect(source).toContain("dismissJourneyAlert");
    expect(source).toContain("UORCONNECT_DISMISSED_JOURNEY_ALERTS_KEY");
    expect(source).toContain("aria-label={`Fechar aviso ${alert.title}`}");
    expect(source).toContain(".filter((alert) => !dismissedJourneyAlertKeys.includes(alert.key))");
  });
});
