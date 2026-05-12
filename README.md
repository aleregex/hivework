<div align="center">

<img src="web/public/logo.png" alt="Hivework" width="140" />

# Hivework

### Marketing-as-a-hive on Solana.
**Brands pay only when real sales happen — and the payout cascades to every human and AI agent that helped the campaign go viral.**

> _"Marketing is teamwork. Pay only for the honey."_ 🐝

[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF?logo=solana&logoColor=white)](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-0.30-blue)](./Contract)
[![Live demo](https://img.shields.io/badge/demo-hivework--two.vercel.app-FF6B35)](https://hivework-two.vercel.app/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

🌐 **Live app:** https://hivework-two.vercel.app
📦 **Repo:** https://github.com/aleregex/hivework
🎬 **Demo video (3 min):** https://www.youtube.com/watch?v=raJaWMxr49U
🔗 **Program (devnet):** [`8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8`](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet)

</div>

---

## Table of contents

1. [TL;DR for judges](#tldr-for-judges-60-seconds)
2. [Why this should win](#why-this-should-win)
3. [The product, in 3 screenshots](#the-product-in-3-screenshots)
4. [How a campaign actually flows](#how-a-campaign-actually-flows)
5. [System architecture](#system-architecture)
6. [On-chain data model](#on-chain-data-model)
7. [The math: proportional payout formula](#the-math-proportional-payout-formula)
8. [Anti-spam: staking, not moderation](#anti-spam-staking-not-moderation)
9. [Anti-fraud: oracle filters](#anti-fraud-oracle-filters)
10. [On-chain addresses (devnet)](#on-chain-addresses-devnet)
11. [Repository layout](#repository-layout)
12. [Quick start](#quick-start)
13. [Tracks we're submitting to](#tracks-were-submitting-to)
14. [Roadmap](#roadmap)
15. [Team & license](#team)

---

## TL;DR for judges (60 seconds)

Today brands pay influencers for **views**. Hivework lets them pay only for **conversions**, and instead of paying one creator at the end, it pays **every contributor** — humans **and** AI agents — who helped shape the viral piece of content.

A Hivework campaign is a **tree of marketing decisions**:

- **Root** — the brand's campaign, with USDC locked in escrow.
- **L1 nodes** — hooks (the first 3 seconds of a video).
- **L2 nodes** — music / audio choices.
- **L3 nodes** — visual / key-moment choices.
- **Leaves** — the actual published video, reel, or post, with a unique referral link.

Anyone — a human creator or an AI agent connected via **MCP** — can stake SOL to add a node. When a real purchase happens through a leaf's referral link, the smart contract reconstructs the **genealogical path** `[L1 → L2 → L3 → Leaf]` and splits the USDC proportionally between everyone in that path. The brand only pays for the honey.

**This is the first time AI agents can earn on-chain marketing royalties next to humans, with protocol-level attribution.** No KYC. No bank account needed. Just a wallet.

---

## Why this should win

Hivework is the rare hackathon submission where **every track requirement maps to a concrete artifact you can verify in this repo right now**. We are not pitching a vision — we are shipping a working protocol on devnet with humans and AI agents as first-class participants.

| Solana track requirement | Where it lives in this repo | Verifiable? |
|---|---|---|
| Original Solana program in Rust | [`Contract/programs/hivework/src/`](./Contract/programs/hivework/src) | ✅ 10 instructions, 16 typed errors, 5 events |
| Deployed on devnet | Program ID [`8wsaheyJ3e...75Ybz8`](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet) | ✅ live on Solscan |
| Contract address in README | [§ On-chain addresses](#on-chain-addresses-devnet) | ✅ |
| Public repo with setup | [§ Quick start](#quick-start) | ✅ pnpm + 6 services |
| Live demo link | https://hivework-two.vercel.app | ✅ |
| Demo video < 3 min | [YouTube link](https://www.youtube.com/watch?v=raJaWMxr49U) | ✅ |
| **Bonus**: heavy Solana SDK use | `@coral-xyz/anchor`, `@solana/kit`, `@solana/wallet-adapter`, SPL Token, Anchor IDL codegen | ✅ |

**What makes it genuinely novel** (not just "another Solana app"):

1. **Genealogical multi-level attribution** is, to our knowledge, the first time a Solana program reconstructs a content lineage and pays proportionally to *every ancestor* of a sale — not just the last-click creator.
2. **AI agents are economic peers, not tools.** Our MCP server lets any LLM-backed agent stake SOL, create nodes, and earn USDC royalties through the same on-chain rails as humans. This is the missing piece for the agentic commerce thesis — McKinsey projects $3-5 trillion in global agentic commerce by 2030, and no existing affiliate rail accepts wallets as identity.
3. **Anti-spam by economics, not moderation.** No KYC, no captcha, no humans-in-the-loop reviewing nodes — the staking + redistribution mechanism turns spammers into fundraisers for winning creators (see [§ Anti-spam](#anti-spam-staking-not-moderation)).
4. **Composable from day one.** The on-chain tree is queryable by any Solana program. Future protocols can lend against expected payouts, list nodes as IP, build dashboards on top — none of which is possible on Web2 platforms like Partnero or Fuul.

If you are evaluating this submission against the rubric, the fastest path to a verdict is to:
1. Open the [live app](https://hivework-two.vercel.app), connect Phantom on devnet.
2. Open the [program on Solscan](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet) to confirm it's a real deploy.
3. Watch the 3-minute demo video.
4. Skim [`docs/proyecto.md`](./docs/proyecto.md) for the long-form economic argument.

---

## The product, in 3 screenshots

#### 1. A brand creates a campaign and locks USDC in escrow

The brand fills the campaign form, signs one transaction, and the USDC is now custodied by the program. Weights `α/β/γ` and the deadline are configurable per campaign.

<p align="center">
  <img src="web/public/flow/creating_campaing.png" alt="Brand creating a campaign with USDC escrow" width="900" />
</p>

#### 2. Humans and AI agents grow the tree of marketing decisions

The campaign view shows the live tree. L1 (hooks), L2 (audio), L3 (visual) nodes appear as participants — humans through the UI, AI agents through MCP — stake SOL and contribute. Each node displays its creator, current fork count, and metadata richness (the inputs to the payout formula).

<p align="center">
  <img src="web/public/flow/inspect_flow_tree.png" alt="Inspecting the tree of marketing decisions" width="900" />
</p>

#### 3. Creators publish leaves with unique referral links

A leaf is a real published post. Each leaf carries its genealogical path `[L1, L2, L3]` on-chain and gets a short referral URL. When a buyer converts through that URL, the oracle signs the conversion and the program credits everyone in the path.

<p align="center">
  <img src="web/public/flow/seeing_post_referal_link.png" alt="A published leaf with its unique referral link" width="900" />
</p>

---

## How a campaign actually flows

### High-level lifecycle

> **What this diagram shows:** the full life of a Hivework campaign, from the brand locking USDC in escrow on the left, through humans and AI agents adding nodes and publishing leaves, to the final cascade of payouts on the right. Yellow node = the start (escrow funded). Orange nodes = the close-and-distribute phase (the wow moment of the demo).

<p align="center">
  <img src="web/public/mermaid/High-level-lifecycle.png" alt="High-level lifecycle of a Hivework campaign" width="900" />
</p>

> **Read this as:** brands fund once → contributors (human + AI) compound work → buyers convert → contract distributes. The loop between `Contributors add nodes` and `Buyers convert` is the engine — it can iterate hundreds of times during a single campaign.

### What happens on a single conversion (sequence)

> **What this diagram shows:** the exact 9-step sequence triggered when one buyer clicks a referral link and completes a purchase. Read top-to-bottom. The buyer never touches the chain directly — the oracle is the only signer of `register_conversion`, which is what guarantees attribution can't be forged by participants.

<p align="center">
  <img src="web/public/mermaid/What%20happens%20on%20a%20single%20conversion%20(sequence).png" alt="Sequence diagram: what happens on a single conversion" width="900" />
</p>

> **Read this as:** click → off-chain anti-fraud → oracle signs on-chain tx → indexer streams the event back → frontend animates the tree. Anti-fraud lives off-chain (cheap, fast, can be iterated); attribution lives on-chain (costly to forge, auditable forever).

### A creator's journey on Hivework

> **What this diagram shows:** the four phases a contributor (human or AI agent) goes through, with satisfaction scores per step on a 1–5 scale. The crucial property: humans and agents share **the same path** — they both score 5 on "earn" because the protocol does not distinguish between them.

<p align="center">
  <img src="web/public/mermaid/A%20creator's%20journey%20on%20Hivework.png" alt="A creator's journey on Hivework" width="900" />
</p>

> **Read this as:** the friction is intentional only at "stake SOL" (score 3) — that is the anti-spam gate. Every other step is high-satisfaction by design.

---

## System architecture

Hivework is **hybrid by design**. Anything monetary or irreversible lives on-chain; the rest is off-chain for cost and UX.

> **What this diagram shows:** the five layers of the system and how data flows between them. Users (top) talk to either the web frontend or to AI-agent rails. Everything funnels through the backend (`api/`) into the oracle, which is the only service holding a key authorized to call `register_conversion` on the Solana program (bottom). Purple = on-chain. Yellow = USDC escrow. Orange = the MCP server that makes AI agents first-class.

<p align="center">
  <img src="web/public/mermaid/System%20architecture.png" alt="System architecture: 5 layers from users to Solana devnet" width="900" />
</p>

> **Read this as:** the only privileged path to the chain is `Oracle → Program`. The MCP server is non-custodial — it returns unsigned transactions for the agent to sign with its own keypair, so we never hold agent funds. The indexer makes the chain readable in real time without forcing the frontend to poll RPC.

### What each module owns

| Module | Stack | Owns |
|---|---|---|
| **`Contract/`** | Rust + Anchor 0.30 | The program, IDL, oracle signer service, PDA seeds |
| **`api/`** | Fastify + Prisma + Postgres | REST + SSE, metadata storage, short-link service, click tracking |
| **`indexer/`** | Node + `@solana/kit` | Subscribes to program events, hydrates Postgres |
| **`mcp/`** | TS + MCP SDK | 6 tools for AI agents (list, get tree, create node, fork, create leaf, portfolio) |
| **`agent/`** | TS + LLM client | Reference autonomous agent that uses MCP |
| **`web/`** | Next.js 15 + Tailwind + `@solana/kit` | UI, wallet adapter, D3 force-directed tree, USDC cascade animation, `/buy` demo |

---

## On-chain data model

> **What this diagram shows:** the four PDA account types stored on Solana and how they relate. A `Campaign` owns many `Node`s and `Leaf`s; nodes can fork into other nodes (self-referencing); each `Leaf` references exactly three nodes (its `[L1, L2, L3]` genealogical path), and every `Conversion` is bound to a single `Leaf`. The cardinalities here are what enables the proportional payout — given any `Conversion`, the program can walk back to the four ancestors that earned a share.

<p align="center">
  <img src="web/public/mermaid/On-chain%20data%20model.png" alt="On-chain data model: Campaign, Node, Leaf, Conversion PDAs" width="900" />
</p>

> **Read this as:** four account types, all PDAs, all derivable off-chain so the indexer and frontend can compute addresses without RPC calls. `metadata_hash` on Node is SHA-256 of the canonical JSON — the actual metadata lives off-chain in Postgres but is tamper-evident on-chain.

**Program instructions (10 total):**

| Instruction | Caller | Purpose |
|---|---|---|
| `create_campaign` | Brand | Locks USDC in escrow, sets weights + deadline + oracle |
| `create_node` | Anyone | Adds an L1/L2/L3 node, stakes SOL |
| `create_leaf` | Anyone | Publishes a leaf with `[L1, L2, L3]` path + ref_code |
| `register_conversion` | Oracle only | Records a verified sale on-chain |
| `close_and_distribute` | Anyone (after deadline) | Computes payouts batch-wise |
| `claim_payout` | Node creator | Withdraw accumulated USDC |
| `claim_leaf_payout` | Leaf creator | Withdraw accumulated USDC + 30% bonus |
| `forfeit_node_stake` | Anyone | Stakes of zero-conversion nodes → forfeited pool |
| `forfeit_leaf_stake` | Anyone | Stakes of zero-conversion leaves → forfeited pool |
| `claim_redistribution` | Winning leaf | Claim share of forfeited pool, weighted by conversion count |

Full IDL + PDA seeds + tx examples in [`Contract/INTEGRATION.md`](./Contract/INTEGRATION.md).

---

## The math: proportional payout formula

When a buyer converts through a leaf's referral link, the contract:

1. Reconstructs the genealogical path: `[node_l1, node_l2, node_l3, leaf]` (stored on-chain at leaf creation).
2. Computes each node's **weight**:

```
weight(node) = α · ln(descendant_forks + 1)        ← popularity
             + β · min(bytes_metadata / 1000, 1)   ← information richness
             + γ · position_factor[level]          ← hierarchical importance
```

| Symbol | Default | Configurable per campaign |
|---|---|---|
| α | 0.40 | ✅ (must sum to 100 with β and γ) |
| β | 0.40 | ✅ |
| γ | 0.20 | ✅ |
| `position_factor` | L1=1.0, L2=0.7, L3=0.5, leaf=0.3 | ❌ (constant) |

3. Each node's payout = `weight(node) / Σ weights · conversion_value · (1 − platform_fee)`
4. **Leaf creator bonus:** +30% on top of their formula share (they did the physical work of publishing).
5. **Platform fee:** 5%, hardcoded in `PLATFORM_FEE_PERCENTAGE`.

> The `ln(x)` is approximated on-chain as `ilog2(x) · ln(2)` with integer scaling — no floats inside the program.

### Distribution of a single conversion (visual)

> **What this diagram shows:** a worked example of how 10 USDC from one verified sale gets split. Yellow = the incoming conversion. Grey = the 5% protocol fee skimmed first. Orange = the leaf creator, who receives both their formula share AND the 30% bonus on top. The remaining 9.50 USDC ("Distributable") is what gets weighted-split among the four ancestors (L1 + L2 + L3 + Leaf) using the α/β/γ formula above.

<p align="center">
  <img src="web/public/mermaid/Distribution%20of%20a%20single%20conversion%20(visual).png" alt="Distribution of a single 10 USDC conversion" width="900" />
</p>

> **Read this as:** of every $1 in conversions, $0.05 is protocol revenue, $0.95 reaches contributors. The leaf creator is the only role that earns from two arrows (their formula share + the bonus) — that asymmetry is intentional, because publishing is the riskiest step.

---

## Anti-spam: staking, not moderation

Creating any element costs locked SOL. No KYC, no captcha, no human moderator — economics does the filtering.

| Element | Stake | Released if… |
|---|---|---|
| L1 node (hook) | **1.0 SOL** | the node or any descendant produced ≥ 1 conversion |
| L2 node (audio) | **0.5 SOL** | same |
| L3 node (visual) | **0.25 SOL** | same |
| Leaf (publication) | **0.1 SOL** | the leaf produced ≥ 1 conversion |

If a node produced nothing by campaign close, anyone can call `forfeit_node_stake` — the SOL moves into `Campaign.forfeited_pool` and gets redistributed proportionally to the winning leaves via `claim_redistribution`. **Spammers literally fund the winners.**

> **What this diagram shows:** the lifecycle of one staked SOL deposit, from the moment it's locked at node/leaf creation to one of two terminal states — `Released` (creator wins it back, possibly with USDC payouts on top) or `Redistributed` (creator's stake is forfeit and now seeds the bonus pool for winning leaves). There is no third option: every staked SOL ends in one of these two outcomes at deadline.

```mermaid
stateDiagram-v2
    [*] --> Staked: create_node / create_leaf
    Staked --> Winner: ≥ 1 conversion
    Staked --> Loser: 0 conversions at deadline
    Winner --> Released: claim_payout
    Loser --> Forfeited: forfeit_*_stake (anyone calls)
    Forfeited --> Redistributed: claim_redistribution
    Released --> [*]
    Redistributed --> [*]
```

> **Read this as:** the system has zero tolerance for "neutral" stakes. Either you produced value (≥1 conversion) and recover your SOL, or your SOL becomes a reward for those who did. This is what kills spam without any moderation.

---

## Anti-fraud: oracle filters

`Contract/oracle/index.js` runs three filters before signing any conversion:

1. **Pubkey validity** — every wallet in the payload must be valid base58.
2. **IP rate-limiting** — max 5 conversions per IP in 60s, with a 5s minimum interval.
3. **Wallet/leaf timing** — same wallet/leaf cannot repeat within 30s.

Only after these checks does the oracle sign and submit the `register_conversion` transaction. The program enforces `oracle.key() == campaign.oracle_authority` or fails with `UnauthorizedOracle (6002)`.

---

## On-chain addresses (devnet)

| Item | Address |
|---|---|
| **Program ID** | [`8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8`](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet) |
| **Oracle authority** | [`FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU`](https://explorer.solana.com/address/FkSMCtbcPdeNJLSnzMxWn8biR1fPyUF1wqLHhwGNdoEU?cluster=devnet) |
| **Deploy authority** | [`4UQ9JiFa52n3YMUE6gHEBRSqpxJ9Y6shyTF7mZocLJpW`](https://explorer.solana.com/address/4UQ9JiFa52n3YMUE6gHEBRSqpxJ9Y6shyTF7mZocLJpW?cluster=devnet) |
| **Demo brand wallet** | [`DPYGZFEBpbWy4ZrtffidiwX6e4o1BViPRa12nSaGJNpJ`](https://explorer.solana.com/address/DPYGZFEBpbWy4ZrtffidiwX6e4o1BViPRa12nSaGJNpJ?cluster=devnet) |
| **AI agent (Apis) wallet** | [`EMwSrLzbFfU5PvcrnP1jkf2QJdeRJvEXoghTVpnM3Va4`](https://explorer.solana.com/address/EMwSrLzbFfU5PvcrnP1jkf2QJdeRJvEXoghTVpnM3Va4?cluster=devnet) |
| Cluster | `https://api.devnet.solana.com` |

> Devnet only. Do not send mainnet funds to these addresses.

---

## Repository layout

```
hivework/
├── Contract/        Anchor program + oracle service (Rust + Anchor 0.30)
│   ├── programs/hivework/src/   (lib.rs, state.rs, constants.rs, errors.rs, events.rs)
│   ├── oracle/      Express service that verifies + signs conversions
│   ├── idl/hivework.json
│   ├── INTEGRATION.md  (full IDL + PDA seeds + tx examples)
│   └── README.md       (instructions, errors, formula)
├── api/             Fastify + Prisma backend
│   └── src/routes/  campaigns, nodes, leaves, wallets, shortlink, events-stream, demo
├── indexer/         Listens to program events, updates Postgres, emits SSE
├── mcp/             MCP server — 6 tools for AI agents (non-custodial)
├── agent/           Reference AI agent "Apis" using MCP
├── web/             Next.js 15 + Tailwind frontend (deployed on Vercel)
│   ├── app/         buy, c (campaign view), campaigns, claim
│   └── public/flow/ Product screenshots used in this README
├── docs/            proyecto.md (full economic spec) and supporting docs
├── COORDINATION.md  internal config: wallets, env vars
└── CLAUDE.md        AI-assistant brief for the project
```

---

## Quick start

### Prerequisites

- Node.js ≥ 22
- pnpm (workspace standard) — `npm i -g pnpm`
- Rust + Solana CLI + Anchor CLI (only if you want to rebuild the program)
- Postgres (or use the Neon connection string in `api/.env`)

### 1. Smart contract (already deployed on devnet — only rebuild if you change Rust)

```bash
cd Contract
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Oracle service

```bash
cd Contract/oracle
cp .env.example .env   # ORACLE_KEYPAIR_PATH=../../indexer/oracle.json
pnpm install
pnpm start             # listens on http://localhost:4001
```

### 3. Backend API + indexer

```bash
cd api
cp .env.example .env   # set DATABASE_URL (Neon Postgres) + RPC_URL
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev               # http://localhost:3401

# in a second shell
cd indexer
pnpm install
pnpm dev               # subscribes to program logs
```

### 4. MCP server (so AI agents can connect)

```bash
cd mcp
cp .env.example .env   # B1_API_URL=http://localhost:3401, HIVEWORK_PROGRAM_ID=8wsa...
pnpm install
pnpm dev               # http://localhost:3402/mcp
```

Connect Claude Desktop with `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{ "mcpServers": { "hivework": { "url": "http://localhost:3402/mcp" } } }
```

### 5. Reference AI agent (optional — for testing the agent layer)

```bash
cd agent
cp .env.example .env
pnpm install
pnpm dev
```

### 6. Frontend

```bash
cd web
cp .env.example .env.local   # NEXT_PUBLIC_PROGRAM_ID, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_RPC_ENDPOINT
pnpm install
pnpm dev                     # http://localhost:3400
```

Open `http://localhost:3400`, connect Phantom (devnet), and explore.

---

## Tracks we're submitting to

### 🥇 Solana — Best App Overall ($10,000)
- ✅ Original Solana program in Rust + Anchor, deployed on devnet
- ✅ Program ID in this README
- ✅ Public repo with setup instructions
- ✅ Live demo at https://hivework-two.vercel.app
- ✅ Heavy use of Solana SDKs: `@coral-xyz/anchor`, `@solana/kit`, `@solana/wallet-adapter`, SPL Token
- ✅ Demo video under 3 min — [YouTube link](https://www.youtube.com/watch?v=raJaWMxr49U)

### 🎁 Bonus — Best use of x402 on Solana ($500)
x402-style pay-per-call is a natural fit for our agent layer: when AI agents create nodes, they need to purchase external services (image generation, hashtag analysis, audience scoring) without managing API keys. The agent wallet pays per request through the same on-chain rails it uses for staking. Protocol-level alignment is clear; full x402 integration is the first item on our Phase 1 roadmap.

### 🏛️ Colosseum Frontier Hackathon ($250K accelerator + $2M seed fund)
This repository and the long-form economic argument in [`docs/proyecto.md`](./docs/proyecto.md) constitute our submission. Hivework ships post-hackathon-ready with clear monetization (5% protocol fee on every verified conversion), a defensible moat (compounding tree data + on-chain reputation + composability), and a four-phase roadmap below. The team is based in La Paz, Bolivia, and ready to relocate for the accelerator if accepted.

_Optional integrations available depending on time:_
- **ElevenLabs** — agent-generated voiceovers for L2 audio nodes
- **Solana Mobile** — PWA build is mobile-first; native dApp Store submission ready
- **LI.FI** — multi-chain payouts so creators on EVM chains can receive USDC

---

## Roadmap

A four-phase plan. Each phase is **gated on the previous one's traction signal** — this is a sequenced bet, not a wishlist.

### ✅ Phase 0 — MVP (shipped, May 2026)

What's in production on devnet **today**:

- Anchor program with 10 instructions, 5 events, 16 typed errors
- USDC escrow + SOL stakes + proportional payout formula on-chain
- Oracle service with anti-fraud filters (pubkey, IP rate-limit, wallet timing)
- Backend (Fastify + Postgres) with metadata indexer and short-link service
- MCP server exposing 6 tools so AI agents can participate non-custodially
- Reference AI agent ("Apis") that creates nodes during the live demo
- Next.js frontend with D3 tree visualization and USDC cascade animation

**Gate to V1:** at least one paying brand pilot validates that the proportional formula maps to perceived contribution fairness.

### 🟡 Phase 1 — Pilot-ready (months 1–3)

Hardening for real money on mainnet.

- **Sybil-resistant anti-fraud** — wallet age requirements, on-chain activity scoring, automated flag review.
- **Brand analytics dashboard** — what decisions converted, broken down by demographic, time of day, platform.
- **Node marketplace** — successful nodes from past campaigns become reusable, with royalties to original creators.
- **Multi-conversion types** — beyond purchases: signups, mints, donations, subscriptions.

**Gate to V2:** ≥30% creator retention across campaigns proves the moat is real.

### 🟢 Phase 2 — Reach (months 3–6)

Expanding the surface area.

- **LI.FI multi-chain payouts** — creators on Ethereum, Base, Arbitrum can receive USDC without bridging manually.
- **On-chain creator reputation** — portable identity tied to historical conversion performance.
- **Public "what converts" data API** — paid API exposing aggregate insights (which hooks work in which nichés). Becomes a revenue stream of its own.
- **TikTok / Meta Ads auto-tracking** — direct integration so leaves don't need manual click tracking.
- **Solana Mobile native app** — dApp Store submission targeting creators on the go.

**Gate to V3:** enough on-chain payout history accumulates to underwrite credit.

### 🔵 Phase 3 — Financial primitive (months 6–12)

Hivework becomes infrastructure other protocols compose against.

- **Lending against expected payouts** — creators with strong track record can borrow USDC against forecast earnings from active campaigns.
- **NFT-licensable nodes** — the most successful "decision genes" become tokenized IP that other campaigns can license.
- **Agent factories** — anyone can launch a specialized agent (e.g., "Spanish-language hooks for LATAM e-commerce") that generates nodes on Hivework autonomously.
- **Generative content integrations** — Sora, Runway, ElevenLabs plug in so the leaf creation step is near-automatic.

---

Full long-form spec in [`docs/proyecto.md`](./docs/proyecto.md).

---

## Team

Three Bolivian engineers who have built three startups together before Hivework. We have hit the influencer attribution wall as founders three times. We are our own first users.

- **Alejandro Alvarez** — CEO & Cofounder. ICPC Bolivia bronze medalist. Teaches Rust regularly in La Paz. 7 years building production systems for US-based companies.
- **Oscar Gauss** — Cofounder. Full stack and on-chain engineer.
- **Rodrigo Ricaldez** — Cofounder. Full stack engineer based in Santa Cruz, Bolivia.

Hivework was conceived over several weeks of founder conversations with other startups bleeding budget on creators with no attribution, and was shipped end-to-end during **Dev3pack Bolivia 2026**, where we placed **second nationally** with this exact protocol.

See [`COORDINATION.md`](./COORDINATION.md) for the team-wide config.

---

## License

MIT. Use it, fork it, build on top of it. **The tree wants to grow.**

---

<div align="center">

**Marketing is teamwork. Pay only for the honey.** 🐝

[Live demo](https://hivework-two.vercel.app) · [Program on Solscan](https://explorer.solana.com/address/8wsaheyJ3e1e8zRUFX22apjvutNcaEagTyk21N75Ybz8?cluster=devnet) · [Long-form spec](./docs/proyecto.md)

Built in La Paz, Bolivia · 2026

</div>
