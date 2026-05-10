# `api/` — Hivework Backend Service

> **Group B / B1.** Fastify-based HTTP API and SSE event bus that owns all off-chain metadata, click tracking, and short-link routing for the Hivework protocol.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Fastify](https://img.shields.io/badge/fastify-5.8-000000?logo=fastify)](https://fastify.dev)
[![Prisma](https://img.shields.io/badge/prisma-7.8-2D3748?logo=prisma)](https://prisma.io)
[![Postgres](https://img.shields.io/badge/postgres-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech)

---

## What this service is

The Hivework protocol is **hybrid by design**: anything monetary lives on Solana, everything else lives in this service. `api/` is the off-chain source of truth for:

- **Campaign metadata** — brand name, product description, hero image, redirect URL, weight overrides
- **Node and leaf metadata** — title, description, tags, examples, media URLs, SHA-256 hash anchored on-chain
- **Short-link service** — every leaf has an 8-character ASCII `ref_code` that maps to the brand's redirect URL with click tracking
- **Pending conversions** — buyer clicks land here first; the indexer's oracle picks them up, runs anti-fraud checks, and pushes them on-chain
- **Wallet portfolio aggregation** — given a wallet, returns staked SOL, pending payouts, claim history, per-contribution breakdown
- **In-process event bus** — every state transition emits an event; the `/events/stream` SSE endpoint fans them out to the frontend in real time

This service has **zero on-chain authority**. It does not hold private keys, it does not sign transactions. The chain is read by `indexer/` and written by `Contract/oracle/` and end-user wallets.

---

## How it integrates with the rest of the system

```
                    ┌──────────────────────────────┐
                    │  web/  (Next.js frontend)    │
                    └──────┬───────────────────────┘
                           │ REST + SSE
                           ▼
┌─────────────────────────────────────────────────────────┐
│                       api/  (this)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ /campaigns  │  │ /nodes       │  │ /leaves        │  │
│  │ /demo/*     │  │ /shortlinks  │  │ /wallets       │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────┘  │
│         │                │                   │          │
│         ▼                ▼                   ▼          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Postgres (Neon) — campaign/node/leaf metadata, │   │
│  │  pending_conversions, click events              │   │
│  └─────────────────────────────────────────────────┘   │
└────────┬────────────────────────────┬───────────────────┘
         │ reads via Prisma           │ writes pending
         ▼                            ▼
   ┌────────────┐              ┌──────────────┐
   │  mcp/      │              │  indexer/    │
   │ (AI tools) │              │ (oracle      │
   └────────────┘              │  poller)     │
                               └──────┬───────┘
                                      │ register_conversion
                                      ▼
                               Solana program
```

**Integration contracts:**

| Consumer | Channel | What it reads / writes |
|---|---|---|
| `web/` | REST + `/events/stream` SSE | Reads campaign/tree state, posts node/leaf drafts, redirects via `/r/:refCode` |
| `mcp/` | REST | Reads tree, writes node/leaf drafts on behalf of agents (agents sign on-chain themselves) |
| `indexer/` | Direct Postgres (shared schema) | Reads `PendingConversion` rows, writes `onchain_pda` once tx lands |
| `Contract/oracle/` | Optional `BACKEND_VERIFY_URL` | Anti-fraud verification before signing on-chain |

> **The Prisma schema in `api/prisma/schema.prisma` is the canonical schema.** `indexer/` regenerates its client from the same file (`prisma generate --schema ../api/prisma/schema.prisma`).

---

## Stack

- **Runtime:** Node ≥22, ESM modules, TypeScript strict mode
- **HTTP:** Fastify 5 with `@fastify/cors`, `@fastify/swagger`, `@fastify/swagger-ui`
- **Validation:** Zod 4 via `fastify-type-provider-zod` — every request and response is schema-validated
- **ORM:** Prisma 7 (driver-adapter mode with `pg`)
- **Solana SDK:** `@solana/kit` 6.9 (used only for pubkey validation and PDA derivation, never for signing)
- **Tests:** Native `node --test` runner via `tsx`

---

## Routes

All routes return JSON. Validation errors return `400` with a Zod issue tree. Schemas live in `src/schemas/`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness + DB connectivity check |
| `GET` | `/campaigns/active` | Paginated list of `status=active` campaigns |
| `GET` | `/campaigns/:id` | Campaign metadata + full tree (nodes + leaves) |
| `POST` | `/campaigns/draft` | Create off-chain draft before on-chain `create_campaign` |
| `POST` | `/campaigns/:id/finalize` | Bind a draft to an `onchain_pda` after the tx lands |
| `POST` | `/nodes/draft` | Create node metadata draft, returns `metadata_hash` (SHA-256) |
| `POST` | `/nodes/:id/finalize` | Bind to `onchain_pda` |
| `POST` | `/leaves/draft` | Create leaf metadata + reserve `ref_code` |
| `POST` | `/leaves/:id/finalize` | Bind to `onchain_pda` |
| `GET` | `/leaves/by-ref/:refCode` | Resolve a leaf by its short code |
| `GET` | `/r/:refCode` | 302 redirect to brand's URL + records click |
| `POST` | `/demo/convert` | Demo-only: simulates a buyer purchase, writes `PendingConversion` |
| `GET` | `/wallets/:address/portfolio` | Aggregated earnings/stakes/claims for a wallet |
| `GET` | `/events/stream` | SSE stream of all state transitions (server → client) |

Full OpenAPI schema is auto-generated and served at `/docs` (Swagger UI).

---

## Quick start

### 1. Install

```bash
cd api
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit DATABASE_URL — Hivework uses Neon (serverless Postgres)
```

### 3. Migrate + seed

```bash
pnpm db:migrate    # applies prisma/migrations/
pnpm db:seed       # loads the Halo Cola demo fixture
```

### 4. Run

```bash
pnpm dev           # tsx watch, hot reload
# or
pnpm build && pnpm start
```

Service listens on `http://localhost:3401` by default. Swagger UI at `/docs`.

### 5. Smoke test

```bash
pnpm test          # node --test runs api/src/tests/smoke.test.ts
```

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (Neon-compatible) |
| `PORT` | | Listen port, default `3401` |
| `LOG_LEVEL` | | Pino log level, default `info` |
| `CORS_ORIGINS` | | Comma-separated allowed origins for `web/` and `mcp/` |
| `SHORTLINK_BASE_URL` | | Public URL used to build leaf referral links (e.g. `https://hivework.link`) |

---

## Data model (high level)

| Prisma model | On-chain twin | Notes |
|---|---|---|
| `CampaignMetadata` | `Campaign` PDA | `onchain_pda` is set after finalize |
| `NodeMetadata` | `Node` PDA | `metadata_hash` (SHA-256 of canonical JSON) is signed on-chain |
| `LeafMetadata` | `Leaf` PDA | Carries `ref_code` (`[u8; 8]` ASCII) used as PDA seed |
| `PendingConversion` | `Conversion` PDA after oracle signs | `status` walks `pending → verified → pushed_to_chain` |
| `ClickEvent` | _(off-chain only)_ | Anti-fraud signal for the oracle |

The full schema lives in [`prisma/schema.prisma`](./prisma/schema.prisma).

---

## Demo flow this service powers

1. Brand fills `/campaigns/new` on `web/`. Frontend `POST /campaigns/draft` → `web/` triggers on-chain `create_campaign` → `POST /campaigns/:id/finalize`.
2. Agents (via `mcp/`) and humans (via `web/`) post `/nodes/draft`, sign on-chain `create_node`, then call finalize.
3. Creators publish leaves through `/leaves/draft` → on-chain `create_leaf` → finalize. Each leaf gets a public URL `/r/:refCode`.
4. A buyer clicks `/r/:refCode` on `web/` → 302 redirect, `ClickEvent` recorded.
5. Demo `/buy/[refCode]` page calls `POST /demo/convert`. A `PendingConversion` row is written and the event bus fires `pending_conversion`.
6. `indexer/`'s oracle poller picks the row up, validates it, and submits `register_conversion` on-chain. Once confirmed, the listener flips the row to `pushed_to_chain` and the SSE stream fans out the update to every connected `web/` client.

---

## Project layout

```
api/
├── prisma/
│   ├── schema.prisma         # canonical schema for B1 + B3 (indexer)
│   ├── migrations/
│   └── seed.ts               # Halo Cola demo fixture
└── src/
    ├── server.ts             # entrypoint
    ├── app.ts                # buildApp() — registers plugins + routes
    ├── config.ts             # env parsing (zod-validated)
    ├── events.ts             # in-process event bus + SSE adapter
    ├── refcode.ts            # 8-char ASCII generator + uniqueness reservation
    ├── plugins/              # cors, swagger, prisma, zod-type-provider
    ├── routes/               # campaigns, nodes, leaves, shortlink, wallets, demo, events-stream, health
    ├── schemas/              # zod schemas (campaign, node, leaf, shared)
    └── tests/                # smoke tests via node:test
```

---

## See also

- **Root architecture overview:** [`../README.md`](../README.md#system-architecture)
- **Indexer that consumes our pending rows:** [`../indexer/README.md`](../indexer/README.md)
- **MCP server that calls our routes for AI agents:** [`../mcp/README.md`](../mcp/README.md)
- **Frontend that consumes our REST + SSE:** [`../web/README.md`](../web/README.md)