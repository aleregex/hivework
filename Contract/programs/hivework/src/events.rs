use anchor_lang::prelude::*;

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub authority: Pubkey,
    pub total_usdc: u64,
    pub deadline: i64,
    /// Off-chain cuid threaded through from the api draft.
    /// Lets the indexer match an on-chain account to its api row.
    pub metadata_cuid: String,
}

#[event]
pub struct NodeCreated {
    pub node: Pubkey,
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub level: u8,
    pub parent_node: Option<Pubkey>,
    pub stake_lamports: u64,
    pub metadata_cuid: String,
}

#[event]
pub struct LeafCreated {
    pub leaf: Pubkey,
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub ref_code: [u8; 8],
    pub path: [Pubkey; 3],
    pub stake_lamports: u64,
    pub metadata_cuid: String,
}

#[event]
pub struct ConversionRegistered {
    pub conversion: Pubkey,
    pub campaign: Pubkey,
    pub leaf: Pubkey,
    pub value: u64,
    /// Mirrors the 16-byte conversion_id seed used by the PDA, hex-encoded.
    /// Indexer joins this back to pending_conversion.id.
    pub conversion_id: [u8; 16],
}

#[event]
pub struct CampaignClosed {
    pub campaign: Pubkey,
    pub conversions_processed: u32,
}

#[event]
pub struct PayoutClaimed {
    pub campaign: Pubkey,
    /// The Node or Leaf PDA whose claimable_usdc was drained.
    pub source: Pubkey,
    pub creator: Pubkey,
    pub kind: PayoutKind,
    pub amount_usdc: u64,
    pub stake_released_lamports: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PayoutKind {
    Node,
    Leaf,
}
