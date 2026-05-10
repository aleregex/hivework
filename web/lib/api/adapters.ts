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
    // Deadline isn't yet stored server-side; stub at one week.
    hoursLeft: 168,
    // No category column today; everything renders as "consumer".
    category: "consumer",
    hot: conversions > 5,
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
    // Per-leaf conversion counts aren't included in the campaign detail; the
    // SSE stream populates them at runtime once Tier 2 lands.
    conversions: 0,
    payoutUsdc: 0,
    refCode: l.refCode,
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
    // The api doesn't surface conversion_value_usdc per campaign yet (it lives
    // on-chain only). Default to a presentable demo price; replace once the
    // campaign payload exposes it.
    pricingUsdc: 24,
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
    closesInHours: row.status === "claimable" ? -1 : 168,
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
  const enriched: MyLeafEnriched[] = [];
  for (const l of myLeaves) {
    const hook = nodeById.get(l.path[0]);
    const audio = nodeById.get(l.path[1]);
    const visual = nodeById.get(l.path[2]);
    if (!hook || !audio || !visual) continue;
    const path: TreeNode[] = [hook, audio, visual, adaptLeaf(l)];
    enriched.push({
      refCode: l.refCode,
      publishedAt: l.createdAt,
      contentUrl: l.contentUrl,
      // Per-leaf metrics aren't surfaced in /wallets/:address/portfolio yet.
      // Stays 0/0/0 until Tier 2 (SSE) feeds them in real time.
      clicks: 0,
      conversions: 0,
      earningsUsdc: 0,
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
