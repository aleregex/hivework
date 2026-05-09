"use client";

import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { TreeGraph } from "./tree-graph";
import { NodeDetailPanel } from "./node-detail-panel";
import { TreeLegend } from "./tree-legend";
import { treeToGraph, type TreeNode } from "@/lib/mocks/tree";

const PULSE_MS = 1200;

export function TreeView({ initialNodes }: { initialNodes: TreeNode[] }) {
  // Local copy so we can simulate conversion bumps live during the demo.
  // Real impl swaps this for a useQuery against Group B's indexer (Task #6).
  const [nodes, setNodes] = useState<TreeNode[]>(initialNodes);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());

  const graph = useMemo(() => treeToGraph(nodes), [nodes]);

  // Walk up the path from a node and pulse every ancestor — that's exactly
  // what the smart contract pays out, and exactly what we want to *show*.
  const simulateConversion = useCallback(
    (nodeId: string) => {
      const path = new Set<string>();
      let cursor = nodes.find((n) => n.id === nodeId);
      while (cursor) {
        path.add(cursor.id);
        cursor = cursor.parentId
          ? nodes.find((n) => n.id === cursor!.parentId)
          : undefined;
      }

      // Bump conversion counters for the leaf and every ancestor.
      setNodes((prev) =>
        prev.map((n) =>
          path.has(n.id)
            ? {
                ...n,
                conversions: n.conversions + 1,
                payoutUsdc: n.payoutUsdc + 2.5,
              }
            : n
        )
      );

      // Pulse them, then clear the pulse after PULSE_MS.
      setPulsing((prev) => new Set([...prev, ...path]));
      window.setTimeout(() => {
        setPulsing((prev) => {
          const next = new Set(prev);
          path.forEach((id) => next.delete(id));
          return next;
        });
      }, PULSE_MS);
    },
    [nodes]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <Card className="overflow-hidden p-0">
          <TreeGraph
            data={graph}
            selectedNodeId={selected?.id ?? null}
            onSelect={setSelected}
            pulsingNodeIds={pulsing}
          />
        </Card>
        <TreeLegend />
      </div>

      {selected ? (
        <NodeDetailPanel
          node={selected}
          onClose={() => setSelected(null)}
          onSimulateConversion={simulateConversion}
        />
      ) : (
        <aside className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-wax bg-comb/40 p-6 text-center text-xs text-muted">
          <p>Click any node to see its details, payout, and ref-link.</p>
          <p className="mt-2 text-[10px] uppercase tracking-wider">
            Tip · drag to pan · scroll to zoom
          </p>
        </aside>
      )}
    </div>
  );
}
