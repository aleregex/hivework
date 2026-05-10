# Hivework API — Frontend Integration Guide

> What `web/` needs to talk to `api/`. Not for agents (see `mcp/README.md`), not for the indexer (see `indexer/`).

---

## TL;DR

| | |
|---|---|
| Base URL (local) | `http://localhost:3001` |
| Base URL (deploy) | set in `web/.env.local` as `NEXT_PUBLIC_API_URL` (TBD by Group B) |
| OpenAPI / Swagger | `GET /docs` (interactive), `GET /docs/json` (raw spec) |
| Auth | **none today**. Wallet-signature JWT is on the wishlist; for the demo every endpoint is open. |
| CORS | `CORS_ORIGIN=http://localhost:3000` by default; multi-origin = comma-separated; `*` = wildcard. |
| Content type | `application/json` everywhere except SSE (`text/event-stream`). |
| Decimals | USDC and SOL are returned as **strings** (`"38.400000"`, `"1.000000000"`) — Prisma `Decimal` doesn't fit in a JS number. Parse with `Number()` for display, never for math. |
| IDs | Off-chain CUIDs (`cmp_…`, `nd_…`, `lf_…`) before the on-chain tx; same id post-finalize. The on-chain PDA shows up as `onchainPda` once the indexer sees the event. |
| Real-time | SSE at `GET /events/stream`. |

---

## Setup in `web/`

