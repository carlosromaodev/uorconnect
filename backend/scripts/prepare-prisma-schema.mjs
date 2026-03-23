import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const provider = process.argv[2] ?? "postgresql";
const output = process.argv[3] ?? "prisma/schema.deploy.prisma";

const root = process.cwd();
const sourcePath = path.join(root, "prisma/schema.prisma");
const targetPath = path.join(root, output);

const source = await readFile(sourcePath, "utf8");
const next = source.replace('provider = "sqlite"', `provider = "${provider}"`);

await mkdir(path.dirname(targetPath), { recursive: true });
await writeFile(targetPath, next, "utf8");

console.log(`Prisma schema preparado em ${output} com provider=${provider}`);
