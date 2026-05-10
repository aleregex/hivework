import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  getBase64Encoder,
  getBase64EncodedWireTransaction,
  getTransactionDecoder,
  partiallySignTransactionWithSigners,
  type KeyPairSigner,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { config } from "./config.js";

export type AgentSigner = KeyPairSigner;
export type SolanaRpc = Rpc<SolanaRpcApi>;

let cachedSigner: AgentSigner | null = null;
let cachedRpc: SolanaRpc | null = null;

export async function loadAgentSigner(): Promise<AgentSigner> {
  if (cachedSigner) return cachedSigner;
  const path = resolve(process.cwd(), config.WALLET_PATH);
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error(
      `wallet at ${path} is not a 64-byte JSON array (got length ${Array.isArray(parsed) ? parsed.length : "non-array"})`,
    );
  }
  const bytes = Uint8Array.from(parsed);
  cachedSigner = await createKeyPairSignerFromBytes(bytes);
  return cachedSigner;
}

export function getRpc(): SolanaRpc {
  if (!cachedRpc) cachedRpc = createSolanaRpc(config.RPC_URL);
  return cachedRpc;
}

export async function signAndSendBase64Tx(
  unsignedTxBase64: string,
  signer: AgentSigner,
): Promise<string> {
  const wireBytes = getBase64Encoder().encode(unsignedTxBase64);
  const tx = getTransactionDecoder().decode(wireBytes);
  const signed = await partiallySignTransactionWithSigners([signer], tx);
  const wire = getBase64EncodedWireTransaction(signed);
  const sig = await getRpc()
    .sendTransaction(wire, { encoding: "base64" })
    .send();
  return sig as unknown as string;
}
