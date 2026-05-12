import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { b1Get, b1Post, B1ApiError } from "../api-client.js";
import { config, isProgramReady } from "../config.js";
import { logToolCall, logToolError } from "../logging.js";
import {
  buildUnsignedCreateLeafTx,
  canonicalMetadataHash,
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

// The api's POST /leaves/draft returns { leaf, reservation } with camelCase
// fields per api/src/schemas/leaf.ts.
type ApiLeafDraftResponse = {
  leaf: { id: string; refCode: string; onchainPda: string | null };
  reservation: { refCode: string; expiresAt: string };
};

type ApiCampaignDetail = {
  campaign: { id: string; onchainPda: string | null };
  nodes: Array<{ id: string; onchainPda: string | null }>;
};

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

async function createLeafInternal(
  input: CreateLeafInput,
): Promise<CreateLeafResult> {
  const stakeSol = resolveStakeSol(input.stake);

  // POST /leaves/draft expects camelCase per api/src/schemas/leaf.ts.
  const draftResp = await b1Post<ApiLeafDraftResponse>("/leaves/draft", {
    campaignId: input.campaign_id,
    path: input.path,
    creatorWallet: input.creator_wallet,
    contentUrl: input.content_url ?? null,
    platform: input.platform,
    stakeSol,
  });
  const refCode = draftResp.reservation.refCode;
  const shortUrl = `https://${process.env.SHORTLINK_DOMAIN ?? "hivework.link"}/${refCode}`;

  if (!isProgramReady()) {
    return {
      leaf_id: draftResp.leaf.id,
      ref_code: refCode,
      short_url: shortUrl,
      status: "pending_program",
      unsigned_tx_b64: null,
      fee_payer: null,
      expected_program_id: null,
      tx_signature: "PENDING_GROUP_A",
    };
  }

  try {
    const detail = await b1Get<ApiCampaignDetail>(
      `/campaigns/${encodeURIComponent(input.campaign_id)}`,
    );
    if (!detail.campaign.onchainPda) {
      throw new TxBuilderError("campaign is not finalized on-chain yet");
    }
    const pathPdas: string[] = [];
    for (const id of input.path) {
      const node = detail.nodes.find((n) => n.id === id);
      if (!node?.onchainPda) {
        throw new TxBuilderError(`path node ${id} not finalized on-chain yet`);
      }
      pathPdas.push(node.onchainPda);
    }

    const { bytesMetadata } = canonicalMetadataHash({
      contentUrl: input.content_url ?? null,
      platform: input.platform,
    });

    const tx = await buildUnsignedCreateLeafTx({
      campaignOnchainPda: detail.campaign.onchainPda,
      pathOnchainPdas: [pathPdas[0]!, pathPdas[1]!, pathPdas[2]!] as const,
      refCode,
      bytesMetadata,
      metadataCuid: draftResp.leaf.id,
      creatorWallet: input.creator_wallet,
    });
    return {
      leaf_id: draftResp.leaf.id,
      ref_code: refCode,
      short_url: shortUrl,
      status: "draft_only",
      unsigned_tx_b64: tx.unsigned_tx_b64,
      fee_payer: tx.fee_payer,
      expected_program_id: tx.expected_program_id,
      tx_signature: null,
    };
  } catch (err) {
    if (err instanceof TxBuilderError) {
      return {
        leaf_id: draftResp.leaf.id,
        ref_code: refCode,
        short_url: shortUrl,
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
    "Register a Hivework leaf (a published piece of content with a unique referral link). path is the 3 node ids [L1_hook, L2_audio, L3_visual] this leaf combines. Returns the ref_code, short_url and an unsigned tx if the program is configured. Stake defaults to 0.1 SOL.",
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
            ? `API error (${err.status}): ${err.message}`
            : `create_leaf failed: ${(err as Error).message}`;
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );
}
