import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit'
import type { Config } from './config.js'

export function createRpcClients(cfg: Config) {
  const rpc = createSolanaRpc(cfg.rpcHttp)
  const rpcSubs = createSolanaRpcSubscriptions(cfg.rpcWs)
  return { rpc, rpcSubs }
}
