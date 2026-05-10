import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Post, B1ApiError } from "../api-client.js";
import { config, isProgramReady } from "../config.js";
import { logToolCall, logToolError } from "../logging.js";
import {
  buildUnsignedCreateLeafTx,
  TxBuilderError,
} from "../solana/tx-builder.js";

const LEAF_STAKE_SOL = 0.1;

const stakeShape = z
  .object({
    amount_sol: z.number().positive().optional(),
    auto: z.boolean().default(true),
  })
  .optional();

const inputShape = {
  campaign_id: z.string().min(1),
  path: z
    .array(z.string().min(1))
    .length(3, "path must be exactly 3 node ids: [L1, L2, L3]"),
  creator_wallet: z.string().min(32).max(64),
  content_url: z.string().url().nullable().optional(),
  platform: z.enum(["tiktok", "instagram", "x", "youtube", "other"]),
  stake: stakeShape,
};

type CreateLeafInput = {
  campaign_id: string;
  path: string[];
  creator_wallet: string;
  content_url?: string | null;
  platform: "tiktok" | "instagram" | "x" | "youtube" | "other";
  stake?: z.infer<typeof stakeShape>;
};

interface LeafDraftResponse {
  leaf_id: string;
  ref_code: string;
  short_url: string;
  metadata_hash?: string;
}

type CreateLeafResult = {
  leaf_id: string;
  ref_code: string;
  short_url: string;
  status: "draft_only" | "pending_program";
  unsigned_tx_b64: string | null;
  fee_payer: string | null;
  expected_program_id: string | null;
  tx_signature: string | null;
};

function resolveStakeSol(stake?: {
  amount_sol?: number;
  auto?: boolean;
}): number {
  if (!stake || stake.auto !== false || stake.amount_sol === undefined) {
    return LEAF_STAKE_SOL;
  }
  return stake.amount_sol;
}

function toLamports(sol: number): bigint {
  return BigInt(Math.round(sol * 1_000_000_000));
}

async function createLeafInternal(
  input: CreateLeafInput,
): Promise<CreateLeafResult> {
  const stakeSol = resolveStakeSol(input.stake);

  const draft = await b1Post<LeafDraftResponse>("/leaves/draft", {
    campaign_id: input.campaign_id,
    path: input.path,
    creator_wallet: input.creator_wallet,
    content_url: input.content_url ?? null,
    platform: input.platform,
    stake_sol: stakeSol,
  });

  if (!isProgramReady()) {
    return {
      leaf_id: draft.leaf_id,
      ref_code: draft.ref_code,
      short_url: draft.short_url,
      status: "pending_program",
      unsigned_tx_b64: null,
      fee_payer: null,
      expected_program_id: null,
      tx_signature: "PENDING_GROUP_A",
    };
  }

  try {
    const tx = await buildUnsignedCreateLeafTx({
      campaign_id: input.campaign_id,
      path: [input.path[0]!, input.path[1]!, input.path[2]!] as const,
      ref_code: draft.ref_code,
      metadata_hash: draft.metadata_hash ?? "",
      stake_lamports: toLamports(stakeSol),
      creator_wallet: input.creator_wallet,
    });
    return {
      leaf_id: draft.leaf_id,
      ref_code: draft.ref_code,
      short_url: draft.short_url,
      status: "draft_only",
      unsigned_tx_b64: tx.unsigned_tx_b64,
      fee_payer: tx.fee_payer,
      expected_program_id: tx.expected_program_id,
      tx_signature: null,
    };
  } catch (err) {
    if (err instanceof TxBuilderError) {
      return {
        leaf_id: draft.leaf_id,
        ref_code: draft.ref_code,
        short_url: draft.short_url,
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

export function registerCreateLeaf(server: McpServer): void {
  server.tool(
    "create_leaf",
    "Register a Hivework leaf (a published piece of content with a unique referral link). path is the 3 node ids [L1_hook, L2_audio, L3_visual] this leaf combines. Returns the ref_code and short_url plus an unsigned tx if the program is configured. Stake defaults to 0.1 SOL.",
    inputShape,
    async (args) => {
      logToolCall("create_leaf", args);
      try {
        const result = await createLeafInternal(args as CreateLeafInput);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        logToolError("create_leaf", err);
        const message =
          err instanceof B1ApiError
            ? `B1 API error (${err.status}): ${err.message}`
            : `create_leaf failed: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
