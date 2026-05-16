import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Env } from "../config/env";
import { prisma } from "./prisma";

export type PdfJobStatus = "queued" | "processing" | "completed" | "failed" | "expired";

export type PdfJobResult = {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
};

export type DurablePdfJob = {
  id: string;
  kind: string;
  businessKey: string;
  snapshot: Record<string, unknown> | null;
};

type PdfJobHandler = (job: DurablePdfJob) => Promise<PdfJobResult>;

type EnqueuePdfJobInput = {
  kind: string;
  businessKey?: string;
  fileName?: string;
  snapshot?: Record<string, unknown>;
  createdByStudentNumber?: string | null;
  execute?: () => Promise<PdfJobResult>;
};

type PdfDocumentJobRecord = {
  id: string;
  kind: string;
  businessKey: string;
  status: string;
  fileName: string;
  filePath: string | null;
  contentType: string;
  sizeBytes: number | null;
  error: string | null;
  snapshotJson: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
};

const handlers = new Map<string, PdfJobHandler>();
const oneShotHandlers = new Map<string, () => Promise<PdfJobResult>>();
const maxConcurrentJobs = 1;
const staleProcessingMs = 10 * 60 * 1000;
let processingJobs = 0;

export function registerPdfJobHandler(kind: string, handler: PdfJobHandler) {
  handlers.set(kind, handler);
}

function storageRoot(env: Env) {
  return path.resolve(process.cwd(), env.PDF_JOB_STORAGE_DIR);
}

function retentionExpiresAt(env: Env) {
  return new Date(Date.now() + env.PDF_JOB_RETENTION_HOURS * 60 * 60 * 1000);
}

function normalizeStatus(status: string): PdfJobStatus {
  if (status === "processing" || status === "completed" || status === "failed" || status === "expired") {
    return status;
  }
  return "queued";
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function pdfJobInputHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parseSnapshot(snapshotJson: string | null): Record<string, unknown> | null {
  if (!snapshotJson) return null;
  try {
    const parsed = JSON.parse(snapshotJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function serializeJob(job: PdfDocumentJobRecord) {
  return {
    id: job.id,
    kind: job.kind,
    status: normalizeStatus(job.status),
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    expiresAt: job.expiresAt?.toISOString() ?? null,
    hasFile: Boolean(job.filePath),
    fileName: job.fileName,
    sizeBytes: job.sizeBytes,
  };
}

function safeKindSegment(kind: string) {
  return kind.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "pdf";
}

async function persistPdfResult(env: Env, jobId: string, kind: string, result: PdfJobResult) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const relativePath = path.join(safeKindSegment(kind), year, month, `${jobId}.pdf`);
  const absolutePath = path.join(storageRoot(env), relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, result.buffer);
  return {
    filePath: relativePath,
    sizeBytes: result.buffer.byteLength,
  };
}

async function removeStoredFile(env: Env, filePath: string | null) {
  if (!filePath) return;
  try {
    const absolutePath = path.join(storageRoot(env), filePath);
    await unlink(absolutePath);
  } catch {
    // Missing files are already clean from the user's point of view.
  }
}

async function pruneExpiredJobs(env: Env) {
  const now = new Date();
  const expiredJobs = await prisma.pdfDocumentJob.findMany({
    where: {
      status: "completed",
      expiresAt: { lt: now },
      filePath: { not: null },
    },
    select: { id: true, filePath: true },
    take: 50,
  });

  for (const job of expiredJobs) {
    await removeStoredFile(env, job.filePath);
    await prisma.pdfDocumentJob.update({
      where: { id: job.id },
      data: {
        status: "expired",
        filePath: null,
        sizeBytes: null,
        error: "PDF expirado pela política de retenção.",
      },
    });
  }
}

async function recoverStaleProcessingJobs() {
  const staleBefore = new Date(Date.now() - staleProcessingMs);
  await prisma.pdfDocumentJob.updateMany({
    where: {
      status: "processing",
      lockedAt: { lt: staleBefore },
    },
    data: {
      status: "queued",
      lockedAt: null,
      lockOwner: null,
      error: "Processamento anterior interrompido; job reenfileirado.",
    },
  });
}

async function executeJob(env: Env, job: Awaited<ReturnType<typeof prisma.pdfDocumentJob.update>>) {
  const handler = oneShotHandlers.get(job.id) ?? handlers.get(job.kind);
  if (!handler) {
    throw new Error(`Nenhum executor de PDF registado para ${job.kind}.`);
  }

  const result = await handler({
    id: job.id,
    kind: job.kind,
    businessKey: job.businessKey,
    snapshot: parseSnapshot(job.snapshotJson),
  });
  const stored = await persistPdfResult(env, job.id, job.kind, result);
  const completedAt = new Date();

  await prisma.pdfDocumentJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      fileName: result.fileName,
      contentType: result.contentType ?? "application/pdf",
      filePath: stored.filePath,
      sizeBytes: stored.sizeBytes,
      error: null,
      completedAt,
      expiresAt: retentionExpiresAt(env),
      lockedAt: null,
      lockOwner: null,
    },
  });
}

