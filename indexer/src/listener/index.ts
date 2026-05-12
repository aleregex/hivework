import { address } from '@solana/kit'
import { createRpcClients } from '../rpc.js'
import type { Config } from '../config.js'
import { slotCursor } from '../slot-cursor.js'
import { parseAnchorEvents } from './parser.js'
import { dispatch } from './handlers.js'
import { log } from '../log.js'
import { listenerStatus } from '../status.js'
import { sleep } from '../sleep.js'

const PLACEHOLDER = 'PLACEHOLDER_UNTIL_GROUP_A_DEPLOYS'

export async function startListener(cfg: Config, signal: AbortSignal): Promise<void> {
  if (cfg.programId === PLACEHOLDER) {
    log.indexer.warn('PROGRAM_ID is placeholder — listener idle until Grupo A deploys')
    return
  }

  const { rpcSubs } = createRpcClients(cfg)
  const programId = address(cfg.programId)
  let attempt = 0
  let stableSince = 0

  while (!signal.aborted) {
    try {
      const sub = await rpcSubs
        .logsNotifications({ mentions: [programId] }, { commitment: 'confirmed' })
        .subscribe({ abortSignal: signal })

      log.indexer.info('subscribed', { programId: cfg.programId })
      stableSince = Date.now()
      listenerStatus.connected = true

      for await (const notification of sub) {
        // Reset attempt counter once we've been stable for 60s.
        if (Date.now() - stableSince > 60_000) attempt = 0

        const value = notification.value
        const ctx = notification.context as { slot: number | bigint } | undefined
        const slot = ctx?.slot != null ? BigInt(ctx.slot) : 0n

        if (value.err) continue

        const events = parseAnchorEvents(value.logs)
        for (const ev of events) {
          // dispatch swallows its own errors; we never propagate out.
          await dispatch(ev, value.signature, slot)
        }

        if (slot > 0n) await slotCursor.set(slot)
      }
    } catch (e) {
      listenerStatus.connected = false
      if (signal.aborted) return
      attempt++
      const base = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5))
      const delay = base + Math.floor(Math.random() * 500)
      log.indexer.error('reconnect scheduled', { delayMs: delay, attempt, err: String(e) })
      await sleep(delay, signal)
    }
  }
}
