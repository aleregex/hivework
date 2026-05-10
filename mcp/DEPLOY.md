# hivework-mcp — Usage & Deployment Guide

Operational runbook for the Hivework MCP server. The reference for *what* the tools do is `mcp/README.md`. This doc is about *running* the server: locally, for the team, and during the demo.

---

## TL;DR

```bash
# clone + install
cd mcp
cp .env.example .env
npm install

# run
npm run dev                 # http://localhost:4000/mcp
curl http://localhost:4000/health
```

Connect Claude Desktop:

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "hivework": { "url": "http://localhost:4000/mcp" }
  }
}
```

Restart Claude Desktop. Six tools should appear in the picker.

---

## What this server is

- HTTP MCP server using `StreamableHTTPServerTransport` (one fresh `McpServer` per request — stateless, concurrent-safe).
- Listens on `MCP_PORT` (default `4000`) at path `/mcp`.
- Exposes 6 tools: `list_active_campaigns`, `get_tree`, `create_node`, `fork_node`, `create_leaf`, `query_my_portfolio`.
- Talks to **B/api** over HTTP. No Prisma in mcp.
- **Non-custodial.** Signing tools return an `unsigned_tx_b64`; the caller (the agent) signs and submits. Mcp never holds a keypair.

---

## Local development

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node | `>=22` | `engines` in package.json |
| npm | bundled | lockfile is npm |
| B/api running | optional | tools that hit api will return `B1ApiError` if unreachable; the server still boots |

### First-time setup

```bash
cd mcp
cp .env.example .env
npm install
```

### Run

```bash
npm run dev      # tsx watch — auto-reload on file change
```

Boot output:

```
[mcp] hivework-mcp listening on http://localhost:4000/mcp
[mcp] health: http://localhost:4000/health
[mcp] B1 API: http://localhost:3001
[mcp] RPC: https://api.devnet.solana.com
[mcp] HIVEWORK_PROGRAM_ID is not set — create_node/create_leaf/fork_node will return status='pending_program' until Group A ships.
```

The `pending_program` warning is expected pre-Group-A. Signing tools still respond — they just don't build an on-chain tx yet.

### Type-check before pushing

```bash
npx tsc --noEmit
```

### Production build (used for container deploys)

```bash
npm run build       # tsc → dist/
node dist/server.js # start compiled server
```

---

## Using the server

### From Claude Desktop (most common during the demo)

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hivework": { "url": "http://localhost:4000/mcp" }
  }
}
```

Restart Claude Desktop. Verify the 6 tools appear by asking it: *"List the available Hivework tools."*

### From the team's `agent/` package

The `agent/` package already wires an MCP client at boot (`agent/src/mcp-client.ts`). Set `MCP_URL` in `agent/.env`:

```
MCP_URL=http://localhost:4000/mcp
```

Then `cd agent && npm run dev`.