async function processQueue(env: Env) {
  if (processingJobs >= maxConcurrentJobs) return;

  await recoverStaleProcessingJobs();
  const nextJob = await prisma.pdfDocumentJob.findFirst({
    where: { status: "queued" },
    orderBy: [{ createdAt: "asc" }],
  });
  if (!nextJob) return;

  processingJobs += 1;
  const lockOwner = `${process.pid}-${randomUUID()}`;
  const startedAt = new Date();
  const job = await prisma.pdfDocumentJob.update({
    where: { id: nextJob.id },
    data: {
      status: "processing",
      startedAt,
      lockedAt: startedAt,
      lockOwner,
      attempts: { increment: 1 },
      error: null,
    },
  });

  try {
    await executeJob(env, job);
  } catch (error) {
    await prisma.pdfDocumentJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Falha ao gerar PDF",
        lockedAt: null,
        lockOwner: null,
        expiresAt: retentionExpiresAt(env),
      },
    });
  } finally {
    oneShotHandlers.delete(job.id);
    processingJobs -= 1;
    void processQueue(env);
  }
}

export async function enqueuePdfJob(env: Env, input: EnqueuePdfJobInput) {
  await pruneExpiredJobs(env);

  const snapshot = input.snapshot ?? {};
  const inputHash = pdfJobInputHash(snapshot);
  const businessKey = input.businessKey ?? `${input.kind}:${inputHash}`;
  const now = new Date();
  const existing = await prisma.pdfDocumentJob.findUnique({ where: { businessKey } });

  if (existing && existing.status === "completed" && existing.filePath && (!existing.expiresAt || existing.expiresAt > now)) {
    return serializeJob(existing);
  }

  const snapshotJson = stableJson(snapshot);
  const job = existing
    ? await prisma.pdfDocumentJob.update({
      where: { id: existing.id },
      data: {
        status: "queued",
        fileName: input.fileName ?? existing.fileName,
        filePath: null,
        sizeBytes: null,
        contentType: "application/pdf",
        error: null,
        inputHash,
        snapshotJson,
        createdByStudentNumber: input.createdByStudentNumber ?? existing.createdByStudentNumber,
        startedAt: null,
        completedAt: null,
        expiresAt: null,
        lockedAt: null,
        lockOwner: null,
      },
    })
    : await prisma.pdfDocumentJob.create({
      data: {
        kind: input.kind,
        businessKey,
        status: "queued",
        fileName: input.fileName ?? `${safeKindSegment(input.kind)}.pdf`,
        inputHash,
        snapshotJson,
        createdByStudentNumber: input.createdByStudentNumber ?? null,
      },
    });

  if (input.execute) {
    oneShotHandlers.set(job.id, input.execute);
  }

  void processQueue(env);
  return serializeJob(job);
}

export async function getPdfJob(env: Env, jobId: string) {
  await pruneExpiredJobs(env);
  void processQueue(env);

  const job = await prisma.pdfDocumentJob.findUnique({ where: { id: jobId } });
  return job ? serializeJob(job) : null;
}

export async function getPdfJobResult(env: Env, jobId: string): Promise<PdfJobResult | null> {
  await pruneExpiredJobs(env);
  const job = await prisma.pdfDocumentJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "completed" || !job.filePath) return null;

  try {
    const buffer = await readFile(path.join(storageRoot(env), job.filePath));
    return {
      buffer,
      fileName: job.fileName,
      contentType: job.contentType,
    };
  } catch {
    await prisma.pdfDocumentJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "Ficheiro PDF gerado não foi encontrado no storage.",
        filePath: null,
        sizeBytes: null,
      },
    });
    return null;
  }
}