1. Add to `web/.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
2. The api allows credentials and reads `CORS_ORIGIN`. If you change the web port, update `api/.env`'s `CORS_ORIGIN`.
3. The api is stateless — feel free to call from server components, route handlers, or the client. No cookies are required.

A minimal typed fetcher:

```ts
// web/lib/api/client.ts
const BASE = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.json ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new ApiError(res.status, body.error ?? "unknown", body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
```

---

## Two universal patterns

### 1. Draft → on-chain tx → finalize

Every mutation that lives on-chain (campaigns, nodes, leaves) is a **two-step** flow. The api stores the rich metadata first, the wallet signs the on-chain tx second, then the api flips the row from `draft` to `finalized` once it has the PDA.

```
┌────────┐   POST /…/draft   ┌─────────┐   sign + submit tx   ┌──────────┐
│ wallet │ ─────────────────▶│   api   │  ─────────────────▶  │  Solana  │
└────────┘  returns draftId  └─────────┘                       └──────────┘
                                  ▲                                 │
                                  │  POST /…/finalize{ draftId,    │
                                  │      onchainPda }              │
                                  └────── after wallet confirms ────┘
```

Why: the metadata (description, examples, media URLs) is too big for the chain. We hash-commit on-chain and serve the full payload off-chain.

> **Note for now:** the indexer also flips drafts to `finalized` automatically when it sees the on-chain event. So calling `/finalize` from the frontend is **idempotent** — if you skip it, the indexer will catch up; if you do call it, the indexer will see the row already finalized and no-op. Either is fine. Calling it gives you immediate UI feedback without waiting for the indexer.

### 2. Error envelope

Every non-2xx response is the same shape:

```json
{ "error": "ref_code_not_found", "message": "No finalized leaf for zzzzzzzz" }
```

`error` is a stable machine code (use it for branching). `message` is human-readable (use it for toasts).

Common codes you will hit:
- `404 campaign_not_found`, `node_not_found`, `leaf_not_found`, `ref_code_not_found`
- `400 parent_invalid`, `parent_required`, `parent_level_mismatch`, `path_invalid`, `path_levels_invalid`, `path_genealogy_invalid`
- `409 ref_code_mismatch`, `ref_code_expired`, `leaf_not_finalized`

Validation errors from Zod surface as 400 with a different shape (`statusCode`, `code: "FST_ERR_VALIDATION"`, `message`) — Fastify's default. Show the `message` field in a toast.

---

## Endpoint catalogue (page by page)

### Landing `/` and `/campaigns` — campaigns list

```
GET /campaigns/active?limit=20&offset=0
```

Response:

```ts
{
  items: CampaignSummary[];
  meta: { limit: number; offset: number; total: number };
}
```

Where `CampaignSummary` is:

```ts
type CampaignSummary = {
  id: string;
  onchainPda: string | null;
  status: "draft" | "active" | "closed";
  brand: { name: string; logoUrl: string | null };
  product: { name: string; imageUrl: string | null; description: string };
  redirectUrl: string;
  creatorWallet: string;
  poolUsdc: string;          // decimal-as-string
  createdAt: string;         // ISO-8601
  stats: {
    nodeCount: number;
    leafCount: number;
    clickCount: number;
    conversionsCount: number;
  };
};
```

Used to replace `MOCK_CAMPAIGNS` in `web/lib/mocks/campaigns.ts`.

### Campaign detail `/c/[id]` — tree view

```
GET /campaigns/:id
```

Response:

```ts
{
  campaign: CampaignSummary;
  nodes: Node[];
  leaves: Leaf[];
}
```

The full tree comes in one round-trip (`nodes` + `leaves`). Reconstruct the tree client-side by linking `node.parentNodeId` and `leaf.path` (an array of 3 node ids `[L1, L2, L3]`).

`Node`:

```ts
type Node = {
  id: string;
  onchainPda: string | null;
  campaignId: string;
  level: "L1" | "L2" | "L3";
  parentNodeId: string | null;
  creatorWallet: string;
  title: string;
  description: string;
  examples: unknown | null;     // free-form JSON
  tags: string[];
  mediaUrls: string[];
  stakeSol: string;
  forkCount: number;
  conversionsCount: number;
  status: "draft" | "finalized";
  createdAt: string;
};
```

`Leaf`:

```ts
type Leaf = {
  id: string;
  onchainPda: string | null;
  campaignId: string;
  path: [string, string, string];   // [L1.id, L2.id, L3.id]
  creatorWallet: string;
  refCode: string;
  contentUrl: string | null;
  platform: "tiktok" | "instagram" | "x" | "youtube" | "other";
  stakeSol: string;
  status: "draft" | "finalized";
  createdAt: string;
};
```

Combine with `GET /events/stream` (below) for live tree updates.

### Create campaign `/campaigns/new`

Two steps + on-chain tx in between.

**Step 1** — store the draft:

```
POST /campaigns/draft
```

Body:

```ts
{
  brandName: string;            // 1..120
  brandLogoUrl?: string | null; // URL
  productName: string;          // 1..200
  productImageUrl?: string | null;
  productDescription: string;   // 1..2000
  redirectUrl: string;          // URL — where the buy-page redirects
  creatorWallet: string;        // base58, 32..44
  poolUsdc: number;             // 0..10_000_000
}
```

Returns a 201 with the full `CampaignSummary` (status `"draft"`, `onchainPda: null`). Save `campaign.id` — it's the `draftId` you'll send back.

**Step 2** — wallet signs the Anchor `create_campaign` ix and transfers USDC to escrow. You get back a PDA.

**Step 3** — confirm:

```
POST /campaigns/finalize
```

Body:

```ts
{ draftId: string; onchainPda: string; }
```

Returns the same `CampaignSummary`, now with `status: "active"` and `onchainPda` filled in.

### Contribute node `/c/[id]/contribute`

Same draft → tx → finalize flow.

```
POST /nodes/draft
```

Body:

```ts
{
  campaignId: string;
  level: "L1" | "L2" | "L3";
  parentNodeId?: string | null; // required for L2/L3, must be null for L1
  creatorWallet: string;
  title: string;                // 1..200
  description: string;          // 1..2000
  examples?: unknown | null;
  tags?: string[];              // ≤20, each ≤40
  mediaUrls?: string[];         // ≤10 URLs
  stakeSol: number;             // 1.0/0.5/0.25 by level (validated by contract)
}
```

Errors:
- `400 parent_required` — passed null parent for an L2/L3
- `400 parent_invalid` — parent is in a different campaign
- `400 parent_level_mismatch` — L2 needs an L1 parent, L3 needs an L2 parent

Then sign Anchor `create_node` + stake transfer, then:

```
POST /nodes/finalize
{ draftId: string; onchainPda: string; }
```

### Publish leaf `/c/[id]` (Publish tab)

```
POST /leaves/draft
```

Body:

```ts
{
  campaignId: string;
  path: [string, string, string];   // exactly 3 node ids, [L1, L2, L3] in order
  creatorWallet: string;
  contentUrl?: string | null;
  platform: "tiktok" | "instagram" | "x" | "youtube" | "other";
  stakeSol: number;                  // canonical 0.1
}
```

Response (201):

```ts
{
  leaf: Leaf;                                  // status = "draft"
  reservation: {
    refCode: string;                           // 8 chars from [a-z2-9] minus i,l,o,1
    expiresAt: string;                         // ISO-8601, ~5 min from now
  };
}
```

Show the `refCode` immediately — it's reserved against collisions until `expiresAt`. After the wallet signs the on-chain `create_leaf`, finalize:

```
POST /leaves/finalize
{ draftId: string; refCode: string; onchainPda: string; }
```

Errors:
- `409 ref_code_mismatch` — you sent a different refCode than the one in the draft
- `409 ref_code_expired` — the reservation expired before you finalized; create a new draft to get a fresh code
- `400 path_*` — the 3 nodes aren't connected genealogically

### Buy page `/buy/[refCode]`

Two calls.

**1) Render the page** — replaces `getLeafByRefCode` mock:

```
GET /leaves/by-ref/:refCode
```

Response:

```ts
{
  leaf: Leaf;
  campaign: CampaignSummary;
  path: [Node, Node, Node];        // resolved [L1, L2, L3] in order
}
```

404 `ref_code_not_found` if the leaf isn't finalized yet.

**2) On "Buy now" click** — registers the conversion:

```
POST /demo/convert
```

Body:

```ts
{
  refCode: string;
  valueUsdc: number;          // 0 < value ≤ 10_000
  buyerWallet?: string;       // optional, base58, 32..44
  source?: "demo_buy_page" | "manual" | "api";  // defaults to "demo_buy_page"
}
```

Response (201):

```ts
{
  pendingConversionId: string;
  leafId: string;
  status: "pending";
  createdAt: string;
}
```

This writes a `pending_conversions` row that the indexer's oracle bridge picks up, signs, and submits on-chain. The frontend will see the conversion go through in real time via the SSE stream (`conversion_pending` → `conversion_confirmed`).

Errors:
- `404 ref_code_not_found`
- `409 leaf_not_finalized` — the leaf hasn't been confirmed on-chain yet (its tx is still pending)

### Claim page `/claim` and the tree's "My leaves" panel

```
GET /wallets/:address/portfolio
```

Response — replaces `MOCK_PENDING_PAYOUTS`, `MOCK_CLAIMED_PAYOUTS`, `LIFETIME_TOTAL_USDC`, and `MOCK_MY_LEAVES`:

```ts
{
  wallet: string;
  nodes: Node[];                   // everything this wallet authored
  leaves: Leaf[];
  stakedSol: string;               // sum of finalized stakes
  pendingPayoutsUsdc: string;      // total across all campaigns
  pendingByCampaign: Array<{
    campaignId: string;
    campaignName: string;          // = campaign.product.name
    brandName: string;
    contributingNodes: number;     // distinct nodes/leaves this wallet owns that contributed
    pendingUsdc: string;
    status: "active" | "claimable"; // claimable once the campaign is closed on-chain
  }>;
  claimHistory: Array<{
    campaignId: string;
    campaignName: string;
    amountUsdc: string;
    claimedAt: string;             // ISO-8601
    txSignature: string;
  }>;
  lifetimeClaimedUsdc: string;
}
```

**How `pendingPayoutsUsdc` is computed:** off-chain by the api, applying the on-chain formula (α=0.4, β=0.4, γ=0.2, position factors L1=1.0/L2=0.7/L3=0.5/leaf=0.3, 5% platform fee, 30% leaf bonus) to every conversion in `pushed_to_chain` or `verified` state. So the number is honest (matches what the contract would pay if it closed right now), but recomputed on every request — don't poll harder than once a few seconds.

**Known empty fields today:** `claimHistory` and `lifetimeClaimedUsdc` are `[]`/`"0"` until Group A emits a `PayoutClaimed` event from `claim_payout` / `claim_leaf_payout` and the indexer indexes it. The wire shape is stable — render `"No claims yet"` if the array is empty.

---

## Real-time updates — SSE

```
GET /events/stream
```

Long-lived `text/event-stream`. Use the browser `EventSource`:

```ts
// web/lib/api/events.ts
export type HiveEvent =
  | { type: "node_created"; campaignId: string; nodeId: string;
      level: "L1" | "L2" | "L3"; creatorWallet: string }
  | { type: "leaf_created"; campaignId: string; leafId: string;
      refCode: string; creatorWallet: string }
  | { type: "click"; leafId: string; refCode: string }
  | { type: "conversion_pending"; pendingId: string; leafId: string;
      valueUsdc: string }
  | { type: "conversion_confirmed"; conversionId: string;
      leafId: string; txSig: string };

export function subscribe(onEvent: (e: HiveEvent) => void): () => void {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/events/stream`;
  const es = new EventSource(url, { withCredentials: true });
  for (const t of [
    "node_created", "leaf_created", "click",
    "conversion_pending", "conversion_confirmed",
  ] as const) {
    es.addEventListener(t, (msg) => onEvent(JSON.parse(msg.data)));
  }
  return () => es.close();
}
```

Notes:
- **Every event has its own `event:` name** — listen on each name individually (as above) instead of the generic `onmessage` handler.
- The stream emits a `: keepalive` comment every 15 s — `EventSource` ignores comments, no app-level handling needed.
- On reconnect, you may briefly miss events. Re-fetch `GET /campaigns/:id` after a reconnect to reconcile.
- Browsers limit ~6 SSE connections per origin per HTTPS; one global subscriber feeding a Zustand/React-context fan-out is the right pattern, not one EventSource per component.

When to use which event:
- `node_created` / `leaf_created` → animate the new node into the tree, bump `forkCount` on the parent
- `click` → optional, only matters for the brand dashboard
- `conversion_pending` → light up the leaf "yellow" (oracle is signing)
- `conversion_confirmed` → cascade animation on the leaf's path

---

## Short-link redirect (info only — frontend doesn't call this)

The api owns `GET /l/:refCode` which records a click (sha256-hashed IP/UA, fire-and-forget) and 302-redirects to `campaign.redirectUrl`. The frontend never hits this directly — the public short URL goes in the leaf creator's social bio, and lands users on the brand storefront (which in the demo is `/buy/:refCode` if `redirectUrl` points back to the web app).

If `redirectUrl` is set to `https://hivework.app/buy/{refCode}` (or any URL containing that path), the click → buy → convert chain works end-to-end with no frontend wiring on the `/l/` side.

---

## Quick reference card

| Page | Method + path | Replaces mock |
|---|---|---|
| `/` and `/campaigns` | `GET /campaigns/active` | `MOCK_CAMPAIGNS` |
| `/c/[id]` (tree view) | `GET /campaigns/:id` + SSE | `MOCK_CAMPAIGNS` + `MOCK_TREE` |
| `/campaigns/new` | `POST /campaigns/draft` → tx → `POST /campaigns/finalize` | — |
| `/c/[id]/contribute` | `POST /nodes/draft` → tx → `POST /nodes/finalize` | — |
| Publish tab (in `/c/[id]`) | `POST /leaves/draft` → tx → `POST /leaves/finalize` | — |
| `/buy/[refCode]` | `GET /leaves/by-ref/:refCode` + `POST /demo/convert` | `getLeafByRefCode` |
| `/claim` | `GET /wallets/:address/portfolio` | `MOCK_PENDING_PAYOUTS`, `MOCK_CLAIMED_PAYOUTS`, `LIFETIME_TOTAL_USDC` |
| Tree "My leaves" panel | `GET /wallets/:address/portfolio` (`leaves` field) | `MOCK_MY_LEAVES` |
| Live tree updates | `GET /events/stream` | client-side mock loop in `use-demo-mode.ts` |

---

## Things the api does NOT do (so don't wait for them)

- **No auth.** Treat every endpoint as public for the demo. If you build a "my campaigns" view, filter by the connected wallet's pubkey client-side.
- **No file uploads.** Send `mediaUrls` as already-hosted URLs (Vercel Blob, IPFS, etc.).
- **No cron / no payout settlement endpoint.** Closing a campaign and distributing USDC is fully on-chain — the contract iterates conversions on `close_and_distribute`. The api only mirrors what the indexer observes.
- **No claim flow.** When the wallet calls `claim_payout` on the contract, the api will see the resulting balance change reflected via the indexer (once `PayoutClaimed` is emitted — see "Known empty fields" above).

---

## Local dev workflow

```bash
# from repo root, in three terminals:
cd api    && npm install && npm run dev      # :3001
cd web    && npm install && npm run dev      # :3000
cd indexer && npm install && npm run dev     # listens to devnet, writes to api's DB

# Smoke-test the api alone (no web needed):
cd api && npm test
```

Open `http://localhost:3001/docs` for live Swagger and `http://localhost:3001/health` for a quick liveness + DB check.

---

## When the contract ships (Group A)

The wire shape above is **stable**. The only field that changes meaning is `onchainPda` — today it stays `null` after `*/finalize` if you skipped that call, because the indexer hasn't seen the event yet. Once Group A's contract is live and the indexer is parsing real events, every finalized row will have its `onchainPda` populated within a few slots of the tx.

`claimHistory` will populate as soon as the indexer ships the `PayoutClaim` model + handler for `PayoutClaimed`. No frontend change required when that happens.