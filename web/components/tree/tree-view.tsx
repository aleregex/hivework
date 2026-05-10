"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TreeGraph } from "./tree-graph";
import { NodeDetailPanel } from "./node-detail-panel";
import { TreeLegend } from "./tree-legend";
import { CascadeSummary } from "./cascade-summary";
import { DemoControlPanel } from "./demo-control-panel";
import { treeToGraph, type TreeNode } from "@/lib/mocks/tree";

const PULSE_MS = 1200;
// Total time the cascade animation plays before the summary card slides in.
// Tuned so a presenter can describe what's happening without rushing the eye.
const CASCADE_MS = 4500;

type Mode = "live" | "cascading" | "closed";

// Pool of agent-authored decisions we drip into the tree as the presenter
// clicks "AI agent spawns a node" during the demo. Picked to look plausible
// for the Halo Cola campaign and to bias toward different levels so the tree
// grows in interesting directions.
const AGENT_NODE_POOL: Array<Omit<TreeNode, "id">> = [
  {
    level: 1,
    parentId: "root",
    title: "Hot day, cold can — agent variant",
    description:
      "Agent-generated A/B variant of the heat-of-the-day hook, optimized for engagement on US morning slots based on prior campaigns.",
    author: "agent",
    authorHandle: "agent.cola.001",
    stakeSol: 1.0,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  },
  {
    level: 2,
    parentId: "h2",
    title: "Stadium crowd ambient",
    description:
      "Big-event crowd ambient sound layered under a single voice. Generated with ElevenLabs + curated by agent.",
    author: "agent",
    authorHandle: "agent.cola.001",
    stakeSol: 0.5,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  },
  {
    level: 3,
    parentId: "a3",
    title: "Slow-mo can crack, golden hour",
    description:
      "240fps slow motion of the can opening, intercut with golden hour skyline. Stylized, aspirational.",
    author: "agent",
    authorHandle: "agent.cola.001",
    stakeSol: 0.25,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  },
];

// Pool of leaves we add when the presenter clicks "Publish leaf as @teammate".
// Each one composes an existing path; the demo uses the first one.
const TEAMMATE_LEAF_POOL: Array<Omit<TreeNode, "id">> = [
  {
    level: 4,
    parentId: "v3",
    title: "@teammate.live IG reel",
    description:
      "Live-published during the hackathon demo — shot vertically, 11s, posted to a real Instagram for the audience to see the link.",
    author: "human",
    authorHandle: "teammate.live",
    stakeSol: 0.1,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
    refCode: "demo01",
  },
  {
    level: 4,
    parentId: "v1",
    title: "@teammate.live X post",
    description: "Quick X post with the link in the description.",
    author: "human",
    authorHandle: "teammate.live",
    stakeSol: 0.1,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
    refCode: "demo02",
  },
];

