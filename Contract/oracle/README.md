# `Contract/oracle/` — Hivework Oracle Service (Reference Implementation)

> **Group A.** Reference HTTP oracle service that validates conversions off-chain and signs `register_conversion` on the Hivework Solana program. This is the v1 reference; the production-path oracle for the demo runs inside [`../../indexer/`](../../indexer/) (Group B), which polls the same `PendingConversion` rows directly from Postgres.

[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Anchor](https://img.shields.io/badge/anchor-0.30-blue)](https://www.anchor-lang.com)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)](https://nodejs.org)

---

## What this service is

The Hivework program **does not trust anyone except its oracle** to attest to conversions. The on-chain `register_conversion` instruction has an `oracle: Signer` constraint that compares the signer's pubkey against the `oracle_authority` recorded in the campaign's PDA at `create_campaign` time. Without that signature, no conversion can land.

This package is the **reference oracle**: an Express HTTP service that

1. accepts a webhook `POST /conversion` with `{ campaign, leaf, value, walletPubkey, conversionId, ip }`,
2. runs **off-chain anti-fraud checks** (rate limits per wallet, per IP, burst caps, optional cross-check against `api/`),
3. signs and submits the on-chain `register_conversion` instruction with the oracle keypair,
4. returns the transaction signature to the caller.

It is shipped as a runnable artifact so any third party can stand up their own oracle for their own campaign — the program is multi-tenant; each campaign chooses its oracle authority on creation.

> **For the hackathon demo we use the indexer-driven path** (`../../indexer/src/oracle/`) because it pulls from the same DB the API writes to and avoids exposing a public HTTP surface. The two implementations are interchangeable from the program's point of view: both produce a tx signed by an authorized oracle pubkey.

---

## How it integrates with the rest of the system

```
   web/  /buy/[refCode]                   third-party
        │                                 webhook source
        │ POST /demo/convert                  │
        ▼                                     │ POST /conversion
   ┌─────────────┐                            │
   │   api/      │ ── PendingConversion ──┐   │
   └─────────────┘                        │   │
                                          │   │
                            ┌─────────────┴───┴────────────┐
                            │       this oracle/           │
                            │                              │
                            │  1. anti-fraud (in-mem maps) │
                            │  2. optional verify call to  │
                            │     api/'s BACKEND_VERIFY_URL│
                            │  3. build register_conversion│
                            │  4. sign with oracle keypair │
                            │  5. submit                   │
                            └─────────────┬────────────────┘
                                          │ register_conversion
                                          ▼
                                Hivework Solana program
```

**Integration contracts:**

| Counterparty | Direction | Channel |
|---|---|---|
| Webhook source (e.g. e-commerce platform) | ⬅ POST `/conversion` | HTTP JSON |
| `api/` | ⬆ optional verify | `BACKEND_VERIFY_URL` |
| Hivework program | ➡ `register_conversion` | Anchor RPC |
| `indexer/` listener | ⬅ observes the resulting `ConversionRegistered` event | _(no direct contact)_ |

---

## Anti-fraud rules implemented

These live in `index.js` and exist because the on-chain program cannot enforce them cheaply:

| Rule | Default |
|---|---|
| Wallet pubkey is valid base58 (32 bytes) | hard fail |
| Same `wallet+campaign` cannot repeat within `RATE_WALLET_MS` | 30 s |
| Same IP cannot repeat within `RATE_IP_MS` | 5 s |
| Same IP cannot exceed `IP_BURST_MAX` conversions in `IP_BURST_WINDOW` | 5 / 60 s |
| Optional `BACKEND_VERIFY_URL` cross-check against `api/` | off by default (demo mode) |

> These are **economic** signals, not cryptographic ones. They are not load-bearing for protocol security — the protocol's security comes from the staking + redistribution mechanism. Anti-fraud here just keeps the demo clean.

---

## Quick start

### 1. Build the program first

```bash
cd ..              # to Contract/
anchor build       # produces target/idl/hivework.json
```

The oracle reads the IDL from `../target/idl/hivework.json`.

### 2. Install + configure

```bash
cd oracle
npm install
cp .env.example .env
```

Edit `.env`:

```bash
PORT=3001
RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8

# Pick ONE of the two key sources:
ORACLE_KEYPAIR_PATH=./oracle-key.json     # Solana CLI JSON format (preferred)
# ORACLE_PRIVATE_KEY=<base58 secret key>  # alternative, single-line

# Optional: cross-check against api/ before signing
BACKEND_VERIFY_URL=http://localhost:3401/internal/verify-conversion
```

### 3. Run

```bash
npm start
# Oracle pubkey: FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU
# Programa cargado: 8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8
# Oracle listening on http://localhost:3001
```

The pubkey printed at boot **must** match the `oracle_authority` recorded in your campaign PDAs, or the program will reject every tx with `UnauthorizedOracle` (error 6002).

### 4. Send a test conversion

```bash
curl -X POST http://localhost:3001/conversion \
  -H 'Content-Type: application/json' \
  -d '{
    "campaign": "<campaign-pda>",
    "leaf": "<leaf-pda>",
    "walletPubkey": "<buyer-wallet>",
    "conversionId": "1",
    "value": 1500000
  }'
# → { "ok": true, "signature": "5xN9j…" }
```

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{ ok: true, oracle: <pubkey>, program: <id> }` |
| `POST` | `/conversion` | Register a single conversion. Runs anti-fraud, signs, submits, returns tx signature |

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `PORT` | | HTTP listen port, default `3001` |
| `RPC_URL` | | Solana RPC, default devnet |
| `PROGRAM_ID` | ✅ | Hivework program ID |
| `ORACLE_KEYPAIR_PATH` | ✅* | Path to Solana CLI keypair JSON |
| `ORACLE_PRIVATE_KEY` | ✅* | base58 secret key — alternative to `ORACLE_KEYPAIR_PATH` |
| `BACKEND_VERIFY_URL` | | Optional URL on `api/` for off-chain verification before signing |

\* exactly one of `ORACLE_KEYPAIR_PATH` / `ORACLE_PRIVATE_KEY` is required.

---

## Why two oracle implementations?

The Hivework architecture supports any number of oracle adapters. They all produce the same artifact (a signed `register_conversion` tx) but are tuned for different operators:

| Implementation | Lives in | Best when… |
|---|---|---|
| **HTTP webhook oracle** | `Contract/oracle/` (this) | A third party (e.g. Shopify, a payment processor) is the source of truth and POSTs conversions in real time |
| **DB-poller oracle** | `indexer/src/oracle/` (Group B) | The campaign owner runs the funnel themselves; clicks and conversions land in `api/`'s Postgres directly |

The on-chain program does not care which one signs. The campaign authority picks one (or many) at `create_campaign` time by setting `oracle_authority`.

---

## Security notes

- The oracle's private key is the protocol's most sensitive secret per campaign. Treat it like a custodian wallet: HSM in production, gitignored JSON in the demo.
- The current implementation logs the oracle pubkey at boot; it never logs the secret.
- The HTTP server runs on plain HTTP for the demo. **Production deployments must terminate TLS.**
- Anti-fraud state is **in-memory** — restarting the process resets the rate buckets. Acceptable for demo, swap for Redis in production.

---

## Project layout

```
Contract/oracle/
├── index.js          # Express server + anti-fraud + Anchor signer
├── package.json
└── .env.example
```

---

## See also

- **The program this oracle signs to:** [`../README.md`](../README.md)
- **The indexer-based oracle used in the demo:** [`../../indexer/README.md`](../../indexer/README.md)
- **Pending-conversion source:** [`../../api/README.md`](../../api/README.md)
- **Root architecture overview:** [`../../README.md`](../../README.md#system-architecture)
