import { describe, expect, it, vi } from "vitest";
import { UorStudentDataDeletionWorker } from "./uor-student-data-deletion.worker";

describe("UorStudentDataDeletionWorker", () => {
  it("processa pedidos pendentes em lote sem sobrepor drains", async () => {
    const processNextDataDeletion = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const worker = new UorStudentDataDeletionWorker({ processNextDataDeletion }, { pollMs: 60_000 });

    worker.start();
    worker.kick();
    await vi.waitFor(() => expect(processNextDataDeletion).toHaveBeenCalledTimes(3));
    await worker.stop();
  });

  it("permanece inativo quando desabilitado", async () => {
    const processNextDataDeletion = vi.fn(async () => false);
    const worker = new UorStudentDataDeletionWorker({ processNextDataDeletion }, { enabled: false });

    worker.start();
    worker.kick();
    await worker.stop();
    expect(processNextDataDeletion).not.toHaveBeenCalled();
  });
});
