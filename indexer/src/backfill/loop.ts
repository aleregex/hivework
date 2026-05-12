// Backfill is the safety net. Every 30s we ask the chain for the full state of
// our program's accounts and reconcile against the DB cache. This catches:
//   - events the WebSocket dropped silently
//   - state that exists from before the indexer was running
//   - any other drift between on-chain truth and our cache.
//
// Real reconciliation requires the IDL-generated account discriminators. Until
// `npm run codama:generate` produces them, this is a heartbeat that logs only.
import type { Config } from '../config.js'
import { log } from '../log.js'
import { sleep } from '../sleep.js'

const PLACEHOLDER = 'PLACEHOLDER_UNTIL_GROUP_A_DEPLOYS'

export async function startBackfill(cfg: Config, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      if (cfg.programId === PLACEHOLDER) {
        // Nothing on-chain to reconcile yet; just heartbeat.
      } else {
        // TODO(post-IDL): for each account kind (Campaign / Node / Leaf / Conversion):
        //   1. rpc.getProgramAccounts(programId, { filters: [{ memcmp: { offset: 0, bytes: discriminator } }] })
        //   2. parse with codama-generated decoder
        //   3. diff vs prisma cache by onchainPda
        //   4. upsert missing rows; log inconsistencies but never delete
        // Idempotent: same pass twice is a no-op.
      }
    } catch (e) {
      log.backfill.error('tick failed', { err: String(e) })
    }
    await sleep(30_000, signal)
  }
}
