// Types used across the tree view. Real data now comes from Group B's
// GET /campaigns/:id via lib/api/hooks.ts + adaptTree.
//
// The flat `[root, ...nodes, ...leaves]` shape is preserved so the existing
// react-force-graph wiring is unchanged.

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

export type GraphData = {
  nodes: TreeNode[];
  links: { source: string; target: string }[];
};

/**
 * Adapt the flat node list to the shape react-force-graph expects.
 * source/target use node ids; the lib resolves them to node refs internally.
 */
export function treeToGraph(nodes: TreeNode[]): GraphData {
  return {
    nodes: nodes.map((n) => ({ ...n })),
    links: nodes
      .filter((n) => n.parentId !== null)
      .map((n) => ({ source: n.parentId as string, target: n.id })),
  };
}

// All static mock data + helpers that closed over MOCK_TREE are commented out.
// Walk a path / look up by id locally inside each component now (the data lives
// in the prop / query result, not in a module-level constant).
//
// const root: TreeNode = { ... };
// const hooks: TreeNode[] = [ ... ];
// const audios: TreeNode[] = [ ... ];
// const visuals: TreeNode[] = [ ... ];
// const leaves: TreeNode[] = [ ... ];
//
// export const MOCK_TREE: TreeNode[] = [
//   root,
//   ...hooks,
//   ...audios,
//   ...visuals,
//   ...leaves,
// ];
//
// export function getNodeById(id: string): TreeNode | undefined {
//   return MOCK_TREE.find((n) => n.id === id);
// }
//
// export function getNodesByLevel(level: NodeLevel): TreeNode[] {
//   return MOCK_TREE.filter((n) => n.level === level);
// }
//
// export function getChildren(parentId: string): TreeNode[] {
//   return MOCK_TREE.filter((n) => n.parentId === parentId);
// }
//
// export function getPath(leafId: string): TreeNode[] {
//   const path: TreeNode[] = [];
//   let current = getNodeById(leafId);
//   while (current) {
//     path.unshift(current);
//     current = current.parentId ? getNodeById(current.parentId) : undefined;
//   }
//   return path;
// }
