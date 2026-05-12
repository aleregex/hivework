import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Get, B1ApiError } from "../api-client.js";
import { logToolCall, logToolError } from "../logging.js";
import {
  createNodeInternal,
  type CreateNodeInput,
  type CreateNodeMetadata,
} from "./create-node.js";

const stakeShape = z
  .object({
    amount_sol: z.number().positive().optional(),
    auto: z.boolean().default(true),
  })
  .optional();

const modificationsShape = z.object({
  creator_wallet: z.string().min(32).max(64),
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  examples: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string()).optional(),
  media_urls: z.array(z.string().url()).optional(),
});

const inputShape = {
  node_id: z.string().min(1),
  modifications: modificationsShape,
  stake: stakeShape,
};

// Shape returned by GET /nodes/:id — camelCase per api/src/schemas/node.ts.
type ApiNode = {
  id: string;
  campaignId: string;
  parentNodeId: string | null;
  level: "L1" | "L2" | "L3";
  title: string;
  description: string;
  examples: unknown;
  tags: string[];
  mediaUrls: string[];
};

export function registerForkNode(server: McpServer): void {
  server.tool(
    "fork_node",
    "Fork an existing node: create a sibling node (same parent and level) that inherits the original's metadata, then applies the caller's modifications. The new node's fork_of points to the original. modifications.creator_wallet is required (the forker's wallet). At least one metadata override is recommended; identical forks may be rejected by the program.",
    inputShape,
    async (args) => {
      logToolCall("fork_node", args);
      try {
        const original = await b1Get<ApiNode>(
          `/nodes/${encodeURIComponent(args.node_id)}`,
        );

        const examples = Array.isArray(original.examples)
          ? (original.examples as Array<Record<string, unknown>>)
          : [];

        const merged: CreateNodeMetadata = {
          creator_wallet: args.modifications.creator_wallet,
          title: args.modifications.title ?? original.title,
          description: args.modifications.description ?? original.description,
          examples: args.modifications.examples ?? examples,
          tags: args.modifications.tags ?? original.tags ?? [],
          media_urls: args.modifications.media_urls ?? original.mediaUrls ?? [],
          fork_of: args.node_id,
        };

        const input: CreateNodeInput = {
          campaign_id: original.campaignId,
          parent_id: original.parentNodeId,
          level: original.level,
          metadata: merged,
          stake: args.stake,
        };

        const result = await createNodeInternal(input);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...result, fork_of: args.node_id }, null, 2),
            },
          ],
        };
      } catch (err) {
        logToolError("fork_node", err);
        const message =
          err instanceof B1ApiError
            ? `API error (${err.status}): ${err.message}`
            : `fork_node failed: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
