"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Bot, Coins, Loader2, Network, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TreeGraph } from "./tree-graph";
import { NodeDetailPanel } from "./node-detail-panel";
import { TreeLegend } from "./tree-legend";
import { CascadeSummary } from "./cascade-summary";
import { DemoControlPanel } from "./demo-control-panel";
import {
  PublishFlowPanel,
  type PublishState,
  type PublishStep,
} from "./publish-flow-panel";
import { AgentChatPanel, type PathSuggestion } from "./agent-chat-panel";
import { MyLeavesPanel } from "./my-leaves-panel";
import { AddNodeDialog } from "./add-node-dialog";
import { useDemoMode } from "./use-demo-mode";
import { treeToGraph, type TreeNode } from "@/lib/mocks/tree";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { useHiveworkProgram } from "@/lib/anchor/program";
import { createLeafOnchain } from "@/lib/anchor/tx";
import { postLeafDraft, postLeafFinalize } from "@/lib/api/hooks";

const PULSE_MS = 1200;
const CASCADE_MS = 4500;

type Mode = "live" | "cascading" | "closed";
type PanelTab = "inspect" | "publish" | "agent" | "my-leaves";

const TAB_DEFS: Array<{
  id: PanelTab;
  label: string;
  icon: typeof Network;
}> = [
  { id: "inspect", label: "Inspect", icon: Network },
  { id: "publish", label: "Publish", icon: Sparkles },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "my-leaves", label: "My posts", icon: Wallet },
];

// Demo pools (unchanged from previous version — these power the pitch script)
const AGENT_NODE_POOL: Array<Omit<TreeNode, "id">> = [
  {
    level: 1,
    parentId: "root",
    title: "Hot day, cold can — agent variant",
    description:
      "Agent-generated A/B variant of the heat-of-the-day hook, optimized for engagement on US morning slots based on prior campaigns.",
    author: "agent",
    authorHandle: "agent.cola.001",
    stakeSol: 0.01,
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
    stakeSol: 0.005,
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
    stakeSol: 0.0025,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
  },
];

const TEAMMATE_LEAF_POOL: Array<Omit<TreeNode, "id">> = [
  {
    level: 4,
    parentId: "v3",
    title: "@teammate.live IG reel",
    description:
      "Live-published during the hackathon demo — shot vertically, 11s, posted to a real Instagram for the audience to see the link.",
    author: "human",
    authorHandle: "teammate.live",
    stakeSol: 0.001,
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
    stakeSol: 0.001,
    forks: 0,
    conversions: 0,
    payoutUsdc: 0,
    refCode: "demo02",
  },
];

const EMPTY_PUBLISH: PublishState = {
  hookId: null,
  audioId: null,
  visualId: null,
  refCode: null,
};

type Props = {
  initialNodes: TreeNode[];
  campaignId: string;
  /** On-chain PDA of the campaign. Null while it's still in `draft`. */
  campaignOnchainPda: string | null;
};