export function TreeView({ initialNodes }: { initialNodes: TreeNode[] }) {
  // Local copy so we can simulate conversion bumps live during the demo.
  // Real impl swaps this for a useQuery against Group B's indexer (Task #6).
  const [nodes, setNodes] = useState<TreeNode[]>(initialNodes);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("live");

  // Counters into the demo pools so successive clicks add different items.
  const agentIndex = useRef(0);
  const teammateIndex = useRef(0);

  const graph = useMemo(() => treeToGraph(nodes), [nodes]);

  /** Walk up parentId chain to compute the genealogical path (set of ids). */
  const pathFromNode = useCallback((nodeId: string, source: TreeNode[]) => {
    const path = new Set<string>();
    let cursor = source.find((n) => n.id === nodeId);
    while (cursor) {
      path.add(cursor.id);
      cursor = cursor.parentId
        ? source.find((n) => n.id === cursor!.parentId)
        : undefined;
    }
    return path;
  }, []);

  /** Pulse a set of node ids for PULSE_MS ms. */
  const pulseFor = useCallback((ids: Iterable<string>) => {
    setPulsing((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    const idsCopy = new Set(ids);
    window.setTimeout(() => {
      setPulsing((prev) => {
        const next = new Set(prev);
        idsCopy.forEach((id) => next.delete(id));
        return next;
      });
    }, PULSE_MS);
  }, []);

  /** Bump conversion + payout on every node in `path`. */
  const bumpConversionAlongPath = useCallback(
    (path: Set<string>, valueUsdc = 2.5) => {
      setNodes((prev) =>
        prev.map((n) =>
          path.has(n.id)
            ? {
                ...n,
                conversions: n.conversions + 1,
                payoutUsdc: n.payoutUsdc + valueUsdc,
              }
            : n
        )
      );
    },
    []
  );

  // ---- Public actions used by NodeDetailPanel + DemoControlPanel ----

  const simulateConversion = useCallback(
    (nodeId: string) => {
      const path = pathFromNode(nodeId, nodes);
      bumpConversionAlongPath(path);
      pulseFor(path);
    },
    [nodes, pathFromNode, bumpConversionAlongPath, pulseFor]
  );

  /** Pick a random leaf and fire one conversion through its full path. */
  const fireRandomConversion = useCallback(() => {
    const leaves = nodes.filter((n) => n.level === 4);
    if (leaves.length === 0) return;
    // Bias toward leaves that already converted so the highlighted paths grow.
    const pool = leaves.filter((l) => l.conversions > 0);
    const target = (pool.length > 0 ? pool : leaves)[
      Math.floor(
        Math.random() * (pool.length > 0 ? pool.length : leaves.length)
      )
    ];
    simulateConversion(target.id);
    toast.success(`+1 conversion`, {
      description: `${target.title} · path lit up`,
      duration: 1800,
    });
  }, [nodes, simulateConversion]);

  /** Spaced burst of N conversions hitting random leaves. */
  const fireConversionBurst = useCallback(
    (count: number) => {
      let i = 0;
      const tick = () => {
        if (i >= count) return;
        fireRandomConversion();
        i += 1;
        window.setTimeout(tick, 400);
      };
      tick();
    },
    [fireRandomConversion]
  );

  const spawnAgentNode = useCallback(() => {
    const template =
      AGENT_NODE_POOL[agentIndex.current % AGENT_NODE_POOL.length];
    agentIndex.current += 1;
    const newNode: TreeNode = {
      ...template,
      id: `agent_${Date.now()}_${agentIndex.current}`,
    };
    setNodes((prev) => [...prev, newNode]);
    pulseFor([newNode.id]);
    toast.success("AI agent created a node", {
      description: `@${newNode.authorHandle} · L${newNode.level} · ${newNode.title}`,
      duration: 2400,
    });
  }, [pulseFor]);

  const publishLeaf = useCallback(() => {
    const template =
      TEAMMATE_LEAF_POOL[teammateIndex.current % TEAMMATE_LEAF_POOL.length];
    teammateIndex.current += 1;
    const newLeaf: TreeNode = {
      ...template,
      id: `leaf_${Date.now()}_${teammateIndex.current}`,
    };
    setNodes((prev) => [...prev, newLeaf]);
    pulseFor([newLeaf.id]);
    toast.success("Leaf published", {
      description: `hivework.link/${newLeaf.refCode} · share in your bio`,
      duration: 2400,
    });
  }, [pulseFor]);

  // Trigger the close + distribute cascade. Runs the heavy animation, then
  // shows the summary. In the real flow this would be the on-chain
  // close_and_distribute tx; here we just play the visual.
  const triggerClose = useCallback(() => {
    setSelected(null);
    setMode("cascading");
    window.setTimeout(() => setMode("closed"), CASCADE_MS);
  }, []);

  const replay = useCallback(() => {
    setNodes(initialNodes);
    setMode("live");
    agentIndex.current = 0;
    teammateIndex.current = 0;
  }, [initialNodes]);

  const isCascading = mode === "cascading";
  const isClosed = mode === "closed";
  const demoDisabled = isCascading || isClosed;

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

      {/* Demo orchestration. Lives outside the grid so it floats over the page. */}
      <DemoControlPanel
        disabled={demoDisabled}
        onSpawnAgentNode={spawnAgentNode}
        onPublishLeaf={publishLeaf}
        onFireConversion={fireRandomConversion}
        onFireConversionBurst={fireConversionBurst}
        onClose={triggerClose}
        onReset={replay}
      />
    </div>
  );
}
