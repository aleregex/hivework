// API → mock-shape adapters. The point of this file: components keep
// importing the same types from `@/lib/mocks/*` and rendering the same
// fields, but the data behind them now comes from Group B's api.
//
// Anything that the api can't (yet) tell us — payouts settled per node,
// per-leaf clicks/conversions, conversion price per campaign — gets a
// safe placeholder with a comment.

import type { CampaignSummary } from "@/lib/mocks/campaigns";
import type { TreeNode } from "@/lib/mocks/tree";
import type { LeafBuyContext } from "@/lib/mocks/leaves";
import type { MyLeafEnriched } from "@/lib/mocks/my-leaves";
import type {
  MyCampaignEarnings,
  MyContribution,
  StakeStatus,
} from "@/lib/mocks/my-earnings";
import type { ClaimedPayout, PendingPayout } from "@/lib/mocks/payouts";
import type {
  ApiCampaignDetail,
  ApiCampaignSummary,
  ApiLeaf,
  ApiLeafByRef,
  ApiNode,
  ApiPortfolio,
} from "./types";

// Pubkeys we know belong to the team's AI agent. Used to draw the "agent" badge
// in the tree. Keep in sync with COORDINATION.md § "Group B wallets".
const KNOWN_AGENT_WALLETS = new Set<string>([
  "EMwSrLzbFfU5PvcrnP1jkf2QJdeRJvEXoghTVpnM3Va4", // Apis
]);

