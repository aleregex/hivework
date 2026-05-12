// Type used across the app. Real data now comes from Group B's
// GET /campaigns/active via lib/api/hooks.ts + adaptCampaign.

export type CampaignSummary = {
  id: string;
  brand: string;
  brandHandle: string;
  product: string;
  poolUsdc: number;
  spentUsdc: number;
  conversions: number;
  nodes: number;
  leaves: number;
  hoursLeft: number;
  category: "consumer" | "web3" | "saas" | "social";
  hot: boolean;
  creatorWallet: string;
};

// MOCK_CAMPAIGNS commented out — replaced by useCampaigns() hook (Tier 1).
// Kept here for reference / fallback during local dev without the api running.
//
// export const MOCK_CAMPAIGNS: CampaignSummary[] = [
//   {
//     id: "cmp_halo_cola",
//     brand: "Halo Cola",
//     brandHandle: "halocola",
//     product: "Original Recipe · 12-pack of 355ml cans",
//     poolUsdc: 800,
//     spentUsdc: 312,
//     conversions: 58,
//     nodes: 23,
//     leaves: 12,
//     hoursLeft: 142,
//     category: "consumer",
//     hot: true,
//   },
//   {
//     id: "cmp_andean_token",
//     brand: "Andean DAO",
//     brandHandle: "andean",
//     product: "Genesis mint · ANDN governance token",
//     poolUsdc: 5000,
//     spentUsdc: 2840,
//     conversions: 318,
//     nodes: 67,
//     leaves: 34,
//     hoursLeft: 64,
//     category: "web3",
//     hot: true,
//   },
//   {
//     id: "cmp_hablalo_app",
//     brand: "Háblalo",
//     brandHandle: "hablalo",
//     product: "Premium subscription · 12 months",
//     poolUsdc: 1200,
//     spentUsdc: 410,
//     conversions: 87,
//     nodes: 31,
//     leaves: 18,
//     hoursLeft: 218,
//     category: "saas",
//     hot: false,
//   },
// ];
