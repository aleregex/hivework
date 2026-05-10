import { address } from '@solana/kit'
import { createRpcClients } from '../rpc.js'
import type { Config } from '../config.js'
import { slotCursor } from '../slot-cursor.js'

const PLACEHOLDER = 'PLACEHOLDER_UNTIL_GROUP_A_DEPLOYS'

export async function startListener(cfg: Config, signal: AbortSignal): Promise<void> {
  if (cfg.programId === PLACEHOLDER) {
    console.warn('[listener] PROGRAM_ID is placeholder — listener idle until Grupo A deploys')
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

      console.log('[listener] subscribed', cfg.programId)
      stableSince = Date.now()

      for await (const { value } of sub) {
        if (Date.now() - stableSince > 60_000) attempt = 0
        if (value.err) continue
        // TODO: parseAnchorEvents(value.logs, idl) → dispatch(event, signature, slot)
        console.log('[listener]', value.signature, value.logs.length, 'lines')
        // slot is not in logsNotifications payload directly — fetched via getSignatureStatuses if needed
        await slotCursor.set(0n)
      }
    } catch (e) {
      if (signal.aborted) return
      attempt++
      const base = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5))
      const delay = base + Math.floor(Math.random() * 500)
      console.error('[listener] reconnect in', delay, 'ms — attempt', attempt, e)
      await sleep(delay, signal)
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((res) => {
    const t = setTimeout(res, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      res()
    }, { once: true })
  })
}
