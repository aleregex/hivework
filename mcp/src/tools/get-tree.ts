import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Get, B1ApiError } from "../api-client.js";
import { logToolCall, logToolError } from "../logging.js";

const inputShape = {
  campaign_id: z.string().min(1),
};

export function registerGetTree(server: McpServer): void {
  server.tool(
    "get_tree",
    "Get the full tree for a Hivework campaign by id. Returns campaign metadata plus all nodes (L1=hook, L2=audio, L3=visual) and all leaves with their paths and ref codes.",
    inputShape,
    async (args) => {
      logToolCall("get_tree", args);
      try {
        const path = `/campaigns/${encodeURIComponent(args.campaign_id)}`;
        const data = await b1Get(path);
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        logToolError("get_tree", err);
        const message =
          err instanceof B1ApiError
            ? `B1 API error (${err.status}): ${err.message}`
            : `Failed to fetch tree: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
