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

interface OriginalNode {
  node_id: string;
  campaign_id: string;
  parent_id: string | null;
  level: "L1" | "L2" | "L3";
  title: string;
  description: string;
  examples?: Array<Record<string, unknown>>;
  tags?: string[];
  media_urls?: string[];
}

export function registerForkNode(server: McpServer): void {
  server.tool(
    "fork_node",
    "Fork an existing node: create a sibling node (same parent and level) that inherits the original's metadata, then applies the caller's modifications. The new node's fork_of points to the original. modifications.creator_wallet is required (the forker's wallet). At least one metadata override is recommended; identical forks may be rejected by the program.",
    inputShape,
    async (args) => {
      logToolCall("fork_node", args);
      try {
        const original = await b1Get<OriginalNode>(
          `/nodes/${encodeURIComponent(args.node_id)}`,
        );

        const merged: CreateNodeMetadata = {
          creator_wallet: args.modifications.creator_wallet,
          title: args.modifications.title ?? original.title,
          description: args.modifications.description ?? original.description,
          examples: args.modifications.examples ?? original.examples ?? [],
          tags: args.modifications.tags ?? original.tags ?? [],
          media_urls: args.modifications.media_urls ?? original.media_urls ?? [],
          fork_of: args.node_id,
        };

        const input: CreateNodeInput = {
          campaign_id: original.campaign_id,
          parent_id: original.parent_id,
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
            ? `B1 API error (${err.status}): ${err.message}`
            : `fork_node failed: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
