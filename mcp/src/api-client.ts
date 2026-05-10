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

export async function b1Get<T = unknown>(path: string): Promise<T> {
  const url = `${config.B1_API_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new B1ApiError(
      res.status,
      `B1 GET ${path} -> ${res.status} ${res.statusText} ${text}`,
    );
  }
  return (await res.json()) as T;
}