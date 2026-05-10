import { config } from "./config.js";
import { PERSONA_NAME } from "./persona.js";

export type CampaignSummary = {
  id: string;
  onchainPda: string | null;
  status: string;
  brand: { name: string; logoUrl: string | null };
  product: { name: string; imageUrl: string | null; description: string };
  redirectUrl: string;
  creatorWallet: string;
  poolUsdc: string;
  createdAt: string;
  stats: {
    nodeCount: number;
    leafCount: number;
    clickCount: number;
    conversionsCount: number;
  };
};

const POLL_INTERVAL_MS = 10_000;

async function fetchActiveCampaigns(
  signal: AbortSignal,
): Promise<CampaignSummary[]> {
  const res = await fetch(
    `${config.B1_API_URL}/campaigns/active?limit=100&offset=0`,
    { signal },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { items?: CampaignSummary[] };
  return body.items ?? [];
}

export async function* watchNewCampaigns(
  signal: AbortSignal,
): AsyncGenerator<CampaignSummary> {
  const seen = new Set<string>();
  let primed = false;

  console.log(
    `[${PERSONA_NAME}] polling ${config.B1_API_URL}/campaigns/active every ${POLL_INTERVAL_MS / 1000}s`,
  );

  while (!signal.aborted) {
    try {
      const campaigns = await fetchActiveCampaigns(signal);
      for (const c of campaigns) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        if (!primed) continue;
        yield c;
      }
      primed = true;
    } catch (err) {
      if (signal.aborted) return;
      console.warn(
        `[${PERSONA_NAME}:agent warn] poll error: ${(err as Error).message}`,
      );
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, POLL_INTERVAL_MS);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    } catch {
      return;
    }
  }
}
