import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const MAGIC = Buffer.from("UORST01\0");
const IV_BYTES = 12;
const TAG_BYTES = 16;

function usage() {
  process.stdout.write("Uso:\n  node scripts/uor-student-backup.mjs backup --output ficheiro.uorenc\n  node scripts/uor-student-backup.mjs restore --input ficheiro.uorenc --confirm-isolated-target\n\nVariáveis obrigatórias: DATABASE_URL e UOR_STUDENT_BACKUP_KEY_BASE64 (32 bytes).\n");
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function key() {
  const value = Buffer.from(process.env.UOR_STUDENT_BACKUP_KEY_BASE64 ?? "", "base64");
  if (value.length !== 32) throw new Error("UOR_STUDENT_BACKUP_KEY_BASE64 deve conter exatamente 32 bytes em base64.");
  return value;
}

async function command(program, args, databaseUrl) {
  await new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: "inherit", env: { ...process.env, PGDATABASE: databaseUrl } });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${program} terminou com código ${code}.`)));
  });
}

async function backup(databaseUrl, output) {
  const directory = await mkdtemp(path.join(tmpdir(), "uor-student-backup-"));
  const dump = path.join(directory, "database.dump");
  const iv = randomBytes(IV_BYTES);
  const encryptionKey = key();
  try {
    await command("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", dump], databaseUrl);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const target = createWriteStream(output, { flags: "wx", mode: 0o600 });
    target.write(MAGIC);
    target.write(iv);
    await pipeline(createReadStream(dump), cipher, target, { end: false });
    target.end(cipher.getAuthTag());
    await new Promise((resolve, reject) => { target.once("close", resolve); target.once("error", reject); });
    const digest = createHash("sha256").update(await readFile(output)).digest("hex");
    process.stdout.write(`Backup cifrado criado: ${output}\nSHA-256: ${digest}\n`);
  } finally {
    encryptionKey.fill(0);
    await rm(directory, { recursive: true, force: true });
  }
}

async function restore(databaseUrl, input) {
  if (!process.argv.includes("--confirm-isolated-target")) throw new Error("Restore recusado: usa uma base vazia e confirma com --confirm-isolated-target.");
  const metadata = await stat(input);
  const minimum = MAGIC.length + IV_BYTES + TAG_BYTES + 1;
  if (metadata.size < minimum) throw new Error("Backup inválido ou truncado.");
  const handle = await open(input, "r");
  const header = Buffer.alloc(MAGIC.length + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  await handle.read(header, 0, header.length, 0);
  await handle.read(tag, 0, TAG_BYTES, metadata.size - TAG_BYTES);
  await handle.close();
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Formato de backup UOR Estudante inválido.");
  const directory = await mkdtemp(path.join(tmpdir(), "uor-student-restore-"));
  const dump = path.join(directory, "database.dump");
  const encryptionKey = key();
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, header.subarray(MAGIC.length));
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(input, { start: header.length, end: metadata.size - TAG_BYTES - 1 }), decipher, createWriteStream(dump, { mode: 0o600 }));
    await command("pg_restore", ["--exit-on-error", "--no-owner", "--no-privileges", "--dbname", databaseUrl, dump], databaseUrl);
    await command("psql", ["--no-psqlrc", "--tuples-only", "--command", "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Student','SecretariaSnapshot','UorStudentAggregate','UorStudentAuthorization');"], databaseUrl);
    process.stdout.write("Restore e verificação estrutural concluídos na base isolada.\n");
  } finally {
    encryptionKey.fill(0);
    tag.fill(0);
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv.includes("--help") || process.argv.length < 3) usage();
else {
  const mode = process.argv[2];
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("postgres")) throw new Error("DATABASE_URL PostgreSQL é obrigatória.");
  if (mode === "backup") await backup(databaseUrl, path.resolve(option("--output") ?? ""));
  else if (mode === "restore") await restore(databaseUrl, path.resolve(option("--input") ?? ""));
  else throw new Error("Modo inválido. Usa backup ou restore.");
}
