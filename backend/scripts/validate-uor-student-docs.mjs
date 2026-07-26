import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "..");
const requirementsPath = path.join(root, "docs/vision/uor-connect-v2/requirements/UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md");
const matrixPath = path.join(root, "docs/vision/uor-connect-v2/requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md");
const [requirements, matrix] = await Promise.all([readFile(requirementsPath, "utf8"), readFile(matrixPath, "utf8")]);

const ids = [...requirements.matchAll(/\| (RF-EST-\d{3}|RNF-EST-\d{3}|RN-EST-\d{3}) \|/g)].map((match) => match[1]);
const matrixRows = [...matrix.matchAll(/\| \[([ x])\] \| (RF-EST-\d{3}|RNF-EST-\d{3}|RN-EST-\d{3}) \| ([a-z_]+) \|/g)]
  .map((match) => ({ checked: match[1] === "x", id: match[2], status: match[3] }));
const errors = [];
const allowed = new Set(["planned", "in_analysis", "partial", "implemented", "verified", "blocked", "deprecated", "superseded"]);
for (const row of matrixRows) {
  if (!allowed.has(row.status)) errors.push(`${row.id}: estado inválido ${row.status}`);
  if (row.checked !== (row.status === "verified")) errors.push(`${row.id}: [x] é permitido exclusivamente com estado verified`);
}
const matrixIds = new Set(matrixRows.map((row) => row.id));
for (const id of ids) if (!matrixIds.has(id)) errors.push(`${id}: ausente da matriz`);
for (const row of matrixRows) if (!ids.includes(row.id) && !["RF-EST-087", "RF-EST-094"].includes(row.id)) errors.push(`${row.id}: não existe no catálogo normativo`);

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Documentação UOR Estudante válida: ${matrixRows.length} linhas rastreadas.\n`);
}