export function TreeView({
  initialNodes,
  campaignId,
  campaignOnchainPda,
}: Props) {
  const [nodes, setNodes] = useState<TreeNode[]>(initialNodes);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("live");
  const [tab, setTab] = useState<PanelTab>("inspect");
  const [publish, setPublish] = useState<PublishState>(EMPTY_PUBLISH);
  // AddNodeDialog state. parent === undefined means closed.
  const [addUnder, setAddUnder] = useState<TreeNode | null | undefined>(
    undefined
  );
  const demoMode = useDemoMode();
  const program = useHiveworkProgram();
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();

  const agentIndex = useRef(0);
  const teammateIndex = useRef(0);

  const graph = useMemo(() => treeToGraph(nodes), [nodes]);

  /* ---------- helpers (unchanged from previous version) ---------- */

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

  const simulateConversion = useCallback(
    (nodeId: string) => {
      const path = pathFromNode(nodeId, nodes);
      bumpConversionAlongPath(path);
      pulseFor(path);
    },
    [nodes, pathFromNode, bumpConversionAlongPath, pulseFor]
  );

  // Demo affordance: light up every node in the path from this node up to the
  // root, without bumping any counters. Lets a presenter say "if this node
  // converts, *these* are the people that get paid" without faking data.
  const highlightPath = useCallback(
    (nodeId: string) => {
      pulseFor(pathFromNode(nodeId, nodes));
    },
    [nodes, pathFromNode, pulseFor]
  );

  const fireRandomConversion = useCallback(() => {
    const leaves = nodes.filter((n) => n.level === 4);
    if (leaves.length === 0) return;
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

  const publishLeafFromDemoPool = useCallback(() => {
    const template =
      TEAMMATE_LEAF_POOL[teammateIndex.current % TEAMMATE_LEAF_POOL.length];
    teammateIndex.current += 1;
    const newLeaf: TreeNode = {
      ...template,
      id: `leaf_${Date.now()}_${teammateIndex.current}`,
    };
    setNodes((prev) => [...prev, newLeaf]);
    pulseFor([newLeaf.id]);
    toast.success("Post published", {
      description: `hivework.link/${newLeaf.refCode} · share in your bio`,
      duration: 2400,
    });
  }, [pulseFor]);

  const triggerClose = useCallback(() => {
    setSelected(null);
    setMode("cascading");
    window.setTimeout(() => setMode("closed"), CASCADE_MS);
  }, []);

  const replay = useCallback(() => {
    setNodes(initialNodes);
    setMode("live");
    setPublish(EMPTY_PUBLISH);
    setTab("inspect");
    setSelected(null);
    agentIndex.current = 0;
    teammateIndex.current = 0;
  }, [initialNodes]);

  /* ---------- publish flow ---------- */

  /** Determine which step is waiting for a click on the tree. */
  const activeStep: PublishStep | null = useMemo(() => {
    if (publish.refCode) return null;
    if (!publish.hookId) return "hook";
    if (!publish.audioId) return "audio";
    if (!publish.visualId) return "visual";
    return null;
  }, [publish]);

  /** Set of node IDs the user can click while publishing. */
  const selectableNodeIds = useMemo(() => {
    if (tab !== "publish" || activeStep === null) return undefined;
    if (activeStep === "hook") {
      return new Set(nodes.filter((n) => n.level === 1).map((n) => n.id));
    }
    if (activeStep === "audio") {
      return new Set(
        nodes
          .filter((n) => n.level === 2 && n.parentId === publish.hookId)
          .map((n) => n.id)
      );
    }
    return new Set(
      nodes
        .filter((n) => n.level === 3 && n.parentId === publish.audioId)
        .map((n) => n.id)
    );
  }, [tab, activeStep, nodes, publish.hookId, publish.audioId]);

  /** Already-locked nodes in the publish flow — they get a confirmed look. */
  const highlightedNodeIds = useMemo(() => {
    if (tab !== "publish") return undefined;
    const ids = new Set<string>();
    if (publish.hookId) ids.add(publish.hookId);
    if (publish.audioId) ids.add(publish.audioId);
    if (publish.visualId) ids.add(publish.visualId);
    return ids;
  }, [tab, publish]);

  /** Tree click handler — branches based on the current tab. */
  const handleTreeClick = useCallback(
    (node: TreeNode | null) => {
      if (tab === "publish" && node && activeStep) {
        if (activeStep === "hook" && node.level === 1) {
          setPublish((p) => ({ ...p, hookId: node.id }));
          return;
        }
        if (
          activeStep === "audio" &&
          node.level === 2 &&
          node.parentId === publish.hookId
        ) {
          setPublish((p) => ({ ...p, audioId: node.id }));
          return;
        }
        if (
          activeStep === "visual" &&
          node.level === 3 &&
          node.parentId === publish.audioId
        ) {
          setPublish((p) => ({ ...p, visualId: node.id }));
          return;
        }
        return;
      }
      // Other tabs: regular inspect behavior. Auto-switch to inspect if user
      // clicks a node from agent or my-leaves tab so they see context.
      setSelected(node);
      if (node && tab !== "inspect") setTab("inspect");
    },
    [tab, activeStep, publish.hookId, publish.audioId]
  );

  /** Clear a step + every step after it. */
  const clearPublishStep = useCallback((step: PublishStep) => {
    setPublish((p) => ({
      ...p,
      hookId: step === "hook" ? null : p.hookId,
      audioId: step === "hook" || step === "audio" ? null : p.audioId,
      visualId: null,
      refCode: null,
    }));
  }, []);

  /** Draft → on-chain create_leaf → finalize. Adds the leaf to the live tree. */
  const finalizePublish = useCallback(async () => {
    if (!publish.hookId || !publish.audioId || !publish.visualId) return;
    if (!program || !publicKey) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!campaignOnchainPda) {
      toast.error(
        "Campaign isn't finalized on-chain yet — wait for the brand's tx."
      );
      return;
    }

    const hook = nodes.find((n) => n.id === publish.hookId);
    const audio = nodes.find((n) => n.id === publish.audioId);
    const visual = nodes.find((n) => n.id === publish.visualId);
    if (!hook?.onchainPda || !audio?.onchainPda || !visual?.onchainPda) {
      toast.error(
        "Pick a path of finalized nodes — at least one leg is still pending."
      );
      return;
    }

    try {
      // 1) Reserve a ref_code + persist the leaf draft.
      const draftResp = await postLeafDraft({
        campaignId,
        path: [hook.id, audio.id, visual.id],
        creatorWallet: publicKey.toBase58(),
        platform: "other",
        stakeSol: 0.001,
      });
      const { leaf: draftLeaf, reservation } = draftResp;
      const refCode = reservation.refCode;

      // 2) Sign + send create_leaf with the reserved ref_code.
      const { leafPda, signature } = await createLeafOnchain(program, {
        campaign: new PublicKey(campaignOnchainPda),
        creator: publicKey,
        nodeL1: new PublicKey(hook.onchainPda),
        nodeL2: new PublicKey(audio.onchainPda),
        nodeL3: new PublicKey(visual.onchainPda),
        refCode,
        metadata: { contentUrl: null, platform: "other" },
        metadataCuid: draftLeaf.id,
      });

      // 3) Finalize the api row + consume the ref_code reservation.
      await postLeafFinalize({
        draftId: draftLeaf.id,
        refCode,
        onchainPda: leafPda.toBase58(),
      });

      // 4) UI state — leaf appears under the picked visual node.
      const localLeaf: TreeNode = {
        id: draftLeaf.id,
        level: 4,
        parentId: publish.visualId,
        title: "Your published post",
        description: `tx ${signature.slice(0, 8)}…${signature.slice(-4)}`,
        author: "human",
        authorHandle: "you",
        stakeSol: 0.001,
        forks: 0,
        conversions: 0,
        payoutUsdc: 0,
        refCode,
        onchainPda: leafPda.toBase58(),
      };
      setNodes((prev) => [...prev, localLeaf]);
      pulseFor([localLeaf.id]);
      setPublish((p) => ({ ...p, refCode }));
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      toast.success("Post published — ref-link is live", {
        description: `hivework.link/${refCode}`,
        duration: 2600,
      });
    } catch (err) {
      console.error("createLeaf failed", err);
      toast.error("Couldn't publish post", {
        description:
          err instanceof Error ? err.message : "Unknown error — see console.",
      });
    }
  }, [
    publish,
    pulseFor,
    program,
    publicKey,
    campaignOnchainPda,
    campaignId,
    nodes,
    queryClient,
  ]);

  const resetPublish = useCallback(() => {
    setPublish(EMPTY_PUBLISH);
  }, []);

  /** Plug an agent suggestion straight into the publish state + switch tabs. */
  const acceptAgentPath = useCallback((path: PathSuggestion) => {
    setPublish({
      hookId: path.hookId,
      audioId: path.audioId,
      visualId: path.visualId,
      refCode: null,
    });
    setTab("publish");
    toast.success("Path locked from agent — review & publish", {
      duration: 2200,
    });
  }, []);

  /* ---------- inline add-node modal ---------- */

  /** Insert a freshly-created child into the tree + light it up. */
  const handleNodeCreated = useCallback(
    (newNode: TreeNode) => {
      setNodes((prev) => [...prev, newNode]);
      pulseFor([newNode.id]);
      // Bump up the parent's fork count locally so the canvas reflects it.
      if (newNode.parentId) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === newNode.parentId ? { ...n, forks: n.forks + 1 } : n
          )
        );
      }
      // Auto-select the new node so the inspect panel shows it.
      setSelected(newNode);
    },
    [pulseFor]
  );

  /** Walk parents up to L1 to lock the path when user wants to publish from L3. */
  const switchToPublishFromL3 = useCallback(
    (parentL3: TreeNode) => {
      const audio = nodes.find((n) => n.id === parentL3.parentId);
      const hook = audio
        ? nodes.find((n) => n.id === audio.parentId)
        : undefined;
      if (!hook || !audio) return;
      setPublish({
        hookId: hook.id,
        audioId: audio.id,
        visualId: parentL3.id,
        refCode: null,
      });
      setTab("publish");
    },
    [nodes]
  );

  /* ---------- render ---------- */

  const isCascading = mode === "cascading";
  const isClosed = mode === "closed";
  const demoDisabled = isCascading || isClosed;

  return (
    <div className="flex flex-col gap-3">
      {/* Action bar — left side is just a hint (clicking a node in the tree
          is the canonical add-child action, including the campaign root for
          L1 hooks). Right side carries status + close CTA. */}
      <div className="flex min-h-[28px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {mode === "live" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Click any node to grow under it
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {mode === "cascading" && (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] text-honey">
              <Loader2 className="h-3 w-3 animate-spin" />
              distributing payouts on-chain…
            </span>
          )}
          {mode === "closed" && (
            <span className="font-mono text-[11px] text-muted">
              closed · pool fully distributed
            </span>
          )}
          {mode === "live" && (
            <Button
              variant="sting"
              size="sm"
              onClick={triggerClose}
              title="Trigger the close + distribute cascade"
            >
              <Coins className="h-4 w-4" />
              Close &amp; distribute
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-3">
          <Card className="overflow-hidden p-0">
            <TreeGraph
              data={graph}
              selectedNodeId={selected?.id ?? null}
              onSelect={isCascading || isClosed ? () => {} : handleTreeClick}
              pulsingNodeIds={pulsing}
              cascadeMode={isCascading || isClosed}
              selectableNodeIds={selectableNodeIds}
              highlightedNodeIds={highlightedNodeIds}
            />
          </Card>
          <TreeLegend />
        </div>

        {/* Side column */}
        <div className="flex h-full flex-col gap-3">
          {mode === "live" && (
            <>
              <TabBar tab={tab} onTabChange={setTab} />
              <div className="flex-1">
                {tab === "inspect" &&
                  (selected ? (
                    <NodeDetailPanel
                      node={selected}
                      onClose={() => setSelected(null)}
                      onHighlightPath={highlightPath}
                      onAddChild={(parent) => setAddUnder(parent)}
                    />
                  ) : (
                    <EmptyInspect />
                  ))}
                {tab === "publish" && (
                  <PublishFlowPanel
                    state={publish}
                    activeStep={activeStep}
                    onClearStep={clearPublishStep}
                    onPublish={finalizePublish}
                    onReset={resetPublish}
                    nodes={nodes}
                  />
                )}
                {tab === "agent" && (
                  <AgentChatPanel
                    onAcceptPath={acceptAgentPath}
                    nodes={nodes}
                  />
                )}
                {tab === "my-leaves" && (
                  <MyLeavesPanel campaignId={campaignId} />
                )}
              </div>
            </>
          )}

          {mode === "cascading" && (
            <aside className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-honey/40 bg-honey/5 p-6 text-center">
              <div className="flex items-center gap-2 text-honey">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">
                  close_and_distribute() running
                </span>
              </div>
              <p className="text-xs leading-relaxed text-fg-soft">
                The contract walks every conversion path, computes node weights
                with α/β/γ, and batches the USDC transfers. Watch the tree light
                up.
              </p>
              <code className="rounded bg-ink-2 px-2 py-1 font-mono text-[10px] text-fg-soft">
                cluster: devnet · slot: pending
              </code>
            </aside>
          )}

          {isClosed && <CascadeSummary nodes={nodes} onReset={replay} />}
        </div>
      </div>

      {/* Demo orchestration — only visible to the presenter (?demo=1 in URL).
          Hidden by default so it doesn't compete with the influencer UX. */}
      {demoMode && (
        <DemoControlPanel
          disabled={demoDisabled}
          onSpawnAgentNode={spawnAgentNode}
          onPublishLeaf={publishLeafFromDemoPool}
          onFireConversion={fireRandomConversion}
          onFireConversionBurst={fireConversionBurst}
          onClose={triggerClose}
          onReset={replay}
        />
      )}

      {/* Inline add-node modal. Mounted once; visibility driven by addUnder. */}
      <AddNodeDialog
        open={addUnder !== undefined}
        parent={addUnder ?? null}
        onOpenChange={(open) => {
          if (!open) setAddUnder(undefined);
        }}
        onCreate={handleNodeCreated}
        onSwitchToPublish={switchToPublishFromL3}
        campaignId={campaignId}
        campaignOnchainPda={campaignOnchainPda}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tab bar — sticky strip on top of the side column.
 * ------------------------------------------------------------------ */

function TabBar({
  tab,
  onTabChange,
}: {
  tab: PanelTab;
  onTabChange: (t: PanelTab) => void;
}) {
  return (
    <div
      className="grid grid-cols-4 overflow-hidden rounded-md border border-line bg-surface"
      role="tablist"
    >
      {TAB_DEFS.map((def) => {
        const Icon = def.icon;
        const active = def.id === tab;
        return (
          <button
            key={def.id}
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(def.id)}
            className={`relative inline-flex flex-col items-center justify-center gap-1 px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              active
                ? "bg-ink-2 text-honey"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{def.label}</span>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-px bg-honey"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyInspect() {
  return (
    <aside className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface/40 p-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-2">
        <Network className="h-4 w-4 text-muted" />
      </span>
      <div>
        <p className="text-sm font-medium">Click any node to grow the tree</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Inspect details, payouts and ref-links — or hit{" "}
          <span className="text-foreground">+ Add child here</span> to stake a
          new decision under it. Switch to{" "}
          <span className="text-honey">publish</span> to drop a post.
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
        drag · scroll · click
      </p>
    </aside>
  );
}
