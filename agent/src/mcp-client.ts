import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "./config.js";

export async function connectMcpClient(): Promise<Client> {
  const client = new Client({
    name: "apis-agent",
    version: "0.1.0",
  });

  const transport = new StreamableHTTPClientTransport(new URL(config.MCP_URL));
  await client.connect(transport);
  return client;
}
