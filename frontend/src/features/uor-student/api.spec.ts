import { afterEach, describe, expect, it, vi } from "vitest";
import { UorStudentApiError, uorStudentApi } from "./api";

describe("UOR Student API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "uor_csrf=; Max-Age=0; path=/";
  });

  it("uses the private student namespace, cookie credentials and CSRF", async () => {
    document.cookie = "uor_csrf=csrf-test; path=/";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: {
        active: true,
        profileId: "profile-opaque",
        institutionCode: "uor",
        providers: [],
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(uorStudentApi.session()).resolves.toMatchObject({ active: true, institutionCode: "uor" });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/student/session", expect.objectContaining({
      credentials: "include",
      headers: expect.any(Headers),
    }));
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-csrf-token")).toBe("csrf-test");
  });

  it("normalizes backend errors without leaking the response body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: { code: "STUDENT_SESSION_REQUIRED", message: "Sessão necessária." },
    }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }));

    await expect(uorStudentApi.session()).rejects.toEqual(expect.objectContaining<UorStudentApiError>({
      status: 401,
      code: "STUDENT_SESSION_REQUIRED",
      message: "Sessão necessária.",
    }));
  });

  it("rejects a successful response outside the API envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ active: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(uorStudentApi.session()).rejects.toMatchObject({
      status: 502,
      code: "UOR_STUDENT_RESPONSE_INVALID",
    });
  });
});
