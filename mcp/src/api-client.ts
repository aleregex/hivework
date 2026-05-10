import { config } from "./config.js";

export class B1ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "B1ApiError";
  }
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.B1_API_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new B1ApiError(
      res.status,
      `B1 ${method} ${path} -> ${res.status} ${res.statusText} ${text}`,
    );
  }
  return (await res.json()) as T;
}

export const b1Get = <T = unknown>(path: string): Promise<T> =>
  request<T>("GET", path);

export const b1Post = <T = unknown>(
  path: string,
  body: unknown,
): Promise<T> => request<T>("POST", path, body);
