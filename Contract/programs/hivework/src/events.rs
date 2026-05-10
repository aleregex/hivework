use anchor_lang::prelude::*;

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub authority: Pubkey,
    pub total_usdc: u64,
    pub deadline: i64,
}

#[event]
pub struct NodeCreated {
    pub node: Pubkey,
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub level: u8,
}

#[event]
pub struct LeafCreated {
    pub leaf: Pubkey,
    pub campaign: Pubkey,
    pub creator: Pubkey,
    pub ref_code: [u8; 8],
}

#[event]
pub struct ConversionRegistered {
    pub conversion: Pubkey,
    pub campaign: Pubkey,
    pub leaf: Pubkey,
    pub value: u64,
}

#[event]
pub struct CampaignClosed {
    pub campaign: Pubkey,
    pub conversions_processed: u32,
}
