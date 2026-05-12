// Builds unsigned Anchor transactions for the Hivework program. Returned as
// base64 wire-format so an agent (using @solana/kit) can decode, partially
// sign with its own keypair, and send via RPC.
//
// The MCP server itself is wallet-less — it never signs. fee_payer is the
// caller's wallet; the only signer required for create_node / create_leaf is
// the creator. The base64 returned here is the canonical "wire" transaction:
// the v0 versioned tx with no signatures yet.

import {
  AnchorProvider,
  Idl,
  Program,
  BN,
  Wallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

export class TxBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxBuilderError";
  }
}

export interface CreateNodeTxArgs {
  campaignOnchainPda: string;
  parentNodeOnchainPda: string | null;
  level: "L1" | "L2" | "L3";
  /** Hex-encoded sha256 of the canonical metadata JSON (32 bytes). */
  metadataHash: string;
  /** UTF-8 byte length of the canonical metadata JSON. */
  bytesMetadata: number;
  metadataCuid: string;
  creatorWallet: string;
}

export interface CreateLeafTxArgs {
  campaignOnchainPda: string;
  pathOnchainPdas: readonly [string, string, string];
  /** 8-char alphanumeric ref code reserved via /leaves/draft. */
  refCode: string;
  bytesMetadata: number;
  metadataCuid: string;
  creatorWallet: string;
}

export interface UnsignedTx {
  unsigned_tx_b64: string;
  fee_payer: string;
  expected_program_id: string;
}

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);

let cachedProgram: Program<Idl> | null = null;
let cachedConnection: Connection | null = null;

function loadIdl(): Idl {
  // The IDL lives under mcp/idl/, synced from Contract/target/idl on each
  // release. If missing, the builder can't operate — surface a clear error
  // rather than crashing the MCP at boot.
  const idlPath = resolve(process.cwd(), "idl", "hivework.json");
  if (!existsSync(idlPath)) {
    throw new TxBuilderError(
      `IDL not found at ${idlPath}. Run \`anchor build\` and copy target/idl/hivework.json into mcp/idl/.`,
    );
  }
  return JSON.parse(readFileSync(idlPath, "utf-8")) as Idl;
}

function getProgram(): Program<Idl> {
  if (cachedProgram) return cachedProgram;
  if (!config.HIVEWORK_PROGRAM_ID) {
    throw new TxBuilderError(
      "HIVEWORK_PROGRAM_ID not set — cannot build unsigned txs.",
    );
  }
  cachedConnection = new Connection(config.RPC_URL, "confirmed");
  // The provider is read-only: a throwaway keypair Wallet so AnchorProvider
  // is happy. We never sign with it — the agent does the signing later.
  const dummy = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(cachedConnection, dummy, {
    preflightCommitment: "confirmed",
    commitment: "confirmed",
  });
  const idl = loadIdl();
  cachedProgram = new Program(idl, provider);
  return cachedProgram;
}

function getConnection(): Connection {
  if (cachedConnection) return cachedConnection;
  cachedConnection = new Connection(config.RPC_URL, "confirmed");
  return cachedConnection;
}

function levelByte(level: "L1" | "L2" | "L3"): number {
  return level === "L1" ? 1 : level === "L2" ? 2 : 3;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) {
    throw new TxBuilderError(
      `metadata_hash must be 32 bytes hex (64 chars), got ${clean.length}`,
    );
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function deriveNodePda(
  campaign: PublicKey,
  creator: PublicKey,
  metadataHash: Uint8Array,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("node"), campaign.toBuffer(), creator.toBuffer(), Buffer.from(metadataHash)],
    new PublicKey(config.HIVEWORK_PROGRAM_ID!),
  )[0];
}

function deriveLeafPda(campaign: PublicKey, refCode: string): PublicKey {
  const padded = refCode.padEnd(8, " ").slice(0, 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("leaf"), campaign.toBuffer(), Buffer.from(padded, "ascii")],
    new PublicKey(config.HIVEWORK_PROGRAM_ID!),
  )[0];
}

async function ixToBase64Tx(
  feePayer: PublicKey,
  ix: TransactionInstruction,
): Promise<string> {
  const conn = getConnection();
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  // No signatures yet — agent fills them in.
  return Buffer.from(tx.serialize()).toString("base64");
}

export async function buildUnsignedCreateNodeTx(
  args: CreateNodeTxArgs,
): Promise<UnsignedTx> {
  const program = getProgram();
  const programId = program.programId;
  const creator = new PublicKey(args.creatorWallet);
  const campaign = new PublicKey(args.campaignOnchainPda);
  const metadataHash = hexToBytes(args.metadataHash);
  const nodePda = deriveNodePda(campaign, creator, metadataHash);
  const parentNode = args.parentNodeOnchainPda
    ? new PublicKey(args.parentNodeOnchainPda)
    : null;

  const ix = await program.methods
    .createNode(
      levelByte(args.level),
      Array.from(metadataHash),
      args.bytesMetadata,
      args.metadataCuid,
    )
    .accounts({
      node: nodePda,
      campaign,
      creator,
      parentNode,
      systemProgram: SystemProgram.programId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .instruction();

  const unsigned_tx_b64 = await ixToBase64Tx(creator, ix);
  return {
    unsigned_tx_b64,
    fee_payer: creator.toBase58(),
    expected_program_id: programId.toBase58(),
  };
}

export async function buildUnsignedCreateLeafTx(
  args: CreateLeafTxArgs,
): Promise<UnsignedTx> {
  const program = getProgram();
  const programId = program.programId;
  const creator = new PublicKey(args.creatorWallet);
  const campaign = new PublicKey(args.campaignOnchainPda);
  const leafPda = deriveLeafPda(campaign, args.refCode);
  const padded = args.refCode.padEnd(8, " ").slice(0, 8);
  const refCodeBytes = Array.from(Buffer.from(padded, "ascii"));

  const ix = await program.methods
    .createLeaf(refCodeBytes, args.bytesMetadata, args.metadataCuid)
    .accountsStrict({
      leaf: leafPda,
      campaign,
      creator,
      nodeL1: new PublicKey(args.pathOnchainPdas[0]),
      nodeL2: new PublicKey(args.pathOnchainPdas[1]),
      nodeL3: new PublicKey(args.pathOnchainPdas[2]),
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const unsigned_tx_b64 = await ixToBase64Tx(creator, ix);
  return {
    unsigned_tx_b64,
    fee_payer: creator.toBase58(),
    expected_program_id: programId.toBase58(),
  };
}

/** Canonical metadata hash — deterministic JSON.stringify + sha256. */
export function canonicalMetadataHash(metadata: Record<string, unknown>): {
  hashHex: string;
  bytesMetadata: number;
} {
  const json = JSON.stringify(metadata);
  const hashHex = createHash("sha256").update(json).digest("hex");
  return { hashHex, bytesMetadata: Buffer.byteLength(json, "utf-8") };
}

// Suppress unused TOKEN_PROGRAM_ID warning — kept for future claim-tool work.
void TOKEN_PROGRAM_ID;
