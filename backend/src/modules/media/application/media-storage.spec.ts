import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Env } from "../../../config/env";
import { resolveStoredMediaFile, storeMediaDataUrl } from "./media-storage";

const png1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
const pdfTiny = "data:application/pdf;base64,JVBERi0xLjQKJUVPRgo=";

async function withTempEnv<T>(fn: (env: Env) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "uor-media-"));
  try {
    return await fn({ MEDIA_STORAGE_DIR: dir } as Env);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("media storage", () => {
  it("optimiza imagem, gera thumbnail e devolve URL publica", async () => {
    await withTempEnv(async (env) => {
      const stored = await storeMediaDataUrl(env, png1x1, { purpose: "avatars" });

      expect(stored.url).toMatch(/^\/api\/media\/files\/avatars\/\d{4}\/\d{2}\/.+\.webp$/);
      expect(stored.thumbnailUrl).toMatch(/\.thumb\.webp$/);
      expect(stored.mimeType).toBe("image/webp");
      expect(stored.originalMimeType).toBe("image/png");
      expect(stored.width).toBe(1);
      expect(stored.height).toBe(1);

      const file = await resolveStoredMediaFile(env, stored.url);
      expect(file?.mimeType).toBe("image/webp");
    });
  });

  it("guarda documento quando permitido", async () => {
    await withTempEnv(async (env) => {
      const stored = await storeMediaDataUrl(env, pdfTiny, {
        purpose: "course-payment-proofs",
        allowDocuments: true,
      });

      expect(stored.url).toMatch(/\.pdf$/);
      expect(stored.thumbnailUrl).toBeNull();
      expect(stored.mimeType).toBe("application/pdf");
    });
  });
});