function shortHandle(wallet: string): string {
  if (wallet.length < 8) return wallet.toLowerCase();
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`.toLowerCase();
}

function brandHandle(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

function authorType(wallet: string): "human" | "agent" {
  return KNOWN_AGENT_WALLETS.has(wallet) ? "agent" : "human";
}

function levelToNumber(level: "L1" | "L2" | "L3"): 1 | 2 | 3 {
  return level === "L1" ? 1 : level === "L2" ? 2 : 3;
}

// ---------- campaigns ----------

export function adaptCampaign(c: ApiCampaignSummary): CampaignSummary {
  const conversions = c.stats.conversionsCount;
  const hoursLeft = c.deadline
    ? Math.max(
        0,
        Math.floor((new Date(c.deadline).getTime() - Date.now()) / 3_600_000),
      )
    : 0;
  return {
    id: c.id,
    brand: c.brand.name,
    brandHandle: brandHandle(c.brand.name),
    product: c.product.description,
    poolUsdc: Number(c.poolUsdc),
    // The api can't compute spent USDC until the contract emits payout events.
    // Until then, surface 0 so progress bars render at 0%.
    spentUsdc: 0,
    conversions,
    nodes: c.stats.nodeCount,
    leaves: c.stats.leafCount,
    hoursLeft,
    // No category column today; everything renders as "consumer".
    category: "consumer",
    hot: conversions > 5,
    creatorWallet: c.creatorWallet,
  };
}

// ---------- tree ----------

export function adaptNode(n: ApiNode): TreeNode {
  return {
    id: n.id,
    level: levelToNumber(n.level),
    // L1 nodes have null parentNodeId server-side; map them under the
    // synthetic "root" sentinel that the tree component expects.
    parentId: n.parentNodeId ?? "root",
    title: n.title,
    description: n.description,
    author: authorType(n.creatorWallet),
    authorHandle: shortHandle(n.creatorWallet),
    stakeSol: Number(n.stakeSol),
    forks: n.forkCount,
    conversions: n.conversionsCount,
    // Per-node USDC accrual isn't computed off-chain yet (lives in the
    // wallet portfolio aggregate). Stays 0 in the tree view.
    payoutUsdc: 0,
    onchainPda: n.onchainPda,
  };
}

export function adaptLeaf(l: ApiLeaf): TreeNode {
  return {
    id: l.id,
    level: 4,
    parentId: l.path[2] ?? null,
    title: l.contentUrl ?? `Leaf ${l.refCode}`,
    description: l.contentUrl
      ? `Published on ${l.platform}`
      : "(content URL pending)",
    author: authorType(l.creatorWallet),
    authorHandle: shortHandle(l.creatorWallet),
    stakeSol: Number(l.stakeSol),
    forks: 0,
    conversions: l.conversionsCount,
    payoutUsdc: 0,
    refCode: l.refCode,
    onchainPda: l.onchainPda,
  };
}

export function adaptTree(detail: ApiCampaignDetail): TreeNode[] {
  const root: TreeNode = {
    id: "root",
    level: 0,
    parentId: null,
    title: detail.campaign.brand.name,
    description: detail.campaign.product.description,
    author: "human",
    authorHandle: brandHandle(detail.campaign.brand.name),
    stakeSol: 0,
    forks: 0,
    conversions: detail.campaign.stats.conversionsCount,
    payoutUsdc: 0,
  };
  return [
    root,
    ...detail.nodes.map(adaptNode),
    ...detail.leaves.map(adaptLeaf),
  ];
}

// ---------- buy page ----------

export function adaptLeafBuyContext(api: ApiLeafByRef): LeafBuyContext {
  const root: TreeNode = {
    id: "root",
    level: 0,
    parentId: null,
    title: api.campaign.brand.name,
    description: api.campaign.product.description,
    author: "human",
    authorHandle: brandHandle(api.campaign.brand.name),
    stakeSol: 0,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  };
  const path: TreeNode[] = [
    root,
    adaptNode(api.path[0]),
    adaptNode(api.path[1]),
    adaptNode(api.path[2]),
    adaptLeaf(api.leaf),
  ];
  return {
    leaf: path[path.length - 1],
    campaign: adaptCampaign(api.campaign),
    path,
    // Per-conversion payout the brand commits to distribute through the
    // cascade. Independent from the product price the buyer pays (that lives
    // in the buy page as a demo constant for now).
    conversionValueUsdc: Number(api.campaign.conversionValueUsdc),
  };
}

// ---------- portfolio (claim page + my-leaves panel) ----------

export function adaptPortfolioPending(p: ApiPortfolio): PendingPayout[] {
  return p.pendingByCampaign.map((row) => ({
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    brandHandle: brandHandle(row.brandName),
    nodes: row.contributingNodes,
    pendingUsdc: Number(row.pendingUsdc),
    // The portfolio row doesn't carry the campaign deadline. Showing -1 keeps
    // the claim page from rendering a misleading countdown when status is
    // 'active' — the deadline lives on the campaign detail endpoint.
    closesInHours: row.status === "claimable" ? -1 : 0,
    status: row.status,
  }));
}

export function adaptPortfolioClaimed(p: ApiPortfolio): ClaimedPayout[] {
  return p.claimHistory.map((row) => ({
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    amountUsdc: Number(row.amountUsdc),
    claimedAt: row.claimedAt,
    txSignature: row.txSignature,
  }));
}

export function adaptPortfolioLifetime(p: ApiPortfolio): number {
  return Number(p.lifetimeClaimedUsdc);
}

/**
 * Build the enriched "my leaves" rows the side panel needs. Requires the
 * campaign tree (to resolve hook/audio/visual titles for the path) on top of
 * the wallet portfolio.
 */
export function adaptMyLeavesForCampaign(
  portfolio: ApiPortfolio,
  campaignDetail: ApiCampaignDetail,
  campaignId: string
): MyLeafEnriched[] {
  const myLeaves = portfolio.leaves.filter(
    (l) => l.campaignId === campaignId && l.status === "finalized"
  );
  const nodeById = new Map<string, TreeNode>(
    campaignDetail.nodes.map((n) => [n.id, adaptNode(n)])
  );
  // Clicks + conversions live on the campaign detail leaves (aggregated server-
  // side). Earnings come from the portfolio's pending breakdown — the api ran
  // the cascade formula and credited each contribution id its share.
  const detailLeafById = new Map(
    campaignDetail.leaves.map((dl) => [dl.id, dl])
  );
  const pendingByContribId = new Map<string, number>();
  const campaignRow = portfolio.pendingByCampaign.find(
    (row) => row.campaignId === campaignId
  );
  for (const b of campaignRow?.breakdown ?? []) {
    pendingByContribId.set(b.contributionId, Number(b.pendingUsdc));
  }
  const enriched: MyLeafEnriched[] = [];
  for (const l of myLeaves) {
    const hook = nodeById.get(l.path[0]);
    const audio = nodeById.get(l.path[1]);
    const visual = nodeById.get(l.path[2]);
    if (!hook || !audio || !visual) continue;
    const detail = detailLeafById.get(l.id);
    const path: TreeNode[] = [hook, audio, visual, adaptLeaf(l)];
    enriched.push({
      refCode: l.refCode,
      publishedAt: l.createdAt,
      contentUrl: l.contentUrl,
      clicks: detail?.clicksCount ?? 0,
      conversions: detail?.conversionsCount ?? 0,
      earningsUsdc: pendingByContribId.get(l.id) ?? 0,
      hookId: hook.id,
      audioId: audio.id,
      visualId: visual.id,
      hook,
      audio,
      visual,
      path,
    });
  }
  return enriched;
}

/**
 * Per-campaign earnings panel ("Your earnings" strip on /c/[id]). Joins:
 *   - portfolio.pendingByCampaign[campaignId].breakdown — per-contribution USDC
 *   - portfolio.nodes / portfolio.leaves — what the wallet owns in this campaign
 *   - campaignDetail.nodes — to resolve titles + walk the subtree for stake status
 *
 * Stake status mirrors the on-chain release rule: locked while the campaign
 * is live; releasable after close iff the node (or any descendant) had ≥1
 * conversion; forfeit otherwise.
 */
export function adaptMyEarningsForCampaign(
  portfolio: ApiPortfolio,
  campaignDetail: ApiCampaignDetail,
  campaignId: string,
  opts: { campaignClosed?: boolean } = {}
): MyCampaignEarnings | null {
  if (campaignDetail.campaign.id !== campaignId) return null;

  const ownedNodes = portfolio.nodes.filter(
    (n) => n.campaignId === campaignId && n.status === "finalized"
  );
  const ownedLeaves = portfolio.leaves.filter(
    (l) => l.campaignId === campaignId && l.status === "finalized"
  );
  if (ownedNodes.length === 0 && ownedLeaves.length === 0) return null;

  // Precompute subtree conversion totals for every node in the campaign so
  // each contribution row can be derived in O(1). Walk children iteratively
  // — depths > 4 don't happen in this protocol, but the loop is bounded by
  // the campaign size anyway.
  const childrenByParent = new Map<string, ApiNode[]>();
  for (const n of campaignDetail.nodes) {
    const key = n.parentNodeId ?? "__root__";
    const arr = childrenByParent.get(key) ?? [];
    arr.push(n);
    childrenByParent.set(key, arr);
  }
  const subtreeConvByNodeId = new Map<string, number>();
  for (const root of campaignDetail.nodes) {
    if (subtreeConvByNodeId.has(root.id)) continue;
    // Collect all descendants (BFS) and sum.
    let total = 0;
    const stack: ApiNode[] = [root];
    while (stack.length) {
      const cur = stack.pop()!;
      total += cur.conversionsCount;
      const kids = childrenByParent.get(cur.id);
      if (kids) stack.push(...kids);
    }
    subtreeConvByNodeId.set(root.id, total);
  }

  // Pull pendingUsdc per contribution from the api breakdown.
  const campaignRow = portfolio.pendingByCampaign.find(
    (row) => row.campaignId === campaignId
  );
  const pendingByContribId = new Map<string, number>();
  for (const b of campaignRow?.breakdown ?? []) {
    pendingByContribId.set(b.contributionId, Number(b.pendingUsdc));
  }

  const campaignClosed =
    opts.campaignClosed ?? campaignDetail.campaign.status === "closed";

  const stakeStatusFor = (subtreeConv: number): StakeStatus => {
    if (!campaignClosed) return "locked";
    return subtreeConv > 0 ? "releasable" : "forfeit";
  };

  const contributions: MyContribution[] = [];
  for (const n of ownedNodes) {
    const subtreeConv = subtreeConvByNodeId.get(n.id) ?? n.conversionsCount;
    contributions.push({
      nodeId: n.id,
      level: n.level === "L1" ? 1 : n.level === "L2" ? 2 : 3,
      title: n.title,
      stakeSol: Number(n.stakeSol),
      payoutUsdc: pendingByContribId.get(n.id) ?? 0,
      conversions: subtreeConv,
      stakeStatus: stakeStatusFor(subtreeConv),
    });
  }
  for (const l of ownedLeaves) {
    // Leaves don't have descendants; their "subtree" is themselves. The api
    // doesn't surface per-leaf conversion counts yet, so subtreeConv is best
    // approximated by the breakdown presence (≥1 conversion ⇒ entry exists).
    const pending = pendingByContribId.get(l.id) ?? 0;
    const inferredConv = pending > 0 ? 1 : 0;
    contributions.push({
      nodeId: l.id,
      level: 4,
      title: l.contentUrl ?? `Leaf ${l.refCode}`,
      stakeSol: Number(l.stakeSol),
      payoutUsdc: pending,
      conversions: inferredConv,
      stakeStatus: stakeStatusFor(inferredConv),
    });
  }

  const pendingUsdc = contributions.reduce((s, c) => s + c.payoutUsdc, 0);
  const claimableUsdc = campaignClosed ? pendingUsdc : 0;
  const stakeSol = contributions.reduce((s, c) => s + c.stakeSol, 0);
  const releasableStakeSol = contributions
    .filter((c) => c.stakeStatus === "releasable")
    .reduce((s, c) => s + c.stakeSol, 0);
  const forfeitStakeSol = contributions
    .filter((c) => c.stakeStatus === "forfeit")
    .reduce((s, c) => s + c.stakeSol, 0);

  const hoursLeft = campaignDetail.campaign.deadline
    ? Math.max(
        0,
        Math.floor(
          (new Date(campaignDetail.campaign.deadline).getTime() - Date.now()) /
            3_600_000,
        ),
      )
    : 0;

  return {
    campaignId,
    brand: campaignDetail.campaign.brand.name,
    campaignStatus: campaignClosed ? "closed" : "active",
    closesInHours: campaignClosed ? -1 : hoursLeft,
    pendingUsdc,
    claimableUsdc,
    stakeSol,
    releasableStakeSol,
    forfeitStakeSol,
    contributions,
  };
}
