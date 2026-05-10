# `indexer/` — Hivework On-Chain Indexer & Oracle Bridge

> **Group B / B3.** Long-running Node service that subscribes to the Hivework Solana program, hydrates Postgres in real time, and pushes verified conversions on-chain by signing `register_conversion` with the oracle keypair.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Solana Kit](https://img.shields.io/badge/@solana/kit-6.9-9945FF?logo=solana&logoColor=white)](https://github.com/anza-xyz/kit)
[![Codama](https://img.shields.io/badge/codama-IDL%E2%86%92TS-blue)](https://github.com/codama-idl/codama)

---

## What this service is

The Hivework protocol stores all monetary state on Solana, but the frontend cannot afford to walk the chain on every render. `indexer/` solves both ends of that problem:

1. **Read path** — it streams program logs, parses Anchor events into typed objects, and upserts the corresponding rows in the shared Postgres schema. This makes the on-chain tree queryable in milliseconds via `api/`.
2. **Write path** — it polls `PendingConversion` rows produced by the demo `/buy` flow, runs anti-fraud validation, and submits `register_conversion` to the program with the oracle's authorized signer. The oracle is the **only** wallet allowed by the program to attest to a sale.

In short: `indexer/` is the bidirectional bridge between off-chain pending state and on-chain canonical state.

---

## How it integrates with the rest of the system

```
   Solana devnet (Hivework program)
   ▲                   │
   │ register_conversion│ logs / events
   │                    ▼
┌──┴──────────────────────────────────────┐
│                indexer/  (this)         │
│  ┌─────────────────────────────────┐    │
│  │ listener/   ←── WS + RPC poll   │    │  reads program events
│  │   parser.ts (Codama-generated)  │    │  → upserts NodeMetadata,
│  │   handlers.ts                   │    │     LeafMetadata,
│  └────────────┬────────────────────┘    │     ConversionStatus
│               │                         │
│  ┌────────────▼────────────────────┐    │
│  │ oracle/                         │    │  every N seconds
│  │   poller.ts ── reads pending    │    │  → validates → signs
│  │   validate.ts (anti-fraud)      │    │  → submits tx
│  │   signer.ts (oracle.json)       │    │
│  └────────────┬────────────────────┘    │
│               │                         │
│  ┌────────────▼────────────────────┐    │
│  │ backfill/   (cold start replay) │    │
│  └────────────┬────────────────────┘    │
│               │                         │
│  ┌────────────▼────────────────────┐    │
│  │ health/     /healthz endpoint   │    │
│  └─────────────────────────────────┘    │
└───────────────┬─────────────────────────┘
                │
                ▼ shared Prisma schema
         Postgres (Neon)
                ▲
                │
          api/  ←── reads via Prisma
```

**Integration contracts:**

| Counterparty | Direction | Channel |
|---|---|---|
| Hivework program | ⬅ logs / events | `@solana/kit` RPC subscription + slot polling |
| Hivework program | ➡ `register_conversion` tx | Oracle keypair signs |
| Postgres (shared with `api/`) | ⬆⬇ | Prisma client generated from `../api/prisma/schema.prisma` |
| `api/`'s `PendingConversion` rows | ⬇ poll, ⬆ status update | Direct DB |
| Operator | ⬅ `/healthz` | Plain HTTP, JSON payload with slot lag and oracle balance |

> **The indexer never reads or writes through `api/`.** It shares the Postgres database directly. This is intentional: it cannot be rate-limited by the API and stays online if the API restarts.

---

## Subsystems

### 1. Listener (`src/listener/`)

- **`index.ts`** — opens a WebSocket subscription to program logs and a slot-polling fallback. Both paths feed the same handler queue, so duplicate events are deduped by signature.
- **`parser.ts`** — decodes Anchor event data using the Codama-generated decoder (`scripts/codama.ts` → `src/generated/`). When the program ID is empty, returns `[]` (graceful no-op for pre-deploy).
- **`handlers.ts`** — one function per event type (`CampaignCreated`, `NodeCreated`, `LeafCreated`, `ConversionRegistered`, `CampaignClosed`). Each handler is idempotent: re-receiving the same event must not corrupt state.

### 2. Oracle bridge (`src/oracle/`)

- **`poller.ts`** — every `ORACLE_POLL_INTERVAL_MS`, queries `PendingConversion WHERE status='pending'`, locks the row, runs `validate`, builds the `register_conversion` instruction with the leaf's genealogical path and conversion id, signs with the loaded keypair, broadcasts, and flips the row to `verified` (then `pushed_to_chain` once the listener sees the event).
- **`validate.ts`** — off-chain anti-fraud: leaf must exist and be finalized; ref_code must be present; at least one click event must precede the conversion; the conversion must be within the campaign deadline. The on-chain program does not (and cannot) check these — they are economic, not cryptographic, signals.
- **`signer.ts`** — loads the oracle keypair from `ORACLE_KEYPAIR_PATH` (JSON array format, identical to `solana-keygen` output). The pubkey here **must** match the `oracle_authority` set in `Campaign` PDAs at `create_campaign` time, otherwise the program rejects the tx.

### 3. Backfill (`src/backfill/`)

- **`loop.ts`** — on cold start, replays program transactions since the last persisted `slot_cursor`. Stops once it catches up to the live listener. Required because devnet WS connections drop and we must recover without missing a `ConversionRegistered`.

### 4. Health (`src/health/`)

- **`server.ts`** — plain `node:http` server exposing `GET /healthz` with: oracle pubkey + SOL balance, current slot, slot lag vs. listener cursor, listener up/down, DB up/down. Used by the operator and by the demo dashboard's "ready to roll" badge.

---

## Stack

- **Runtime:** Node ≥22, ESM, TypeScript strict
- **Solana SDK:** `@solana/kit` 6.9 (modern, tree-shakeable, async-first)
- **DB:** Prisma 7 against the shared schema in `../api/prisma/schema.prisma`
- **IDL → TS:** Codama (`@codama/nodes-from-anchor`, `@codama/renderers-js`) to generate decoders for events and accounts from the Anchor IDL
- **WS:** `ws` 8 for raw program log subscriptions

---

## Quick start

### 1. Install

```bash
cd indexer
pnpm install
```

### 2. Generate Prisma client + Codama bindings

```bash
pnpm prisma:generate    # uses ../api/prisma/schema.prisma
pnpm codama:generate    # reads ../Contract/idl/hivework.json → src/generated/
```

> Re-run `codama:generate` whenever Group A ships a new IDL.

### 3. Configure

```bash
cp .env.example .env
# Set DATABASE_URL, RPC_URL, HIVEWORK_PROGRAM_ID, ORACLE_KEYPAIR_PATH
```

### 4. Run

```bash
pnpm dev      # tsx watch
# or
pnpm start
```

The four subsystems start in parallel under a single `AbortController`:

```ts
// src/index.ts
await Promise.all([
  startHealthServer(cfg, ctrl.signal),
  startListener(cfg, ctrl.signal),
  startBackfill(cfg, ctrl.signal),
  startOraclePoller(cfg, ctrl.signal),
])
```

A `SIGINT` aborts all four cleanly.

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Same Neon connection string as `api/` |
| `RPC_URL` | ✅ | Solana RPC (devnet for the demo) |
| `HIVEWORK_PROGRAM_ID` | ✅ | Anchor program ID; if empty, listener is a no-op |
| `ORACLE_KEYPAIR_PATH` | ✅ | Path to JSON keypair authorized by the program |
| `INDEXER_HEALTH_PORT` | | Default `3402` |
| `ORACLE_POLL_INTERVAL_MS` | | Default `2000` |
| `BACKFILL_BATCH_SIZE` | | Default `100` |

---

## Demo-day failure modes & fallbacks

| Failure | Effect | Fallback |
|---|---|---|
| Oracle balance < 0.05 SOL | Cannot sign | `/healthz` flags red; airdrop SOL with `solana airdrop 2 <oracle-pubkey>` |
| RPC WS drops | Misses live events | Backfill replays from last cursor on next reconnect |
| Conversion fails on-chain | Row stuck in `verified` | Listener flips back to `pending` after timeout (idempotent retry) |
| Anchor IDL changes | Decode fails | Re-run `pnpm codama:generate`, redeploy indexer |

---

## Project layout

```
indexer/
├── scripts/
│   └── codama.ts           # IDL → src/generated/
└── src/
    ├── index.ts            # entrypoint, runs 4 subsystems in parallel
    ├── config.ts           # env parsing
    ├── db.ts               # Prisma client singleton
    ├── rpc.ts              # @solana/kit client factory
    ├── slot-cursor.ts      # persisted last-processed slot
    ├── log.ts              # tagged loggers per subsystem
    ├── status.ts           # in-memory listener status for /healthz
    ├── events.ts           # event type definitions
    ├── listener/           # WS + log parsing
    │   ├── index.ts
    │   ├── parser.ts
    │   └── handlers.ts
    ├── oracle/             # validate + sign + submit
    │   ├── poller.ts
    │   ├── signer.ts
    │   └── validate.ts
    ├── backfill/           # cold-start replay
    │   └── loop.ts
    ├── health/             # /healthz HTTP endpoint
    │   └── server.ts
    └── generated/          # Codama-generated decoders (do not edit)
```

---

## See also

- **The program this service indexes:** [`../Contract/README.md`](../Contract/README.md)
- **The schema this service writes to:** [`../api/prisma/schema.prisma`](../api/prisma/schema.prisma)
- **The oracle service that originally inspired this design:** [`../Contract/oracle/README.md`](../Contract/oracle/README.md)
- **Root architecture overview:** [`../README.md`](../README.md#system-architecture)
