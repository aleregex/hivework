import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { b1Get, B1ApiError } from "../api-client.js";

export function registerListActiveCampaigns(server: McpServer): void {
  server.tool(
    "list_active_campaigns",
    "List all currently active marketing campaigns on Hivework. Returns campaigns with brand, product, current pool size in USDC, deadline, and tree summary.",
    {},
    async () => {
      try {
        const data = await b1Get("/campaigns/active");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (err) {
        const message =
          err instanceof B1ApiError
            ? `B1 API error (${err.status}): ${err.message}`
            : `Failed to fetch active campaigns: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}