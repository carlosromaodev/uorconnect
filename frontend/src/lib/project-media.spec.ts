import { describe, expect, it } from "vitest";
import { getProjectBannerSource } from "./project-media";

describe("project media", () => {
  const remoteLocation = {
    hostname: "www.uorconnect.ao",
    origin: "https://www.uorconnect.ao",
  } as const;

  const localLocation = {
    hostname: "127.0.0.1",
    origin: "http://127.0.0.1:4173",
  } as const;

  it("resolves stored project banners against the configured API host without duplicating the /api prefix", () => {
    expect(
      getProjectBannerSource(
        "/api/media/files/submission-banners/2026/05/capa.webp",
        "https://api.uorconnect.ao",
        remoteLocation,
      ),
    ).toBe("https://api.uorconnect.ao/media/files/submission-banners/2026/05/capa.webp");
  });

  it("keeps local previews on the local proxy", () => {
    expect(
      getProjectBannerSource(
        "/api/media/files/submission-banners/2026/05/capa.webp",
        "https://api.uorconnect.ao",
        localLocation,
      ),
    ).toBe("http://127.0.0.1:4173/api/media/files/submission-banners/2026/05/capa.webp");
  });

  it("rejects non-media relative paths", () => {
    expect(getProjectBannerSource("/uploads/capa.webp", undefined, remoteLocation)).toBeNull();
  });
});
