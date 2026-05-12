import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Get, b1Post, B1ApiError } from "../api-client.js";
import { config, isProgramReady } from "../config.js";
import { logToolCall, logToolError } from "../logging.js";
import {
  buildUnsignedCreateNodeTx,
  canonicalMetadataHash,
  TxBuilderError,
} from "../solana/tx-builder.js";

// Mirrors Contract/programs/hivework/src/constants.rs. If the contract
// changes its stakes, update this and the matching value in
// web/lib/anchor/stakes.ts in lockstep.
const STAKE_BY_LEVEL = { L1: 0.0006, L2: 0.0003, L3: 0.00015 } as const;

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

// The API's GET /campaigns/:id returns { campaign, nodes, leaves }. Only the
// fields we need are typed; the rest is unknown.
type ApiCampaignDetail = {
  campaign: { id: string; onchainPda: string | null };
  nodes: Array<{ id: string; onchainPda: string | null }>;
};

// The API's POST /nodes/draft returns the full ApiNode (camelCase).
type ApiNode = {
  id: string;
  onchainPda: string | null;
};

function resolveStakeSol(
  level: "L1" | "L2" | "L3",
  stake?: { amount_sol?: number; auto?: boolean },
): number {
  if (!stake || stake.auto !== false || stake.amount_sol === undefined) {
    return STAKE_BY_LEVEL[level];
  }
  return stake.amount_sol;
}

export async function createNodeInternal(
  input: CreateNodeInput,
): Promise<CreateNodeResult> {
  const stakeSol = resolveStakeSol(input.level, input.stake);

  // POST /nodes/draft expects camelCase per api/src/schemas/node.ts.
  const draft = await b1Post<ApiNode>("/nodes/draft", {
    campaignId: input.campaign_id,
    level: input.level,
    parentNodeId: input.parent_id ?? null,
    creatorWallet: input.metadata.creator_wallet,
    title: input.metadata.title,
    description: input.metadata.description,
    examples: input.metadata.examples,
    tags: input.metadata.tags,
    mediaUrls: input.metadata.media_urls,
    stakeSol,
  });

  // No program → return the draft and tell the caller to come back later.
  if (!isProgramReady()) {
    return {
      node_id: draft.id,
      status: "pending_program",
      unsigned_tx_b64: null,
      fee_payer: null,
      expected_program_id: null,
      tx_signature: "PENDING_GROUP_A",
    };
  }

  try {
    // Resolve the campaign + (optional) parent on-chain PDAs from the api.
    const detail = await b1Get<ApiCampaignDetail>(
      `/campaigns/${encodeURIComponent(input.campaign_id)}`,
    );
    if (!detail.campaign.onchainPda) {
      throw new TxBuilderError("campaign is not finalized on-chain yet");
    }
    let parentPda: string | null = null;
    if (input.level !== "L1") {
      if (!input.parent_id) {
        throw new TxBuilderError(`${input.level} nodes require a parent_id`);
      }
      const parent = detail.nodes.find((n) => n.id === input.parent_id);
      if (!parent?.onchainPda) {
        throw new TxBuilderError(
          `parent ${input.parent_id} not finalized on-chain yet`,
        );
      }
      parentPda = parent.onchainPda;
    }

    // Same canonical metadata as what the api stored — bytes & hash match.
    const { hashHex, bytesMetadata } = canonicalMetadataHash({
      title: input.metadata.title,
      description: input.metadata.description,
    });

    const tx = await buildUnsignedCreateNodeTx({
      campaignOnchainPda: detail.campaign.onchainPda,
      parentNodeOnchainPda: parentPda,
      level: input.level,
      metadataHash: hashHex,
      bytesMetadata,
      metadataCuid: draft.id,
      creatorWallet: input.metadata.creator_wallet,
    });
    return {
      node_id: draft.id,
      status: "draft_only",
      unsigned_tx_b64: tx.unsigned_tx_b64,
      fee_payer: tx.fee_payer,
      expected_program_id: tx.expected_program_id,
      tx_signature: null,
    };
  } catch (err) {
    if (err instanceof TxBuilderError) {
      return {
        node_id: draft.id,
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
    "Create a Hivework tree node. level: L1=hook, L2=audio, L3=visual. Persists metadata via the api; if HIVEWORK_PROGRAM_ID is set, also returns an unsigned Solana tx for the caller to sign with creator_wallet and submit to RPC. The indexer flips the row from draft to finalized once it sees the on-chain event. If the program is not deployed, status='pending_program' and the metadata draft is preserved.",
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
            ? `API error (${err.status}): ${err.message}`
            : `create_node failed: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
