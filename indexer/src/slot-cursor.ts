// In-memory cursor for stub phase. Move to a Postgres kv table once B1 ships schema.
let last: bigint = 0n

export const slotCursor = {
  get(): bigint {
    return last
  },
  async set(s: bigint): Promise<void> {
    if (s > last) last = s
  },
}
