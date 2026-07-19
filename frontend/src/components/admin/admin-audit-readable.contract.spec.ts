import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const auditTab = readFileSync(path.join(__dirname, "AdminAuditTab.tsx"), "utf8");
const apiSource = readFileSync(path.join(__dirname, "../../lib/api.ts"), "utf8");

describe("admin audit readable table contract", () => {
  it("shows the actor name and human-readable action text before technical identifiers", () => {
    expect(apiSource).toContain("actorName: string | null");
    expect(apiSource).toContain("actionLabel: string");
    expect(auditTab).toContain("formatAuditActorName");
    expect(auditTab).toContain("log.actorName");
    expect(auditTab).toContain("formatReadableAuditAction(log)");
    expect(auditTab).toContain("log.actionLabel");
    expect(auditTab).toContain("Identificador técnico");
  });
});
