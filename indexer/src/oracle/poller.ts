import type { Config } from '../config.js'

export async function startOraclePoller(_cfg: Config, signal: AbortSignal): Promise<void> {
  console.warn('[oracle] poller idle until B1 schema + Grupo A IDL are ready')
  while (!signal.aborted) {
    await sleep(10_000, signal)
    // TODO: load pending → validate → buildRegisterConversionIx → sign with oracleSigner → send tx
    // On confirm: update status='pushed_to_chain' + tx_signature
    // On validation fail: status='rejected'
    // On send fail: leave 'pending', retry next tick
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
