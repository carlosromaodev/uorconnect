import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(path.join(process.cwd(), "src/app.ts"), "utf8");

describe("app CORS contract", () => {
  it("allows official UOR Connect origins used by public and admin shells", () => {
    expect(appSource).toContain("officialUorConnectOrigins");
    expect(appSource).toContain("https://uorconnect.space");
    expect(appSource).toContain("https://www.uorconnect.space");
    expect(appSource).toContain("https://admin.uorconnect.space");
    expect(appSource).toContain("officialUorConnectOrigins.has(origin)");
  });
});
