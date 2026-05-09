// Mock payouts owed to the connected wallet. Real data comes from the on-chain
// program (per-wallet PDA balances) read via Anchor in Task #6.

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

export const MOCK_PENDING_PAYOUTS: PendingPayout[] = [
  {
    campaignId: "cmp_chasqui_coffee",
    campaignName: "Chasqui Coffee",
    brandHandle: "chasqui",
    nodes: 3,
    pendingUsdc: 38.4,
    closesInHours: 142,
    status: "active",
  },
  {
    campaignId: "cmp_andean_token",
    campaignName: "Andean DAO genesis mint",
    brandHandle: "andean",
    nodes: 2,
    pendingUsdc: 218.5,
    closesInHours: -2, // already closed, claimable
    status: "claimable",
  },
];

export const MOCK_CLAIMED_PAYOUTS: ClaimedPayout[] = [
  {
    campaignId: "cmp_quinoa_runners",
    campaignName: "Quinoa Runners shoe drop",
    amountUsdc: 47.2,
    claimedAt: "2026-04-18T14:22:00Z",
    txSignature:
      "5xK2mP3qN8rT9wY1aZbCdEfG7hJiKlMnOpQrStUvWxYz1aBcDeFgHiJkLmNoPqRsTuVw",
  },
  {
    campaignId: "cmp_qheswa_radio",
    campaignName: "Qheswa Radio launch",
    amountUsdc: 89.6,
    claimedAt: "2026-04-02T09:15:00Z",
    txSignature:
      "3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6aB7cD8eF9gH0iJ1kL2mN3oP4qR5s",
  },
];

export const LIFETIME_TOTAL_USDC = 1283.9;
