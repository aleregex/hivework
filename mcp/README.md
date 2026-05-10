# hivework-mcp

MCP server for Hivework. Exposes the Hivework actions (list campaigns, fetch trees, create nodes/leaves, fork, query portfolio) as tools for AI agents over the Model Context Protocol.

Owned by Group B (sub-group `b2a/mcp`). Reads/writes go through the B/api HTTP service. **No direct DB access** from this package.

---

## Quick start

```bash
cd mcp
cp .env.example .env       # adjust if needed
npm install
npm run dev                # starts on http://localhost:4000/mcp
```

Health check:

```bash
curl http://localhost:4000/health
# {"status":"ok","server":"hivework-mcp"}
```

The server is stateless: every `/mcp` request spins up a fresh `McpServer + transport`. Concurrency is fine.

---

## Environment

| Var | Default | Notes |
|---|---|---|
| `MCP_PORT` | `4000` | HTTP listen port |
| `B1_API_URL` | `http://localhost:3001` | B/api base URL |
| `RPC_URL` | `https://api.devnet.solana.com` | Solana RPC for blockhash lookups |
| `HIVEWORK_PROGRAM_ID` | _(empty)_ | Anchor program id from Group A. **When empty, signing tools return `status="pending_program"`** instead of building a tx. Flip a single env var when A ships — no code change. |
| `LOG_LEVEL` | `info` | Reserved; tools log via `console.log` for now |

---

