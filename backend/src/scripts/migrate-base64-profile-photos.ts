import { createHash } from "node:crypto";
import { loadEnv } from "../config/env";
import { prisma } from "../shared/prisma";
import { persistMediaValue } from "../modules/media/application/media-storage";

type PhotoRecord = {
  id: number;
  value: string | null;
};

type PhotoTarget = {
  label: string;
  purpose: string;
  fetchBatch: (cursorId: number | null, take: number) => Promise<PhotoRecord[]>;
  update: (id: number, url: string) => Promise<unknown>;
};

type TargetResult = {
  label: string;
  scanned: number;
  alreadyStored: number;
  externalOrEmpty: number;
  convertible: number;
  converted: number;
  failed: number;
};

const dataImagePattern = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i;
const storedMediaPattern = /^\/(?:api\/)?media\/files\//i;
const externalUrlPattern = /^(https?:)?\/\//i;
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const batchSizeArg = argv.find((arg) => arg.startsWith("--batch-size="));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const batchSize = Math.max(1, Math.min(500, Number(batchSizeArg?.split("=")[1] ?? 100)));
  const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : null;
  return { dryRun, batchSize, limit };
}

function normalizeMimeType(value: string) {
  const mime = value.toLowerCase();
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function detectImageMimeType(buffer: Buffer) {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function decodeBase64Image(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 128 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  const buffer = Buffer.from(compact, "base64");
  const mimeType = detectImageMimeType(buffer);
  if (!mimeType) return null;
  return { dataUrl: `data:${mimeType};base64,${compact}`, mimeType };
}

function normalizeConvertiblePhoto(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return { kind: "empty" as const };
  if (storedMediaPattern.test(trimmed)) return { kind: "stored" as const };
  if (externalUrlPattern.test(trimmed) || trimmed.startsWith("/")) return { kind: "external" as const };

  const dataMatch = trimmed.match(dataImagePattern);
  if (dataMatch) {
    const base64 = dataMatch[2].replace(/\s+/g, "");
    const buffer = Buffer.from(base64, "base64");
    const declaredMimeType = normalizeMimeType(dataMatch[1]);
    const detectedMimeType = detectImageMimeType(buffer) ?? declaredMimeType;
    if (!allowedImageMimeTypes.has(detectedMimeType)) {
      return { kind: "unsupported" as const, reason: `mime ${detectedMimeType}` };
    }
    return { kind: "convertible" as const, dataUrl: `data:${detectedMimeType};base64,${base64}` };
  }

  const decoded = decodeBase64Image(trimmed);
  if (decoded) return { kind: "convertible" as const, dataUrl: decoded.dataUrl };

  return { kind: "external" as const };
}

function hashDataUrl(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const targets: PhotoTarget[] = [
  {
    label: "Student.avatarUrl",
    purpose: "avatars",
    fetchBatch: (cursorId, take) => prisma.student.findMany({
      where: { avatarUrl: { not: null } },
      select: { id: true, avatarUrl: true },
      orderBy: { id: "asc" },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take,
    }).then((rows) => rows.map((row) => ({ id: row.id, value: row.avatarUrl }))),
    update: (id, url) => prisma.student.update({ where: { id }, data: { avatarUrl: url } }),
  },
  {
    label: "EventTeamCredential.photoUrl",
    purpose: "credential-photos",
    fetchBatch: (cursorId, take) => prisma.eventTeamCredential.findMany({
      where: { photoUrl: { not: null } },
      select: { id: true, photoUrl: true },
      orderBy: { id: "asc" },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take,
    }).then((rows) => rows.map((row) => ({ id: row.id, value: row.photoUrl }))),
    update: (id, url) => prisma.eventTeamCredential.update({ where: { id }, data: { photoUrl: url } }),
  },
  {
    label: "TeamMembershipClaim.photoUrl",
    purpose: "credential-photos",
    fetchBatch: (cursorId, take) => prisma.teamMembershipClaim.findMany({
      where: { photoUrl: { not: null } },
      select: { id: true, photoUrl: true },
      orderBy: { id: "asc" },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take,
    }).then((rows) => rows.map((row) => ({ id: row.id, value: row.photoUrl }))),
    update: (id, url) => prisma.teamMembershipClaim.update({ where: { id }, data: { photoUrl: url } }),
  },
  {
    label: "Speaker.avatarUrl",
    purpose: "avatars",
    fetchBatch: (cursorId, take) => prisma.speaker.findMany({
      where: { avatarUrl: { not: null } },
      select: { id: true, avatarUrl: true },
      orderBy: { id: "asc" },
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take,
    }).then((rows) => rows.map((row) => ({ id: row.id, value: row.avatarUrl }))),
    update: (id, url) => prisma.speaker.update({ where: { id }, data: { avatarUrl: url } }),
  },
];

async function migrateTarget(
  target: PhotoTarget,
  options: { dryRun: boolean; batchSize: number; limit: number | null },
  storedByHash: Map<string, string>,
) {
  const env = loadEnv();
  const result: TargetResult = {
    label: target.label,
    scanned: 0,
    alreadyStored: 0,
    externalOrEmpty: 0,
    convertible: 0,
    converted: 0,
    failed: 0,
  };
  let cursorId: number | null = null;

  while (options.limit === null || result.scanned < options.limit) {
    const remaining = options.limit === null ? options.batchSize : Math.min(options.batchSize, options.limit - result.scanned);
    const batch = await target.fetchBatch(cursorId, remaining);
    if (batch.length === 0) break;

    for (const row of batch) {
      cursorId = row.id;
      result.scanned += 1;
      const normalized = normalizeConvertiblePhoto(row.value);

      if (normalized.kind === "stored") {
        result.alreadyStored += 1;
        continue;
      }

      if (normalized.kind === "empty" || normalized.kind === "external") {
        result.externalOrEmpty += 1;
        continue;
      }

      if (normalized.kind === "unsupported") {
        result.failed += 1;
        console.warn(`[media:migrate] ${target.label}#${row.id} ignorado: ${normalized.reason}`);
        continue;
      }

      result.convertible += 1;
      if (options.dryRun) continue;

      try {
        const cacheKey = hashDataUrl(normalized.dataUrl);
        const storedUrl = storedByHash.get(cacheKey)
          ?? await persistMediaValue(env, normalized.dataUrl, {
            purpose: target.purpose,
            maxImageDimension: 900,
          });

        if (!storedUrl) {
          throw new Error("storage não devolveu URL");
        }

        storedByHash.set(cacheKey, storedUrl);
        await target.update(row.id, storedUrl);
        result.converted += 1;
      } catch (error) {
        result.failed += 1;
        console.error(`[media:migrate] falha em ${target.label}#${row.id}:`, error instanceof Error ? error.message : error);
      }
    }

    if (batch.length < remaining) break;
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const storedByHash = new Map<string, string>();
  console.log(`[media:migrate] ${options.dryRun ? "dry-run" : "aplicando"} migracao de fotos base64 para storage local`);

  const results: TargetResult[] = [];
  for (const target of targets) {
    results.push(await migrateTarget(target, options, storedByHash));
  }

  console.table(results);
  const totals = results.reduce((acc, item) => ({
    scanned: acc.scanned + item.scanned,
    alreadyStored: acc.alreadyStored + item.alreadyStored,
    externalOrEmpty: acc.externalOrEmpty + item.externalOrEmpty,
    convertible: acc.convertible + item.convertible,
    converted: acc.converted + item.converted,
    failed: acc.failed + item.failed,
  }), { scanned: 0, alreadyStored: 0, externalOrEmpty: 0, convertible: 0, converted: 0, failed: 0 });

  console.log("[media:migrate] totais", totals);
  if (options.dryRun) {
    console.log("[media:migrate] nenhuma escrita foi feita. Execute sem --dry-run para converter.");
  }

  if (totals.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[media:migrate] erro fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
