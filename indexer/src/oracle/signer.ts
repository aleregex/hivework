import { readFileSync } from 'node:fs'
import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit'
import type { Config } from '../config.js'

export async function loadOracleSigner(cfg: Config): Promise<KeyPairSigner> {
  const raw = readFileSync(cfg.oracleKeypairPath, 'utf8')
  const bytes = Uint8Array.from(JSON.parse(raw))
  return createKeyPairSignerFromBytes(bytes)
}
