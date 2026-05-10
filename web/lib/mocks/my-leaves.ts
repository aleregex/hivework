// Mocks for "leaves owned by the connected wallet" inside a single campaign.
// In real impl this comes from indexing the on-chain Leaf accounts where
// `creator == connected_pubkey` AND `campaign == campaign_id`.
//
// Two sets exist: an empty one (used to demo the "no leaves yet" state when
// the user has just connected) and a populated one (used after the influencer
// runs through the publish-leaf flow during the demo).

import type { TreeNode } from "./tree";
import { getNodeById, getPath } from "./tree";

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

export const MY_LEAVES_BY_CAMPAIGN: Record<string, MyLeaf[]> = {
  cmp_halo_cola: [
    {
      refCode: "ay7m9p",
      publishedAt: "2026-05-07T18:14:00Z",
      contentUrl: "https://www.tiktok.com/@you/video/7240392021",
      clicks: 412,
      conversions: 12,
      earningsUsdc: 32.1,
      hookId: "h1",
      audioId: "a1",
      visualId: "v1",
    },
  ],
  cmp_andean_token: [
    {
      refCode: "zk4m2x",
      publishedAt: "2026-05-08T11:02:00Z",
      contentUrl: null,
      clicks: 86,
      conversions: 3,
      earningsUsdc: 18.7,
      // these are placeholder ids — real version resolves the path on publish
      hookId: "h1",
      audioId: "a3",
      visualId: "v3",
    },
  ],
  cmp_hablalo_app: [],
};

export function getMyLeavesForCampaign(
  campaignId: string
): MyLeafEnriched[] {
  const leaves = MY_LEAVES_BY_CAMPAIGN[campaignId] ?? [];
  return leaves
    .map((l): MyLeafEnriched | null => {
      const hook = getNodeById(l.hookId);
      const audio = getNodeById(l.audioId);
      const visual = getNodeById(l.visualId);
      if (!hook || !audio || !visual) return null;
      // We use the visual node's id to derive the path; in a real leaf the
      // path is the leaf itself but for the mock we approximate it.
      const path = getPath(visual.id);
      return { ...l, hook, audio, visual, path };
    })
    .filter((x): x is MyLeafEnriched => x !== null);
}

export function summarizeMyLeaves(leaves: MyLeafEnriched[]) {
  return {
    count: leaves.length,
    clicks: leaves.reduce((s, l) => s + l.clicks, 0),
    conversions: leaves.reduce((s, l) => s + l.conversions, 0),
    earningsUsdc: leaves.reduce((s, l) => s + l.earningsUsdc, 0),
  };
}
