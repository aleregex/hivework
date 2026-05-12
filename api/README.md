# Hivework API

> **The off-chain brain of a hybrid Solana protocol.** Owns every byte of campaign, tree, click, and conversion metadata — and streams them to humans and AI agents in real time.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Fastify](https://img.shields.io/badge/fastify-5.8-000000?logo=fastify)](https://fastify.dev)
[![Prisma](https://img.shields.io/badge/prisma-7.8-2D3748?logo=prisma)](https://prisma.io)
[![Postgres](https://img.shields.io/badge/postgres-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)
[![Zod](https://img.shields.io/badge/zod-4.4-3068B7)](https://zod.dev)
[![Solana](https://img.shields.io/badge/cluster-devnet-9945FF?logo=solana&logoColor=white)](https://docs.solana.com/clusters)

---

## TL;DR

| | |
|---|---|
| **Base URL (local)** | `http://localhost:3401` |
| **OpenAPI / Swagger UI** | `GET /docs` (interactive) · `GET /docs/json` (raw spec) |
| **Health probe** | `GET /health` — pings the DB before returning `200` |
| **Real-time** | `GET /events/stream` — Server-Sent Events for every state transition |
| **Auth** | None for the hackathon demo. Wallet-signature JWT is on the wishlist. |
| **Validation** | Zod 4 on **every** request body, query, and response — typed end-to-end |
| **Money** | USDC + SOL returned as **strings** (Prisma `Decimal` doesn't fit a JS number) |

Need to wire the frontend? See [FRONTEND.md](./FRONTEND.md).

---

## Why this service exists

Hivework splits its protocol cleanly between Solana (anything monetary or irreversible) and this service (everything else). The split lets the chain stay cheap and auditable while the off-chain layer carries the rich metadata, indexes, and real-time feeds that a marketing protocol actually needs.

This service is the **only** writer of off-chain state. It is also the **only** reader the frontend needs — no direct Postgres, no scattered microservices, no caching layer to invalidate.

It owns:

- **Campaign, node, and leaf metadata** — titles, descriptions, examples, media URLs, brand/product info, the SHA-256 hash that anchors each record to its on-chain PDA.
- **The short-link service** — every published leaf gets an 8-char ASCII `ref_code`. Buyers land on `/l/<refCode>`, a click is recorded, and they're 302'd to the demo storefront.
- **The pending-conversion pipeline** — `POST /demo/convert` writes a row, forwards to the oracle webhook, and reports back whether the conversion landed on-chain, got rejected, or is still pending.
- **Wallet portfolio aggregation** — given a wallet, returns staked SOL, pending payouts per campaign, lifetime claimed USDC, and a full claim history (sourced from indexed `PayoutClaim` events).
- **An in-process event bus + SSE** — every state mutation fires an event, and `/events/stream` fans them out to every connected client.

It does **not**:

- Hold any private keys.
- Sign any transactions.
- Touch the Solana RPC except for pubkey validation.

The chain is read by [`indexer/`](../indexer) and written by [`Contract/oracle/`](../Contract/oracle) plus end-user wallets through [`web/`](../web). This service stays out of consensus on purpose.

---

## How it fits in

```
                  ┌────────────────────────────┐
                  │  web/   (Next.js)          │
                  │  mcp/   (AI agents)        │
                  └──────┬─────────────────────┘
                         │ REST + SSE
                         ▼
        ┌─────────────────────────────────────────────┐
        │                  api/  (you are here)        │
        │                                              │
        │   /campaigns  /nodes  /leaves                │
        │   /l/:refCode (shortlink + click tracking)   │
        │   /demo/convert (forwards to oracle)         │
        │   /wallets/:address/portfolio                │
        │   /events/stream  (SSE)                      │
        │                                              │
        │   ┌─ Fastify 5 + Zod typed routes ─┐         │
        │   │  Prisma 7 (pg driver adapter)  │         │
        │   │  In-process EventEmitter bus   │         │
        │   └────────────────────────────────┘         │
        └──────┬────────────────────┬──────────────────┘
               │ writes pending     │ reads chain state
               ▼                    ▲
        ┌─────────────┐       ┌──────────────┐
        │  Postgres   │◀──────│   indexer/   │
        │   (Neon)    │       │ (B3 listener)│
        └─────────────┘       └──────┬───────┘
                                     │
                                     ▼
                            ┌───────────────────┐
                            │ Contract/oracle/  │
                            │ register_         │
                            │ conversion()      │
                            └───────────────────┘
```

| Consumer | Channel | Purpose |
|---|---|---|
| `web/` | REST + SSE | Reads tree, posts drafts, redirects through `/l/:refCode` |
| `mcp/` | REST | Lets AI agents post node/leaf drafts (agents sign on-chain themselves) |
| `indexer/` | Shared Postgres | Flips `onchain_pda` once the chain confirms; writes `PayoutClaim` rows |
| `Contract/oracle/` | `ORACLE_WEBHOOK_URL` callback | Receives each new pending conversion to sign + push |

> The Prisma schema in `prisma/schema.prisma` is canonical. `indexer/` regenerates its client from the same file — there is exactly one source of truth.

---

## API surface

Every route is fully Zod-validated on input and output. Validation errors return `400` with the issue tree. The full OpenAPI 3.1 spec is generated automatically and served at `/docs`.

### Campaigns

| Method | Path | Returns |
|---|---|---|
| `GET` | `/campaigns/active` | Paginated list of `status=active` campaigns with stats (nodes, leaves, clicks, conversions) |
| `GET` | `/campaigns/:id` | Campaign + full embedded tree (nodes ordered by level + creation; leaves with per-leaf conversion counts) |
| `GET` | `/campaigns/:id/conversions` | All `verified` / `pushed_to_chain` conversions for `close_and_distribute`, each with the resolved PDA path (campaign, leaf, L1, L2, L3) |
| `POST` | `/campaigns/draft` | Persist metadata before the on-chain `create_campaign` tx |
| `POST` | `/campaigns/finalize` | Bind a draft `id` to its resolved `onchain_pda` |

### Nodes

| Method | Path | Returns |
|---|---|---|
| `GET` | `/nodes/:id` | Single node by id |
| `POST` | `/nodes/draft` | Create node metadata draft (returns the CUID used as the `metadata_cuid` seed) |
| `POST` | `/nodes/finalize` | Bind a draft to its on-chain PDA |

### Leaves

| Method | Path | Returns |
|---|---|---|
| `POST` | `/leaves/draft` | Create leaf metadata + reserve a fresh `ref_code` (8-char ASCII, idempotent) |
| `POST` | `/leaves/finalize` | Confirm the on-chain tx + consume the `ref_code` reservation |
| `GET` | `/leaves/by-ref/:refCode` | Resolve a finalized leaf + its campaign + 3-node ancestor path |

### Public storefront

| Method | Path | Returns |
|---|---|---|
| `GET` | `/l/:refCode` | Records a click and `302`s to `${FRONTEND_URL}/buy/<refCode>` |

### Demo flow (hackathon-only)

| Method | Path | Returns |
|---|---|---|
| `POST` | `/demo/convert` | Persists a `PendingConversion`, forwards to the oracle webhook, returns `status ∈ {pending, pushed_to_chain, rejected}` + optional `txSignature` |

### Wallet portfolio

| Method | Path | Returns |
|---|---|---|
| `GET` | `/wallets/:address/portfolio` | Authored nodes & leaves, staked SOL, pending USDC per campaign, lifetime claimed, full claim history |

### System

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` | `{ status: "ok", db: "ok" }` — fails closed if Postgres is unreachable |
| `GET` | `/events/stream` | Server-Sent Events of every state mutation (see [SSE](#real-time-via-sse)) |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/docs/json` | Raw OpenAPI 3.1 spec |

---

## Quick start

```bash
cd api
pnpm install

cp .env.example .env
# Fill DATABASE_URL — Neon recommended; any Postgres 15+ works.

pnpm db:migrate    # applies prisma/migrations/
pnpm db:seed       # loads the Halo Cola demo fixture

pnpm dev           # tsx watch, hot reload — http://localhost:3401
```

Swagger UI is at `http://localhost:3401/docs` the moment it boots.

### Smoke test

```bash
pnpm test          # node --test runs src/tests/smoke.test.ts
```

### Production-style run

```bash
pnpm build         # tsc → dist/
pnpm start         # node dist/server.js
```

---

## Environment

| Var | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string (Neon-compatible) |
| `PORT` | | `3401` | HTTP listen port |
| `LOG_LEVEL` | | `info` | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `NODE_ENV` | | `development` | `development` / `test` / `production` |
| `CORS_ORIGIN` | | `http://localhost:3000` | Comma-separated origins. `*` allows everything. |
| `FRONTEND_URL` | | `http://localhost:3000` | Public URL used to build the `/l/:refCode` redirect target |
| `ORACLE_WEBHOOK_URL` | | — | Where `/demo/convert` POSTs each new pending row. Leave empty for offline mode. |
| `ORACLE_WEBHOOK_TOKEN` | | — | Bearer token sent to the oracle. Must match the oracle's `WEBHOOK_TOKEN`. |

Config is parsed once at boot through `src/config.ts` (Zod-validated). Missing required vars fail-fast with a clear message.

---

## Data model

The Prisma schema is the canonical source of truth and is shared with `indexer/`.

| Model | On-chain twin | Notes |
|---|---|---|
| `CampaignMetadata` | `Campaign` PDA | Tracks pool, deadline, conversion value, brand/product copy. `onchain_pda` flips after finalize. |
| `NodeMetadata` | `Node` PDA | L1 / L2 / L3 decision in the tree. Hashes its canonical JSON for on-chain anchoring. |
| `LeafMetadata` | `Leaf` PDA | Carries the 8-char `ref_code` used as PDA seed. |
| `RefCodeReservation` | _(off-chain only)_ | Idempotent ref-code allocator with TTL. |
| `Click` | _(off-chain only)_ | One row per `/l/:refCode` hit; powers anti-fraud + analytics. |
| `PendingConversion` | `Conversion` PDA after oracle signs | Status: `pending → pushed_to_chain` (happy path) or `rejected`. |
| `PayoutClaim` | `PayoutClaimed` event | Inserted by `indexer/` on every on-chain payout claim. Drives the portfolio view. |

Full schema: [`prisma/schema.prisma`](./prisma/schema.prisma).

---

## Real-time via SSE

`GET /events/stream` is a plain `text/event-stream` connection. Every mutation in the API emits a typed event through `src/events.ts` and the SSE plugin pushes it to every connected client. The frontend uses this to make the tree "light up" the moment a conversion lands.

```ts
const es = new EventSource("http://localhost:3401/events/stream");
es.addEventListener("conversion_confirmed", (e) => {
  const { conversionId, leafId, txSig } = JSON.parse(e.data);
  // ...animate the cascade
});
```

Event types currently emitted (see `src/events.ts` for the typed union):

| Event | Payload |
|---|---|
| `node_created` | `campaignId`, `nodeId`, `level`, `creatorWallet` |
| `leaf_created` | `campaignId`, `leafId`, `refCode`, `creatorWallet` |
| `click` | `leafId`, `refCode` |
| `conversion_pending` | `pendingId`, `leafId`, `valueUsdc` |
| `conversion_confirmed` | `conversionId`, `leafId`, `txSig` |

No client library required. Auto-reconnects come for free with `EventSource`.

---

## Engineering choices worth noting

- **Typed end-to-end.** `fastify-type-provider-zod` makes every request handler infer parameter, body, query, and response types directly from a Zod schema. No `any`, no duplicated types between the validator and the handler.
- **Drafts → finalize, never two-phase commit.** Every on-chain write happens through `POST /<resource>/draft` first (persists metadata and reserves any identifiers), then the wallet signs on-chain, then `POST /<resource>/finalize` binds the resolved PDA. If the user closes the tab between steps the draft is harmless and gets cleaned up.
- **Decimal as string.** USDC (`Decimal(18, 6)`) and SOL stakes (`Decimal(18, 9)`) are wider than a JS number. We serialize as strings; the frontend parses for display only.
- **Idempotent ref-code generation.** Eight-char ASCII codes are reserved before the on-chain tx via `RefCodeReservation` (TTL'd). A retry of the same draft returns the same code; collisions are rejected at SQL `UNIQUE` time.
- **Fail-soft oracle integration.** If `ORACLE_WEBHOOK_URL` is unset or unreachable, `/demo/convert` still persists the pending row and returns `status: "pending"`. The indexer's poller can drain queued rows later.
- **One schema, two services.** `indexer/` regenerates its Prisma client from `api/prisma/schema.prisma`. Adding a column is a single migration.

---

## Project layout

```
api/
├── prisma/
│   ├── schema.prisma         # canonical schema, shared with indexer/
│   ├── migrations/           # idempotent SQL migrations
│   └── seed.ts               # Halo Cola demo fixture
└── src/
    ├── server.ts             # entrypoint (PORT, signal handlers)
    ├── app.ts                # buildApp() — registers plugins + routes
    ├── config.ts             # Zod-validated env parsing
    ├── events.ts             # typed in-process event bus
    ├── refcode.ts            # 8-char ASCII allocator + uniqueness guard
    ├── plugins/
    │   ├── cors.ts           # @fastify/cors
    │   ├── swagger.ts        # OpenAPI generation + Swagger UI
    │   ├── prisma.ts         # singleton PrismaClient lifecycle
    │   ├── zod.ts            # fastify-type-provider-zod wiring
    │   └── event-bus.ts      # exposes app.events for routes
    ├── routes/
    │   ├── campaigns.ts      # CRUD + tree + conversions
    │   ├── nodes.ts          # CRUD draft/finalize
    │   ├── leaves.ts         # CRUD + by-ref lookup
    │   ├── shortlink.ts      # /l/:refCode + click recording
    │   ├── demo.ts           # /demo/convert + oracle webhook bridge
    │   ├── wallets.ts        # portfolio aggregate
    │   ├── events-stream.ts  # SSE adapter for app.events
    │   └── health.ts         # /health
    ├── schemas/              # Zod schemas (campaign, node, leaf, shared)
    └── tests/
        └── smoke.test.ts     # boots the app + hits the critical routes
```

---

## Related modules

- **Root architecture overview** → [`../README.md`](../README.md#system-architecture)
- **Frontend integration guide** (typed wire formats, examples, gotchas) → [`./FRONTEND.md`](./FRONTEND.md)
- **Indexer that flips `onchain_pda` + writes `PayoutClaim`** → [`../indexer/README.md`](../indexer/README.md)
- **Oracle that signs `register_conversion`** → [`../Contract/oracle/README.md`](../Contract/oracle/README.md)
- **MCP server that lets AI agents call this API** → [`../mcp/README.md`](../mcp/README.md)
- **Frontend that consumes the REST + SSE** → [`../web/README.md`](../web/README.md)
