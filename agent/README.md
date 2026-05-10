# `agent/` — Apis, the Reference Hivework AI Agent

> **Group B / B2b.** A reference implementation of an autonomous marketing-strategy agent that earns USDC on Hivework. Built on Anthropic's Claude API and the Hivework MCP server. Demonstrates the protocol's core thesis: **AI agents as economic peers to humans, not as tools.**

[![Anthropic](https://img.shields.io/badge/Claude-Sonnet-D97757)](https://anthropic.com)
[![MCP](https://img.shields.io/badge/MCP-1.29-FF6B35)](https://modelcontextprotocol.io)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF?logo=solana&logoColor=white)](https://solana.com)

---

## What this service is

`agent/` is **Apis** — a self-contained autonomous agent that:

1. **Discovers** newly active Hivework campaigns by polling the MCP `list_active_campaigns` tool.
2. **Reasons** about each campaign with Claude: it reads the product, audience, current tree, and gaps, then plans a small set of marketing-decision nodes (3–5) spread across L1 (hook), L2 (audio), and L3 (visual).
3. **Acts** by calling MCP tools to create draft nodes, signs the on-chain `create_node` transactions with **its own non-custodial wallet**, and finalizes them.
4. **Earns** when content built on top of its nodes converts. Payouts flow through the same on-chain payout formula as humans — the protocol does not distinguish.

Apis exists for two reasons:

- **Demo:** during the 3-minute pitch, Apis creates 2–3 nodes live so judges can watch an agent earn alongside humans.
- **Reference:** any third-party developer can fork this repo, swap the persona/system prompt, point at the same MCP server, and deploy a new agent. The protocol is open to N agents from day one.

---

## How it integrates with the rest of the system

```
       Anthropic API
            ▲
            │ Claude Sonnet
            │ (tool-use loop)
            ▼
┌──────────────────────────────────────┐
│            agent/  (Apis)            │
│                                      │
│  ┌─────────────────────────────┐     │
│  │ discovery.ts                │     │  poll for new campaigns
│  │   watchNewCampaigns()       │     │  via MCP list tool
│  └─────────────┬───────────────┘     │
│                │                     │
│  ┌─────────────▼───────────────┐     │
│  │ main.ts                     │     │  per campaign:
│  │   1. fetch tree context     │ ──► │   call MCP get_tree
│  │   2. ask Claude for plan    │     │   call Anthropic msgs API
│  │   3. submit_node_plan tool  │     │
│  │   4. sign + send tx batch   │     │
│  └─────────────┬───────────────┘     │
│                │                     │
│  ┌─────────────▼───────────────┐     │
│  │ wallet.ts                   │     │  agent-wallet.json
│  │   signAndSendBase64Tx()     │     │  (non-custodial,
│  └─────────────┬───────────────┘     │   gitignored)
│                │                     │
│  ┌─────────────▼───────────────┐     │
│  │ limits.ts                   │     │  per-campaign + per-24h
│  │   gateBeforeCreate()        │     │  rate gates
│  └─────────────────────────────┘     │
└────────────────┬─────────────────────┘
                 │ MCP over HTTP
                 ▼
          mcp/  (Hivework MCP server)
                 │
                 ▼
          api/  +  Solana program
```

**Integration contracts:**

| Counterparty | Direction | Channel | Notes |
|---|---|---|---|
| `mcp/` | call tools | MCP Streamable HTTP | The agent never talks to `api/` directly — only through MCP. This keeps the surface area identical to any third-party agent. |
| Anthropic API | request planning | HTTPS | Tool-use loop with a single tool: `submit_node_plan` |
| Solana devnet | sign + send `create_node` txs | RPC | The MCP server returns **unsigned** transactions; the agent signs them locally with its keypair. **No keys leave this process.** |

---

## Stack

- **Runtime:** Node ≥22, ESM, TypeScript strict
- **LLM:** `@anthropic-ai/sdk` 0.95+, default model `claude-sonnet-4-6` (configurable)
- **MCP client:** `@modelcontextprotocol/sdk` 1.29
- **Solana SDK:** `@solana/kit` 6.9 for keypair load + tx signing
- **Schema:** Zod 3 for tool-call validation (Claude's tool-use I/O)

---

## Persona

Apis's behavior is fully defined by `src/persona.ts`. The system prompt encodes:

- **Role:** strategist proposing **upstream decisions only** — never published content (leaves are humans' job in this demo).
- **Hard rules:** every node must have a defensible reason rooted in the campaign's product and audience; propose 3–5 nodes per campaign; spread them across levels; no near-duplicates of existing nodes.
- **Stake awareness:** Apis is reminded these are real SOL stakes (L1 = 1.0, L2 = 0.5, L3 = 0.25) and is asked to be deliberate.
- **Output contract:** must call `submit_node_plan` exactly once with a typed plan; no prose outside the tool call.

To create a new agent (e.g. "Mellis" for music-focused campaigns), copy this directory, swap `PERSONA_NAME` and `SYSTEM_PROMPT`, generate a new wallet, fund it, and run.

---

## Quick start

### 1. Install

```bash
cd agent
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
# Set ANTHROPIC_API_KEY, MCP_URL, AGENT_KEYPAIR_PATH, RPC_URL
```

### 3. Generate + fund the agent's wallet

```bash
solana-keygen new --no-bip39-passphrase --outfile agent-wallet.json
solana airdrop 5 $(solana-keygen pubkey agent-wallet.json) --url devnet
```

The wallet file is gitignored. The pubkey must be recorded in `COORDINATION.md` so the rest of the team knows which wallet is "Apis."

### 4. Run

```bash
pnpm dev          # tsx watch — re-runs on code changes
pnpm smoke        # one-shot, exits after one campaign cycle
```

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `ANTHROPIC_MODEL` | | Default `claude-sonnet-4-6` |
| `MCP_URL` | ✅ | Hivework MCP server, e.g. `http://localhost:3403/mcp` |
| `AGENT_KEYPAIR_PATH` | ✅ | Path to JSON keypair (Solana CLI format) |
| `RPC_URL` | ✅ | Solana RPC for tx signing/sending |
| `MAX_NODES_PER_CAMPAIGN` | | Per-campaign rate gate, default `5` |
| `MAX_NODES_PER_24H` | | Global rate gate, default `30` |
| `DRY_RUN` | | If `true`, plans but does not sign/send |

---

## Safety rails

Two layers of "agents shouldn't burn SOL on garbage":

1. **Soft (model)** — system prompt enforces no near-duplicates and "every node must have a defensible reason." The model is instructed to omit nodes when it can't articulate why.
2. **Hard (process)** — `limits.ts` enforces a per-campaign cap and a 24-hour rolling cap. The agent process refuses to send beyond these regardless of what Claude asks for.
3. **Economic** — Apis has only as much SOL as we fund it with. The protocol's staking model already disincentivizes spam: bad nodes lose their stake at campaign close. Apis is just another participant under the same rules.

---

## What "Apis is working" looks like in the demo

```
[discovery]   new campaign: Halo Cola (id=…)
[planner]     fetching tree context… 4 nodes already
[anthropic]   plan ready: 4 nodes (1× L1, 2× L2, 1× L3)
[mcp]         create_node L1 "Hangover-cure framing"  → unsigned tx
[wallet]      signed + sent: 5xN9j… (sig)
[mcp]         create_node L2 "Slow Andean cumbia"     → unsigned tx
[wallet]      signed + sent: 9HpQk… (sig)
…
[limits]      campaign quota reached (4/5), idling
```

Each line corresponds to a real on-chain transaction visible on Solscan during the pitch. The judges can verify Apis paid real stake.

---

## Project layout

```
agent/
└── src/
    ├── main.ts              # discovery → plan → sign → send loop
    ├── config.ts            # env validation (zod)
    ├── persona.ts           # PERSONA_NAME + SYSTEM_PROMPT (the agent's identity)
    ├── plan-schema.ts       # zod shape of submit_node_plan tool
    ├── anthropic-client.ts  # Anthropic SDK init + model id
    ├── mcp-client.ts        # MCP HTTP client init
    ├── discovery.ts         # poll list_active_campaigns
    ├── wallet.ts            # @solana/kit keypair + tx sign+send
    └── limits.ts            # per-campaign + per-24h rate gates
```

---

## Why this matters for the pitch

> Today, an LLM cannot earn marketing royalties. It has no bank account, no KYC, no merchant agreement. Hivework gives it a keypair, an MCP endpoint, and the same on-chain rails as a human creator. **Apis is the proof.**

This is the missing piece for the agentic-commerce thesis: not "agents that buy things on your behalf" but "agents that produce and capture value as economic peers." The protocol is open; this directory is just the first agent.

---

## See also

- **MCP server Apis talks to:** [`../mcp/README.md`](../mcp/README.md)
- **Backend MCP fronts:** [`../api/README.md`](../api/README.md)
- **The on-chain program Apis transacts on:** [`../Contract/README.md`](../Contract/README.md)
- **Root pitch and thesis:** [`../README.md`](../README.md)
