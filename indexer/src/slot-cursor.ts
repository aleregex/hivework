// File-backed slot cursor. Records the highest slot the listener has seen so we
// can resume after restart. Atomic writes via tmp + rename. The cursor is
// observability + a future "scan signatures since X" hook — the real safety net
// for missed events is the backfill loop (getProgramAccounts diff).
import { readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const FILE = resolve(process.cwd(), '.cursor')
const TMP = `${FILE}.tmp`

let last: bigint = load()

function load(): bigint {
  if (!existsSync(FILE)) return 0n
  try {
    const raw = readFileSync(FILE, 'utf8')
    const parsed = JSON.parse(raw) as { slot?: string }
    return parsed.slot ? BigInt(parsed.slot) : 0n
  } catch {
    return 0n
  }
}

function persist(s: bigint): void {
  writeFileSync(TMP, JSON.stringify({ slot: s.toString() }), { mode: 0o644 })
  renameSync(TMP, FILE)
}

export const slotCursor = {
  get(): bigint {
    return last
  },
  async set(s: bigint): Promise<void> {
    if (s <= last) return
    last = s
    try {
      persist(s)
    } catch {
      // Best-effort persistence — never crash the listener over a write failure.
    }
  },
}
