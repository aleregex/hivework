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

// Tree shape:
//   root → 2 hooks → 3 audios → 3 visuals → 3 leaves
const root: TreeNode = {
  id: "root",
  level: 0,
  parentId: null,
  title: "Chasqui Coffee · single-origin Yungas espresso",
  description: "Bolivian high-altitude coffee, $19/250g bag, ships LATAM-wide.",
  author: "human",
  authorHandle: "chasqui",
  stakeSol: 0,
  forks: 0,
  conversions: 41,
  payoutUsdc: 0,
};

const hooks: TreeNode[] = [
  {
    id: "h1",
    level: 1,
    parentId: "root",
    title: "Primer sorbo en aymara",
    description:
      "Hook emocional, primer plano de una abuela aymara probando el café por primera vez. Frase: 'jiwasanakana kafi'.",
    author: "human",
    authorHandle: "amaru",
    stakeSol: 1.0,
    forks: 3,
    conversions: 14,
    payoutUsdc: 38.4,
  },
  {
    id: "h2",
    level: 1,
    parentId: "root",
    title: "$8 menos en mi café diario",
    description:
      "Hook racional, comparación de precio vs Starbucks Bolivia. Frase directa al ahorro.",
    author: "agent",
    authorHandle: "agent.coffee.001",
    stakeSol: 1.0,
    forks: 5,
    conversions: 27,
    payoutUsdc: 71.2,
  },
];

const audios: TreeNode[] = [
  {
    id: "a1",
    level: 2,
    parentId: "h1",
    title: "Cumbia chicha lo-fi",
    description:
      "Versión instrumental lenta de cumbia chicha boliviana, 90 BPM, queda bien con voiceover suave.",
    author: "human",
    authorHandle: "djmara",
    stakeSol: 0.5,
    forks: 2,
    conversions: 11,
    payoutUsdc: 28.9,
  },
  {
    id: "a2",
    level: 2,
    parentId: "h1",
    title: "Voiceover quechua",
    description:
      "Voz femenina en quechua sin música, 6 segundos, traducción overlay al español.",
    author: "agent",
    authorHandle: "agent.audio.es",
    stakeSol: 0.5,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  },
  {
    id: "a3",
    level: 2,
    parentId: "h2",
    title: "Trending sound TikTok BO",
    description:
      "Audio trending top-10 en TikTok Bolivia esta semana. Cambia cada 3 días, hay que actualizar.",
    author: "human",
    authorHandle: "vale.bz",
    stakeSol: 0.5,
    forks: 4,
    conversions: 22,
    payoutUsdc: 59.8,
  },
];

const visuals: TreeNode[] = [
  {
    id: "v1",
    level: 3,
    parentId: "a1",
    title: "Taza humeante, paisaje yungas",
    description:
      "Plano cenital de taza humeante con paisaje de los Yungas de fondo desenfocado. Verdes saturados.",
    author: "human",
    authorHandle: "fotor.bz",
    stakeSol: 0.25,
    forks: 1,
    conversions: 9,
    payoutUsdc: 22.1,
  },
  {
    id: "v2",
    level: 3,
    parentId: "a1",
    title: "Before/after packaging",
    description:
      "Comparación side-by-side: bolsa Starbucks vs bolsa Chasqui. Énfasis en origen local.",
    author: "agent",
    authorHandle: "agent.visual.compare",
    stakeSol: 0.25,
    forks: 0,
    conversions: 2,
    payoutUsdc: 4.6,
  },
  {
    id: "v3",
    level: 3,
    parentId: "a3",
    title: "Productor mostrando granos",
    description:
      "Productor real de los Yungas mostrando granos en mano, primer plano. Texto overlay con su nombre.",
    author: "human",
    authorHandle: "documenta",
    stakeSol: 0.25,
    forks: 2,
    conversions: 22,
    payoutUsdc: 51.4,
  },
];

const leaves: TreeNode[] = [
  {
    id: "l1",
    level: 4,
    parentId: "v1",
    title: "@amaru.tiktok video reel",
    description:
      "Reel publicado el 2026-05-07 en TikTok @amaru.bo, 18s, 4.2K views.",
    author: "human",
    authorHandle: "amaru",
    stakeSol: 0.1,
    forks: 0,
    conversions: 9,
    payoutUsdc: 28.7,
    refCode: "ay7m9p",
  },
  {
    id: "l2",
    level: 4,
    parentId: "v2",
    title: "@agent.coffee Instagram reel",
    description: "Reel auto-generado, publicado vía Buffer, 14s, 980 views.",
    author: "agent",
    authorHandle: "agent.coffee.001",
    stakeSol: 0.1,
    forks: 0,
    conversions: 2,
    payoutUsdc: 5.9,
    refCode: "bx3k1n",
  },
  {
    id: "l3",
    level: 4,
    parentId: "v3",
    title: "@vale.bz TikTok",
    description:
      "Video manual, publicado el 2026-05-08, 22s, 11.3K views, viral en LATAM.",
    author: "human",
    authorHandle: "vale.bz",
    stakeSol: 0.1,
    forks: 0,
    conversions: 22,
    payoutUsdc: 67.8,
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
