// Stub event types until Grupo A ships the IDL and `npm run codama:generate`
// produces the real decoder. Keep field names matching the docs/grupo_b.md
// contract so handlers don't need to change shape on swap-in.

export type Pubkey = string  // base58

export type CampaignCreated = {
  name: 'CampaignCreated'
  campaignPda: Pubkey       // → CampaignMetadata.onchainPda
  metadataCuid: string      // ← REQUIRED from Grupo A: thread the api/ cuid through
  brandPubkey: Pubkey
  poolLamports: bigint      // SOL portion only; USDC pool tracked via separate event/account
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
  path: [Pubkey, Pubkey, Pubkey]   // L1, L2, L3 node PDAs
  creator: Pubkey
  refCode: string
  stakeLamports: bigint
}

export type ConversionRegistered = {
  name: 'ConversionRegistered'
  conversionPda: Pubkey
  leafPda: Pubkey
  valueLamports: bigint     // for SOL-denominated demos; USDC via decimal in api
  oracleSignature: string
}

export type CampaignClosed = {
  name: 'CampaignClosed'
  campaignPda: Pubkey
  totalDistributedLamports: bigint
}

export type AnchorEvent =
  | CampaignCreated
  | NodeCreated
  | LeafCreated
  | ConversionRegistered
  | CampaignClosed
