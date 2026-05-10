import { createSolanaRpc } from "@solana/kit";
import { config } from "../config.js";

let cached: ReturnType<typeof createSolanaRpc> | null = null;

export function getRpc(): ReturnType<typeof createSolanaRpc> {
  if (!cached) {
    cached = createSolanaRpc(config.RPC_URL);
  }
  return cached;
}
