import type { UorStudentIdentityRepository } from "../application/ports";

const DEFAULT_POLL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 20;

export class UorStudentDataDeletionWorker {
  #timer: NodeJS.Timeout | null = null;
  #drain: Promise<void> | null = null;
  #stopping = false;

  constructor(
    private readonly repository: Pick<UorStudentIdentityRepository, "processNextDataDeletion">,
    private readonly options: { enabled?: boolean; pollMs?: number; batchSize?: number } = {},
  ) {}

  start() {
    if (this.options.enabled === false || this.#timer) return;
    this.#stopping = false;
    this.#timer = setInterval(() => this.kick(), this.options.pollMs ?? DEFAULT_POLL_MS);
    this.#timer.unref?.();
    this.kick();
  }

  async stop() {
    this.#stopping = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    await this.#drain?.catch(() => undefined);
  }

  kick() {
    if (this.options.enabled === false || this.#stopping || this.#drain) return;
    this.#drain = this.#processBatch()
      .catch(() => undefined)
      .finally(() => {
        this.#drain = null;
      });
  }

  async #processBatch() {
    for (let processed = 0; processed < (this.options.batchSize ?? DEFAULT_BATCH_SIZE); processed += 1) {
      if (this.#stopping || !await this.repository.processNextDataDeletion()) return;
    }
  }
}
