import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Post, B1ApiError } from "../api-client.js";
import { config, isProgramReady } from "../config.js";
import { logToolCall, logToolError } from "../logging.js";
import {
  buildUnsignedCreateNodeTx,
  TxBuilderError,
} from "../solana/tx-builder.js";

const STAKE_BY_LEVEL = { L1: 1.0, L2: 0.5, L3: 0.25 } as const;

const metadataShape = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000),
  examples: z.array(z.record(z.unknown())).default([]),
  tags: z.array(z.string()).default([]),
  media_urls: z.array(z.string().url()).default([]),
  creator_wallet: z.string().min(32).max(64),
  fork_of: z.string().nullable().optional(),
});

const stakeShape = z
  .object({
    amount_sol: z.number().positive().optional(),
    auto: z.boolean().default(true),
  })
  .optional();

const inputShape = {
  campaign_id: z.string().min(1),
  parent_id: z.string().nullable().optional(),
  level: z.enum(["L1", "L2", "L3"]),
  metadata: metadataShape,
  stake: stakeShape,
};

export type CreateNodeMetadata = z.infer<typeof metadataShape>;

export type CreateNodeInput = {
  campaign_id: string;
  parent_id?: string | null;
  level: "L1" | "L2" | "L3";
  metadata: CreateNodeMetadata;
  stake?: z.infer<typeof stakeShape>;
};

export type CreateNodeResult = {
  node_id: string;
  status: "draft_only" | "pending_program";
  unsigned_tx_b64: string | null;
  fee_payer: string | null;
  expected_program_id: string | null;
  tx_signature: string | null;
};

interface NodeDraftResponse {
  node_id: string;
  metadata_hash?: string;
}

function resolveStakeSol(
  level: "L1" | "L2" | "L3",
  stake?: { amount_sol?: number; auto?: boolean },
): number {
  if (!stake || stake.auto !== false || stake.amount_sol === undefined) {
    return STAKE_BY_LEVEL[level];
  }
  return stake.amount_sol;
}

function toLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1_000_000_000));
}

export async function createNodeInternal(
  input: CreateNodeInput,
): Promise<CreateNodeResult> {
  const stakeSol = resolveStakeSol(input.level, input.stake);

  const draftBody = {
    campaign_id: input.campaign_id,
    parent_id: input.parent_id ?? null,
    level: input.level,
    creator_wallet: input.metadata.creator_wallet,
    title: input.metadata.title,
    description: input.metadata.description,
    examples: input.metadata.examples,
    tags: input.metadata.tags,
    media_urls: input.metadata.media_urls,
    fork_of: input.metadata.fork_of ?? null,
    stake_sol: stakeSol,
  };

  const draft = await b1Post<NodeDraftResponse>("/nodes/draft", draftBody);

  if (!isProgramReady()) {
    return {
      node_id: draft.node_id,
      status: "pending_program",
      unsigned_tx_b64: null,
      fee_payer: null,
      expected_program_id: null,
      tx_signature: "PENDING_GROUP_A",
    };
  }

  try {
    const tx = await buildUnsignedCreateNodeTx({
      campaign_id: input.campaign_id,
      parent_id: input.parent_id ?? null,
      level: input.level,
      metadata_hash: draft.metadata_hash ?? "",
      stake_lamports: toLamports(stakeSol),
      creator_wallet: input.metadata.creator_wallet,
    });
    return {
      node_id: draft.node_id,
      status: "draft_only",
      unsigned_tx_b64: tx.unsigned_tx_b64,
      fee_payer: tx.fee_payer,
      expected_program_id: tx.expected_program_id,
      tx_signature: null,
    };
  } catch (err) {
    if (err instanceof TxBuilderError) {
      return {
        node_id: draft.node_id,
        status: "pending_program",
        unsigned_tx_b64: null,
        fee_payer: null,
        expected_program_id: config.HIVEWORK_PROGRAM_ID ?? null,
        tx_signature: "PENDING_GROUP_A",
      };
    }
    throw err;
  }
}

export function registerCreateNode(server: McpServer): void {
  server.tool(
    "create_node",
    "Create a Hivework tree node. level: L1=hook, L2=audio, L3=visual. Persists metadata via B/api; if HIVEWORK_PROGRAM_ID is set, returns an unsigned Solana tx for the caller to sign with creator_wallet and submit to RPC. The indexer flips the row from draft to finalized once it sees the on-chain event. If the program is not yet deployed, status='pending_program' and the metadata draft is preserved.",
    inputShape,
    async (args) => {
      logToolCall("create_node", args);
      try {
        const result = await createNodeInternal(args as CreateNodeInput);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        logToolError("create_node", err);
        const message =
          err instanceof B1ApiError
            ? `B1 API error (${err.status}): ${err.message}`
            : `create_node failed: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
