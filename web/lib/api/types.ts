// Wire types for Group B's HTTP api. Mirrors the Zod schemas in api/src/schemas.
// Keep this file in sync with api/FRONTEND.md whenever the api shape changes.

export type ApiNodeLevel = "L1" | "L2" | "L3";
export type ApiPlatform = "tiktok" | "instagram" | "x" | "youtube" | "other";
export type ApiCampaignStatus = "draft" | "active" | "closed";
export type ApiDraftStatus = "draft" | "finalized";

export type ApiCampaignSummary = {
  id: string;
  onchainPda: string | null;
  status: ApiCampaignStatus;
  brand: { name: string; logoUrl: string | null };
  product: { name: string; imageUrl: string | null; description: string };
  redirectUrl: string;
  creatorWallet: string;
  poolUsdc: string;
  /** ISO 8601 timestamp when the campaign closes. Null for legacy rows. */
  deadline: string | null;
  createdAt: string;
  stats: {
    nodeCount: number;
    leafCount: number;
    clickCount: number;
    conversionsCount: number;
  };
};

export type ApiNode = {
  id: string;
  onchainPda: string | null;
  campaignId: string;
  level: ApiNodeLevel;
  parentNodeId: string | null;
  creatorWallet: string;
  title: string;
  description: string;
  examples: unknown | null;
  tags: string[];
  mediaUrls: string[];
  stakeSol: string;
  forkCount: number;
  conversionsCount: number;
  status: ApiDraftStatus;
  createdAt: string;
};

export type ApiLeaf = {
  id: string;
  onchainPda: string | null;
  campaignId: string;
  path: [string, string, string];
  creatorWallet: string;
  refCode: string;
  contentUrl: string | null;
  platform: ApiPlatform;
  stakeSol: string;
  status: ApiDraftStatus;
  createdAt: string;
};

export type ApiPaginated<T> = {
  items: T[];
  meta: { limit: number; offset: number; total: number };
};

export type ApiCampaignDetail = {
  campaign: ApiCampaignSummary;
  nodes: ApiNode[];
  leaves: ApiLeaf[];
};

export type ApiLeafByRef = {
  leaf: ApiLeaf;
  campaign: ApiCampaignSummary;
  path: [ApiNode, ApiNode, ApiNode];
};

export type ApiCampaignConversion = {
  pendingConversionId: string;
  conversionIdSeed: string;
  leafPda: string;
  nodeL1Pda: string;
  nodeL2Pda: string;
  nodeL3Pda: string;
  valueUsdc: string;
  status: "pushed_to_chain" | "verified";
  pushedTxSig: string | null;
};

export type ApiCampaignConversionsResponse = {
  campaignOnchainPda: string | null;
  conversions: ApiCampaignConversion[];
};

export type ApiPortfolioPendingBreakdownRow = {
  contributionId: string;
  kind: "node" | "leaf";
  pendingUsdc: string;
};

export type ApiPortfolioPendingRow = {
  campaignId: string;
  campaignOnchainPda: string | null;
  campaignName: string;
  brandName: string;
  contributingNodes: number;
  pendingUsdc: string;
  status: "active" | "claimable";
  breakdown: ApiPortfolioPendingBreakdownRow[];
};

export type ApiPortfolioClaimRow = {
  campaignId: string;
  campaignName: string;
  amountUsdc: string;
  claimedAt: string;
  txSignature: string;
};

export type ApiPortfolio = {
  wallet: string;
  nodes: ApiNode[];
  leaves: ApiLeaf[];
  stakedSol: string;
  pendingPayoutsUsdc: string;
  pendingByCampaign: ApiPortfolioPendingRow[];
  claimHistory: ApiPortfolioClaimRow[];
  lifetimeClaimedUsdc: string;
};
