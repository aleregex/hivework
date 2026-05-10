import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { registerListActiveCampaigns } from "./tools/list-active-campaigns.js";

function buildServer(): McpServer {
  const server = new McpServer({
    name: "hivework-mcp",
    version: "0.1.0",
  });
  registerListActiveCampaigns(server);
  return server;
}

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "hivework-mcp" }));
    return;
  }

  const isMcpPath = req.url === "/mcp" || (req.url?.startsWith("/mcp?") ?? false);
  if (!isMcpPath) {
    res.writeHead(404).end();
    return;
  }

  // Stateless: spin up a fresh server + transport per request so concurrent
  // clients don't share state. Cheap because tool registration is sync.
  try {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);

    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      body = raw ? JSON.parse(raw) : undefined;
    }

    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("[mcp] handler error", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

httpServer.listen(config.MCP_PORT, () => {
  console.log(
    `[mcp] hivework-mcp listening on http://localhost:${config.MCP_PORT}/mcp`,
  );
  console.log(`[mcp] health: http://localhost:${config.MCP_PORT}/health`);
  console.log(`[mcp] B1 API: ${config.B1_API_URL}`);
});

const shutdown = (signal: string) => {
  console.log(`[mcp] received ${signal}, shutting down`);
  httpServer.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));