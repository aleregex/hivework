// Mock tree data for /c/[id] until Group B exposes /api/campaigns/:id/tree.
// Shape: flat list of nodes + parent pointer. Easy to feed into react-force-graph.

export type NodeAuthor = "human" | "agent";
export type NodeLevel = 0 | 1 | 2 | 3 | 4; // 0=campaign root, 1-3=node levels, 4=leaf

export type TreeNode = {
  id: string;
  level: NodeLevel;
  parentId: string | null;
  title: string;
  description: string;
  author: NodeAuthor;
  authorHandle: string;
  stakeSol: number;
  forks: number;
  conversions: number;
  payoutUsdc: number;
  refCode?: string; // only for leaves
};

// Campaign: Halo Cola — fictional global cola brand. The example is intentionally
// generic so any LATAM or English-speaking audience instantly understands the
// marketing context (vs a niche local product).
//
// Tree shape:
//   root → 2 hooks → 3 audios → 3 visuals → 3 leaves
const root: TreeNode = {
  id: "root",
  level: 0,
  parentId: null,
  title: "Halo Cola · Original Recipe 12-pack",
  description:
    "Globally distributed cola brand. $24/12-pack, ships in 30+ countries via shop.halocola.com.",
  author: "human",
  authorHandle: "halocola",
  stakeSol: 0,
  forks: 0,
  conversions: 58,
  payoutUsdc: 0,
};

const hooks: TreeNode[] = [
  {
    id: "h1",
    level: 1,
    parentId: "root",
    title: "First sip on a hot day",
    description:
      "Emotional opener: extreme close-up of someone cracking a cold can after a long workout. No words for the first 3s, just the can-crack and the gasp.",
    author: "human",
    authorHandle: "sofia.creates",
    stakeSol: 1.0,
    forks: 3,
    conversions: 19,
    payoutUsdc: 47.2,
  },
  {
    id: "h2",
    level: 1,
    parentId: "root",
    title: "Move over, big soda",
    description:
      "Challenger angle: side-by-side with the legacy cola brand, calling out artificial sweeteners and price hikes. Direct, irreverent.",
    author: "agent",
    authorHandle: "agent.cola.001",
    stakeSol: 1.0,
    forks: 5,
    conversions: 39,
    payoutUsdc: 96.8,
  },
];

const audios: TreeNode[] = [
  {
    id: "a1",
    level: 2,
    parentId: "h1",
    title: "Lo-fi beach instrumental",
    description:
      "Slow lo-fi loop, 80 BPM, ocean ambient layered in. Pairs with the heat-of-the-day visual. Royalty-free.",
    author: "human",
    authorHandle: "djmarina",
    stakeSol: 0.5,
    forks: 2,
    conversions: 14,
    payoutUsdc: 33.5,
  },
  {
    id: "a2",
    level: 2,
    parentId: "h1",
    title: "ASMR can crack + pour",
    description:
      "No music. Just an extreme-detail recording of the can opening, fizz, and pour over ice. 6 seconds.",
    author: "agent",
    authorHandle: "agent.audio.us",
    stakeSol: 0.5,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  },
  {
    id: "a3",
    level: 2,
    parentId: "h2",
    title: "Trending TikTok sound (BR)",
    description:
      "Top-3 trending sound on TikTok Brazil this week. Refresh weekly — high reach, short shelf life.",
    author: "human",
    authorHandle: "vale.br",
    stakeSol: 0.5,
    forks: 4,
    conversions: 25,
    payoutUsdc: 61.2,
  },
];

const visuals: TreeNode[] = [
  {
    id: "v1",
    level: 3,
    parentId: "a1",
    title: "Condensation on glass bottle",
    description:
      "Macro shot of cold beads of water rolling down a glass bottle. Soft golden-hour light. Heat-and-cold contrast.",
    author: "human",
    authorHandle: "fotor.studio",
    stakeSol: 0.25,
    forks: 1,
    conversions: 12,
    payoutUsdc: 27.4,
  },
  {
    id: "v2",
    level: 3,
    parentId: "a1",
    title: "Bottle vs can comparison",
    description:
      "Side-by-side of Halo Cola can next to the legacy brand can. Same size, same price, different ingredients list overlay.",
    author: "agent",
    authorHandle: "agent.visual.compare",
    stakeSol: 0.25,
    forks: 0,
    conversions: 2,
    payoutUsdc: 4.8,
  },
  {
    id: "v3",
    level: 3,
    parentId: "a3",
    title: "Friends on rooftop, sunset",
    description:
      "Group of friends laughing on a city rooftop at golden hour, passing cans around. Real people, no models.",
    author: "human",
    authorHandle: "documenta.us",
    stakeSol: 0.25,
    forks: 2,
    conversions: 25,
    payoutUsdc: 58.6,
  },
];

const leaves: TreeNode[] = [
  {
    id: "l1",
    level: 4,
    parentId: "v1",
    title: "@sofia.creates TikTok",
    description:
      "Reel posted 2026-05-07 on TikTok @sofia.creates, 18s, 5.2K views.",
    author: "human",
    authorHandle: "sofia.creates",
    stakeSol: 0.1,
    forks: 0,
    conversions: 12,
    payoutUsdc: 32.1,
    refCode: "ay7m9p",
  },
  {
    id: "l2",
    level: 4,
    parentId: "v2",
    title: "@agent.cola.001 Instagram reel",
    description: "Auto-generated reel, posted via Buffer, 14s, 1.4K views.",
    author: "agent",
    authorHandle: "agent.cola.001",
    stakeSol: 0.1,
    forks: 0,
    conversions: 2,
    payoutUsdc: 6.4,
    refCode: "bx3k1n",
  },
  {
    id: "l3",
    level: 4,
    parentId: "v3",
    title: "@marcelo.eats YouTube short",
    description:
      "Manually edited short, posted 2026-05-08, 22s, 14.3K views, picked up by US algorithm.",
    author: "human",
    authorHandle: "marcelo.eats",
    stakeSol: 0.1,
    forks: 0,
    conversions: 25,
    payoutUsdc: 72.4,
    refCode: "ck9q2r",
  },
];

export const MOCK_TREE: TreeNode[] = [
  root,
  ...hooks,
  ...audios,
  ...visuals,
  ...leaves,
];

export function getNodeById(id: string): TreeNode | undefined {
  return MOCK_TREE.find((n) => n.id === id);
}

export function getNodesByLevel(level: NodeLevel): TreeNode[] {
  return MOCK_TREE.filter((n) => n.level === level);
}

export function getChildren(parentId: string): TreeNode[] {
  return MOCK_TREE.filter((n) => n.parentId === parentId);
}

/**
 * Walk up from a leaf to the root, returning the genealogical path.
 * This mirrors what the smart contract does to compute payouts.
 */
export function getPath(leafId: string): TreeNode[] {
  const path: TreeNode[] = [];
  let current = getNodeById(leafId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getNodeById(current.parentId) : undefined;
  }
  return path;
}

export type GraphData = {
  nodes: TreeNode[];
  links: { source: string; target: string }[];
};

/**
 * Adapt the flat node list to the shape react-force-graph expects.
 * source/target use node ids; the lib resolves them to node refs internally.
 */
export function treeToGraph(nodes: TreeNode[] = MOCK_TREE): GraphData {
  return {
    nodes: nodes.map((n) => ({ ...n })),
    links: nodes
      .filter((n) => n.parentId !== null)
      .map((n) => ({ source: n.parentId as string, target: n.id })),
  };
}
