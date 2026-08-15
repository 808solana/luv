import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE, ApiError, apiRequest } from "@/lib/api";

describe("credentialed API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to the production API and includes credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ ok: boolean }>("/auth/me")).resolves.toEqual({
      ok: true,
    });
    expect(API_BASE).toBe("https://api.luv13.ai");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.luv13.ai/auth/me",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it("returns a typed API error without logging response bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Invalid email or password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(apiRequest("/auth/login")).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: "ApiError",
        status: 401,
        message: "Invalid email or password",
      }),
    );
  });
});
