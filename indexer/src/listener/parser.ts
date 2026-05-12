// Minimal Anchor event parser. Anchor emits events as a log line of the form
//   "Program data: <base64>"
// where the base64 payload is `[8-byte discriminator][borsh-encoded data]`.
// Discriminators come from the IDL's `events` array — we match by 8-byte
// prefix and decode the rest using a hand-rolled borsh reader.
//
// Why hand-rolled rather than `@coral-xyz/anchor.BorshEventCoder`?
// The indexer is built on `@solana/kit` and has no reason to pull in the full
// anchor SDK. The set of event field types we use is tiny (pubkey, u8/u32/u64,
// i64, bool, Option<T>, [u8;N], [Pubkey;N], String, enum) so a 100-line reader
// covers everything Group A emits.
import type { AnchorEvent } from '../events.js'
import idlJson from '../../../web/lib/anchor/idl/hivework.json' with { type: 'json' }

const PROGRAM_DATA = 'Program data: '

type IdlEvent = { name: string; discriminator: number[] }
type IdlField = { name: string; type: unknown }

const IDL = idlJson as unknown as {
  events: IdlEvent[]
  types: Array<{
    name: string
    type: {
      kind: 'struct' | 'enum'
      fields?: IdlField[]
      variants?: Array<{ name: string }>
    }
  }>
}

const EVENT_TYPE_BY_NAME = new Map<string, IdlField[]>()
for (const t of IDL.types ?? []) {
  if (t.type.kind === 'struct' && t.type.fields) {
    EVENT_TYPE_BY_NAME.set(t.name, t.type.fields)
  }
}

const DISCRIMINATORS: Array<{ name: string; bytes: Uint8Array }> = (IDL.events ?? []).map((e) => ({
  name: e.name,
  bytes: Uint8Array.from(e.discriminator),
}))

class Reader {
  private dv: DataView
  private offset = 0
  constructor(private buf: Uint8Array) {
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  remaining(): number {
    return this.buf.length - this.offset
  }
  u8(): number {
    const v = this.dv.getUint8(this.offset)
    this.offset += 1
    return v
  }
  u32(): number {
    const v = this.dv.getUint32(this.offset, true)
    this.offset += 4
    return v
  }
  u64(): bigint {
    const v = this.dv.getBigUint64(this.offset, true)
    this.offset += 8
    return v
  }
  i64(): bigint {
    const v = this.dv.getBigInt64(this.offset, true)
    this.offset += 8
    return v
  }
  bool(): boolean {
    return this.u8() !== 0
  }
  bytes(n: number): Uint8Array {
    const out = this.buf.slice(this.offset, this.offset + n)
    this.offset += n
    return out
  }
  pubkey(): string {
    return base58Encode(this.bytes(32))
  }
  optionPubkey(): string | null {
    return this.u8() === 0 ? null : this.pubkey()
  }
  string(): string {
    const len = this.u32()
    const bytes = this.bytes(len)
    return new TextDecoder().decode(bytes)
  }
}

// Standard base58 (Bitcoin alphabet). Used only for pubkey serialization in
// events; lifted out so we don't pull bs58 into the indexer just for this.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function base58Encode(bytes: Uint8Array): string {
  // Count leading zero bytes (they become '1' chars).
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++

  // Convert big-endian bytes → base58 digits.
  const digits: number[] = [0]
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }

  let out = ''
  for (let i = 0; i < zeros; i++) out += '1'
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]]
  return out
}

