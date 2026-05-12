// Builds referral URLs from the running api host (NEXT_PUBLIC_API_URL).
// The actual redirect endpoint is GET /l/:refCode on the api — whichever
// origin serves it (localhost in dev, Railway in prod) is what we want
// users to see and share. We never hardcode a vanity domain.

const RAW_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3401";
const BASE = RAW_BASE.replace(/\/$/, "");

export function shortlinkUrl(refCode: string): string {
  return `${BASE}/l/${refCode}`;
}

export function shortlinkDisplay(refCode: string): string {
  try {
    return `${new URL(BASE).host}/l/${refCode}`;
  } catch {
    return `${BASE.replace(/^https?:\/\//, "")}/l/${refCode}`;
  }
}
