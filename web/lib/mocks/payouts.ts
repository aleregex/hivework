// Types used by /claim. Real data now comes from Group B's
// GET /wallets/:address/portfolio via lib/api/hooks.ts + the
// adaptPortfolio* helpers.

export type PendingPayout = {
  campaignId: string;
  campaignName: string;
  brandHandle: string;
  nodes: number; // how many nodes in this campaign generated payout for the user
  pendingUsdc: number;
  closesInHours: number; // negative if already closed
  status: "active" | "claimable" | "claimed";
};

export type ClaimedPayout = {
  campaignId: string;
  campaignName: string;
  amountUsdc: number;
  claimedAt: string;
  txSignature: string;
};

// Mock data commented out — replaced by usePortfolio() (Tier 3).
//
// export const MOCK_PENDING_PAYOUTS: PendingPayout[] = [
//   { campaignId: "cmp_halo_cola", ... },
//   { campaignId: "cmp_andean_token", ... },
// ];
//
// export const MOCK_CLAIMED_PAYOUTS: ClaimedPayout[] = [
//   { campaignId: "cmp_quinoa_runners", ... },
//   { campaignId: "cmp_qheswa_radio", ... },
// ];
//
// export const LIFETIME_TOTAL_USDC = 1283.9;
