pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const NODE_SEED: &[u8] = b"node";
pub const LEAF_SEED: &[u8] = b"leaf";
pub const CONVERSION_SEED: &[u8] = b"conversion";

// Stakes requeridos para prevenir spam (en lamports)
// 1 SOL = 1_000_000_000 lamports
// Valores reducidos 100x para devnet/testing (originales: 1.0 / 0.5 / 0.25 / 0.1 SOL)
pub const L1_STAKE_AMOUNT: u64 = 10_000_000;       // 0.01 SOL
pub const L2_STAKE_AMOUNT: u64 = 5_000_000;        // 0.005 SOL
pub const L3_STAKE_AMOUNT: u64 = 2_500_000;        // 0.0025 SOL
pub const LEAF_STAKE_AMOUNT: u64 = 1_000_000;      // 0.001 SOL

pub const PLATFORM_FEE_PERCENTAGE: u8 = 5;
pub const LEAF_BONUS_PERCENTAGE: u8 = 30;

// Default weights
pub const DEFAULT_ALPHA: u8 = 40; // Popularity (forks)
pub const DEFAULT_BETA: u8 = 40;  // Information richness
pub const DEFAULT_GAMMA: u8 = 20; // Hierarchical position

// Position factors (multiplied by 10 internally to avoid floats, e.g. 10 = 1.0)
pub const POS_FACTOR_L1: u8 = 10;
pub const POS_FACTOR_L2: u8 = 7;
pub const POS_FACTOR_L3: u8 = 5;
pub const POS_FACTOR_LEAF: u8 = 3;
