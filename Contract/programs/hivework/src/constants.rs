pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const NODE_SEED: &[u8] = b"node";
pub const LEAF_SEED: &[u8] = b"leaf";
pub const CONVERSION_SEED: &[u8] = b"conversion";

// Stakes requeridos para prevenir spam (en lamports).
// 1 SOL = 1_000_000_000 lamports.
//
// Los stakes son DEPÓSITOS anti-spam en SOL (el pago real vive en USDC, en el
// escrow de la campaña). A precios de SOL ≈ $160 USD, los siguientes valores
// equivalen a unos centavos cada uno — suficientes para frenar spam masivo
// sin hacer la participación costosa para usuarios reales.
//
// L1 ≈ $0.10, escalando hacia abajo por nivel hasta el leaf en ≈ $0.01.
pub const L1_STAKE_AMOUNT: u64 = 600_000;     // 0.0006 SOL ≈ $0.10
pub const L2_STAKE_AMOUNT: u64 = 300_000;     // 0.0003 SOL ≈ $0.05
pub const L3_STAKE_AMOUNT: u64 = 150_000;     // 0.00015 SOL ≈ $0.025
pub const LEAF_STAKE_AMOUNT: u64 = 60_000;    // 0.00006 SOL ≈ $0.01

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

// Upper bound on the off-chain cuid string passed to create_*. cuids today are
// 24 chars; we cap at 32 to leave room for prefix variants without inflating
// instruction-data size.
pub const MAX_CUID_LEN: usize = 32;
