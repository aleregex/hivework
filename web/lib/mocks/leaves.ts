// Type used by /buy/[refCode]. Real data now comes from Group B's
// GET /leaves/by-ref/:refCode via lib/api/hooks.ts + adaptLeafBuyContext.

import type { TreeNode } from "./tree";
import type { CampaignSummary } from "./campaigns";

export type LeafBuyContext = {
  leaf: TreeNode;
  campaign: CampaignSummary;
  path: TreeNode[]; // root → hook → audio → visual → leaf
  pricingUsdc: number;
};

// Mock lookup commented out — replaced by useLeafByRef() (Tier 3).
//
// const REF_CODE_TO_LEAF: Record<string, string> = {
//   ay7m9p: "l1",
//   bx3k1n: "l2",
//   ck9q2r: "l3",
// };
//
// const PRICING_BY_CAMPAIGN: Record<string, number> = {
//   cmp_halo_cola: 24,
//   cmp_andean_token: 25,
//   cmp_hablalo_app: 49,
// };
//
// export function getLeafByRefCode(refCode: string): LeafBuyContext | null {
//   const leafId = REF_CODE_TO_LEAF[refCode];
//   if (!leafId) return null;
//   const leaf = getNodeById(leafId);
//   if (!leaf) return null;
//   const campaign = MOCK_CAMPAIGNS[0];
//   const path = getPath(leafId);
//   const pricingUsdc = PRICING_BY_CAMPAIGN[campaign.id] ?? 0;
//   return { leaf, campaign, path, pricingUsdc };
// }
