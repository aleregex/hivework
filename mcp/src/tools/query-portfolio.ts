import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Get, B1ApiError } from "../api-client.js";
import { logToolCall, logToolError } from "../logging.js";

const inputShape = {
  wallet_address: z.string().min(32).max(64),
};

export function registerQueryPortfolio(server: McpServer): void {
  server.tool(
    "query_my_portfolio",
    "Get all Hivework activity for a wallet: nodes created, leaves published, active stakes, and pending payouts in USDC.",
    inputShape,
    async (args) => {
      logToolCall("query_my_portfolio", args);
      try {
        const path = `/wallets/${encodeURIComponent(args.wallet_address)}/portfolio`;
        const data = await b1Get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        logToolError("query_my_portfolio", err);
        const message =
          err instanceof B1ApiError
            ? `B1 API error (${err.status}): ${err.message}`
            : `Failed to fetch portfolio: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
