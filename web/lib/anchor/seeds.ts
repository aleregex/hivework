// PDA derivation helpers — mirror Contract/INTEGRATION.md § 2 exactly.
// All seeds match the on-chain `seeds = [...]` constraints; if you tweak
// these, the contract will reject the tx with a "seeds constraint violated"
// error.

import { PublicKey } from "@solana/web3.js";
import { HIVEWORK_PROGRAM_ID } from "./idl";

const PROGRAM_ID = new PublicKey(HIVEWORK_PROGRAM_ID);

const enc = (s: string) => new TextEncoder().encode(s);

/** Encode a `u32` as little-endian 4 bytes (matches Borsh). */
export function u32LE(n: number): Uint8Array {
  if (!Number.isInteger(n) || n < 0 || n > 0xff_ff_ff_ff) {
    throw new Error(`u32 out of range: ${n}`);
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

/** SHA-256 of a UTF-8 string → 32-byte Uint8Array. Browser-side only. */
export async function sha256Bytes(input: string): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed view: TS 5.7+ types
  // `TextEncoder.encode()` as `Uint8Array<ArrayBufferLike>`, but
  // `crypto.subtle.digest` requires an `ArrayBuffer`-backed `BufferSource`.
  const data = new Uint8Array(enc(input));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(buf);
}

export function deriveCampaignPda(
  authority: PublicKey,
  campaignId: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [enc("campaign"), authority.toBuffer(), u32LE(campaignId)],
    PROGRAM_ID
  );
}

export function deriveNodePda(
  campaign: PublicKey,
  creator: PublicKey,
  metadataHash: Uint8Array
): [PublicKey, number] {
  if (metadataHash.length !== 32) {
    throw new Error("metadata_hash must be 32 bytes");
  }
  return PublicKey.findProgramAddressSync(
    [enc("node"), campaign.toBuffer(), creator.toBuffer(), metadataHash],
    PROGRAM_ID
  );
}

export function deriveLeafPda(
  campaign: PublicKey,
  refCode: string
): [PublicKey, number] {
  const refBytes = encodeRefCode(refCode);
  return PublicKey.findProgramAddressSync(
    [enc("leaf"), campaign.toBuffer(), refBytes],
    PROGRAM_ID
  );
}

/** ASCII-encode an 8-char ref_code, padding/truncating to fit `[u8; 8]`. */
export function encodeRefCode(refCode: string): Uint8Array {
  const padded = refCode.padEnd(8, " ").slice(0, 8);
  return enc(padded);
}

export { PROGRAM_ID };
