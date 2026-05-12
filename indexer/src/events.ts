// Decoded event types emitted by Contract/programs/hivework. Field shape
// follows what parser.ts produces: pubkeys are base58, integers are bigint
// (because borsh emits u64/i64 as 64-bit ints), strings are decoded utf-8.

export type Pubkey = string // base58

export type CampaignCreated = {
  name: 'CampaignCreated'
  campaignPda: Pubkey
  metadataCuid: string
  brandPubkey: Pubkey
  // CampaignCreated emits `total_usdc` (u64 base units) rather than SOL — the
  // field is kept named `poolLamports` for backward compat with prior handler
  // code, but interpret it as USDC base units when wiring downstream.
  poolLamports: bigint
}

export type NodeCreated = {
  name: 'NodeCreated'
  nodePda: Pubkey
  metadataCuid: string
  campaignPda: Pubkey
  parentNodePda: Pubkey | null
  level: 1 | 2 | 3
  creator: Pubkey
  stakeLamports: bigint
}

export type LeafCreated = {
  name: 'LeafCreated'
  leafPda: Pubkey
  metadataCuid: string
  campaignPda: Pubkey
  path: [Pubkey, Pubkey, Pubkey]
  creator: Pubkey
  refCode: string
  stakeLamports: bigint
}

export type ConversionRegistered = {
  name: 'ConversionRegistered'
  conversionPda: Pubkey
  campaignPda: Pubkey
  leafPda: Pubkey
  /** USDC base units (6 decimals) as encoded on-chain. Field kept named
   *  `valueLamports` for back-compat; downstream code should treat it as USDC. */
  valueLamports: bigint
  /** UTF-8 decoded conversion_id seed. Matches the prefix of the source
   *  pending_conversion.id so the indexer can match the row. */
  conversionId: string
  /** Reserved for future use — currently unused. */
  oracleSignature: string
}

export type CampaignClosed = {
  name: 'CampaignClosed'
  campaignPda: Pubkey
  /** Reused for `conversions_processed` count. */
  totalDistributedLamports: bigint
}

export type PayoutClaimed = {
  name: 'PayoutClaimed'
  campaignPda: Pubkey
  source: Pubkey
  creator: Pubkey
  kind: 'node' | 'leaf'
  amountUsdc: bigint
  stakeReleasedLamports: bigint
}

export type AnchorEvent =
  | CampaignCreated
  | NodeCreated
  | LeafCreated
  | ConversionRegistered
  | CampaignClosed
  | PayoutClaimed