### From a custom MCP TypeScript client

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:4000/mcp"),
);
const client = new Client({ name: "my-app", version: "0.1.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(tools.map((t) => t.name));

const result = await client.callTool({
  name: "list_active_campaigns",
  arguments: {},
});
console.log(result.content);
```

### Direct JSON-RPC (debugging / smoke tests)

`StreamableHTTPServerTransport` requires the SSE `Accept` header.

```bash
# 1. initialize
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'

# 2. list tools
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. call a tool
curl -s -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_active_campaigns","arguments":{}}}'
```

Responses come back as Server-Sent Events (`event: message\ndata: {...}`).

---

## Deployment

The hackathon demo runs from one operator machine. Pick one of three patterns depending on whether teammates need to reach the server too.

### Option 1 — Localhost only (operator's machine, simplest)

What it covers: operator runs Claude Desktop and the demo on the same machine. No teammate access needed.

```bash
cd mcp && npm run dev
```

That's it. Claude Desktop config points at `http://localhost:4000/mcp`. Done.

### Option 2 — Public tunnel (recommended for demo + remote teammates)

What it covers: operator runs the server locally; teammates and Claude Desktop instances on other laptops can reach it. Best for a 10-hour hackathon — zero infra to provision, takes 30 seconds.

#### cloudflared (free, no account)

```bash
brew install cloudflared
cd mcp && npm run dev   # in one terminal
cloudflared tunnel --url http://localhost:4000   # in another
# → https://<random-subdomain>.trycloudflare.com
```

Hand the URL to the team. Append `/mcp` for the MCP endpoint.

#### ngrok (free with account)

```bash
brew install ngrok
ngrok http 4000
# → https://<random-subdomain>.ngrok-free.app
```

Same usage — append `/mcp`.

**Caveat:** the URL changes on every restart. If you're going to be tearing down and bringing the server back up during the demo, paste the live URL into the team channel each time.

### Option 3 — Hosted (Render, Fly, Railway)

What it covers: persistent URL, survives operator's laptop sleeping. Worth doing only if the demo will run from someone else's machine or if you want the agent running 24/7 in the lead-up to the demo.

Cheapest: **Render free web service**. Add a `Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV MCP_PORT=4000
EXPOSE 4000
CMD ["node", "dist/server.js"]
```

Push to GitHub, point Render at the `mcp/` subfolder, set env vars (below), deploy. URL: `https://hivework-mcp.onrender.com/mcp`.

Fly and Railway work the same way with a `fly.toml` or auto-detected Node service.

---

## Production environment variables

| Var | Required | Notes |
|---|---|---|
| `MCP_PORT` | no | Default `4000`. Render/Fly inject `PORT` — read that instead if you go hosted (see below). |
| `B1_API_URL` | yes | Public URL of the deployed B/api, e.g. `https://hivework-api.onrender.com` |
| `RPC_URL` | recommended | Default is the public devnet RPC, which is rate-limited. Use Helius free tier (`https://devnet.helius-rpc.com/?api-key=...`) for the demo. |
| `HIVEWORK_PROGRAM_ID` | once Group A ships | When set, signing tools attempt to build an unsigned tx. Until then, leave empty. |
| `LOG_LEVEL` | no | Reserved; tools currently log via `console.log`. |

If hosting on Render/Fly/Railway, replace `MCP_PORT` defaulting:

```ts
// src/config.ts
MCP_PORT: z.coerce.number().int().positive().default(
  process.env.PORT ? Number(process.env.PORT) : 4000,
),
```

(Not done in the repo today — hackathon scope. Trivial change when needed.)

---

## Health check & observability

### Health

```
GET /health
→ 200 {"status":"ok","server":"hivework-mcp"}
```

Hosted services (Render, Fly) all auto-ping this. No extra config required if you set `/health` as the health-check path.

### Logs

Per-tool calls log to stdout in the form:

```
[mcp:tool] 2026-05-09T22:33:49.012Z create_node args={"campaign_id":"abc","level":"L1",...}
[mcp:tool] 2026-05-09T22:33:49.418Z create_node error=B1 POST /nodes/draft -> 503 ...
```

Tail logs locally with `npm run dev`; on hosted, use the platform's log viewer.

### Wire-level debugging

Set `MCP_LOG=debug` upstream in the SDK for verbose JSON-RPC traces (not currently wired in the server — pass through if needed).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Claude Desktop doesn't show tools | Wrong URL or transport mismatch | Confirm `url` ends in `/mcp`. Restart Claude Desktop fully (quit + reopen, not just close window). |
| Tool returns `B1 API error (ECONNREFUSED)` | B/api not running | `cd api && npm run dev` |
| Tool returns `B1 API error (404)` on `/nodes/draft` | Endpoint not yet implemented in B/api | Coordinate with whoever owns api/. mcp's expected contracts are listed in `mcp/README.md` § "Endpoints required from B/api". |
| All signing tools return `status='pending_program'` | `HIVEWORK_PROGRAM_ID` not set | Expected pre-Group-A. Once they ship, set the env var and replace the throw in `src/solana/tx-builder.ts`. |
| `getaddrinfo ENOTFOUND` on RPC calls | Public devnet RPC throttling or DNS | Move to Helius free tier (`RPC_URL`). |
| `tsc` fails with `Cannot find module '@solana/kit'` | Missed `npm install` after lockfile update | `cd mcp && npm install` |
| Tunnel URL keeps changing | cloudflared without a named tunnel; ngrok free tier | For named cloudflared tunnels: `cloudflared tunnel create hivework-mcp` (requires a Cloudflare account). For ngrok: paid plan or use cloudflared. |

---

## What lives where

```
mcp/
├── README.md         ← reference: tool list, JSON Schemas, contracts
├── DEPLOY.md         ← this file: how to run & ship
├── .env.example
├── package.json
└── src/
    ├── server.ts     transport + tool registration
    ├── config.ts     env + isProgramReady()
    ├── api-client.ts b1Get / b1Post
    ├── logging.ts
    ├── solana/       rpc.ts (kit factory) + tx-builder.ts (placeholder)
    └── tools/        one file per tool
```