// High-level Anchor tx builders. Each function:
//   1. Derives the on-chain PDAs from inputs.
//   2. Builds the ix via the typed program.methods.
//   3. Sends with the AnchorProvider's wallet (the user's wallet adapter).
//   4. Returns the PDA(s) + tx signature so the caller can pass them to
//      /finalize on the api.
//
// Mirrors the recipes in Contract/INTEGRATION.md § 5.

import { BN, type Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  deriveCampaignPda,
  deriveLeafPda,
  deriveNodePda,
  encodeRefCode,
  sha256Bytes,
} from "./seeds";
import { HIVEWORK_PROGRAM_ID } from "./idl";

// SPL standard program ids — hardcoded to avoid pulling @solana/spl-token.
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const PROGRAM_ID = new PublicKey(HIVEWORK_PROGRAM_ID);
const CONVERSION_SEED = new TextEncoder().encode("conversion");

/** Standard SPL associated-token-account derivation. */
function getAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

/** Derive the Conversion PDA (mirror: seeds = [b"conversion", campaign, leaf, id]). */
export function deriveConversionPda(
  campaign: PublicKey,
  leaf: PublicKey,
  conversionId: Uint8Array
): [PublicKey, number] {
  if (conversionId.length !== 16) {
    throw new Error("conversion_id must be 16 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [CONVERSION_SEED, campaign.toBuffer(), leaf.toBuffer(), conversionId],
    PROGRAM_ID
  );
}

// ---------- create_campaign ----------

export type CreateCampaignArgs = {
  authority: PublicKey;
  usdcMint: PublicKey;
  oracleAuthority: PublicKey;
  /** USDC amount, in human units. Converted to base units (1e6) on-chain. */
  initialUsdc: number;
  /** Unix timestamp (seconds). Must be in the future. */
  deadlineUnixSec: number;
  /** Off-chain cuid from /campaigns/draft. Emitted via CampaignCreated. */
  metadataCuid: string;
  /** Formula weights — must sum to 100. Defaults match constants.rs. */
  alpha?: number;
  beta?: number;
  gamma?: number;
};

export type CreateCampaignResult = {
  campaignPda: PublicKey;
  campaignId: number;
  signature: string;
};

export async function createCampaignOnchain(
  program: Program,
  args: CreateCampaignArgs
): Promise<CreateCampaignResult> {
  const alpha = args.alpha ?? 40;
  const beta = args.beta ?? 40;
  const gamma = args.gamma ?? 20;
  if (alpha + beta + gamma !== 100) {
    throw new Error("alpha + beta + gamma must equal 100");
  }

  // u32 — fits in 32 bits via second-precision Date.now() until 2106.
  const campaignId = Math.floor(Date.now() / 1000);

  const [campaignPda] = deriveCampaignPda(args.authority, campaignId);
  const escrowAta = getAta(campaignPda, args.usdcMint);
  const authorityAta = getAta(args.authority, args.usdcMint);

  // USDC has 6 decimals on every cluster.
  const initialUsdcBase = new BN(Math.round(args.initialUsdc * 1_000_000));

  const signature = await program.methods
    .createCampaign(
      new BN(args.deadlineUnixSec),
      alpha,
      beta,
      gamma,
      campaignId,
      initialUsdcBase,
      args.metadataCuid
    )
    .accountsStrict({
      campaign: campaignPda,
      usdcMint: args.usdcMint,
      escrowUsdc: escrowAta,
      authorityUsdc: authorityAta,
      authority: args.authority,
      oracleAuthority: args.oracleAuthority,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return { campaignPda, campaignId, signature };
}

// ---------- create_node ----------

export type CreateNodeArgs = {
  campaign: PublicKey;
  creator: PublicKey;
  level: 1 | 2 | 3;
  /**
   * Parent node on-chain PDA — required for L2/L3, must be SystemProgram for L1
   * (the contract treats SystemProgram.programId as "no parent").
   */
  parentNode: PublicKey | null;
  /** Canonical metadata payload. JSON-stringified deterministically client-side. */
  metadata: Record<string, unknown>;
  /** Off-chain cuid from /nodes/draft. Emitted via NodeCreated. */
  metadataCuid: string;
};

export type CreateNodeResult = {
  nodePda: PublicKey;
  metadataHash: Uint8Array;
  bytesMetadata: number;
  signature: string;
};

export async function createNodeOnchain(
  program: Program,
  args: CreateNodeArgs
): Promise<CreateNodeResult> {
  const metadataJson = JSON.stringify(args.metadata);
  const metadataHash = await sha256Bytes(metadataJson);
  const bytesMetadata = new TextEncoder().encode(metadataJson).length;

  const [nodePda] = deriveNodePda(args.campaign, args.creator, metadataHash);

  // The contract's `parent_node` is `Option<Account<Node>>` (IDL flags it
  // optional: true). For L1, we pass null so Anchor encodes "absent"; for
  // L2/L3, we pass the real parent PDA. We cast to satisfy Anchor's strict
  // .accounts type — at runtime null is the correct value for optional accs.
  const signature = await program.methods
    .createNode(
      args.level,
      Array.from(metadataHash),
      bytesMetadata,
      args.metadataCuid
    )
    .accounts({
      node: nodePda,
      campaign: args.campaign,
      creator: args.creator,
      parentNode: args.parentNode,
      systemProgram: SystemProgram.programId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .rpc();

  return { nodePda, metadataHash, bytesMetadata, signature };
}

// ---------- create_leaf ----------

export type CreateLeafArgs = {
  campaign: PublicKey;
  creator: PublicKey;
  nodeL1: PublicKey;
  nodeL2: PublicKey;
  nodeL3: PublicKey;
  /** 8-char alphanumeric, ASCII. The api's leaf draft endpoint reserves it. */
  refCode: string;
  metadata: Record<string, unknown>;
  /** Off-chain cuid from /leaves/draft. Emitted via LeafCreated. */
  metadataCuid: string;
};

export type CreateLeafResult = {
  leafPda: PublicKey;
  bytesMetadata: number;
  signature: string;
};

export async function createLeafOnchain(
  program: Program,
  args: CreateLeafArgs
): Promise<CreateLeafResult> {
  const metadataJson = JSON.stringify(args.metadata);
  const bytesMetadata = new TextEncoder().encode(metadataJson).length;
  const refCodeBytes = encodeRefCode(args.refCode);

  const [leafPda] = deriveLeafPda(args.campaign, args.refCode);

  const signature = await program.methods
    .createLeaf(
      Array.from(refCodeBytes),
      bytesMetadata,
      args.metadataCuid
    )
    .accountsStrict({
      leaf: leafPda,
      campaign: args.campaign,
      creator: args.creator,
      nodeL1: args.nodeL1,
      nodeL2: args.nodeL2,
      nodeL3: args.nodeL3,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { leafPda, bytesMetadata, signature };
}

// ---------- register_conversion ----------
// Caller must sign with the oracle keypair (campaign.oracle_authority).
// Returned by the wallet adapter when an oracle-controlled wallet is connected.

export type RegisterConversionArgs = {
  campaign: PublicKey;
  leaf: PublicKey;
  nodeL1: PublicKey;
  nodeL2: PublicKey;
  nodeL3: PublicKey;
  oracle: PublicKey;
  /** 16-byte conversion id. Uniqueness is enforced by the PDA. */
  conversionId: Uint8Array;
  /** USDC value in base units (6 decimals). */
  valueUsdcBase: BN;
};

export type RegisterConversionResult = {
  conversionPda: PublicKey;
  signature: string;
};

export async function registerConversionOnchain(
  program: Program,
  args: RegisterConversionArgs
): Promise<RegisterConversionResult> {
  if (args.conversionId.length !== 16) {
    throw new Error("conversion_id must be exactly 16 bytes");
  }
  const [conversionPda] = deriveConversionPda(
    args.campaign,
    args.leaf,
    args.conversionId
  );

  const signature = await program.methods
    .registerConversion(Array.from(args.conversionId), args.valueUsdcBase)
    .accountsStrict({
      conversion: conversionPda,
      campaign: args.campaign,
      leaf: args.leaf,
      nodeL1: args.nodeL1,
      nodeL2: args.nodeL2,
      nodeL3: args.nodeL3,
      oracle: args.oracle,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { conversionPda, signature };
}

// ---------- close_campaign ----------
// Explicitly close a campaign, needed when there are 0 conversions.

export type CloseCampaignArgs = {
  campaign: PublicKey;
  authority: PublicKey;
};

export async function closeCampaignOnchain(
  program: Program,
  args: CloseCampaignArgs
): Promise<{ signature: string }> {
  // @ts-expect-error - closeCampaign will be available in the IDL after running `anchor build`
  const signature = await program.methods
    .closeCampaign()
    .accountsStrict({
      campaign: args.campaign,
      authority: args.authority,
    })
    .rpc();
  return { signature };
}

// ---------- close_and_distribute ----------
// Processes ONE conversion per call. Caller iterates over every pending
// conversion to fully distribute the campaign.

export type CloseAndDistributeArgs = {
  campaign: PublicKey;
  conversion: PublicKey;
  leaf: PublicKey;
  nodeL1: PublicKey;
  nodeL2: PublicKey;
  nodeL3: PublicKey;
  authority: PublicKey;
};

export async function closeAndDistributeOnchain(
  program: Program,
  args: CloseAndDistributeArgs
): Promise<{ signature: string }> {
  const signature = await program.methods
    .closeAndDistribute()
    .accountsStrict({
      campaign: args.campaign,
      conversion: args.conversion,
      leaf: args.leaf,
      nodeL1: args.nodeL1,
      nodeL2: args.nodeL2,
      nodeL3: args.nodeL3,
      authority: args.authority,
    })
    .rpc();
  return { signature };
}

// ---------- claim_payout (node creator) ----------

export type ClaimPayoutArgs = {
  node: PublicKey;
  campaign: PublicKey;
  usdcMint: PublicKey;
  creator: PublicKey;
};

export async function claimPayoutOnchain(
  program: Program,
  args: ClaimPayoutArgs
): Promise<{ signature: string }> {
  const escrowUsdc = getAta(args.campaign, args.usdcMint);
  const creatorUsdc = getAta(args.creator, args.usdcMint);

  const signature = await program.methods
    .claimPayout()
    .accountsStrict({
      node: args.node,
      campaign: args.campaign,
      escrowUsdc,
      creatorUsdc,
      creator: args.creator,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature };
}

// ---------- claim_leaf_payout (leaf creator) ----------

export type ClaimLeafPayoutArgs = {
  leaf: PublicKey;
  campaign: PublicKey;
  usdcMint: PublicKey;
  creator: PublicKey;
};

export async function claimLeafPayoutOnchain(
  program: Program,
  args: ClaimLeafPayoutArgs
): Promise<{ signature: string }> {
  const escrowUsdc = getAta(args.campaign, args.usdcMint);
  const creatorUsdc = getAta(args.creator, args.usdcMint);

  const signature = await program.methods
    .claimLeafPayout()
    .accountsStrict({
      leaf: args.leaf,
      campaign: args.campaign,
      escrowUsdc,
      creatorUsdc,
      creator: args.creator,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature };
}

// ---------- forfeit_node_stake / forfeit_leaf_stake ----------
// Public-good action: any wallet can call after campaign close to sweep a
// loser's stake into the campaign's forfeit pool.

export type ForfeitNodeStakeArgs = {
  node: PublicKey;
  campaign: PublicKey;
  caller: PublicKey;
};

export async function forfeitNodeStakeOnchain(
  program: Program,
  args: ForfeitNodeStakeArgs
): Promise<{ signature: string }> {
  const signature = await program.methods
    .forfeitNodeStake()
    .accountsStrict({
      node: args.node,
      campaign: args.campaign,
      caller: args.caller,
    })
    .rpc();
  return { signature };
}

export type ForfeitLeafStakeArgs = {
  leaf: PublicKey;
  campaign: PublicKey;
  caller: PublicKey;
};

export async function forfeitLeafStakeOnchain(
  program: Program,
  args: ForfeitLeafStakeArgs
): Promise<{ signature: string }> {
  const signature = await program.methods
    .forfeitLeafStake()
    .accountsStrict({
      leaf: args.leaf,
      campaign: args.campaign,
      caller: args.caller,
    })
    .rpc();
  return { signature };
}

// ---------- withdraw_unused_usdc ----------

export type WithdrawUnusedUsdcArgs = {
  campaign: PublicKey;
  usdcMint: PublicKey;
  authority: PublicKey;
};

export async function withdrawUnusedUsdcOnchain(
  program: Program,
  args: WithdrawUnusedUsdcArgs
): Promise<{ signature: string }> {
  const escrowUsdc = getAta(args.campaign, args.usdcMint);
  const authorityUsdc = getAta(args.authority, args.usdcMint);

  const signature = await program.methods
    .withdrawUnusedUsdc()
    .accountsStrict({
      campaign: args.campaign,
      escrowUsdc,
      authorityUsdc,
      authority: args.authority,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { signature };
}

// ---------- claim_redistribution ----------

export type ClaimRedistributionArgs = {
  leaf: PublicKey;
  campaign: PublicKey;
  creator: PublicKey;
};

export async function claimRedistributionOnchain(
  program: Program,
  args: ClaimRedistributionArgs
): Promise<{ signature: string }> {
  const signature = await program.methods
    .claimRedistribution()
    .accountsStrict({
      leaf: args.leaf,
      campaign: args.campaign,
      creator: args.creator,
    })
    .rpc();
  return { signature };
}
