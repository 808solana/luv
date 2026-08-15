export const API_BASE = (
  process.env.NEXT_PUBLIC_LUV13_API_BASE || "https://api.luv13.ai"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  if (typeof record.error === "string") return record.error;
  if (record.detail && typeof record.detail === "object") {
    const detail = record.detail as Record<string, unknown>;
    if (typeof detail.message === "string") return detail.message;
  }
  return fallback;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      errorMessage(body, `Request failed with status ${response.status}.`),
      response.status,
    );
  }
  return body as T;
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
