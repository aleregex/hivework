use anchor_lang::prelude::*;

#[account]
pub struct Campaign {
    pub authority: Pubkey,            // 32
    pub id: u32,                       // 4
    pub escrow_usdc: Pubkey,          // 32
    pub usdc_mint: Pubkey,            // 32
    pub oracle_authority: Pubkey,     // 32
    pub total_usdc: u64,              // 8
    pub platform_fee: u8,             // 1
    pub alpha_weight: u8,             // 1
    pub beta_weight: u8,              // 1
    pub gamma_weight: u8,             // 1
    pub deadline: i64,                // 8
    pub is_closed: bool,              // 1
    pub conversions_processed: u32,   // 4 (batch processing counter)
    pub total_conversions: u32,       // 4 (incrementado en register_conversion)
    pub forfeited_pool: u64,          // 8 (lamports de stakes de perdedores)
    pub total_to_winners: u64,        // 8 (USDC asignado a ganadores en close)
    pub unused_withdrawn: bool,       // 1 (la marca ya retiró el USDC sobrante)
    pub bump: u8,                     // 1
}

impl Campaign {
    pub const SPACE: usize =
        8 + 32 + 4 + 32 + 32 + 32 + 8 + 1 + 1 + 1 + 1 + 8 + 1 + 4 + 4 + 8 + 8 + 1 + 1;
}

#[account]
pub struct Node {
    pub campaign: Pubkey,             // 32
    pub creator: Pubkey,              // 32
    pub parent_node: Option<Pubkey>,  // 1 + 32
    pub level: u8,                    // 1
    pub metadata_hash: [u8; 32],      // 32
    pub bytes_metadata: u32,          // 4 (para richness_score)
    pub stake_locked: u64,            // 8
    pub forks_count: u32,             // 4
    pub conversions_count: u32,       // 4
    pub claimable_usdc: u64,          // 8
    pub bump: u8,                     // 1
}

impl Node {
    pub const SPACE: usize = 8 + 32 + 32 + 33 + 1 + 32 + 4 + 8 + 4 + 4 + 8 + 1;
}

#[account]
pub struct Leaf {
    pub campaign: Pubkey,             // 32
    pub creator: Pubkey,              // 32
    pub parent_node: Pubkey,          // 32
    pub genealogical_path: [Pubkey; 3], // 96
    pub ref_code: [u8; 8],            // 8
    pub bytes_metadata: u32,          // 4 (para richness_score)
    pub stake_locked: u64,            // 8
    pub conversions_count: u32,       // 4
    pub claimable_usdc: u64,          // 8
    pub redistribution_claimed: bool, // 1 (para evitar doble-claim del bonus)
    pub bump: u8,                     // 1
}

impl Leaf {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 96 + 8 + 4 + 8 + 4 + 8 + 1 + 1;
}

#[account]
pub struct Conversion {
    pub campaign: Pubkey,             // 32
    pub leaf: Pubkey,                 // 32
    pub oracle: Pubkey,               // 32
    pub id: [u8; 16],                 // 16
    pub value: u64,                   // 8
    pub is_processed: bool,           // 1
    pub bump: u8,                     // 1
}

impl Conversion {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 16 + 8 + 1 + 1;
}
