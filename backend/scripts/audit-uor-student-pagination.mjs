import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const sourceRoot = path.resolve(process.cwd(), "src/modules/uor-student");
const sourceFiles = [];

function collect(directory) {
  for (const name of readdirSync(directory)) {
    const absolute = path.join(directory, name);
    if (statSync(absolute).isDirectory()) collect(absolute);
    else if (name.endsWith(".ts") && !name.endsWith(".spec.ts")) sourceFiles.push(absolute);
  }
}

function matchingBrace(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return index;
  }
  return -1;
}

collect(sourceRoot);
const failures = [];
let calls = 0;
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const matcher = /\.findMany\s*\(\s*\{/g;
  for (const match of source.matchAll(matcher)) {
    calls += 1;
    const start = source.indexOf("{", match.index);
    const end = matchingBrace(source, start);
    const body = end < 0 ? "" : source.slice(start, end + 1);
    if (!/\btake\s*:/.test(body)) {
      const line = source.slice(0, match.index).split("\n").length;
      failures.push(`${path.relative(process.cwd(), file)}:${line}`);
    }
  }
}

if (failures.length) {
  process.stderr.write(`Consultas findMany sem limite explícito:\n${failures.map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Auditoria de paginação aprovada: ${calls} consultas findMany possuem limite explícito.\n`);
}
