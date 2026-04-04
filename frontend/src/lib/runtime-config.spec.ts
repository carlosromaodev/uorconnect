import { describe, expect, it } from "vitest";
import {
  resolveAbsoluteApiUrl,
  resolveAbsoluteAssetUrl,
  resolveApiBase,
  resolveApiRequestUrl,
} from "./runtime-config";

describe("runtime config", () => {
  const localLocation = {
    hostname: "127.0.0.1",
    origin: "http://127.0.0.1:4173",
  } as const;

  const remoteLocation = {
    hostname: "app.uorconnect.ao",
    origin: "https://app.uorconnect.ao",
  } as const;

  it("uses relative api base by default", () => {
    expect(resolveApiBase(undefined, localLocation)).toBe("/api");
  });

  it("falls back to local proxy when localhost is previewing a remote build", () => {
    expect(resolveApiBase("https://api.uorconnect.space", localLocation)).toBe("/api");
    expect(resolveApiRequestUrl("/courses", "https://api.uorconnect.space", localLocation)).toBe("/api/courses");
    expect(resolveAbsoluteApiUrl("/agenda", "https://api.uorconnect.space", localLocation)).toBe("http://127.0.0.1:4173/api/agenda");
    expect(resolveAbsoluteAssetUrl("/submissions/7/ticket.pdf", "https://api.uorconnect.space", localLocation))
      .toBe("http://127.0.0.1:4173/submissions/7/ticket.pdf");
  });

  it("preserves explicit absolute api base outside localhost", () => {
    expect(resolveApiBase("https://api.uorconnect.space", remoteLocation)).toBe("https://api.uorconnect.space");
    expect(resolveApiRequestUrl("/stats", "https://api.uorconnect.space", remoteLocation))
      .toBe("https://api.uorconnect.space/stats");
    expect(resolveAbsoluteAssetUrl("/submissions/7/ticket.pdf", "https://api.uorconnect.space", remoteLocation))
      .toBe("https://api.uorconnect.space/submissions/7/ticket.pdf");
  });

  it("normalizes relative env values", () => {
    expect(resolveApiBase("api", localLocation)).toBe("/api");
    expect(resolveApiBase("/api/", localLocation)).toBe("/api");
  });
});

