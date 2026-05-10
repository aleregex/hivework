// Mock view of "what does the connected wallet have inside this campaign"
// for the per-campaign Withdraw flow on /c/[id].
//
// Shape mirrors what we'll get from the on-chain program once Group A wires
// claim_payout / release_stake — every Node / Leaf PDA where
// `creator == connected_pubkey` AND `campaign == campaign_id`, plus their
// accrued payout balance and stake-release status.
//
// For the hackathon demo we hardcode that the connected wallet *is*
// `sofia.creates` for `cmp_halo_cola` (the path h1 → a1 → v1 → l1, which is
// the highest-converting path in MOCK_TREE). That gives a satisfying
// withdrawal demo: 4 nodes, $33 earned, 1.85 SOL staked.

import { MOCK_CAMPAIGNS } from "./campaigns";
import { MOCK_TREE, type NodeLevel } from "./tree";

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

/**
 * Demo override: which nodeIds in each campaign tree belong to "me".
 * In real life this is `Leaf.creator == publicKey` from the on-chain index.
 * The set is chosen so the demo shows a realistic mix:
 *   - cmp_halo_cola: a full converting path (h1 → a1 → v1 → l1)
 *   - cmp_andean_token: empty (we don't have its tree mocked)
 */
const MY_NODE_IDS_BY_CAMPAIGN: Record<string, string[]> = {
  cmp_halo_cola: ["h1", "a1", "v1", "l1"],
};

function deriveStakeStatus(
  campaignClosed: boolean,
  conversionsInSubtree: number
): StakeStatus {
  if (!campaignClosed) return "locked";
  return conversionsInSubtree > 0 ? "releasable" : "forfeit";
}

/** Sum of conversions in a node's subtree (including the node itself). */
function subtreeConversions(rootId: string): number {
  const start = MOCK_TREE.find((n) => n.id === rootId);
  if (!start) return 0;
  const stack = [start];
  let total = 0;
  while (stack.length) {
    const cur = stack.pop()!;
    total += cur.conversions;
    for (const c of MOCK_TREE.filter((n) => n.parentId === cur.id)) {
      stack.push(c);
    }
  }
  return total;
}

/**
 * Build the wallet's view of this campaign. Returns null if the wallet
 * doesn't own anything here (the caller should hide the panel in that case).
 *
 * For now `campaignClosed` defaults to false; once TreeView exposes its
 * close-and-distribute mode globally this can flip — but for the demo the
 * Withdraw modal already shows "claimable when campaign closes" copy that
 * makes the active state honest.
 */
export function getMyEarningsForCampaign(
  campaignId: string,
  opts: { campaignClosed?: boolean } = {}
): MyCampaignEarnings | null {
  const campaign = MOCK_CAMPAIGNS.find((c) => c.id === campaignId);
  if (!campaign) return null;

  const myNodeIds = MY_NODE_IDS_BY_CAMPAIGN[campaignId] ?? [];
  if (myNodeIds.length === 0) return null;

  const owned = MOCK_TREE.filter((n) => myNodeIds.includes(n.id));
  if (owned.length === 0) return null;

  const campaignClosed = opts.campaignClosed ?? false;

  const contributions: MyContribution[] = owned.map((n) => {
    const subConv = subtreeConversions(n.id);
    return {
      nodeId: n.id,
      level: n.level,
      title: n.title,
      stakeSol: n.stakeSol,
      payoutUsdc: n.payoutUsdc,
      conversions: subConv,
      stakeStatus: deriveStakeStatus(campaignClosed, subConv),
    };
  });

  const pendingUsdc = contributions.reduce((s, c) => s + c.payoutUsdc, 0);
  const claimableUsdc = campaignClosed ? pendingUsdc : 0;
  const stakeSol = contributions.reduce((s, c) => s + c.stakeSol, 0);
  const releasableStakeSol = contributions
    .filter((c) => c.stakeStatus === "releasable")
    .reduce((s, c) => s + c.stakeSol, 0);
  const forfeitStakeSol = contributions
    .filter((c) => c.stakeStatus === "forfeit")
    .reduce((s, c) => s + c.stakeSol, 0);

  return {
    campaignId,
    brand: campaign.brand,
    campaignStatus: campaignClosed ? "closed" : "active",
    closesInHours: campaign.hoursLeft,
    pendingUsdc,
    claimableUsdc,
    stakeSol,
    releasableStakeSol,
    forfeitStakeSol,
    contributions,
  };
}