## Connecting Claude Desktop (HTTP transport)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hivework": {
      "url": "http://localhost:4000/mcp"
    }
  }
}
```

Restart Claude Desktop. The 6 Hivework tools should appear in the tool picker.

> stdio transport: not implemented in this package. The active transport is `StreamableHTTPServerTransport`. If a stdio entrypoint is needed for a specific Claude Desktop build, open an issue — the registration helpers in `src/tools/` are transport-agnostic and a stdio `bin/` is a ~30-line wrapper.

---

## Tool reference

Schemas below are the canonical wire JSON Schema. In code they're declared as Zod shapes; the SDK converts them at the protocol boundary. The README is the source of truth for any agent or client reading the contract.

### `list_active_campaigns`

List all currently active marketing campaigns on Hivework.

**Input** — no parameters.

**Output** — passthrough of `GET /campaigns/active` from B/api as JSON text content.

---

### `get_tree`

Get the full tree for a campaign.

**Input**
```json
{
  "type": "object",
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 }
  },
  "required": ["campaign_id"]
}
```

**Output** — passthrough of `GET /campaigns/:campaign_id`. Expected to include `{ campaign, nodes, leaves }`.

---

### `create_node`

Create a tree node (L1=hook, L2=audio, L3=visual).

**Input**
```json
{
  "type": "object",
  "properties": {
    "campaign_id": { "type": "string", "minLength": 1 },
    "parent_id":   { "type": ["string", "null"] },
    "level":       { "type": "string", "enum": ["L1", "L2", "L3"] },
    "metadata": {
      "type": "object",
      "properties": {
        "title":          { "type": "string", "minLength": 1, "maxLength": 120 },
        "description":    { "type": "string", "maxLength": 2000 },
        "examples":       { "type": "array", "items": { "type": "object" }, "default": [] },
        "tags":           { "type": "array", "items": { "type": "string" }, "default": [] },
        "media_urls":     { "type": "array", "items": { "type": "string", "format": "uri" }, "default": [] },
        "creator_wallet": { "type": "string", "minLength": 32, "maxLength": 64 },
        "fork_of":        { "type": ["string", "null"] }
      },
      "required": ["title", "description", "creator_wallet"]
    },
    "stake": {
      "type": "object",
      "properties": {
        "amount_sol": { "type": "number", "exclusiveMinimum": 0 },
        "auto":       { "type": "boolean", "default": true }
      }
    }
  },
  "required": ["campaign_id", "level", "metadata"]
}
```

Stake `auto: true` (default) uses canonical L1=0.01, L2=0.005, L3=0.0025 SOL (devnet-cheap stakes; on-chain enforced).

**Output**
```json
{
  "type": "object",
  "properties": {
    "node_id":             { "type": "string" },
    "status":              { "type": "string", "enum": ["draft_only", "pending_program"] },
    "unsigned_tx_b64":     { "type": ["string", "null"] },
    "fee_payer":           { "type": ["string", "null"] },
    "expected_program_id": { "type": ["string", "null"] },
    "tx_signature":        { "type": ["string", "null"], "description": "Sentinel 'PENDING_GROUP_A' when status='pending_program'; null when status='draft_only'." }
  },
  "required": ["node_id", "status"]
}
```

---

### `fork_node`

Create a sibling node (same parent + level) inheriting the original's metadata, with caller modifications applied. The new node's `fork_of` references the original.

**Input**
```json
{
  "type": "object",
  "properties": {
    "node_id": { "type": "string", "minLength": 1 },
    "modifications": {
      "type": "object",
      "properties": {
        "creator_wallet": { "type": "string", "minLength": 32, "maxLength": 64 },
        "title":          { "type": "string", "minLength": 1, "maxLength": 120 },
        "description":    { "type": "string", "maxLength": 2000 },
        "examples":       { "type": "array", "items": { "type": "object" } },
        "tags":           { "type": "array", "items": { "type": "string" } },
        "media_urls":     { "type": "array", "items": { "type": "string", "format": "uri" } }
      },
      "required": ["creator_wallet"]
    },
    "stake": { "$ref": "#/definitions/stake_in_create_node" }
  },
  "required": ["node_id", "modifications"]
}
```

**Output** — same as `create_node`, plus a `fork_of` field echoing the original `node_id`.

---

### `create_leaf`

Register a leaf (a published piece of content with a unique referral link). `path` is the 3 node ids `[L1, L2, L3]` this leaf combines. Stake defaults to 0.001 SOL (devnet-cheap; on-chain enforced).

**Input**
```json
{
  "type": "object",
  "properties": {
    "campaign_id":    { "type": "string", "minLength": 1 },
    "path":           { "type": "array", "items": { "type": "string", "minLength": 1 }, "minItems": 3, "maxItems": 3 },
    "creator_wallet": { "type": "string", "minLength": 32, "maxLength": 64 },
    "content_url":    { "type": ["string", "null"], "format": "uri" },
    "platform":       { "type": "string", "enum": ["tiktok", "instagram", "x", "youtube", "other"] },
    "stake":          { "type": "object", "properties": { "amount_sol": { "type": "number" }, "auto": { "type": "boolean" } } }
  },
  "required": ["campaign_id", "path", "creator_wallet", "platform"]
}
```

**Output**
```json
{
  "type": "object",
  "properties": {
    "leaf_id":             { "type": "string" },
    "ref_code":            { "type": "string" },
    "short_url":           { "type": "string", "format": "uri" },
    "status":              { "type": "string", "enum": ["draft_only", "pending_program"] },
    "unsigned_tx_b64":     { "type": ["string", "null"] },
    "fee_payer":           { "type": ["string", "null"] },
    "expected_program_id": { "type": ["string", "null"] },
    "tx_signature":        { "type": ["string", "null"] }
  },
  "required": ["leaf_id", "ref_code", "short_url", "status"]
}
```

---

### `query_my_portfolio`

Get all activity for a wallet: nodes created, leaves published, active stakes, pending USDC payouts (computed off-chain by applying the on-chain payout formula to indexed conversions), and historical claims.

**Input**
```json
{
  "type": "object",
  "properties": {
    "wallet_address": { "type": "string", "minLength": 32, "maxLength": 64 }
  },
  "required": ["wallet_address"]
}
```

**Output** — passthrough of `GET /wallets/:address/portfolio`. Shape:

```json
{
  "wallet": "string",
  "nodes": "Node[]",
  "leaves": "Leaf[]",
  "stakedSol": "string",
  "pendingPayoutsUsdc": "string",
  "pendingByCampaign": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "brandName": "string",
      "contributingNodes": 0,
      "pendingUsdc": "string",
      "status": "active | claimable",
      "breakdown": [
        {
          "contributionId": "string",
          "kind": "node | leaf",
          "pendingUsdc": "string"
        }
      ]
    }
  ],
  "claimHistory": [
    {
      "campaignId": "string",
      "campaignName": "string",
      "amountUsdc": "string",
      "claimedAt": "ISO-8601 string",
      "txSignature": "string"
    }
  ],
  "lifetimeClaimedUsdc": "string"
}
```

Pending values match the on-chain formula (α=0.4, β=0.4, γ=0.2, 5% platform fee, 30% leaf bonus). `claimHistory`/`lifetimeClaimedUsdc` are populated once the indexer subscribes to `PayoutClaimed` events from the contract — they are stable empty/zero until then.

---

## Unsigned-tx contract (for agent devs)

This MCP server is **non-custodial**. It never holds a keypair. For any tool that mutates on-chain state (`create_node`, `fork_node`, `create_leaf`):

1. The tool always saves a metadata draft via B/api.
2. **If `HIVEWORK_PROGRAM_ID` is set** AND the IDL is wired in `src/solana/tx-builder.ts`:
   - Returns `status: "draft_only"`, `unsigned_tx_b64: <base64>`, `fee_payer: <creator_wallet>`, `expected_program_id`, `tx_signature: null`.
   - **The agent must:** verify `expected_program_id` matches what it expects, sign the tx with `creator_wallet`'s keypair, submit to the configured Solana RPC, and wait for finalization.
   - **The agent does NOT call back into MCP** to "finalize". The B/indexer subscribes to program events and transitions the metadata row from `draft` → `finalized` automatically when it sees the on-chain log.
3. **If `HIVEWORK_PROGRAM_ID` is unset OR the IDL builder is not yet wired** (current state — Group A pending):
   - Returns `status: "pending_program"`, `tx_signature: "PENDING_GROUP_A"`, all tx fields `null`.
   - The metadata draft persists in B/api. When Group A ships, the draft can be backfilled or recreated.

This means the `agent/` package is responsible for: holding its keypair, parsing `unsigned_tx_b64`, signing, and submitting to RPC. None of that lives in mcp/.

---

## Endpoints required from B/api

Mcp talks to B/api over HTTP only. The contracts assumed by these tools:

| Tool | Method | Path | Body / Returns |
|---|---|---|---|
| `list_active_campaigns` | `GET` | `/campaigns/active` | _(existing)_ |
| `get_tree` | `GET` | `/campaigns/:id` | `{ campaign, nodes, leaves }` |
| `create_node` | `POST` | `/nodes/draft` | body: `{ campaign_id, parent_id, level, creator_wallet, title, description, examples, tags, media_urls, fork_of, stake_sol }` → `{ node_id, metadata_hash? }` |
| `fork_node` | `GET` | `/nodes/:id` | `{ node_id, campaign_id, parent_id, level, title, description, examples?, tags?, media_urls? }` |
| `create_leaf` | `POST` | `/leaves/draft` | body: `{ campaign_id, path, creator_wallet, content_url, platform, stake_sol }` → `{ leaf_id, ref_code, short_url, metadata_hash? }` |
| `query_my_portfolio` | `GET` | `/wallets/:address/portfolio` | `{ wallet, nodes, leaves, stakedSol, pendingPayoutsUsdc, pendingByCampaign, claimHistory, lifetimeClaimedUsdc }` (see § "query_my_portfolio" for the full shape) |

**Mcp does NOT call `/nodes/finalize` or `/leaves/finalize`.** That transition is the indexer's responsibility once it observes the on-chain event.

---

## Implementation status

- ✅ All 6 tools registered and wired through to B/api.
- ✅ Unsigned-tx contract documented; signing tools degrade gracefully when `HIVEWORK_PROGRAM_ID` is unset.
- ⏳ `src/solana/tx-builder.ts` is a placeholder that throws. When Group A delivers `PROGRAM_ID + IDL`:
  1. Drop the IDL JSON at `mcp/idl/hivework.json`.
  2. Generate a Codama client (or hand-write the instruction encoders against `@solana/kit`).
  3. Replace the `throw` blocks with real `buildUnsignedCreateNodeTx` / `buildUnsignedCreateLeafTx` implementations.
  4. Set `HIVEWORK_PROGRAM_ID` in `.env`.
  No tool code or schemas change.

---

## Layout

```
mcp/
├── README.md                      this file
├── package.json
├── .env.example
└── src/
    ├── server.ts                  HTTP MCP transport, registers all tools
    ├── config.ts                  env schema + isProgramReady()
    ├── api-client.ts              b1Get / b1Post against B/api
    ├── logging.ts                 logToolCall / logToolError
    ├── solana/
    │   ├── rpc.ts                 @solana/kit RPC factory
    │   └── tx-builder.ts          unsigned tx builders (placeholder until IDL)
    └── tools/
        ├── list-active-campaigns.ts
        ├── get-tree.ts
        ├── create-node.ts         exports createNodeInternal (reused by fork-node)
        ├── fork-node.ts
        ├── create-leaf.ts
        └── query-portfolio.ts
```
