import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Env } from "../../../config/env";

const DATA_URL_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_MIME_TYPES = new Set(["application/pdf"]);
const PUBLIC_MEDIA_PREFIX = "/api/media/files";
const BACKEND_MEDIA_PREFIX = "/media/files";
const PRIVATE_PURPOSES = new Set(["course-payment-proofs", "submission-payment-proofs"]);

type StoreMediaOptions = {
  purpose: string;
  allowDocuments?: boolean;
  maxBytes?: number;
  maxImageDimension?: number;
  thumbnailDimension?: number;
};

export type MediaStoragePolicy = {
  imageMimeTypes: string[];
  documentMimeTypes: string[];
  defaultImageMaxBytes: number;
  defaultDocumentMaxBytes: number;
  defaultMaxImageDimension: number;
  defaultThumbnailDimension: number;
  publicCacheMaxAgeSeconds: number;
  orphanRetentionDays: number;
  privatePurposes: string[];
};

export type OrphanMediaCleanupResult = {
  scanned: number;
  orphaned: number;
  deleted: number;
  bytesDeleted: number;
  dryRun: boolean;
  retentionDays: number;
};

export type StoredMedia = {
  url: string;
  thumbnailUrl: string | null;
  mimeType: string;
  originalMimeType: string;
  size: number;
  originalSize: number;
  width: number | null;
  height: number | null;
  metadataUrl: string;
};

function sanitizePurpose(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "general";
}

function mediaRoot(env: Env) {
  return path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR);
}

function assertInsideRoot(root: string, target: string) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid media path");
  }
}

