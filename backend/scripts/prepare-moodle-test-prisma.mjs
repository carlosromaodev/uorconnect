import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "prisma/schema.prisma");
const outputPath = path.join(root, "prisma/schema.moodle-test.prisma");
const source = await readFile(sourcePath, "utf8");
const marker = 'generator client {\n  provider = "prisma-client-js"\n}';
if (!source.includes(marker)) {
  throw new Error("Não foi possível preparar o Prisma SQLite isolado para testes Moodle.");
}

const generated = source.replace(
  marker,
  'generator client {\n  provider = "prisma-client-js"\n  output   = "../node_modules/@uor/moodle-test-prisma"\n}',
);
await writeFile(outputPath, generated, { encoding: "utf8", mode: 0o600 });
console.log("Prisma SQLite de teste Moodle preparado.");
