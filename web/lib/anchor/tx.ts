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

// SPL standard program ids — hardcoded to avoid pulling @solana/spl-token.
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

/** Standard SPL associated-token-account derivation. */
function getAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
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
      initialUsdcBase
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

  // L1 needs no parent — pass System program as a sentinel.
  const parentAccount = args.parentNode ?? SystemProgram.programId;

  const signature = await program.methods
    .createNode(args.level, Array.from(metadataHash), bytesMetadata)
    .accountsStrict({
      node: nodePda,
      campaign: args.campaign,
      creator: args.creator,
      parentNode: parentAccount,
      systemProgram: SystemProgram.programId,
    })
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
    .createLeaf(Array.from(refCodeBytes), bytesMetadata)
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
