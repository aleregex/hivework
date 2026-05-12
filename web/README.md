# `web/` — Hivework Frontend

> The user-facing surface of Hivework: brand campaign creation, the live tree visualization that is the demo's centerpiece, the buyer `/buy` flow, the creator portfolio, and the USDC cascade animation that plays at campaign close.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Solana Wallet Adapter](https://img.shields.io/badge/wallet--adapter-react-9945FF?logo=solana&logoColor=white)](https://github.com/anza-xyz/wallet-adapter)
[![Anchor](https://img.shields.io/badge/anchor-0.30-blue)](https://www.anchor-lang.com)

🌐 **Live:** https://hivework-two.vercel.app

---

## What this app is

Hivework is a Solana protocol where brands pay only for real conversions, and the payout cascades to every contributor in the genealogical path that produced the sale. `web/` is the surface where that whole system becomes tangible:

- **Brands** create campaigns, lock USDC in escrow, and watch their tree grow.
- **Creators (humans + AI agents)** stake SOL to add nodes, fork existing ones, and publish leaves with unique referral links.
- **Buyers** discover content via short links and convert through the demo `/buy` page.
- **Everyone** watches conversions roll in, and at campaign close the cascade animation distributes the pot proportionally — visible on Solscan in real time.

The frontend is the **only consumer of the SSE event stream** from `api/`, so the tree updates instantly when an agent or human adds a node.

---

## How it integrates with the rest of the system

```
                       ┌─────────────────────────┐
                       │ Solana wallet adapter   │
                       │ (Phantom / Solflare)    │
                       └────────────┬────────────┘
                                    │ user signs
                                    ▼
   ┌────────────────────────────────────────────────────────┐
   │                    web/   (this)                        │
   │                                                          │
   │  app/                                                    │
   │   ├── page.tsx               landing                     │
   │   ├── campaigns/             list + /new                 │
   │   ├── c/[id]/                campaign tree view + /buy   │
   │   ├── buy/[refCode]/         demo conversion flow        │
   │   └── claim/                 wallet portfolio + claims   │
   │                                                          │
   │  lib/anchor/  ← Anchor IDL → program client (typed)      │
   │  lib/api/     ← REST + SSE client for api/               │
   │  components/  ← tree-graph, cascade-summary, dialogs…    │
   └─────────┬─────────────────────────┬────────────────────┘
             │ REST + SSE              │ Anchor txs
             ▼                         ▼
      api/  (Fastify)            Solana devnet
             │                         │
             ▼                         ▼
     Postgres (Neon)              indexer/ ──→ updates Postgres
                                   ↑    │
                                   │    │ /events/stream SSE
                                   └────┴────────────────────►
```

**Integration contracts:**

| Counterparty | Direction | Channel |
|---|---|---|
| `api/` | reads campaigns, nodes, leaves, portfolio, shortlinks | REST + SSE on `/events/stream` |
| Solana program | signs and sends `create_campaign`, `create_node`, `create_leaf`, `claim_payout` | Anchor client built from IDL in `Contract/idl/hivework.json` |
| Wallet adapter | UI integration | `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` |
| `indexer/` | indirect (writes the rows we read) | none direct |

The frontend never talks to `mcp/` — that's only for AI agents. It also never holds the oracle key — the oracle lives in `indexer/` / `Contract/oracle/`.

---

## Stack

- **Framework:** Next.js 16 (App Router, RSC) on React 19.2
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS 4 + custom design tokens (honey/sting palette) in `app/globals.css`
- **UI primitives:** shadcn/ui (Radix-based) re-exported from `components/ui/`
- **Animations:** `framer-motion` for the cascade summary + dialog transitions
- **State:** TanStack React Query for server state, Zustand for ephemeral UI state, React Hook Form + Zod for forms
- **Solana:** `@coral-xyz/anchor`, `@solana/wallet-adapter-*`, SPL Token; `@solana/kit` for low-level pubkey + PDA work
- **Tree layout:** hand-rolled tidy-tree algorithm in `components/tree/tree-graph.tsx` (Reingold-Tilford, two-pass) — deterministic, hex nodes, pan + zoom

---

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing: hero, how-it-works, active campaigns CTA |
| `/campaigns` | `app/campaigns/page.tsx` | List of active campaigns |
| `/campaigns/new` | `app/campaigns/new/page.tsx` | Brand wizard: product → pool → weights → on-chain `create_campaign` |
| `/c/[id]` | `app/c/[id]/page.tsx` | **Centerpiece.** Campaign detail with tree view, agent chat panel, demo control panel |
| `/c/[id]/contribute` | `app/c/[id]/contribute/page.tsx` | Sub-route for adding nodes / publishing leaves |
| `/buy/[refCode]` | `app/buy/[refCode]/page.tsx` | Demo buyer flow: triggers `POST /demo/convert`, shows tree light up |
| `/claim` | `app/claim/page.tsx` | Per-wallet portfolio: stakes locked, pending payouts, claim history, per-contribution breakdown |

---

## The two demo wow moments

### 1. The live tree

`components/tree/tree-graph.tsx` (~715 LOC, hand-rolled). Hexagonal nodes, deterministic tidy-tree layout, ResizeObserver-driven viewport fit, wheel zoom, drag pan. Subscribed to `/events/stream` so when Apis (the AI agent) creates a node mid-pitch, the new hex pops in without a refresh.

### 2. The USDC cascade

`components/tree/cascade-summary.tsx` triggers when a campaign closes. `framer-motion` reveal animations, animated counters that tick from $0 to total distributed, top-creators leaderboard sorted by cascade share, and a Solscan link for the closing transaction. **This is the screenshot judges remember.**

---

## Theming

The bee/hive identity is enforced through CSS variables in `app/globals.css`:

| Token | Value | Use |
|---|---|---|
| `--honey` | `#f2a526` | Primary, node fill, CTA |
| `--sting` | `#ff6b35` | Accent, conversion events |
| `--ink` | `#0a0a0a` | Background (dark mode) |
| `.hex-grid` | SVG honeycomb pattern, 6% opacity | Body backdrop |
| `.glow-honey` / `.glow-sting` | radial glows | Hero + cascade highlights |

Tailwind 4 surfaces these as `bg-honey`, `text-sting`, etc. via `@theme inline` in the same file.

---

## Quick start

### 1. Install

```bash
cd web
pnpm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

```bash
# Local
NEXT_PUBLIC_API_URL=http://localhost:3401
# Or production:
# NEXT_PUBLIC_API_URL=https://api-hivework.oscargauss.com

NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8
```

### 3. Run

```bash
pnpm dev          # http://localhost:3000
# or
pnpm build && pnpm start
```

### 4. Generate demo wallets (optional)

```bash
node scripts/gen-wallets.mjs
# writes to web/.local-keys/ (gitignored). Pubkeys go in COORDINATION.md.
```

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Base URL of `api/`. Local: `http://localhost:3401` · Production: `https://api-hivework.oscargauss.com` |
| `NEXT_PUBLIC_RPC_ENDPOINT` | ✅ | Solana RPC for the wallet adapter |
| `NEXT_PUBLIC_PROGRAM_ID` | ✅ | Hivework program ID (devnet by default) |
| `NEXT_PUBLIC_SHORTLINK_BASE_URL` | | Public base URL for ref-code links |

All public env vars are inlined at build time — never put secrets here.

---

## Project layout

```
web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                     # landing
│   ├── globals.css                  # design tokens + honeycomb backdrops
│   ├── campaigns/
│   │   ├── page.tsx                 # list
│   │   └── new/page.tsx             # brand wizard
│   ├── c/[id]/
│   │   ├── page.tsx                 # campaign detail (tree + panels)
│   │   └── contribute/page.tsx
│   ├── buy/[refCode]/page.tsx       # demo buyer flow
│   ├── claim/page.tsx               # portfolio + claims
│   └── components/providers.tsx     # wallet + react-query providers
├── components/
│   ├── ui/                          # shadcn primitives
│   ├── landing/                     # hero, how-it-works, active-campaigns, footer, nav
│   └── tree/                        # tree-graph, tree-view, cascade-summary,
│                                    # add-node-dialog, agent-chat-panel,
│                                    # demo-control-panel, my-leaves-panel,
│                                    # node-detail-panel, publish-flow-panel,
│                                    # tree-legend, your-earnings-strip
├── lib/
│   ├── anchor/                      # Anchor program client + tx builders
│   ├── api/                         # REST + SSE client for api/
│   └── mocks/                       # local fixtures for offline demo fallback
├── public/
│   ├── flow/                        # screenshots used in the root README
│   └── mermaid/                     # rendered architecture diagrams
└── scripts/
    └── gen-wallets.mjs              # generate the team's demo wallets
```

---

## Demo-day failure modes & fallbacks

| Failure | Effect | Fallback |
|---|---|---|
| `api/` is down | Tree won't load, SSE silent | `lib/mocks/` ships a hardcoded tree for offline pitch |
| RPC is rate-limited | Wallet adapter struggles to confirm | Pre-record video; tree still renders from API |
| Wallet not connected | Cannot sign | Tree is read-only — still demoable |
| Cascade animation stutters | Wow moment dampened | Pre-recorded clip embedded in slide as backup |

---

## See also

- **REST + SSE source:** [`../api/README.md`](../api/README.md)
- **On-chain program (IDL is the contract):** [`../Contract/README.md`](../Contract/README.md)
- **Real-time backend that updates Postgres:** [`../indexer/README.md`](../indexer/README.md)
- **Root pitch + diagrams:** [`../README.md`](../README.md)