function base64Decode(b64: string): Uint8Array {
  // Node has Buffer; fall back to atob in non-node runtimes.
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64')
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function decodeEvent(name: string, r: Reader): AnchorEvent | null {
  switch (name) {
    case 'CampaignCreated': {
      const campaign = r.pubkey()
      const _authority = r.pubkey()
      const totalUsdc = r.u64()
      const _deadline = r.i64()
      const metadataCuid = r.string()
      return {
        name: 'CampaignCreated',
        campaignPda: campaign,
        metadataCuid,
        brandPubkey: _authority,
        // CampaignCreated emits USDC in u64 base units; we track that.
        poolLamports: totalUsdc,
      }
    }
    case 'NodeCreated': {
      const node = r.pubkey()
      const campaign = r.pubkey()
      const creator = r.pubkey()
      const level = r.u8()
      const parentNodePda = r.optionPubkey()
      const stakeLamports = r.u64()
      const metadataCuid = r.string()
      if (level !== 1 && level !== 2 && level !== 3) return null
      return {
        name: 'NodeCreated',
        nodePda: node,
        metadataCuid,
        campaignPda: campaign,
        parentNodePda,
        level: level as 1 | 2 | 3,
        creator,
        stakeLamports,
      }
    }
    case 'LeafCreated': {
      const leaf = r.pubkey()
      const campaign = r.pubkey()
      const creator = r.pubkey()
      // ref_code: [u8; 8]
      const refCodeBytes = r.bytes(8)
      // path: [Pubkey; 3]
      const l1 = r.pubkey()
      const l2 = r.pubkey()
      const l3 = r.pubkey()
      const stakeLamports = r.u64()
      const metadataCuid = r.string()
      return {
        name: 'LeafCreated',
        leafPda: leaf,
        metadataCuid,
        campaignPda: campaign,
        path: [l1, l2, l3],
        creator,
        refCode: new TextDecoder().decode(refCodeBytes).replace(/\0+$/g, ''),
        stakeLamports,
      }
    }
    case 'ConversionRegistered': {
      const conversion = r.pubkey()
      const campaign = r.pubkey()
      const leaf = r.pubkey()
      const value = r.u64()
      const conversionIdBytes = r.bytes(16)
      return {
        name: 'ConversionRegistered',
        conversionPda: conversion,
        leafPda: leaf,
        campaignPda: campaign,
        conversionId: new TextDecoder().decode(conversionIdBytes).replace(/\0+$/g, ''),
        valueLamports: value,
        oracleSignature: '',
      }
    }
    case 'CampaignClosed': {
      const campaign = r.pubkey()
      const conversionsProcessed = r.u32()
      return {
        name: 'CampaignClosed',
        campaignPda: campaign,
        // No lamport amount on-chain; signal via processed count.
        totalDistributedLamports: BigInt(conversionsProcessed),
      }
    }
    case 'PayoutClaimed': {
      const campaign = r.pubkey()
      const source = r.pubkey()
      const creator = r.pubkey()
      const kind = r.u8() // 0=Node, 1=Leaf
      const amountUsdc = r.u64()
      const stakeReleasedLamports = r.u64()
      return {
        name: 'PayoutClaimed',
        campaignPda: campaign,
        source,
        creator,
        kind: kind === 0 ? 'node' : 'leaf',
        amountUsdc,
        stakeReleasedLamports,
      }
    }
    default:
      return null
  }
}

export function parseAnchorEvents(logs: readonly string[]): AnchorEvent[] {
  const out: AnchorEvent[] = []
  for (const line of logs) {
    if (!line.startsWith(PROGRAM_DATA)) continue
    const b64 = line.slice(PROGRAM_DATA.length).trim()
    let raw: Uint8Array
    try {
      raw = base64Decode(b64)
    } catch {
      continue
    }
    if (raw.length < 8) continue
    const disc = raw.slice(0, 8)
    const match = DISCRIMINATORS.find((d) => bytesEqual(disc, d.bytes))
    if (!match) continue
    const r = new Reader(raw.slice(8))
    try {
      const ev = decodeEvent(match.name, r)
      if (ev) out.push(ev)
    } catch {
      // Malformed event payload — skip rather than crash the listener.
    }
  }
  return out
}

// Re-exported for tests + the events.ts schema check.
export { EVENT_TYPE_BY_NAME }
