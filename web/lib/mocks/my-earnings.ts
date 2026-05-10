// Types used by the per-campaign Withdraw flow on /c/[id]. Real data now
// comes from Group B's GET /wallets/:address/portfolio + GET /campaigns/:id
// via lib/api/hooks.ts + adaptMyEarningsForCampaign.

import type { NodeLevel } from "./tree";

/**
 * Stake lifecycle, matching the contract:
 *   locked     — campaign is live, stake can't be moved.
 *   releasable — campaign closed AND this node (or any descendant) had ≥1
 *                conversion → original creator can withdraw.
 *   forfeit    — campaign closed AND 0 conversions in the subtree → stake
 *                redistributed to successful paths per campaign config.
 */
export type StakeStatus = "locked" | "releasable" | "forfeit";

export type MyContribution = {
  nodeId: string;
  level: NodeLevel;
  title: string;
  stakeSol: number;
  payoutUsdc: number;
  conversions: number; // direct + descendant
  stakeStatus: StakeStatus;
};

export type MyCampaignEarnings = {
  campaignId: string;
  brand: string;
  /** "active" while the campaign is live; "closed" after close_and_distribute. */
  campaignStatus: "active" | "closed";
  closesInHours: number; // negative if closed
  /** Total accrued USDC across all owned nodes/leaves. */
  pendingUsdc: number;
  /**
   * USDC actually withdrawable right now. For demo we mirror the /claim page
   * convention: only after the campaign is closed.
   */
  claimableUsdc: number;
  /** Total SOL the wallet put down across all owned nodes. */
  stakeSol: number;
  releasableStakeSol: number;
  forfeitStakeSol: number;
  contributions: MyContribution[];
};

// Mock implementation commented out — replaced by adaptMyEarningsForCampaign()
// (consumed by your-earnings-strip.tsx via usePortfolio + useCampaign).
//
// const MY_NODE_IDS_BY_CAMPAIGN: Record<string, string[]> = {
//   cmp_halo_cola: ["h1", "a1", "v1", "l1"],
// };
//
// function deriveStakeStatus(
//   campaignClosed: boolean,
//   conversionsInSubtree: number
// ): StakeStatus {
//   if (!campaignClosed) return "locked";
//   return conversionsInSubtree > 0 ? "releasable" : "forfeit";
// }
//
// function subtreeConversions(rootId: string): number { ... }
//
// export function getMyEarningsForCampaign(
//   campaignId: string,
//   opts: { campaignClosed?: boolean } = {}
// ): MyCampaignEarnings | null { ... }
