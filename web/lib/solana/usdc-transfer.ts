// Raw USDC (SPL Token) transfer from the connected wallet to an arbitrary
// recipient. The project deliberately avoids @solana/spl-token (see
// lib/anchor/tx.ts:21) so we hand-roll the two instructions we need:
//
//   1. Associated-Token-Account "CreateIdempotent" for the recipient — no-op
//      if their USDC ATA already exists, creates it if not. Buyer pays rent.
//   2. SPL Token "Transfer" — moves base-unit USDC from buyer's ATA to the
//      recipient's ATA.
//
// USDC has 6 decimals on every cluster, so 1 USDC = 1_000_000 base units.

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

// Standard SPL program ids — same constants used elsewhere in this codebase.
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

function getAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

// ATA CreateIdempotent: data = [1]. Accounts (order matters):
//   0. funder (signer, writable)        — pays rent if creation happens
//   1. associated account (writable)    — recipient's ATA
//   2. owner                            — recipient's wallet
//   3. mint                             — USDC mint
//   4. system program
//   5. token program
function createAtaIdempotentIx(args: {
  funder: PublicKey;
  ata: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: args.funder, isSigner: true, isWritable: true },
      { pubkey: args.ata, isSigner: false, isWritable: true },
      { pubkey: args.owner, isSigner: false, isWritable: false },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

// SPL Token Transfer: data = [3, amount_le_u64]. Accounts:
//   0. source ATA (writable)
//   1. destination ATA (writable)
//   2. owner of source (signer)
function transferIx(args: {
  source: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amountBase: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer discriminator
  data.writeBigUInt64LE(args.amountBase, 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: args.source, isSigner: false, isWritable: true },
      { pubkey: args.destination, isSigner: false, isWritable: true },
      { pubkey: args.owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export type TransferUsdcArgs = {
  connection: Connection;
  payer: PublicKey;
  recipient: PublicKey;
  usdcMint: PublicKey;
  /** Human-readable USDC amount (e.g. 24 = $24). Converted to base units. */
  amountUsdc: number;
  sendTransaction: (
    tx: Transaction,
    connection: Connection,
  ) => Promise<string>;
};

/**
 * Send a USDC transfer from `payer` to `recipient`. Creates the recipient's
 * ATA idempotently inside the same tx. Returns the confirmed tx signature.
 */
export async function transferUsdc(args: TransferUsdcArgs): Promise<string> {
  if (!Number.isFinite(args.amountUsdc) || args.amountUsdc <= 0) {
    throw new Error("amountUsdc must be a positive number");
  }
  const amountBase = BigInt(Math.round(args.amountUsdc * 1_000_000));

  const sourceAta = getAta(args.payer, args.usdcMint);
  const destAta = getAta(args.recipient, args.usdcMint);

  const tx = new Transaction()
    .add(
      createAtaIdempotentIx({
        funder: args.payer,
        ata: destAta,
        owner: args.recipient,
        mint: args.usdcMint,
      }),
    )
    .add(
      transferIx({
        source: sourceAta,
        destination: destAta,
        owner: args.payer,
        amountBase,
      }),
    );

  const { blockhash, lastValidBlockHeight } =
    await args.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = args.payer;

  const signature = await args.sendTransaction(tx, args.connection);

  await args.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return signature;
}
