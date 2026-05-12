**`indexer/`** — the bridge that turns Hivework's on-chain hive into a queryable, real-time tree.

> A long-running Node service that subscribes to the Hivework Solana program, hydrates Postgres in real time from raw Anchor event logs, and is wired to push verified conversions back on-chain with the oracle keypair.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Solana Kit](https://img.shields.io/badge/@solana/kit-6.9-9945FF?logo=solana&logoColor=white)](https://github.com/anza-xyz/kit)
[![Prisma](https://img.shields.io/badge/prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Anchor IDL](https://img.shields.io/badge/IDL-hand--rolled%20borsh-orange)](./src/listener/parser.ts)

---

## Why this service exists

Hivework keeps every monetary fact on Solana — campaign escrow, creator stakes, conversion attestations, payouts. That is the whole point. But a frontend cannot afford to walk the chain on every render, and a referral-link microservice cannot wait for a confirmed transaction to know who clicked first.

`indexer/` solves both ends:

1. **Read path** — it subscribes to the program's logs over WebSocket, decodes each Anchor event with a hand-rolled borsh reader, and upserts the corresponding rows in the shared Postgres schema. The on-chain tree becomes queryable in milliseconds via [`api/`](../api/README.md).
2. **Write path** *(scaffolded)* — it polls `pending_conversions` produced by the demo `/buy` flow, runs anti-fraud validation, and is the only wallet authorized by the program to call `register_conversion`.

In one line: **it is the bidirectional bridge between off-chain pending state and on-chain canonical state.**

---

## Shipped vs. post-IDL

The demo runs on what is in the **Shipped** column. The right column is wired but parked behind the IDL placeholder check until Group A redeploys and the program ID is set in `.env`.

| Subsystem        | Status     | What it does today                                                                  |
| ---------------- | ---------- | ----------------------------------------------------------------------------------- |
| Listener         | ✅ shipped  | WS subscribe → decode → idempotent upserts. Exponential-backoff reconnect. |
| Anchor parser    | ✅ shipped  | 100-line borsh reader covering 6 event types. Zero anchor SDK dependency.           |
| Handlers         | ✅ shipped  | One per event, all idempotent at the row level.                                     |
| Oracle signer    | ✅ shipped  | Loads keypair, validated at boot. Surfaced via `/healthz`.                          |
| Validation gate  | ✅ shipped  | Off-chain anti-fraud (existence, status, prior click, positive value).              |
| `/healthz`       | ✅ shipped  | JSON over plain `node:http`. Used by the demo dashboard's "ready to roll" badge.    |
| Slot cursor      | ✅ shipped  | Atomic file write of last-seen slot for restart-safe resume.                        |
| Oracle on-chain push | 🟡 scaffolded | Marks rows `verified`. The `register_conversion` IX is a TODO at [`oracle/poller.ts:57`](./src/oracle/poller.ts) and unblocks the moment the IDL ships. |
| Backfill reconcile | 🟡 scaffolded | Heartbeat loop; `getProgramAccounts` diff TODO at [`backfill/loop.ts:20`](./src/backfill/loop.ts). |
| Codama codegen   | 🟡 plumbed | Runs when `../Contract/target/idl/hivework.json` exists; no-op until then.          |

This split is deliberate. The hard part — decoding Anchor events without pulling the entire SDK and turning them into clean upserts — is done. The remaining work is plumbing once the IDL stabilizes.

---

## Architecture

```
   Solana devnet (Hivework program)
   ▲                   │
   │ register_conversion│ logs / events
   │  (oracle-signed)   ▼
┌──┴──────────────────────────────────────┐
│                indexer/                 │
│  ┌─────────────────────────────────┐    │
│  │ listener/   ←── WS subscription │    │  decodes events,
│  │   parser.ts (borsh reader)      │    │  → idempotent upserts on
│  │   handlers.ts (one per event)   │    │     CampaignMetadata,
│  └────────────┬────────────────────┘    │     NodeMetadata,
│               │                         │     LeafMetadata,
│  ┌────────────▼────────────────────┐    │     PayoutClaim,
│  │ oracle/                         │    │     PendingConversion
│  │   poller.ts ── reads pending    │    │
│  │   validate.ts (anti-fraud)      │    │  every 10s
│  │   signer.ts (oracle.json)       │    │  → validates → (post-IDL) signs & sends
│  └────────────┬────────────────────┘    │
│               │                         │
│  ┌────────────▼────────────────────┐    │
│  │ backfill/  (post-IDL: gPA diff) │    │
│  └────────────┬────────────────────┘    │
│               │                         │
│  ┌────────────▼────────────────────┐    │
│  │ health/  GET /healthz           │    │
│  └─────────────────────────────────┘    │
└───────────────┬─────────────────────────┘
                │
                ▼ Prisma client (cross-package import)
         Postgres (Neon, schema owned by api/)
                ▲
                │
          api/  ←── reads via Prisma
```

**Integration contracts**

| Counterparty                          | Direction        | Channel                                                                |
| ------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Hivework program                      | ⬅ logs / events | `@solana/kit` `logsNotifications` over WS                              |
| Hivework program                      | ➡ `register_conversion` | Oracle keypair signs (post-IDL)                                |
| Postgres (shared with `api/`)         | ⬆⬇             | Prisma client generated from `../api/prisma/schema.prisma`             |
| `api/`'s `pending_conversions` rows   | ⬇ poll, ⬆ status | Direct DB                                                              |
| Operator + demo dashboard             | ⬅ `GET /healthz`| Plain HTTP, JSON payload                                               |

> **The indexer never reads or writes through `api/`.** It shares the database directly. This is intentional: the indexer cannot be rate-limited by the API and stays online if the API restarts.

---

## What makes this implementation interesting

- **No anchor SDK at runtime.** The IDL contains everything needed to decode events: a discriminator and a struct definition. Rather than pull `@coral-xyz/anchor` (heavy, opinionated) into a `@solana/kit` codebase, the parser hand-implements the slice of borsh we need (~100 lines: pubkey, u8/u32/u64, i64, bool, Option, fixed arrays, length-prefixed strings). See [`src/listener/parser.ts`](./src/listener/parser.ts).
- **Idempotent at the row level, not at the message bus.** Every handler in [`handlers.ts`](./src/listener/handlers.ts) is written so that re-receiving the same event is a no-op — `update where id = ?`, `createMany skipDuplicates`, `findUnique` before increment. This is what makes adding the backfill reconcile loop a one-day job instead of a one-week job.
- **Listener that survives flaky devnet WS.** Exponential-backoff reconnect with jitter, attempt counter resets after 60s of stable connection, every reconnect path observable on `/healthz`.
- **Cross-package Prisma import.** The schema lives in `api/` (Group B1 owns it), the indexer imports the generated client from `../api/src/generated/prisma` rather than duplicating the schema. Single source of truth, zero migration drift between services.
- **Unified lifecycle.** Four subsystems, one `AbortController`, one `SIGINT` shuts everything down cleanly:

  ```ts
  await Promise.all([
    startHealthServer(cfg, ctrl.signal),
    startListener(cfg, ctrl.signal),
    startBackfill(cfg, ctrl.signal),
    startOraclePoller(cfg, ctrl.signal),
  ])
  ```

---

## Subsystems in detail

### Listener — `src/listener/`

| File          | Role                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | Opens `logsNotifications({ mentions: [programId] }, { commitment: 'confirmed' })`. Reconnect loop with capped exponential backoff + jitter.   |
| `parser.ts`   | Reads the IDL, builds a discriminator → event-name table, decodes each `Program data: <base64>` line with a tiny borsh reader.                |
| `handlers.ts` | One async function per event. Each is idempotent. Errors are caught and logged so a bad payload never kills the listener.                     |

Parsed events: `CampaignCreated`, `NodeCreated`, `LeafCreated`, `ConversionRegistered`, `CampaignClosed`, `PayoutClaimed`.

### Oracle bridge — `src/oracle/`

| File           | Role                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `poller.ts`    | Every 10s: pulls up to 25 `pending` rows oldest-first, runs `validate`, marks `verified`. *(IDL pending: builds & sends the IX.)* |
| `validate.ts`  | Off-chain anti-fraud: leaf exists, finalized, has `ref_code`, has ≥1 prior click, value > 0. The on-chain program cannot check these — they are economic, not cryptographic, signals. |
| `signer.ts`    | Loads the oracle keypair (`solana-keygen` JSON array format) into a `KeyPairSigner` from `@solana/kit`.                           |

The signer pubkey **must** match the `oracle_authority` set in the `Campaign` PDA at `create_campaign` time, otherwise the program rejects the tx.

### Backfill — `src/backfill/`

`loop.ts` runs every 30s. Today: heartbeat. Post-IDL: `getProgramAccounts(programId, { filters: [memcmp(discriminator)] })` for each account kind, decode with the same borsh reader, diff against the Prisma cache, upsert misses. Designed to be run alongside the live listener, not instead of it.

### Health — `src/health/`

`GET /healthz` returns:

```json
{
  "ok": true,
  "ts": "2026-05-12T00:00:00.000Z",
  "ws_connected": true,
  "last_slot": "291438502",
  "pending_conversions_count": 0,
  "oracle_pubkey": "Hi…",
  "oracle_balance_sol": "1.234567890"
}
```

If the oracle balance dips below the gas floor or the WS drops, the demo dashboard's badge flips red.

---

## Stack

- **Runtime:** Node ≥22, native ESM, TypeScript strict, no build step in dev (`tsx watch`).
- **Solana SDK:** [`@solana/kit`](https://github.com/anza-xyz/kit) 6.9 (modern, tree-shakeable, async-iterator subscriptions).
- **DB:** Prisma 7 with the `prisma-client` generator + `@prisma/adapter-pg`. Schema lives in `../api/prisma/schema.prisma`.
- **WS:** ambient `@solana/kit` subscriptions (no raw `ws` for the program logs).
- **Codama:** `@codama/nodes-from-anchor` + `@codama/renderers-js`, plumbed in [`scripts/codama.ts`](./scripts/codama.ts) for the day we generate typed account decoders for the backfill loop.

---

## Quick start

```bash
cd indexer
pnpm install                       # pnpm is the source of truth (pnpm-lock.yaml)
pnpm prisma:generate               # generates client into ../api/src/generated/prisma
cp .env.example .env               # then fill in DATABASE_URL + the oracle path
pnpm dev                           # tsx watch
```

To regenerate the (currently optional) Codama account decoders once Group A's IDL is at `../Contract/target/idl/hivework.json`:

```bash
pnpm codama:generate
```

---

## Environment

| Var                    | Required | Default        | Purpose                                                          |
| ---------------------- | -------- | -------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`         | ✅        |                | Same Neon connection string as `api/`.                           |
| `RPC_HTTP`             | ✅        |                | Solana JSON-RPC endpoint (devnet for the demo).                  |
| `RPC_WS`               | ✅        |                | Solana WebSocket endpoint.                                       |
| `PROGRAM_ID`           | ✅        |                | Anchor program ID. If set to the placeholder, listener idles.    |
| `ORACLE_KEYPAIR_PATH`  |          | `./oracle.json`| JSON array, `solana-keygen` format. Must be authorized on-chain. |
| `HEALTHZ_PORT`         |          | `3403`         | Port the `/healthz` HTTP server binds to.                        |

The placeholder value `PLACEHOLDER_UNTIL_GROUP_A_DEPLOYS` is recognized and silences the listener / oracle / backfill so the indexer can run safely against an empty environment during local dev.

---

## Demo-day failure modes & fallbacks

| Failure                              | Effect                       | Fallback                                                                       |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------ |
| Oracle balance < gas floor           | Cannot sign post-IDL         | `/healthz` flags red; `solana airdrop 2 <oracle-pubkey> -u devnet`             |
| RPC WS drops mid-demo                | Live events pause            | Listener auto-reconnects with backoff; slot cursor preserves last-seen position |
| Anchor IDL changes after deploy      | Decode mismatch              | Re-copy IDL to `web/lib/anchor/idl/hivework.json`, restart                     |
| `pending_conversion` row stuck       | Conversion not on-chain      | Validate rejects → row marked `rejected`; UI surfaces the reason               |

---

## Project layout

```
indexer/
├── scripts/
│   └── codama.ts           # IDL → src/generated/anchor-client (post-IDL only)
└── src/
    ├── index.ts            # entrypoint; runs 4 subsystems under one AbortController
    ├── config.ts           # strict env parsing
    ├── db.ts               # Prisma client (cross-package import from api/)
    ├── rpc.ts              # @solana/kit client factory
    ├── slot-cursor.ts      # atomic file-backed last-seen slot
    ├── sleep.ts            # abort-aware sleep used by every loop
    ├── log.ts              # tagged loggers per subsystem
    ├── status.ts           # in-memory listener status for /healthz
    ├── events.ts           # decoded event type definitions
    ├── listener/           # WS subscribe + borsh decode + idempotent upserts
    │   ├── index.ts
    │   ├── parser.ts       # 100-line borsh reader, IDL-driven dispatch
    │   └── handlers.ts     # one per event; idempotent at the row level
    ├── oracle/             # validate + sign + (post-IDL) submit
    │   ├── poller.ts
    │   ├── signer.ts
    │   └── validate.ts
    ├── backfill/           # safety net (post-IDL: getProgramAccounts diff)
    │   └── loop.ts
    ├── health/             # /healthz HTTP endpoint
    │   └── server.ts
    └── generated/          # Codama-generated decoders (gitignored)
```

---

## See also

- The program this service indexes: [`../Contract/README.md`](../Contract/README.md)
- The schema this service writes to: [`../api/prisma/schema.prisma`](../api/prisma/schema.prisma)
- The original oracle prototype that inspired this design: [`../Contract/oracle/`](../Contract/oracle/)
- Root architecture overview: [`../README.md`](../README.md)
