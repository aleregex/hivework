"use client";

import { useCallback, useMemo, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TreeGraph } from "./tree-graph";
import { NodeDetailPanel } from "./node-detail-panel";
import { TreeLegend } from "./tree-legend";
import { CascadeSummary } from "./cascade-summary";
import { treeToGraph, type TreeNode } from "@/lib/mocks/tree";

const PULSE_MS = 1200;
// Total time the cascade animation plays before the summary card slides in.
// Tuned so a presenter can describe what's happening without rushing the eye.
const CASCADE_MS = 4500;

type Mode = "live" | "cascading" | "closed";

export function TreeView({ initialNodes }: { initialNodes: TreeNode[] }) {
  // Local copy so we can simulate conversion bumps live during the demo.
  // Real impl swaps this for a useQuery against Group B's indexer (Task #6).
  const [nodes, setNodes] = useState<TreeNode[]>(initialNodes);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("live");

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

  // Trigger the close + distribute cascade. Runs the heavy animation, then
  // shows the summary. In the real flow this would be the on-chain
  // close_and_distribute tx; here we just play the visual.
  const triggerClose = useCallback(() => {
    setSelected(null);
    setMode("cascading");
    // After the cascade plays, lock into the closed state and reveal summary.
    window.setTimeout(() => setMode("closed"), CASCADE_MS);
  }, []);

  const replay = useCallback(() => {
    setNodes(initialNodes);
    setMode("live");
  }, [initialNodes]);

  const isCascading = mode === "cascading";
  const isClosed = mode === "closed";

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted">
          {mode === "live" &&
            "Live · click any node to inspect, drag to pan, scroll to zoom."}
          {mode === "cascading" && (
            <span className="inline-flex items-center gap-2 text-honey">
              <Loader2 className="h-3 w-3 animate-spin" />
              Distributing payouts on-chain… every contributor in every path is
              being paid proportionally.
            </span>
          )}
          {mode === "closed" &&
            "Closed · pool fully distributed. Replay the cascade to demo it again."}
        </div>
        {mode === "live" && (
          <Button
            variant="sting"
            size="sm"
            onClick={triggerClose}
            title="Trigger the close + distribute cascade"
          >
            <Coins className="h-4 w-4" />
            Close &amp; distribute (demo)
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <Card className="overflow-hidden p-0">
            <TreeGraph
              data={graph}
              selectedNodeId={selected?.id ?? null}
              onSelect={isCascading || isClosed ? () => {} : setSelected}
              pulsingNodeIds={pulsing}
              cascadeMode={isCascading || isClosed}
            />
          </Card>
          <TreeLegend />
        </div>

        {/* Side column swaps content per mode. */}
        <div className="flex h-full flex-col">
          {mode === "live" &&
            (selected ? (
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
            ))}

          {mode === "cascading" && (
            <aside className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-honey/40 bg-honey/5 p-6 text-center">
              <div className="flex items-center gap-2 text-honey">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">
                  close_and_distribute() running
                </span>
              </div>
              <p className="text-xs text-muted">
                The contract walks every conversion path, computes node weights
                with α/β/γ, and batches the USDC transfers. Watch the tree light
                up.
              </p>
              <code className="rounded bg-bg2 px-2 py-1 font-mono text-[10px] text-foreground/70">
                cluster: devnet · slot: pending
              </code>
            </aside>
          )}

          {isClosed && <CascadeSummary nodes={nodes} onReset={replay} />}
        </div>
      </div>
    </div>
  );
}
