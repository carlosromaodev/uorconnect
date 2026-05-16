import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(path: string) {
  return readFileSync(resolve(__dirname, "../../", path), "utf8");
}

describe("frontend API type safety contracts", () => {
  it("keeps important API unions restrictive instead of widening them with string", () => {
    const source = readProjectFile("src/lib/api.ts");

    expect(source).not.toMatch(/"done"\s*\|\s*"current"\s*\|\s*"pending"\s*\|\s*string/);
    expect(source).not.toMatch(/"SUPER_ADMIN"\s*\|\s*"TEAM_LEAD"\s*\|\s*"MEMBER"\s*\|\s*string/);
    expect(source).not.toMatch(/"expired"\s*\|\s*string/);
    expect(source).not.toMatch(/"locked"\s*\|\s*string/);
  });
});
