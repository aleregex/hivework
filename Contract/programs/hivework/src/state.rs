use anchor_lang::prelude::*;

#[account]
pub struct Campaign {
    pub authority: Pubkey,            // 32
    pub escrow_usdc: Pubkey,          // 32
    pub total_usdc: u64,              // 8
    pub platform_fee: u8,             // 1
    pub alpha_weight: u8,             // 1
    pub beta_weight: u8,              // 1
    pub gamma_weight: u8,             // 1
    pub deadline: i64,                // 8
    pub is_closed: bool,              // 1
    pub conversions_processed: u32,   // 4 (Para batch processing de close_and_distribute)
    pub bump: u8,                     // 1
}

impl Campaign {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 1 + 1 + 8 + 1 + 4 + 1;
}

#[account]
pub struct Node {
    pub campaign: Pubkey,             // 32
    pub creator: Pubkey,              // 32
    pub parent_node: Option<Pubkey>,  // 1 + 32
    pub level: u8,                    // 1
    pub metadata_hash: [u8; 32],      // 32
    pub stake_locked: u64,            // 8
    pub forks_count: u32,             // 4
    pub conversions_count: u32,       // 4
    pub claimable_usdc: u64,          // 8
    pub bump: u8,                     // 1
}

impl Node {
    pub const SPACE: usize = 8 + 32 + 32 + 33 + 1 + 32 + 8 + 4 + 4 + 8 + 1;
}

#[account]
pub struct Leaf {
    pub campaign: Pubkey,             // 32
    pub creator: Pubkey,              // 32
    pub parent_node: Pubkey,          // 32
    pub genealogical_path: [Pubkey; 3], // 32 * 3 = 96
    pub ref_code: [u8; 8],            // 8
    pub stake_locked: u64,            // 8
    pub conversions_count: u32,       // 4
    pub claimable_usdc: u64,          // 8
    pub bump: u8,                     // 1
}

impl Leaf {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 96 + 8 + 8 + 4 + 8 + 1;
}

#[account]
pub struct Conversion {
    pub campaign: Pubkey,             // 32
    pub leaf: Pubkey,                 // 32
    pub oracle: Pubkey,               // 32
    pub id: [u8; 16],                 // 16
    pub value: u64,                   // 8
    pub is_processed: bool,           // 1 (Para batch processing de distribución)
    pub bump: u8,                     // 1
}

impl Conversion {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 16 + 8 + 1 + 1;
}
