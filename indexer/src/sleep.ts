// Abort-aware sleep used by every long-running loop in the indexer (listener
// reconnect backoff, oracle poll cadence, backfill cadence). Resolves either
// when the timer fires or when the AbortSignal aborts — never both.
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true },
    )
  })
}
