import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "..");
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const findings = [];
const secretPatterns = [
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["github_token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ["openai_key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g],
  ["aws_access_key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["google_api_key", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ["slack_token", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g],
];

for (const relative of tracked) {
  if (/(^|\/)\.env(?:\.|$)/.test(relative) && !relative.endsWith(".env.example")) {
    findings.push(`${relative}: ficheiro de ambiente rastreado`);
  }
  const absolute = path.join(root, relative);
  let buffer;
  try {
    buffer = readFileSync(absolute);
  } catch {
    continue;
  }
  if (buffer.length > 5_000_000 || buffer.includes(0)) continue;
  const content = buffer.toString("utf8");
  for (const [kind, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) findings.push(`${relative}: padrão ${kind}`);
  }
}

if (findings.length) {
  process.stderr.write(`Scanner de segredos reprovado:\n${[...new Set(findings)].map((item) => `- ${item}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Scanner de segredos aprovado: ${tracked.length} ficheiros rastreados analisados.\n`);
}
