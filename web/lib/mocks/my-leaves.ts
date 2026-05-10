// Types used by the "My posts" panel inside the campaign tree. Real data
// now comes from Group B via lib/api/hooks.ts (usePortfolio + useCampaign)
// + adaptMyLeavesForCampaign.

import type { TreeNode } from "./tree";

export type MyLeaf = {
  refCode: string;
  publishedAt: string; // iso
  contentUrl: string | null; // null while content is pending
  clicks: number;
  conversions: number;
  earningsUsdc: number;
  // Snapshot of the path at publish time so we can show the chain in the UI.
  hookId: string;
  audioId: string;
  visualId: string;
};

export type MyLeafEnriched = MyLeaf & {
  hook: TreeNode;
  audio: TreeNode;
  visual: TreeNode;
  path: TreeNode[];
};

/** Pure aggregator — kept because it's used by the panel and is data-source agnostic. */
export function summarizeMyLeaves(leaves: MyLeafEnriched[]) {
  return {
    count: leaves.length,
    clicks: leaves.reduce((s, l) => s + l.clicks, 0),
    conversions: leaves.reduce((s, l) => s + l.conversions, 0),
    earningsUsdc: leaves.reduce((s, l) => s + l.earningsUsdc, 0),
  };
}

// Mock data commented out — replaced by adaptMyLeavesForCampaign() (Tier 3).
//
// export const MY_LEAVES_BY_CAMPAIGN: Record<string, MyLeaf[]> = {
//   cmp_halo_cola: [ { ... } ],
//   cmp_andean_token: [ { ... } ],
//   cmp_hablalo_app: [],
// };
//
// export function getMyLeavesForCampaign(campaignId: string): MyLeafEnriched[] {
//   const leaves = MY_LEAVES_BY_CAMPAIGN[campaignId] ?? [];
//   return leaves.map((l): MyLeafEnriched | null => {
//     const hook = getNodeById(l.hookId);
//     const audio = getNodeById(l.audioId);
//     const visual = getNodeById(l.visualId);
//     if (!hook || !audio || !visual) return null;
//     const path = getPath(visual.id);
//     return { ...l, hook, audio, visual, path };
//   }).filter((x): x is MyLeafEnriched => x !== null);
// }