function parseDataUrl(value: string) {
  const match = value.match(DATA_URL_PATTERN);
  if (!match) return null;

  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

function buildRelativeDir(purpose: string) {
  const now = new Date();
  return path.join(sanitizePurpose(purpose), String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
}

function buildPublicUrl(relativePath: string) {
  return `${PUBLIC_MEDIA_PREFIX}/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function mediaUrlToFilePath(root: string, url: string | null | undefined) {
  const relative = url ? storedMediaRelativePath(url) : null;
  if (!relative) return null;
  const filePath = path.resolve(root, relative);
  assertInsideRoot(root, filePath);
  return filePath;
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function storeImage(root: string, relativeDir: string, buffer: Buffer, originalMimeType: string, options: StoreMediaOptions): Promise<StoredMedia> {
  const id = randomUUID();
  const maxImageDimension = options.maxImageDimension ?? 1600;
  const thumbnailDimension = options.thumbnailDimension ?? 320;
  const outputPath = path.join(root, relativeDir, `${id}.webp`);
  const thumbnailPath = path.join(root, relativeDir, `${id}.thumb.webp`);
  const metadataPath = path.join(root, relativeDir, `${id}.json`);

  const optimized = await sharp(buffer, { failOn: "warning", limitInputPixels: 64_000_000 })
    .rotate()
    .resize({
      width: maxImageDimension,
      height: maxImageDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  const thumbnail = await sharp(buffer, { failOn: "warning", limitInputPixels: 64_000_000 })
    .rotate()
    .resize({
      width: thumbnailDimension,
      height: thumbnailDimension,
      fit: "cover",
      withoutEnlargement: false,
    })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();

  await Promise.all([
    writeFile(outputPath, optimized.data),
    writeFile(thumbnailPath, thumbnail),
  ]);

  const relativeOutput = path.join(relativeDir, `${id}.webp`);
  const relativeThumbnail = path.join(relativeDir, `${id}.thumb.webp`);
  const relativeMetadata = path.join(relativeDir, `${id}.json`);
  const metadata: StoredMedia = {
    url: buildPublicUrl(relativeOutput),
    thumbnailUrl: buildPublicUrl(relativeThumbnail),
    mimeType: "image/webp",
    originalMimeType,
    size: optimized.data.length,
    originalSize: buffer.length,
    width: optimized.info.width,
    height: optimized.info.height,
    metadataUrl: buildPublicUrl(relativeMetadata),
  };

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

async function storeDocument(root: string, relativeDir: string, buffer: Buffer, mimeType: string): Promise<StoredMedia> {
  const id = randomUUID();
  const extension = mimeType === "application/pdf" ? "pdf" : "bin";
  const outputPath = path.join(root, relativeDir, `${id}.${extension}`);
  const metadataPath = path.join(root, relativeDir, `${id}.json`);
  const relativeOutput = path.join(relativeDir, `${id}.${extension}`);
  const relativeMetadata = path.join(relativeDir, `${id}.json`);

  await writeFile(outputPath, buffer);

  const metadata: StoredMedia = {
    url: buildPublicUrl(relativeOutput),
    thumbnailUrl: null,
    mimeType,
    originalMimeType: mimeType,
    size: buffer.length,
    originalSize: buffer.length,
    width: null,
    height: null,
    metadataUrl: buildPublicUrl(relativeMetadata),
  };

  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

export function isStoredMediaUrl(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.startsWith(`${PUBLIC_MEDIA_PREFIX}/`) || trimmed.startsWith(`${BACKEND_MEDIA_PREFIX}/`);
}

function storedMediaRelativePath(publicPath: string) {
  const cleaned = publicPath.replace(/^\/+/, "").replace(/^api\//, "");
  const expectedPrefix = BACKEND_MEDIA_PREFIX.replace(/^\/+/, "");
  if (!cleaned.startsWith(`${expectedPrefix}/`)) {
    return null;
  }

  return decodeURIComponent(cleaned.slice(expectedPrefix.length + 1));
}

export function isPrivateStoredMediaUrl(value?: string | null) {
  const relative = value ? storedMediaRelativePath(value.trim()) : null;
  if (!relative) return false;
  const [purpose] = relative.split(/[\\/]/);
  return PRIVATE_PURPOSES.has(purpose);
}

export function isDataUrl(value?: string | null) {
  return Boolean(value?.trim().startsWith("data:"));
}

export async function storeMediaDataUrl(env: Env, dataUrl: string, options: StoreMediaOptions): Promise<StoredMedia> {
  const parsed = parseDataUrl(dataUrl.trim());
  if (!parsed) {
    throw new Error("Ficheiro inválido.");
  }

  const isImage = IMAGE_MIME_TYPES.has(parsed.mimeType);
  const isDocument = DOCUMENT_MIME_TYPES.has(parsed.mimeType);
  if (!isImage && !(options.allowDocuments && isDocument)) {
    throw new Error("Tipo de ficheiro não suportado.");
  }

  const maxBytes = options.maxBytes ?? (isImage ? 6 * 1024 * 1024 : 10 * 1024 * 1024);
  if (parsed.buffer.length > maxBytes) {
    throw new Error("Ficheiro acima do limite permitido.");
  }

  const root = mediaRoot(env);
  const relativeDir = buildRelativeDir(options.purpose);
  const outputDir = path.join(root, relativeDir);
  assertInsideRoot(root, outputDir);
  await ensureDir(outputDir);

  return isImage
    ? storeImage(root, relativeDir, parsed.buffer, parsed.mimeType, options)
    : storeDocument(root, relativeDir, parsed.buffer, parsed.mimeType);
}

export async function persistMediaValue(
  env: Env,
  value: string | null | undefined,
  options: StoreMediaOptions,
) {
  const trimmed = value?.trim();
  if (!trimmed) return trimmed === "" || value === null ? null : undefined;
  if (!isDataUrl(trimmed)) return trimmed;
  const stored = await storeMediaDataUrl(env, trimmed, options);
  return stored.url;
}

export async function resolveStoredMediaFile(env: Env, publicPath: string) {
  const relative = storedMediaRelativePath(publicPath);
  if (!relative) return null;
  const root = mediaRoot(env);
  const filePath = path.resolve(root, relative);
  assertInsideRoot(root, filePath);

  await access(filePath);
  const metadataPath = filePath.replace(/\.(webp|pdf|bin)$/i, ".json").replace(/\.thumb\.json$/i, ".json");
  const metadata = await readFile(metadataPath, "utf8")
    .then((content) => JSON.parse(content) as StoredMedia)
    .catch(() => null);

  return {
    filePath,
    stream: createReadStream(filePath),
    mimeType: metadata?.mimeType ?? (filePath.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
    size: metadata?.size ?? null,
  };
}

export function getMediaStoragePolicy(env: Env): MediaStoragePolicy {
  return {
    imageMimeTypes: [...IMAGE_MIME_TYPES],
    documentMimeTypes: [...DOCUMENT_MIME_TYPES],
    defaultImageMaxBytes: 6 * 1024 * 1024,
    defaultDocumentMaxBytes: 10 * 1024 * 1024,
    defaultMaxImageDimension: 1600,
    defaultThumbnailDimension: 320,
    publicCacheMaxAgeSeconds: 31_536_000,
    orphanRetentionDays: env.MEDIA_ORPHAN_RETENTION_DAYS,
    privatePurposes: [...PRIVATE_PURPOSES],
  };
}

async function walkMetadataFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMetadataFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith(".json")) return [fullPath];
    return [];
  }));
  return nested.flat();
}

export async function cleanupOrphanedMediaFiles(
  env: Env,
  referencedUrls: Set<string>,
  options: { dryRun?: boolean; retentionDays?: number } = {},
): Promise<OrphanMediaCleanupResult> {
  const root = mediaRoot(env);
  const retentionDays = options.retentionDays ?? env.MEDIA_ORPHAN_RETENTION_DAYS;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const metadataFiles = await walkMetadataFiles(root);
  let orphaned = 0;
  let deleted = 0;
  let bytesDeleted = 0;

  for (const metadataPath of metadataFiles) {
    assertInsideRoot(root, metadataPath);
    const metadata = await readFile(metadataPath, "utf8")
      .then((content) => JSON.parse(content) as StoredMedia)
      .catch(() => null);
    if (!metadata) continue;

    const metadataStat = await stat(metadataPath).catch(() => null);
    if (metadataStat && metadataStat.mtimeMs > cutoff) continue;
    if (
      referencedUrls.has(metadata.url)
      || (metadata.thumbnailUrl ? referencedUrls.has(metadata.thumbnailUrl) : false)
      || referencedUrls.has(metadata.metadataUrl)
    ) continue;

    orphaned += 1;
    if (options.dryRun) continue;

    const paths = [
      mediaUrlToFilePath(root, metadata.url),
      mediaUrlToFilePath(root, metadata.thumbnailUrl),
      metadataPath,
    ].filter((value): value is string => Boolean(value));

    for (const filePath of paths) {
      const fileStat = await stat(filePath).catch(() => null);
      await unlink(filePath).catch(() => null);
      deleted += 1;
      bytesDeleted += fileStat?.size ?? 0;
    }
  }

  return {
    scanned: metadataFiles.length,
    orphaned,
    deleted,
    bytesDeleted,
    dryRun: Boolean(options.dryRun),
    retentionDays,
  };
}
