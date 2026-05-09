# Hivework

> Marketing-as-a-hive on Solana. Brands deposit USDC into escrow. Humans and AI agents collaboratively build trees of marketing decisions. When real conversions happen, payouts flow proportionally to all contributors in the genealogical path that led to the sale.

**Tagline:** "Marketing is teamwork. Pay only for the honey."

**Theme:** Bees and hives 🐝. Suggested palette: yellow `#F5C518` over black `#0A0A0A`, accent orange `#FF6B35`. Final palette to be confirmed by team designer.

---

## Critical context for any AI assistant working on this project

This is a **Solana hackathon project** with **12 hours total** and **3 developers**. The scope is aggressive and must be ruthlessly prioritized.

We are NOT building a perfect product. We are building a **demo that wins**. That means:

- The smart contract must work end-to-end on devnet, not be production-ready
- The UI must look polished in screenshots, not work on every device
- The AI agent must demonstrate the concept in 30 seconds, not be a real product
- The pitch must communicate the idea in 3 minutes, not explain every feature

When in doubt, prioritize: **demo wow factor > correctness of edge cases > code quality > test coverage**.

---

## What we're building

### The problem

Marketing performance is broken in three ways:
1. Brands pay for views and likes, not real sales
2. Creators (humans and AI) work isolated, without shared learning
3. Most importantly: AI agents can't participate as marketing contributors because they have no banking access and no protocol-level attribution

### The solution

A protocol on Solana where each campaign is a collaborative tree of marketing decisions:

- **Root:** the campaign itself (with USDC pool in escrow)
- **Level 1 nodes:** hooks (the first 3 seconds of content)
- **Level 2 nodes:** music/audio decisions
- **Level 3 nodes:** visual/key-moment decisions
- **Leaves:** actual published content (videos, reels, posts) with unique referral links

When someone clicks a referral link and converts, the smart contract pays **proportionally** to ALL nodes in the genealogical path, plus a 30% bonus to the leaf creator. The platform takes 5%.

### Anti-fraud: staking only

To create any element, the creator must stake SOL:
- Level 1 node: 1.0 SOL
- Level 2 node: 0.5 SOL
- Level 3 node: 0.25 SOL
- Leaf: 0.1 SOL

Stakes are released to creators if their node (or any descendant) generates at least one conversion. Otherwise, the stake is redistributed at campaign close. This eliminates spam without needing complex fraud detection.

### The payout formula

For each conversion, the contract:

1. Reconstructs the path: `[node_l1, node_l2, node_l3, leaf]`
2. For each node in the path, calculates weight:

```
weight(node) = α × log(descendant_forks + 1)
             + β × richness_score
             + γ × position_factor[level]
```

Where:
- `α = 0.4` (popularity weight)
- `β = 0.4` (information richness weight)
- `γ = 0.2` (hierarchical level weight)
- `richness_score`: bytes_metadata / 1000, capped 0-1
- `position_factor`: level 1 = 1.0, level 2 = 0.7, level 3 = 0.5, leaf = 0.3

3. Each node's payout: `(node_weight / total_path_weight) × conversion_value × (1 - platform_fee)`
4. Leaf creator gets +30% bonus on top
5. Platform takes 5% fee

---

## System architecture (hybrid by design)

**On-chain (Solana, decentralized):**
- USDC escrow per campaign
- SOL stakes from creators
- PDAs for campaigns, nodes, leaves, conversions
- Payout formula execution
- Stake release logic
- Payout claims

**Off-chain (centralized for MVP):**
- Enriched metadata (descriptions, images, examples)
- Tree indexer for fast frontend queries
- Short-link service with click tracking
- Oracle service that verifies conversions and signs them on-chain
- AI agent and MCP server

The split is by economy of gas, not by power: anything with monetary value or irreversible decisions lives on-chain.

---

## Three groups, one team

The work is divided into 3 groups that should not block each other:

### Group A — Smart contract on-chain, oracle, staking

Owns: Anchor program, the IDL, the oracle service that signs conversions.

Responsibilities documented in: `docs/grupo_a.md`

### Group B — Backend, indexer, MCP server, demo AI agent

Owns: HTTP APIs, metadata storage, blockchain indexer, short-link service, MCP server, the AI agent that creates nodes during the demo.

Responsibilities documented in: `docs/grupo_b.md`

### Group C — Frontend, tree visualization, pitch, submission

Owns: All UI, the tree visualization (the demo's centerpiece), the USDC cascade animation (the wow moment), pitch deck, demo script, video backup, README, submission to Dev3pack and Colosseum.

Responsibilities documented in: `docs/grupo_c.md`

---

## Demo plan (3 minutes)

1. **0:00–0:20** — Hook: state the problem with a number that hurts
2. **0:20–0:50** — Brand creates campaign, USDC moves visibly to escrow on Solscan
3. **0:50–2:00** — Tree grows in real time:
   - Pre-populated with 5-10 nodes
   - AI agent creates 2-3 more nodes live via MCP
   - Team members create leaves with unique links
   - "Purchases" happen via the demo `/buy` page
   - Branches light up as conversions flow in
4. **2:00–2:45** — Campaign closes → USDC cascade animation → payouts flow to all contributors → Solscan confirms transactions
5. **2:45–3:00** — The vision: "Marketing as code. Open trees. Proportional payouts. In Solana."

---

## What "done" looks like

The demo is successful if:

- [ ] A real campaign is created on devnet with real USDC moving to escrow
- [ ] The tree shows at least 8 nodes (mix of humans and AI agent)
- [ ] At least 3 leaves are published with unique short-links
- [ ] At least 5 real conversions are registered on-chain during the demo
- [ ] The cascade animation plays correctly at close
- [ ] Final payouts are distributed and visible on Solscan
- [ ] The pitch fits in 3 minutes

If any of these fails, fall back to the recovery plan in each group's MD.

---

## Coordination protocol

- All wallets and config: see `COORDINATION.md`
- Communication channel: Telegram group "Hivework Hackathon"
- Three full demo rehearsals scheduled before the final pitch
- The final go/no-go decision happens 1 hour before the pitch slot
