import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { PrismaMoodleRepository } from "../infra/prisma-moodle.repository";
import { WebSessionMoodleGateway } from "../infra/web-session-moodle.gateway";
import { MoodleCryptoKeyring } from "../infra/crypto-envelope";
import { MoodleCursorCodec } from "../infra/moodle-cursor";
import type { MoodleApplication } from "./ports";
import { DisabledMoodleApplication } from "./disabled-moodle.application";
import { MoodleSessionManager } from "./moodle-session-manager";
import { MoodleSyncWorker } from "./moodle-sync-worker";
import { LiveMoodleApplication } from "./live-moodle.application";

export type CreateMoodleApplicationOverrides = {
  application?: MoodleApplication;
};

export function createMoodleApplication(
  env: Env,
  overrides: CreateMoodleApplicationOverrides = {},
): MoodleApplication {
  if (overrides.application) return overrides.application;
  const repository = new PrismaMoodleRepository(prisma);
  if (!env.MOODLE_INTEGRATION_ENABLED) return new DisabledMoodleApplication(repository);

  const gateway = new WebSessionMoodleGateway({
    baseUrl: env.MOODLE_BASE_URL,
    timeoutMs: env.MOODLE_FETCH_TIMEOUT_MS,
    maxDownloadBytes: env.MOODLE_DOWNLOAD_MAX_BYTES,
    downloadStreamTimeoutMs: env.MOODLE_DOWNLOAD_STREAM_TIMEOUT_MS,
    sessionIdleTtlMs: env.MOODLE_SESSION_IDLE_TTL_MINUTES * 60_000,
  });
  const keyring = MoodleCryptoKeyring.fromConfig(
    env.MOODLE_ACTIVE_ENCRYPTION_KEY_ID,
    env.MOODLE_ENCRYPTION_KEYS,
  );
  const cursor = new MoodleCursorCodec({
    activeKeyId: env.MOODLE_ACTIVE_ENCRYPTION_KEY_ID,
    serializedKeys: env.MOODLE_ENCRYPTION_KEYS,
  });
  const sessions = new MoodleSessionManager(repository, gateway, keyring, {
    l1TtlMs: env.MOODLE_L1_TTL_SECONDS * 1_000,
  });
  const worker = new MoodleSyncWorker(repository, gateway, keyring, sessions, {
    enabled: env.MOODLE_SYNC_WORKER_ENABLED,
    concurrency: env.MOODLE_SYNC_CONCURRENCY,
    prisma,
  });
  return new LiveMoodleApplication(
    repository,
    gateway,
    keyring,
    cursor,
    sessions,
    worker,
  );
}
