import type { Config } from '../config.js'

export async function startBackfill(_cfg: Config, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      // TODO: getProgramAccounts (filtered by account discriminator) → diff vs DB → upsert missing.
      // Also called immediately on listener reconnect (shared event bus, TBD).
    } catch (e) {
      console.error('[backfill]', e)
    }
    await sleep(30_000, signal)
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
