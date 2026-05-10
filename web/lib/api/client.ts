// Typed fetch wrapper for the api/ HTTP service. Works in both server and
// client components — Next inlines NEXT_PUBLIC_* on both sides.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const hasJson = init?.json !== undefined;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(hasJson ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    body: hasJson ? JSON.stringify(init.json) : init?.body,
    cache: init?.cache ?? "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new ApiError(
      res.status,
      body.error ?? "unknown",
      body.message ?? res.statusText
    );
  }
  return (await res.json()) as T;
}

export const apiBaseUrl = BASE;
