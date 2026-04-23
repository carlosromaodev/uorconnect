import { randomUUID } from "node:crypto";

export type PdfJobStatus = "queued" | "processing" | "completed" | "failed";

export type PdfJobResult = {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
};

type PdfJob = {
  id: string;
  kind: string;
  status: PdfJobStatus;
  createdAt: Date;
  updatedAt: Date;
  error: string | null;
  result: PdfJobResult | null;
  execute: () => Promise<PdfJobResult>;
};

type EnqueuePdfJobInput = {
  kind: string;
  execute: () => Promise<PdfJobResult>;
};

const jobs = new Map<string, PdfJob>();
const queue: string[] = [];
const maxConcurrentJobs = 1;
const jobTtlMs = 1000 * 60 * 20;
let processingJobs = 0;

function pruneExpiredJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if ((now - job.updatedAt.getTime()) > jobTtlMs) {
      jobs.delete(id);
    }
  }
}

async function processQueue() {
  if (processingJobs >= maxConcurrentJobs) return;
  const nextJobId = queue.shift();
  if (!nextJobId) return;

  const job = jobs.get(nextJobId);
  if (!job || job.status !== "queued") {
    return processQueue();
  }

  processingJobs += 1;
  job.status = "processing";
  job.updatedAt = new Date();

  try {
    const result = await job.execute();
    job.result = result;
    job.status = "completed";
    job.error = null;
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Falha ao gerar PDF";
  } finally {
    job.updatedAt = new Date();
    processingJobs -= 1;
    pruneExpiredJobs();
    void processQueue();
  }
}

export function enqueuePdfJob(input: EnqueuePdfJobInput) {
  pruneExpiredJobs();
  const id = randomUUID();
  const now = new Date();
  const job: PdfJob = {
    id,
    kind: input.kind,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    error: null,
    result: null,
    execute: input.execute,
  };

  jobs.set(id, job);
  queue.push(id);
  void processQueue();

  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function getPdfJob(jobId: string) {
  pruneExpiredJobs();
  const job = jobs.get(jobId);
  if (!job) return null;

  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    hasFile: Boolean(job.result),
  };
}

export function getPdfJobResult(jobId: string) {
  pruneExpiredJobs();
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status !== "completed" || !job.result) return null;
  return job.result;
}
