import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("compiled server entrypoint", () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
  ) as {
    main?: string;
    scripts?: Record<string, string>;
  };

  it("points npm start to the server file emitted by the TypeScript build", () => {
    expect(packageJson.main).toBe("dist/src/server.js");
    expect(packageJson.scripts?.start).toBe("node dist/src/server.js");
  });
});
