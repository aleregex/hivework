// Single source of truth for anti-spam stake amounts.
// Keep in sync with Contract/programs/hivework/src/constants.rs.
//
// Stake is a refundable deposit (in SOL) that the contract locks on the
// Node / Leaf PDA when it is created. The node creator gets it back via
// `claim_payout` when the node (or any descendant) has at least one
// conversion; otherwise it goes to the redistribution pool.
//
// Separate from the stake, Solana charges its own rent + tx fees — see
// RENT_PER_NODE_SOL below for the approximate combined cost the user pays
// on top of the stake when creating each kind of account.

export const STAKE_SOL_BY_LEVEL = {
  1: 0.0006,    // L1 hook  — matches L1_STAKE_AMOUNT = 600_000 lamports
  2: 0.0003,    // L2 audio — matches L2_STAKE_AMOUNT = 300_000 lamports
  3: 0.00015,   // L3 visual — matches L3_STAKE_AMOUNT = 150_000 lamports
} as const;

export const STAKE_SOL_LEAF = 0.00006; // matches LEAF_STAKE_AMOUNT = 60_000 lamports

/**
 * Approximate rent-exempt + fee that Solana charges on top of the stake
 * when creating a Node / Leaf account. Computed empirically against the
 * account sizes in state.rs (Node ≈ 159 bytes, Leaf ≈ 235 bytes). The
 * exact value varies by ~10% with the current rent-rate slot, but this is
 * close enough to surface "total cost" in the UI without lying to users.
 */
export const RENT_SOL_PER_NODE = 0.00159;
export const RENT_SOL_PER_LEAF = 0.00203;
export const RENT_SOL_PER_CAMPAIGN = 0.00451; // includes the escrow USDC ATA
export const TX_FEE_SOL = 0.000005;

export function stakeSol(level: 1 | 2 | 3 | 4): number {
  return level === 4 ? STAKE_SOL_LEAF : STAKE_SOL_BY_LEVEL[level];
}

export function rentSol(level: 1 | 2 | 3 | 4): number {
  return level === 4 ? RENT_SOL_PER_LEAF : RENT_SOL_PER_NODE;
}

/** Total SOL the wallet will see deducted: stake + rent + a single tx fee. */
export function totalCostSol(level: 1 | 2 | 3 | 4): number {
  return stakeSol(level) + rentSol(level) + TX_FEE_SOL;
}
