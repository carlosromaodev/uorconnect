import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), "..");
const requirementsPath = path.join(root, "docs/vision/uor-connect-v2/requirements/UOR-ESTUDANTE-RF-RNF-REGRAS-NEGOCIO.md");
const matrixPath = path.join(root, "docs/vision/uor-connect-v2/requirements/UOR-ESTUDANTE-MATRIZ-RASTREABILIDADE.md");
const [requirements, matrix] = await Promise.all([readFile(requirementsPath, "utf8"), readFile(matrixPath, "utf8")]);

const requirementRows = [...requirements.matchAll(/\| \[([ x])\] \| (RF-EST-\d{3}|RNF-EST-\d{3}|RN-EST-\d{3}) \|/g)]
  .map((match) => ({ checked: match[1] === "x", id: match[2] }));
const ids = requirementRows.map((row) => row.id);
const matrixRows = [...matrix.matchAll(/\| \[([ x])\] \| (RF-EST-\d{3}|RNF-EST-\d{3}|RN-EST-\d{3}) \| ([a-z_]+) \|/g)]
  .map((match) => ({ checked: match[1] === "x", id: match[2], status: match[3] }));
const errors = [];
const allowed = new Set(["planned", "in_analysis", "partial", "implemented", "verified", "blocked", "deprecated", "superseded"]);
const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
for (const id of duplicates(ids)) errors.push(`${id}: duplicado no catálogo normativo`);
for (const id of duplicates(matrixRows.map((row) => row.id))) errors.push(`${id}: duplicado na matriz`);
for (const row of matrixRows) {
  if (!allowed.has(row.status)) errors.push(`${row.id}: estado inválido ${row.status}`);
  if (row.checked !== (row.status === "verified")) errors.push(`${row.id}: [x] é permitido exclusivamente com estado verified`);
}
const matrixById = new Map(matrixRows.map((row) => [row.id, row]));
for (const requirement of requirementRows) {
  const tracked = matrixById.get(requirement.id);
  if (!tracked) {
    errors.push(`${requirement.id}: ausente da matriz`);
  } else if (requirement.checked !== tracked.checked) {
    errors.push(`${requirement.id}: checkbox do catálogo diverge da matriz`);
  }
}
for (const row of matrixRows) if (!ids.includes(row.id)) errors.push(`${row.id}: não existe no catálogo normativo`);

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Documentação UOR Estudante válida: ${matrixRows.length} linhas rastreadas.\n`);
}
