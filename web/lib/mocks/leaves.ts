// Mock leaf lookup by ref_code, used by the demo /buy/[ref_code] page until
// Group B's short-link service is up.

import { getNodeById, getPath, type TreeNode } from "./tree";
import { MOCK_CAMPAIGNS, type CampaignSummary } from "./campaigns";

export type LeafBuyContext = {
  leaf: TreeNode;
  campaign: CampaignSummary;
  path: TreeNode[]; // root → hook → audio → visual → leaf
  pricingUsdc: number;
};

const REF_CODE_TO_LEAF: Record<string, string> = {
  ay7m9p: "l1",
  bx3k1n: "l2",
  ck9q2r: "l3",
};

const PRICING_BY_CAMPAIGN: Record<string, number> = {
  cmp_chasqui_coffee: 19,
  cmp_andean_token: 25,
  cmp_hablalo_app: 49,
};

export function getLeafByRefCode(refCode: string): LeafBuyContext | null {
  const leafId = REF_CODE_TO_LEAF[refCode];
  if (!leafId) return null;

  const leaf = getNodeById(leafId);
  if (!leaf) return null;

  // For the demo all mock leaves belong to chasqui-coffee. In real impl this
  // mapping comes from the leaf's campaign_id field on-chain.
  const campaign = MOCK_CAMPAIGNS[0];
  const path = getPath(leafId);
  const pricingUsdc = PRICING_BY_CAMPAIGN[campaign.id] ?? 0;

  return { leaf, campaign, path, pricingUsdc };
}
